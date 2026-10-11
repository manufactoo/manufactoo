package com.manufactoo.stations;

import com.manufactoo.apps.AppService;
import com.manufactoo.apps.TraceabilityGenealogyApp;
import com.manufactoo.common.Messages;
import com.manufactoo.stations.dto.BlockWorkOrderSessionRequest;
import com.manufactoo.stations.dto.DataSourceOption;
import com.manufactoo.stations.dto.SetSessionQtyRequest;
import com.manufactoo.stations.dto.StartWorkOrderSessionRequest;
import com.manufactoo.stations.dto.WorkCenterSessionDto;
import com.manufactoo.stations.dto.WorkOrderSessionDto;
import jakarta.transaction.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Sesion de trabajo Start/Pausar/Bloquear/Finalizar sobre un work order de
 * Odoo, a nivel de estacion -- el equivalente Manufactoo de los botones del
 * Shop Floor de Odoo (ver conversacion 2026-08-05). En esta fase (A) el
 * servicio solo toca la base de datos local, para poder probar la maquina de
 * estados de punta a punta antes de meter la escritura real en Odoo (fase B,
 * ver OdooShopFloorService) en el camino critico.
 * <p>
 * A lo sumo una sesion activa (state != DONE) por estacion a la vez -- lo
 * exige este servicio (findByStationIdAndStateNot), no una constraint de BD,
 * mismo criterio que MaterialLoadService con unloadedAt.
 */
@Service
public class WorkOrderSessionService {

    private static final String DONE = "DONE";

    private final WorkOrderSessionRepository repository;
    private final WorkOrderSessionEventRepository eventRepository;
    private final StationRepository stationRepository;
    private final DataSourceResolver dataSourceResolver;
    private final OdooShopFloorService odooShopFloorService;
    private final AppService appService;
    private final Messages messages;

    public WorkOrderSessionService(WorkOrderSessionRepository repository, WorkOrderSessionEventRepository eventRepository,
                                    StationRepository stationRepository, DataSourceResolver dataSourceResolver,
                                    OdooShopFloorService odooShopFloorService, AppService appService, Messages messages) {
        this.repository = repository;
        this.eventRepository = eventRepository;
        this.stationRepository = stationRepository;
        this.dataSourceResolver = dataSourceResolver;
        this.odooShopFloorService = odooShopFloorService;
        this.appService = appService;
        this.messages = messages;
    }

    /** La sesion activa de una estacion, si hay alguna (null si no hay ninguna en marcha). */
    public WorkOrderSessionDto getActive(Long stationId) {
        requireAppInstalled();
        return repository.findByStationIdAndStateNot(stationId, DONE).map(WorkOrderSessionService::toDto).orElse(null);
    }

    @Transactional
    public WorkOrderSessionDto start(Long stationId, StartWorkOrderSessionRequest request) {
        requireAppInstalled();
        if (stationRepository.findById(stationId).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, messages.get("station.notFound"));
        }
        if (repository.findByStationIdAndStateNot(stationId, DONE).isPresent()) {
            throw badRequest(messages.get("station.workOrderSession.alreadyActive"));
        }

        WorkOrderSession session = new WorkOrderSession();
        session.setStationId(stationId);
        session.setOdooWorkorderId(request.odooWorkorderId());
        session.setOdooWorkcenterId(request.odooWorkcenterId());
        session.setState("RUNNING");
        session.setStartedAt(Instant.now());
        applyOperator(session, request.operatorCode());

        // Odoo primero, estricto: si falla no se persiste nada localmente
        // (decision confirmada 2026-08-05 -- sin estado "pendiente de sync").
        odooShopFloorService.startWorkOrder(request.odooWorkorderId());

        repository.save(session);
        recordEvent(session, "START", null);
        return toDto(session);
    }

    @Transactional
    public WorkOrderSessionDto pause(Long stationId, Long sessionId) {
        WorkOrderSession session = activeSession(stationId, sessionId);
        requireState(session, "RUNNING");

        odooShopFloorService.pauseWorkOrder(session.getOdooWorkorderId());
        reattributeBestEffort(session);

        session.setState("PAUSED");
        repository.save(session);
        recordEvent(session, "PAUSE", null);
        return toDto(session);
    }

    @Transactional
    public WorkOrderSessionDto resume(Long stationId, Long sessionId, String operatorCode) {
        WorkOrderSession session = activeSession(stationId, sessionId);
        requireState(session, "PAUSED", "BLOCKED");
        applyOperator(session, operatorCode);

        // "Bloqueado" y "pausado" son dos cosas distintas en Odoo: un
        // bloqueo (motivo de perdida) hay que desbloquearlo explicitamente
        // antes de poder reabrir un tramo productivo con button_start (ver
        // investigacion 2026-08-05) -- reanudar desde pausa solo necesita lo
        // segundo.
        if ("BLOCKED".equals(session.getState())) {
            odooShopFloorService.unblockWorkOrder(session.getOdooWorkorderId());
        }
        odooShopFloorService.startWorkOrder(session.getOdooWorkorderId());

        session.setState("RUNNING");
        session.setBlockReasonOdooId(null);
        session.setBlockReasonName(null);
        repository.save(session);
        recordEvent(session, "RESUME", null);
        return toDto(session);
    }

    @Transactional
    public WorkOrderSessionDto block(Long stationId, Long sessionId, BlockWorkOrderSessionRequest request) {
        WorkOrderSession session = activeSession(stationId, sessionId);
        requireState(session, "RUNNING", "PAUSED");

        if ("RUNNING".equals(session.getState())) {
            odooShopFloorService.pauseWorkOrder(session.getOdooWorkorderId());
            reattributeBestEffort(session);
        }
        odooShopFloorService.blockWorkOrder(session.getOdooWorkorderId(), session.getOdooWorkcenterId(), request.reasonId());

        session.setState("BLOCKED");
        session.setBlockReasonOdooId(request.reasonId());
        session.setBlockReasonName(request.reasonName());
        repository.save(session);
        recordEvent(session, "BLOCK", null);
        return toDto(session);
    }

    @Transactional
    public WorkOrderSessionDto setQty(Long stationId, Long sessionId, SetSessionQtyRequest request) {
        WorkOrderSession session = activeSession(stationId, sessionId);
        session.setQtyProducing(request.qty());
        repository.save(session);
        return toDto(session);
    }

    @Transactional
    public WorkOrderSessionDto finish(Long stationId, Long sessionId) {
        WorkOrderSession session = activeSession(stationId, sessionId);
        requireState(session, "RUNNING", "PAUSED");

        odooShopFloorService.finishWorkOrder(session.getOdooWorkorderId(), session.getQtyProducing());
        reattributeBestEffort(session);

        session.setState(DONE);
        session.setQtyProduced(session.getQtyProduced() + session.getQtyProducing());
        session.setFinishedAt(Instant.now());
        repository.save(session);
        recordEvent(session, "FINISH", null);
        return toDto(session);
    }

    /**
     * Reatribuye el tramo que se acaba de cerrar al operario real -- best
     * effort: si falla (p. ej. el operario no tiene usuario de Odoo, o un
     * fallo puntual de red en esta segunda llamada), NO bloquea la accion
     * principal -- el tiempo se queda igualmente contabilizado en Odoo, solo
     * que atribuido a la cuenta de integracion de Manufactoo en vez de al
     * operario. La accion principal (pausar/bloquear/finalizar) si es
     * estricta -- ver esos metodos.
     */
    private void reattributeBestEffort(WorkOrderSession session) {
        try {
            Long odooUserId = dataSourceResolver.resolveOperatorOdooUserId(session.getOperatorEmployeeId());
            odooShopFloorService.reattributeLastTimeLog(session.getOdooWorkorderId(), odooUserId);
        } catch (ResponseStatusException e) {
            // best effort, ver javadoc
        }
    }

    /**
     * Cuenta una unidad hacia la cantidad producida de la sesion activa de la
     * estacion, si hay alguna -- lo llama StationService.submitRecord tras
     * CUALQUIER envio valido (no solo si la estacion usa Ruta) con resultado
     * distinto de NG (ver conversacion 2026-08-05: antes "unidad producida"
     * solo se movia si el operario lo tecleaba a mano en el widget de Work
     * Order, sin relacion con lo que de verdad paso por la estacion). Sin
     * efecto si no hay sesion activa -- no todas las estaciones tienen Work
     * Order. No es una accion del operario (no genera WorkOrderSessionEvent,
     * mismo criterio que setQty), y no escribe en Odoo en el momento -- se
     * envia como parte del qty_producing normal cuando se finalice la sesion.
     */
    @Transactional
    void incrementQtyForStation(Long stationId) {
        repository.findByStationIdAndStateNot(stationId, DONE).ifPresent(session -> {
            session.setQtyProducing(session.getQtyProducing() + 1);
            repository.save(session);
        });
    }

    /** Sesiones activas ahora mismo en TODA la instalacion, para el panel cruzado de Work Centers. */
    public List<WorkCenterSessionDto> listAllActive() {
        requireAppInstalled();
        Map<Long, String> stationNames = new LinkedHashMap<>();
        stationRepository.findAll().forEach(s -> stationNames.put(s.getId(), s.getName()));
        return repository.findByStateNotOrderByUpdatedAtDesc(DONE).stream()
                .map(s -> new WorkCenterSessionDto(s.getId(), s.getStationId(),
                        stationNames.getOrDefault(s.getStationId(), String.valueOf(s.getStationId())),
                        s.getOdooWorkorderId(), s.getOdooWorkcenterId(), s.getState(),
                        s.getOperatorEmployeeId(), s.getOperatorName(), s.getQtyProducing(), s.getQtyProduced(),
                        s.getBlockReasonOdooId(), s.getBlockReasonName(), s.getStartedAt(), s.getFinishedAt()))
                .toList();
    }

    /** Resuelve el codigo de barras escaneado del operario contra ODOO_OPERATORS -- opcional, no falla si no se encuentra. */
    private void applyOperator(WorkOrderSession session, String operatorCode) {
        if (operatorCode == null || operatorCode.isBlank()) {
            return;
        }
        dataSourceResolver.lookup(DataSourceType.ODOO_OPERATORS, "barcode", operatorCode, null)
                .ifPresent(op -> {
                    session.setOperatorEmployeeId(parseLongOrNull(op.value()));
                    session.setOperatorName(op.label());
                });
    }

    private static Long parseLongOrNull(String value) {
        try {
            return value == null ? null : Long.valueOf(value);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private WorkOrderSession activeSession(Long stationId, Long sessionId) {
        requireAppInstalled();
        WorkOrderSession session = repository.findById(sessionId)
                .filter(s -> s.getStationId().equals(stationId))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, messages.get("station.workOrderSession.notFound")));
        if (DONE.equals(session.getState())) {
            throw badRequest(messages.get("station.workOrderSession.alreadyDone"));
        }
        return session;
    }

    private void requireState(WorkOrderSession session, String... allowed) {
        for (String state : allowed) {
            if (state.equals(session.getState())) {
                return;
            }
        }
        throw badRequest(messages.get("station.workOrderSession.invalidState", session.getState()));
    }

    private void recordEvent(WorkOrderSession session, String eventType, Long odooProductivityLogId) {
        WorkOrderSessionEvent event = new WorkOrderSessionEvent();
        event.setSessionId(session.getId());
        event.setEventType(eventType);
        event.setOperatorEmployeeId(session.getOperatorEmployeeId());
        event.setOperatorName(session.getOperatorName());
        event.setBlockReasonOdooId(session.getBlockReasonOdooId());
        event.setBlockReasonName(session.getBlockReasonName());
        event.setQtyProducing(session.getQtyProducing());
        event.setOdooProductivityLogId(odooProductivityLogId);
        eventRepository.save(event);
    }

    private static WorkOrderSessionDto toDto(WorkOrderSession s) {
        return new WorkOrderSessionDto(s.getId(), s.getStationId(), s.getOdooWorkorderId(), s.getOdooWorkcenterId(),
                s.getState(), s.getOperatorEmployeeId(), s.getOperatorName(), s.getQtyProducing(), s.getQtyProduced(),
                s.getBlockReasonOdooId(), s.getBlockReasonName(), s.getStartedAt(), s.getFinishedAt());
    }

    private static ResponseStatusException badRequest(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }

    private void requireAppInstalled() {
        if (!appService.isInstalled(TraceabilityGenealogyApp.KEY)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, messages.get("station.appNotInstalled"));
        }
    }
}

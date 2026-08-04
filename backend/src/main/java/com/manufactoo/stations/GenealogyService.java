package com.manufactoo.stations;

import com.manufactoo.apps.AppService;
import com.manufactoo.apps.TraceabilityGenealogyApp;
import com.manufactoo.common.Messages;
import com.manufactoo.stations.dto.GenealogyRecentPageDto;
import com.manufactoo.stations.dto.GenealogySearchResultDto;
import com.manufactoo.stations.dto.GenealogyStepDto;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Genealogia: dado un codigo (lote/serie de Odoo), busca en las DOS
 * direcciones posibles a la vez -- como identificador de una unidad
 * fabricada (recorrido hacia adelante, usando la foto congelada
 * StationTraceRecord.routeIdentifierKeys) y como material consumido en
 * alguna estacion (recall hacia atras, via TraceRecordMaterial). Un mismo
 * stock.lot puede ser ambas cosas a la vez -- p. ej. un subensamblaje: su
 * propio serial es una unidad producida en su estacion de origen, y tambien
 * un material consumido en la estacion que lo integra en un conjunto mayor
 * -- por eso no se le pide al usuario elegir de antemano cual de las dos
 * cosas es (ver conversacion 2026-07-31).
 */
@Service
public class GenealogyService {

    private final StationTraceRecordRepository traceRepository;
    private final StationRepository stationRepository;
    private final StationMaterialLoadRepository materialLoadRepository;
    private final TraceRecordMaterialRepository traceRecordMaterialRepository;
    private final DataSourceResolver dataSourceResolver;
    private final AppService appService;
    private final Messages messages;

    public GenealogyService(StationTraceRecordRepository traceRepository, StationRepository stationRepository,
                             StationMaterialLoadRepository materialLoadRepository,
                             TraceRecordMaterialRepository traceRecordMaterialRepository,
                             DataSourceResolver dataSourceResolver, AppService appService, Messages messages) {
        this.traceRepository = traceRepository;
        this.stationRepository = stationRepository;
        this.materialLoadRepository = materialLoadRepository;
        this.traceRecordMaterialRepository = traceRecordMaterialRepository;
        this.dataSourceResolver = dataSourceResolver;
        this.appService = appService;
        this.messages = messages;
    }

    /**
     * Pagina de los registros de trazabilidad mas recientes de TODA la app
     * (cualquier estacion), mas recientes primero -- para poder explorar la
     * genealogia sin tener que saber ya un codigo de antemano (ver
     * conversacion 2026-08-02). page es 0-based; size se acota a [1,100] para
     * que un valor absurdo no dispare una consulta desproporcionada.
     */
    public GenealogyRecentPageDto listRecent(int page, int size) {
        requireAppInstalled();
        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(size, 1), 100);
        Map<Long, String> stationNames = stationNames();
        Page<StationTraceRecord> result = traceRepository.findAllByOrderByCreatedAtDesc(PageRequest.of(safePage, safeSize));
        List<GenealogyStepDto> items = result.getContent().stream().map(r -> toStepDto(r, stationNames)).toList();
        return new GenealogyRecentPageDto(items, safePage, safeSize, result.getTotalElements());
    }

    /** Busca un codigo y devuelve su recorrido en ambas direcciones a la vez. */
    public GenealogySearchResultDto searchByCode(String code) {
        requireAppInstalled();
        DataSourceResolver.SerialLookupResult resolved = dataSourceResolver.lookupSerial(code)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        messages.get("station.dataSource.invalidCode", code, code)));

        Map<Long, String> stationNames = stationNames();
        return new GenealogySearchResultDto(
                searchAsUnit(resolved.value(), stationNames),
                searchAsMaterial(resolved.value(), stationNames));
    }

    /** Recorrido hacia adelante: pasos de la unidad que tiene ESTE valor como identificador de ruta, en cualquiera de sus campos. */
    private List<GenealogyStepDto> searchAsUnit(String value, Map<Long, String> stationNames) {
        return traceRepository.findAll().stream()
                .filter(r -> r.getRouteIdentifierKeys().stream()
                        .anyMatch(key -> value.equals(String.valueOf(r.getCapturedData().get(key)))))
                .sorted(Comparator.comparing(StationTraceRecord::getCreatedAt))
                .map(r -> toStepDto(r, stationNames))
                .toList();
    }

    /** Recall hacia atras: unidades que llevaron ESTE valor como material consumido, en cualquier estacion. */
    private List<GenealogyStepDto> searchAsMaterial(String value, Map<Long, String> stationNames) {
        List<Long> loadIds = materialLoadRepository.findByValue(value).stream()
                .map(StationMaterialLoad::getId)
                .toList();
        if (loadIds.isEmpty()) {
            return List.of();
        }

        Set<Long> recordIds = loadIds.stream()
                .flatMap(loadId -> traceRecordMaterialRepository.findByMaterialLoadId(loadId).stream())
                .map(TraceRecordMaterial::getTraceRecordId)
                .collect(Collectors.toSet());

        return recordIds.stream()
                .map(traceRepository::findById)
                .flatMap(Optional::stream)
                .sorted(Comparator.comparing(StationTraceRecord::getCreatedAt))
                .map(r -> toStepDto(r, stationNames))
                .toList();
    }

    private GenealogyStepDto toStepDto(StationTraceRecord r, Map<Long, String> stationNames) {
        return new GenealogyStepDto(r.getId(), r.getStationId(),
                stationNames.getOrDefault(r.getStationId(), String.valueOf(r.getStationId())),
                r.getCreatedAt(), r.getCapturedData(), identifierValue(r));
    }

    /**
     * El codigo humano-legible de su identificador de ruta en el momento de
     * guardarse, o null si no tenia ninguno aplicado. Prefiere SIEMPRE
     * "<key>__label" sobre "<key>" -- para un identificador capturado por un
     * DROPDOWN, el valor crudo es el id interno de Odoo (p. ej. "5"), no un
     * codigo real de Odoo, y buscarByCode con ese id fallaria (lookupSerial
     * espera el codigo, no el id). "__label" es siempre el texto legible ya
     * resuelto (p. ej. "0000005"), el mismo dato que un TEXT_INPUT valida
     * directamente sin desplegable -- valido en ambos casos para reutilizarlo
     * como codigo de busqueda con un clic (ver GenealogyPage "recientes").
     */
    private String identifierValue(StationTraceRecord r) {
        return r.getRouteIdentifierKeys().stream()
                .map(key -> {
                    Object label = r.getCapturedData().get(key + "__label");
                    return label != null ? label : r.getCapturedData().get(key);
                })
                .filter(v -> v != null && !String.valueOf(v).isBlank())
                .map(String::valueOf)
                .findFirst()
                .orElse(null);
    }

    private Map<Long, String> stationNames() {
        Map<Long, String> names = new LinkedHashMap<>();
        stationRepository.findAll().forEach(s -> names.put(s.getId(), s.getName()));
        return names;
    }

    private void requireAppInstalled() {
        if (!appService.isInstalled(TraceabilityGenealogyApp.KEY)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, messages.get("station.appNotInstalled"));
        }
    }
}

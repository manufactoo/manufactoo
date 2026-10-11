package com.manufactoo.stations;

import com.manufactoo.common.Messages;
import com.manufactoo.crypto.CryptoService;
import com.manufactoo.odoo.OdooConnection;
import com.manufactoo.odoo.OdooConnectionRepository;
import com.manufactoo.odoo.connector.OdooConnector;
import com.manufactoo.odoo.connector.OdooConnectorFactory;
import com.manufactoo.odoo.connector.OdooJsonRpcException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;

/**
 * Escritura REAL en Odoo de las acciones Start/Pausar/Bloquear/Finalizar del
 * WorkOrderSessionService, sobre mrp.workorder y mrp.workcenter.productivity
 * -- las mismas llamadas que probamos en vivo contra Odoo real (ver
 * conversacion 2026-08-05). Manufactoo nunca replica el work order, solo
 * escribe en el via estas llamadas; el estado/tiempos que ve el propio Odoo
 * (Manufacturing > Work Orders, el informe de OEE) son reales, no una copia.
 * <p>
 * Cada metodo hace su propia conexion+autenticacion contra Odoo (mismo
 * patron que MasterDataService.list -- este proyecto no tiene una sesion
 * Odoo compartida entre servicios, cada uno se conecta por su cuenta).
 */
@Service
public class OdooShopFloorService {

    private static final DateTimeFormatter ODOO_DATETIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss").withZone(ZoneOffset.UTC);

    private final OdooConnectionRepository odooConnectionRepository;
    private final CryptoService cryptoService;
    private final OdooConnectorFactory connectorFactory;
    private final Messages messages;

    public OdooShopFloorService(OdooConnectionRepository odooConnectionRepository, CryptoService cryptoService,
                                 OdooConnectorFactory connectorFactory, Messages messages) {
        this.odooConnectionRepository = odooConnectionRepository;
        this.cryptoService = cryptoService;
        this.connectorFactory = connectorFactory;
        this.messages = messages;
    }

    /** mrp.workorder.button_start -- abre un tramo de tiempo "productive" y pone el work order en progreso. Se reutiliza tal cual para "reanudar" (Odoo no distingue las dos acciones, ver investigacion 2026-08-05). */
    public void startWorkOrder(Long odooWorkorderId) {
        Session s = connect();
        call(s, "mrp.workorder", "button_start", List.of(List.of(odooWorkorderId)), Map.of());
    }

    /** mrp.workorder.button_pending -- cierra el tramo de tiempo abierto, el work order sigue "en progreso" pero sin nadie trabajando ahora mismo. */
    public void pauseWorkOrder(Long odooWorkorderId) {
        Session s = connect();
        call(s, "mrp.workorder", "button_pending", List.of(List.of(odooWorkorderId)), Map.of());
    }

    /** Escribe la cantidad y llama a button_finish -- cierra el work order, mueve qty_producing a qty_produced y desbloquea el siguiente work order de la secuencia (comprobado en vivo). */
    public void finishWorkOrder(Long odooWorkorderId, double qty) {
        Session s = connect();
        call(s, "mrp.workorder", "write", List.of(List.of(odooWorkorderId), Map.of("qty_producing", qty)), Map.of());
        call(s, "mrp.workorder", "button_finish", List.of(List.of(odooWorkorderId)), Map.of());
    }

    /**
     * Crea un tramo de tiempo de PERDIDA (no productivo) para bloquear el work
     * order con un motivo -- NO existe un "button_block" en Odoo (comprobado
     * en vivo); el bloqueo real es crear directamente el registro de
     * mrp.workcenter.productivity con loss_id (sin loss_type: se deriva solo
     * de loss_id, escribirlo a mano da un error de permisos -- ver
     * investigacion 2026-08-05).
     */
    public void blockWorkOrder(Long odooWorkorderId, Long odooWorkcenterId, Long lossReasonId) {
        Session s = connect();
        call(s, "mrp.workcenter.productivity", "create", List.of(Map.of(
                "workorder_id", odooWorkorderId,
                "workcenter_id", odooWorkcenterId,
                "loss_id", lossReasonId,
                "date_start", ODOO_DATETIME.format(Instant.now())
        )), Map.of());
    }

    /** mrp.workorder.button_unblock -- encuentra y cierra el tramo de perdida abierto por blockWorkOrder. */
    public void unblockWorkOrder(Long odooWorkorderId) {
        Session s = connect();
        call(s, "mrp.workorder", "button_unblock", List.of(List.of(odooWorkorderId)), Map.of());
    }

    /**
     * Reatribuye el tramo de tiempo mas reciente YA CERRADO de este work
     * order al operario real -- se llama SIEMPRE despues de cerrar el tramo
     * (pauseWorkOrder/finishWorkOrder/unblockWorkOrder), nunca antes:
     * reasignar un tramo todavia abierto rompe el estado interno de Odoo
     * para la cuenta que llama (button_pending/button_finish dejan de
     * reconocerlo como "su" tramo activo -- ver investigacion 2026-08-05).
     * No hace nada si el operario no tiene usuario de Odoo enlazado (queda
     * atribuido a la cuenta de integracion de Manufactoo).
     */
    @SuppressWarnings("unchecked")
    public void reattributeLastTimeLog(Long odooWorkorderId, Long odooUserId) {
        if (odooUserId == null) {
            return;
        }
        Session s = connect();
        Object result = call(s, "mrp.workcenter.productivity", "search_read", List.of(
                List.of(List.of("workorder_id", "=", odooWorkorderId), List.of("date_end", "!=", false))
        ), Map.of("fields", List.of("id"), "order", "date_end desc", "limit", 1));
        List<Map<String, Object>> rows = (List<Map<String, Object>>) result;
        if (rows.isEmpty()) {
            return;
        }
        Object logId = rows.get(0).get("id");
        call(s, "mrp.workcenter.productivity", "write", List.of(List.of(logId), Map.of("user_id", odooUserId)), Map.of());
    }

    private Object call(Session session, String model, String method, List<Object> args, Map<String, Object> kwargs) {
        try {
            return session.connector().callMethod(session.database(), session.uid(), session.apiKeyOrPassword(), model, method, args, kwargs);
        } catch (OdooJsonRpcException e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, messages.get("station.workOrderSession.odooWriteFailed", e.getMessage()));
        }
    }

    private Session connect() {
        OdooConnection connection = odooConnectionRepository.findAll().stream().findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, messages.get("masterData.noConnection")));
        String apiKeyOrPassword = cryptoService.decrypt(connection.getApiKeyEncrypted());
        OdooConnector connector;
        Integer uid;
        try {
            connector = connectorFactory.connect(connection.getHost(), connection.getPort());
            uid = connector.authenticate(connection.getDatabase(), connection.getUsername(), apiKeyOrPassword);
        } catch (OdooJsonRpcException e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, messages.get("masterData.connectionFailed", e.getMessage()));
        }
        if (uid == null) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, messages.get("masterData.authFailed"));
        }
        return new Session(connector, uid, connection.getDatabase(), apiKeyOrPassword);
    }

    private record Session(OdooConnector connector, int uid, String database, String apiKeyOrPassword) {
    }
}

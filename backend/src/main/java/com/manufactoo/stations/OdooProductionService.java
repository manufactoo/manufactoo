package com.manufactoo.stations;

import com.manufactoo.common.Messages;
import com.manufactoo.crypto.CryptoService;
import com.manufactoo.odoo.OdooConnection;
import com.manufactoo.odoo.OdooConnectionRepository;
import com.manufactoo.odoo.connector.OdooConnector;
import com.manufactoo.odoo.connector.OdooConnectorFactory;
import com.manufactoo.odoo.connector.OdooJsonRpcException;
import com.manufactoo.stations.dto.OpenManufacturingOrderDto;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

/**
 * Escritura REAL en Odoo del consumo/produccion de una orden de fabricacion
 * (mrp.production), unidad a unidad, SIN backorders -- investigado y probado
 * en vivo contra Odoo real antes de escribir esto (ver conversacion
 * 2026-08-06). El mecanismo: escribir directamente en el movimiento de
 * materia prima (stock.move.quantity + picked=true) es EXACTAMENTE lo mismo
 * que hace el propio formulario de Odoo cuando editas la columna "Consumido"
 * de la tabla de componentes sin pulsar "Producir" -- mueve stock real de
 * inmediato y la MO pasa sola a estado "In Progress", sin backorder ni
 * cerrarse. Solo en la ULTIMA unidad (qty_producing llega a igualar
 * product_qty) se llama button_mark_done, que entonces completa limpio
 * porque ya coincide exactamente con lo planeado -- Odoo no pide backorder
 * cuando lo producido no es "menos que la demanda inicial".
 * <p>
 * No se duplica mrp.production en Manufactoo: se lee/escribe en vivo cada
 * vez, igual que OdooShopFloorService con los work orders. Misma politica de
 * escritura estricta: si Odoo falla en cualquier paso, se propaga como
 * ResponseStatusException y StationService no guarda nada localmente (ver
 * submitRecord).
 */
@Service
public class OdooProductionService {

    private final OdooConnectionRepository odooConnectionRepository;
    private final CryptoService cryptoService;
    private final OdooConnectorFactory connectorFactory;
    private final Messages messages;

    public OdooProductionService(OdooConnectionRepository odooConnectionRepository, CryptoService cryptoService,
                                  OdooConnectorFactory connectorFactory, Messages messages) {
        this.odooConnectionRepository = odooConnectionRepository;
        this.cryptoService = cryptoService;
        this.connectorFactory = connectorFactory;
        this.messages = messages;
    }

    /**
     * Registra una unidad mas producida en la MO indicada. lotCode puede venir
     * null/vacio -- si el producto de la MO no lleva seguimiento por lote/serie
     * en Odoo (product.tracking = "none"), no hay ningun lote que elegir y no
     * se exige ninguno (ver conversacion 2026-08-08: antes esto lo decidia
     * StationService a ciegas, sin saber si Odoo realmente necesitaba un lote,
     * asi que un producto sin tracking no podia producir NUNCA -- pedia un
     * identificador imposible de rellenar). Si el producto SI lleva tracking,
     * lotCode es obligatorio y el lote TIENE que existir ya en Odoo (lo crea
     * un tecnico o un Ajuste de inventario, nunca Manufactoo -- se probo
     * crearlo automaticamente cuando no existia y se revirtio el mismo dia,
     * ver conversacion 2026-08-09: un typo del operario no daba error, creaba
     * silenciosamente un lote fantasma nuevo en el maestro de Odoo). Ademas
     * tiene que pertenecer a ESE producto y, si ya esta vinculado como salida
     * de OTRA MO distinta a esta, se rechaza -- un lote representa una
     * hornada/tirada fisica concreta, no tiene sentido de negocio que
     * pertenezca a dos ordenes de fabricacion a la vez. Si esta es la ultima
     * unidad pendiente de la MO, la cierra (button_mark_done) sin backorder.
     * <p>
     * La proporcion de materia prima a consumir por unidad SIEMPRE se calcula
     * desde mrp.bom.line (dato maestro estable: cantidad de componente ÷
     * cantidad que produce la BOM), nunca desde stock.move.product_uom_qty --
     * comprobado en vivo que ese campo del movimiento es REACTIVO (cambia de
     * valor segun el progreso de produccion, no es la cantidad total fija del
     * pedido), asi que dividir entre product_qty ahi mismo daba una racion
     * incorrecta que crecia con cada unidad (ver conversacion 2026-08-06).
     */
    @SuppressWarnings("unchecked")
    public void recordUnit(Long moId, String lotCode) {
        Session s = connect();

        List<Map<String, Object>> moRows = (List<Map<String, Object>>) call(s, "mrp.production", "search_read",
                List.of(List.of(List.of("id", "=", moId))),
                Map.of("fields", List.of("display_name", "qty_producing", "product_qty", "bom_id", "product_id")));
        if (moRows.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, messages.get("station.production.moNotFound", moId));
        }
        Map<String, Object> mo = moRows.get(0);
        String moDisplayName = String.valueOf(mo.get("display_name"));
        double productQty = ((Number) mo.get("product_qty")).doubleValue();
        double qtyProducing = ((Number) mo.get("qty_producing")).doubleValue();
        if (qtyProducing >= productQty) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, messages.get("station.production.alreadyComplete", moId));
        }
        List<Object> bomRef = mo.get("bom_id") instanceof List<?> l && !l.isEmpty() ? (List<Object>) l : null;
        if (bomRef == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, messages.get("station.production.noBom", moId));
        }
        long bomId = ((Number) bomRef.get(0)).longValue();
        List<Object> moProductRef = mo.get("product_id") instanceof List<?> pl && !pl.isEmpty() ? (List<Object>) pl : null;
        long moProductId = moProductRef != null ? ((Number) moProductRef.get(0)).longValue() : -1;

        List<Map<String, Object>> productRows = (List<Map<String, Object>>) call(s, "product.product", "search_read",
                List.of(List.of(List.of("id", "=", moProductId))), Map.of("fields", List.of("tracking")));
        String tracking = !productRows.isEmpty() ? String.valueOf(productRows.get(0).get("tracking")) : "none";

        Long lotId = null;
        if (!"none".equals(tracking)) {
            if (lotCode == null || lotCode.isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, messages.get("station.production.missingIdentifier"));
            }
            List<Map<String, Object>> lotRows = (List<Map<String, Object>>) call(s, "stock.lot", "search_read",
                    List.of(List.of(List.of("name", "=", lotCode), List.of("product_id", "=", moProductId))),
                    Map.of("fields", List.of("id")));
            if (lotRows.isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, messages.get("station.production.lotNotFound", lotCode, moDisplayName));
            }
            lotId = ((Number) lotRows.get(0).get("id")).longValue();

            // Un lote sin usar todavia (lot_producing_ids vacio en cualquier MO)
            // es libre, lo reclama la primera MO que lo use -- pero si YA esta
            // vinculado como salida de OTRA MO, no se acepta aqui (ver
            // conversacion 2026-08-09: dos ordenes del mismo producto abiertas a
            // la vez dejaban colar el lote de una en la otra, porque antes solo
            // se comprobaba que el lote fuera del producto correcto, no de la MO
            // correcta).
            List<Map<String, Object>> conflictingMoRows = (List<Map<String, Object>>) call(s, "mrp.production", "search_read",
                    List.of(List.of(List.of("lot_producing_ids", "in", List.of(lotId)), List.of("id", "!=", moId))),
                    Map.of("fields", List.of("display_name")));
            if (!conflictingMoRows.isEmpty()) {
                String otherMoName = String.valueOf(conflictingMoRows.get(0).get("display_name"));
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        messages.get("station.production.lotBelongsToOtherMo", lotCode, otherMoName));
            }
        }

        List<Map<String, Object>> bomRows = (List<Map<String, Object>>) call(s, "mrp.bom", "search_read",
                List.of(List.of(List.of("id", "=", bomId))), Map.of("fields", List.of("product_qty")));
        double bomYield = ((Number) bomRows.get(0).get("product_qty")).doubleValue();

        List<Map<String, Object>> bomLines = (List<Map<String, Object>>) call(s, "mrp.bom.line", "search_read",
                List.of(List.of(List.of("bom_id", "=", bomId))), Map.of("fields", List.of("product_id", "product_qty")));
        Map<Long, Double> perUnitByProduct = new java.util.HashMap<>();
        for (Map<String, Object> line : bomLines) {
            List<Object> productRef = (List<Object>) line.get("product_id");
            long productId = ((Number) productRef.get(0)).longValue();
            double lineQty = ((Number) line.get("product_qty")).doubleValue();
            perUnitByProduct.put(productId, lineQty / bomYield);
        }

        // La cantidad se FIJA (no se suma) al total acumulado -- comprobado en
        // vivo que, una vez la MO reserva stock, stock.move.quantity ya viene
        // pre-rellenado por Odoo con la cantidad reservada (no arranca en 0),
        // asi que sumarle encima duplicaba lo consumido en cada unidad (ver
        // conversacion 2026-08-06). Calcular ratio*unidadesTotales de cero
        // cada vez es ademas mas robusto: no depende de cual fuera el valor
        // anterior del campo, venga de donde venga.
        double newQtyProducing = qtyProducing + 1;
        List<Map<String, Object>> moves = (List<Map<String, Object>>) call(s, "stock.move", "search_read",
                List.of(List.of(List.of("raw_material_production_id", "=", moId))),
                Map.of("fields", List.of("product_id")));
        for (Map<String, Object> move : moves) {
            List<Object> productRef = (List<Object>) move.get("product_id");
            long productId = ((Number) productRef.get(0)).longValue();
            Double perUnit = perUnitByProduct.get(productId);
            if (perUnit == null) {
                continue; // componente sin linea de BOM correspondiente (no deberia pasar) -- no se toca.
            }
            call(s, "stock.move", "write",
                    List.of(List.of(move.get("id")), Map.of("quantity", perUnit * newQtyProducing, "picked", true)), Map.of());
        }

        Map<String, Object> moWrite = lotId != null
                ? Map.of("qty_producing", newQtyProducing, "lot_producing_ids", List.of(List.of(6, 0, List.of(lotId))))
                : Map.of("qty_producing", newQtyProducing);
        call(s, "mrp.production", "write", List.of(List.of(moId), moWrite), Map.of());

        if (newQtyProducing >= productQty) {
            call(s, "mrp.production", "button_mark_done", List.of(List.of(moId)), Map.of());
        }
    }

    /**
     * Ordenes de fabricacion ABIERTAS (ni terminadas ni canceladas ni en
     * borrador -- confirmed/progress/to_close) para el grafico de
     * completitud del Dashboard (ver conversacion 2026-08-07). Filtro por
     * dominio directamente en Odoo (no trae todas y filtra en Java despues):
     * con muchas ordenes historicas "done" de por medio, un limite fijo
     * post-filtrado podria dejar fuera ordenes abiertas reales.
     * Completitud = qty_producing / product_qty (el progreso EN VIVO que ya
     * escribe recordUnit, no qty_produced que solo se fija al cerrar).
     */
    @SuppressWarnings("unchecked")
    public List<OpenManufacturingOrderDto> listOpenOrders() {
        Session s = connect();
        List<Map<String, Object>> rows = (List<Map<String, Object>>) call(s, "mrp.production", "search_read",
                List.of(List.of(List.of("state", "not in", List.of("draft", "done", "cancel")))),
                Map.of("fields", List.of("id", "display_name", "product_id", "product_qty", "qty_producing", "state"),
                        "order", "id desc", "limit", 50));

        return rows.stream().map(row -> {
            long id = ((Number) row.get("id")).longValue();
            String name = String.valueOf(row.get("display_name"));
            Object productRef = row.get("product_id");
            String productName = productRef instanceof List<?> p && p.size() > 1 ? String.valueOf(p.get(1)) : "";
            double productQty = ((Number) row.get("product_qty")).doubleValue();
            double qtyProducing = ((Number) row.get("qty_producing")).doubleValue();
            String state = String.valueOf(row.get("state"));
            double percent = productQty > 0 ? Math.min(100.0, (qtyProducing / productQty) * 100.0) : 0.0;
            return new OpenManufacturingOrderDto(id, name, productName, productQty, qtyProducing, percent, state);
        }).toList();
    }

    private Object call(Session session, String model, String method, List<Object> args, Map<String, Object> kwargs) {
        try {
            return session.connector().callMethod(session.database(), session.uid(), session.apiKeyOrPassword(), model, method, args, kwargs);
        } catch (OdooJsonRpcException e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, messages.get("station.production.odooWriteFailed", e.getMessage()));
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

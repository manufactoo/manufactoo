package com.manufactoo.stations;

import com.manufactoo.common.Messages;
import com.manufactoo.masterdata.MasterDataService;
import com.manufactoo.odoo.connector.OdooMasterDataEntity;
import com.manufactoo.routes.Route;
import com.manufactoo.routes.RouteService;
import com.manufactoo.routes.dto.RouteOperationSuggestionDto;
import com.manufactoo.stations.dto.DataSourceOption;
import com.manufactoo.stations.dto.DataSourceTableDto;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.Comparator;
import java.util.EnumMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * Resuelve un origen de datos ODOO_* a opciones {value,label} para un
 * desplegable, reutilizando MasterDataService (los datos se leen en vivo de
 * Odoo, nunca se replican). Este es el binding generico que en el proyecto de
 * referencia no existia: alli cada "producto"/"orden" era un tipo de widget
 * cableado; aqui un unico DROPDOWN elige su origen.
 */
@Service
public class DataSourceResolver {

    private final MasterDataService masterDataService;
    private final RouteService routeService;
    private final StationRepository stationRepository;
    private final Messages messages;

    public DataSourceResolver(MasterDataService masterDataService, RouteService routeService,
                              StationRepository stationRepository, Messages messages) {
        this.masterDataService = masterDataService;
        this.routeService = routeService;
        this.stationRepository = stationRepository;
        this.messages = messages;
    }

    public List<DataSourceOption> resolve(DataSourceType type, int limit) {
        return resolve(type, limit, null, null);
    }

    /**
     * Igual que resolve(type, limit), pero si se pasa stationId y el tipo es
     * ODOO_MANUFACTURING_ORDERS, limita las opciones a los productos de las
     * rutas HABILITADAS que incluyen esa estacion (config.filterByStationRoute
     * de un DROPDOWN, opcional -- ver StationBuilderPage.tsx). Si ninguna ruta
     * cubre la estacion, o alguna de las que la cubren no fija producto
     * ("cualquier producto"), no se filtra nada: fallar abierto (enseñar
     * todas) es mejor que dejar al operario sin ninguna orden que elegir por
     * una ruta a medio configurar.
     */
    public List<DataSourceOption> resolve(DataSourceType type, int limit, Long stationId) {
        return resolve(type, limit, stationId, null);
    }

    /**
     * Igual que resolve(type, limit, stationId), pero ademas admite operationId
     * para ODOO_WORKORDERS: si el widget se ha estrechado a una Operacion
     * concreta (config.operationId de un TABLE, ver StationBuilderPage.tsx),
     * solo se enseñan las workorders de esa operacion, en vez de todas las del
     * work center de la estacion.
     */
    public List<DataSourceOption> resolve(DataSourceType type, int limit, Long stationId, Long operationId) {
        OdooMasterDataEntity entity = odooEntity(type);
        List<Map<String, Object>> rows = masterDataService.list(entity, limit, 0);
        rows = filterByStationContext(type, rows, stationId, operationId);
        return rows.stream()
                .map(row -> new DataSourceOption(stringId(row.get("id")), label(row)))
                .toList();
    }

    /**
     * Aplica los filtros contextuales de estacion segun el tipo de dato:
     * ODOO_MANUFACTURING_ORDERS por rutas del producto, ODOO_WORKORDERS por
     * el Work Center de la estacion y, opcionalmente, por una Operacion
     * concreta. El resto de tipos no se filtran (stationId/operationId se
     * ignoran).
     */
    private List<Map<String, Object>> filterByStationContext(DataSourceType type, List<Map<String, Object>> rows,
                                                              Long stationId, Long operationId) {
        List<Map<String, Object>> result = rows;
        if (type == DataSourceType.ODOO_MANUFACTURING_ORDERS && stationId != null) {
            result = filterByRouteProducts(result, stationId);
        }
        if (type == DataSourceType.ODOO_WORKORDERS && stationId != null) {
            result = filterByStationWorkcenter(result, stationId);
        }
        if (type == DataSourceType.ODOO_WORKORDERS && operationId != null) {
            result = filterByOperation(result, operationId);
        }
        if (type == DataSourceType.ODOO_LOSS_REASONS) {
            result = filterManualLossReasons(result);
        }
        return result;
    }

    /** Solo los motivos que un operario puede elegir a mano (manual=true) -- el resto son de uso interno de Odoo, no tiene sentido ofrecerlos en el selector de bloqueo. */
    private List<Map<String, Object>> filterManualLossReasons(List<Map<String, Object>> rows) {
        return rows.stream().filter(row -> Boolean.TRUE.equals(row.get("manual"))).toList();
    }

    /**
     * Limita las workorders al Work Center de la estacion (Station.odooWorkcenterId,
     * ver conversacion 2026-08-04: la estacion guarda su Work Center, no una
     * Operacion concreta, porque un mismo Work Center puede repartirse entre
     * varias estaciones -- p. ej. una linea entera -- o una misma estacion
     * puede reutilizarse para varias operaciones del mismo Work Center -- p.
     * ej. amasado en dos tiempos). Si la estacion no tiene Work Center
     * asociado, no se filtra nada: fallar abierto, mismo criterio que
     * filterByRouteProducts.
     */
    private List<Map<String, Object>> filterByStationWorkcenter(List<Map<String, Object>> rows, Long stationId) {
        Long workcenterId = stationRepository.findById(stationId).map(Station::getOdooWorkcenterId).orElse(null);
        if (workcenterId == null) {
            return rows;
        }
        return rows.stream().filter(row -> workcenterId.equals(manyToOneId(row.get("workcenter_id")))).toList();
    }

    /** Estrecha las workorders a una Operacion concreta (config.operationId del widget) -- ver filterByStationWorkcenter. */
    private List<Map<String, Object>> filterByOperation(List<Map<String, Object>> rows, Long operationId) {
        return rows.stream().filter(row -> operationId.equals(manyToOneId(row.get("operation_id")))).toList();
    }

    private List<Map<String, Object>> filterByRouteProducts(List<Map<String, Object>> rows, Long stationId) {
        List<Route> routes = routeService.findEnabledRoutesForStation(stationId);
        if (routes.isEmpty()) {
            return rows;
        }
        Set<Long> allowedProductIds = new HashSet<>();
        for (Route route : routes) {
            if (route.getProductId() == null) {
                return rows;
            }
            allowedProductIds.add(route.getProductId());
        }
        return rows.stream().filter(row -> allowedProductIds.contains(productIdOf(row))).toList();
    }

    /** El many2one de Odoo llega como [id, "etiqueta"]; a veces ya viene solo el id. */
    private static Long productIdOf(Map<String, Object> row) {
        return manyToOneId(row.get("product_id"));
    }

    /** Extrae el id de un campo many2one de Odoo, venga como [id,"etiqueta"] o como id suelto. */
    private static Long manyToOneId(Object value) {
        if (value instanceof List<?> pair && !pair.isEmpty() && pair.get(0) instanceof Number n) {
            return n.longValue();
        }
        if (value instanceof Number n) {
            return n.longValue();
        }
        return null;
    }

    /**
     * Igual que resolve() pero devuelve filas completas + columnas, para el
     * widget TABLE (p. ej. una tabla enlazada a "ordenes" muestra todas las
     * ordenes con sus columnas). Las columnas reutilizan las etiquetas ya
     * traducidas de masterData.columns.* del frontend.
     */
    public DataSourceTableDto resolveTable(DataSourceType type, int limit) {
        return resolveTable(type, limit, null, null);
    }

    /** Igual que resolveTable(type, limit), pero filtrando por rutas de estacion como resolve() -- ver filterByRouteProducts. */
    public DataSourceTableDto resolveTable(DataSourceType type, int limit, Long stationId) {
        return resolveTable(type, limit, stationId, null);
    }

    /** Igual que resolveTable(type, limit, stationId), pero admite ademas operationId -- ver resolve(type, limit, stationId, operationId). */
    public DataSourceTableDto resolveTable(DataSourceType type, int limit, Long stationId, Long operationId) {
        OdooMasterDataEntity entity = odooEntity(type);
        List<DataSourceTableDto.Column> columns = displayColumnsFor(type).stream()
                .map(DataSourceTableDto.Column::of)
                .toList();
        List<Map<String, Object>> rows = masterDataService.list(entity, limit, 0);
        rows = filterByStationContext(type, rows, stationId, operationId);
        return new DataSourceTableDto(columns, rows);
    }

    /**
     * Operaciones (mrp.routing.workcenter) de un Work Center concreto, para el
     * selector "Estrechar a una operacion" del widget TABLE (config.operationId,
     * solo tiene sentido para ODOO_WORKORDERS). No es un DataSourceType elegible
     * por un widget -- es un catalogo auxiliar de configuracion, igual que
     * data-source-options pero sin pasar por WidgetCatalog.dataSourceTypes().
     * workcenterId null -> todas las operaciones de todos los Work Centers.
     */
    public List<DataSourceOption> resolveOperations(Long workcenterId) {
        List<Map<String, Object>> rows = masterDataService.list(OdooMasterDataEntity.OPERATION, 500, 0);
        if (workcenterId != null) {
            rows = rows.stream().filter(row -> workcenterId.equals(manyToOneId(row.get("workcenter_id")))).toList();
        }
        return rows.stream()
                .map(row -> new DataSourceOption(stringId(row.get("id")), label(row)))
                .toList();
    }

    /**
     * Operaciones de la ruta de Odoo de un producto (producto -> su BOM -> las
     * operaciones de ese BOM, en orden), para el atajo "Rellenar desde las
     * operaciones de Odoo" del formulario de Rutas (ver conversacion
     * 2026-08-04): el usuario elige el producto de la ruta y esto le propone
     * los pasos en vez de que los teclee a mano copiando lo que ya definio en
     * el routing de Odoo. Lista vacia si el producto no existe, no tiene BOM,
     * o su BOM no tiene operaciones -- el llamador (RouteController) lo trata
     * como "nada que proponer", no como error.
     */
    public List<RouteOperationSuggestionDto> resolveRouteOperations(Long productId) {
        Long templateId = masterDataService.list(OdooMasterDataEntity.PRODUCT, 500, 0).stream()
                .filter(row -> productId.equals(rowId(row)))
                .findFirst()
                .map(row -> manyToOneId(row.get("product_tmpl_id")))
                .orElse(null);
        if (templateId == null) {
            return List.of();
        }
        Long bomId = masterDataService.list(OdooMasterDataEntity.BOM, 500, 0).stream()
                .filter(row -> templateId.equals(manyToOneId(row.get("product_tmpl_id"))))
                .findFirst()
                .map(DataSourceResolver::rowId)
                .orElse(null);
        if (bomId == null) {
            return List.of();
        }
        return masterDataService.list(OdooMasterDataEntity.OPERATION, 500, 0).stream()
                .filter(row -> bomId.equals(manyToOneId(row.get("bom_id"))))
                .sorted(Comparator.comparingDouble(row -> ((Number) row.getOrDefault("sequence", 0)).doubleValue()))
                .map(row -> {
                    Object workcenter = row.get("workcenter_id");
                    Long workcenterId = manyToOneId(workcenter);
                    String workcenterName = workcenter instanceof List<?> pair && pair.size() > 1
                            ? String.valueOf(pair.get(1)) : null;
                    return new RouteOperationSuggestionDto(String.valueOf(row.get("name")), workcenterId, workcenterName);
                })
                .toList();
    }

    /** El id propio de una fila (no un many2one) -- viene siempre como numero suelto de Odoo. */
    private static Long rowId(Map<String, Object> row) {
        return row.get("id") instanceof Number n ? n.longValue() : null;
    }

    /**
     * El res.users (usuario de Odoo) enlazado a un hr.employee (por su id),
     * o null si ese operario no tiene ninguno enlazado -- usado por
     * OdooShopFloorService.reattributeLastTimeLog para atribuir el tiempo
     * trabajado al operario real en vez de a la cuenta de integracion de
     * Manufactoo (ver conversacion 2026-08-05).
     */
    public Long resolveOperatorOdooUserId(Long employeeId) {
        if (employeeId == null) {
            return null;
        }
        return masterDataService.list(OdooMasterDataEntity.OPERATOR, 500, 0).stream()
                .filter(row -> employeeId.equals(rowId(row)))
                .findFirst()
                .map(row -> manyToOneId(row.get("user_id")))
                .orElse(null);
    }

    /**
     * Columnas de Odoo disponibles para mostrar de un dato maestro (tabla, y
     * el detalle opcional de un TEXT_INPUT validado -- ver detailColumns en
     * ScreenWidget.config). Mismo conjunto que ya se mostraba en el widget
     * TABLE; aqui se reutiliza para que el diseñador elija cuales enseñar.
     */
    private static final Map<DataSourceType, List<String>> DISPLAY_COLUMNS = new EnumMap<>(DataSourceType.class);

    static {
        DISPLAY_COLUMNS.put(DataSourceType.ODOO_PRODUCTS, List.of("display_name", "default_code", "qty_available", "uom_id", "image_128"));
        DISPLAY_COLUMNS.put(DataSourceType.ODOO_MANUFACTURING_ORDERS, List.of("display_name", "product_qty", "qty_producing", "state", "date_start"));
        DISPLAY_COLUMNS.put(DataSourceType.ODOO_OPERATORS, List.of("name", "job_title", "department_id", "work_email", "image_128"));
        DISPLAY_COLUMNS.put(DataSourceType.ODOO_BOMS, List.of("display_name", "product_qty", "code", "type"));
        DISPLAY_COLUMNS.put(DataSourceType.ODOO_SERIALS, List.of("name", "product_id", "ref"));
        DISPLAY_COLUMNS.put(DataSourceType.ODOO_WORKCENTERS, List.of("name", "code"));
        DISPLAY_COLUMNS.put(DataSourceType.ODOO_WORKORDERS, List.of("name", "workcenter_id", "production_id", "state"));
        DISPLAY_COLUMNS.put(DataSourceType.ODOO_LOSS_REASONS, List.of("name", "loss_type"));
        DISPLAY_COLUMNS.put(DataSourceType.STATIC_LIST, List.of());
    }

    public static List<String> displayColumnsFor(DataSourceType type) {
        return DISPLAY_COLUMNS.getOrDefault(type, List.of());
    }

    /**
     * Columnas por las que se puede "buscar" un registro a partir de un codigo
     * en bruto (p. ej. el codigo de barras/badge leido por un lector RS232 o un
     * evento MQTT). Caso de uso: un desplegable de Operario recibe el codigo de
     * empleado escaneado; se busca esa columna y se resuelve al registro real
     * (se muestra el nombre, se guarda el id en trazabilidad). Solo se ofrecen
     * columnas que Odoo realmente expone para ese dato maestro (ver
     * AbstractOdooConnector.odooFields) y que tienen sentido como codigo de
     * lectura. "display_name" en ordenes de fabricacion es su referencia
     * legible (p. ej. "WH/MO/00023") -- necesaria para que un TEXT_INPUT/
     * DROPDOWN pueda validar/escanear una orden (antes vacio, no se podia).
     * mrp.production no se pide con el campo "name" (ver odooFields), solo
     * "display_name" -- usar "name" aqui dejaria la columna sin match nunca.
     */
    private static final Map<DataSourceType, List<String>> LOOKUP_COLUMNS = new EnumMap<>(DataSourceType.class);

    static {
        LOOKUP_COLUMNS.put(DataSourceType.ODOO_OPERATORS, List.of("barcode"));
        LOOKUP_COLUMNS.put(DataSourceType.ODOO_PRODUCTS, List.of("barcode", "default_code"));
        LOOKUP_COLUMNS.put(DataSourceType.ODOO_BOMS, List.of("code"));
        LOOKUP_COLUMNS.put(DataSourceType.ODOO_SERIALS, List.of("name"));
        LOOKUP_COLUMNS.put(DataSourceType.ODOO_MANUFACTURING_ORDERS, List.of("display_name"));
        LOOKUP_COLUMNS.put(DataSourceType.STATIC_LIST, List.of());
    }

    public static List<String> lookupColumnsFor(DataSourceType type) {
        return LOOKUP_COLUMNS.getOrDefault(type, List.of());
    }

    /**
     * Busca el registro cuyo campo `column` coincide con `code` (comparacion
     * exacta, ignorando mayusculas y espacios sobrantes, ya que los lectores de
     * codigo de barras a veces anaden retornos de carro o var+ian el caso). Se
     * apoya en resolveTable() (que ya trae las filas completas de Odoo) en vez
     * de duplicar la llamada RPC.
     */
    public Optional<DataSourceOption> lookup(DataSourceType type, String column, String code) {
        return lookup(type, column, code, null);
    }

    /** Igual que lookup(), pero filtrando por rutas de estacion como resolve()/resolveTable() -- ver filterByRouteProducts. */
    public Optional<DataSourceOption> lookup(DataSourceType type, String column, String code, Long stationId) {
        return findRow(type, column, code, stationId).map(row -> new DataSourceOption(stringId(row.get("id")), label(row)));
    }

    /**
     * Igual que lookup(), pero devuelve la fila completa en vez de solo
     * {value,label}: la usa el widget TEXT_INPUT cuando el diseñador ha
     * elegido varios "datos a mostrar" (p. ej. nombre y departamento del
     * operario), no solo un unico texto resuelto.
     */
    public Optional<Map<String, Object>> lookupRow(DataSourceType type, String column, String code) {
        return lookupRow(type, column, code, null);
    }

    /** Igual que lookupRow(), pero filtrando por rutas de estacion -- ver filterByRouteProducts. */
    public Optional<Map<String, Object>> lookupRow(DataSourceType type, String column, String code, Long stationId) {
        return findRow(type, column, code, stationId);
    }

    /**
     * Resuelve un codigo de serie/lote (stock.lot) contra Odoo: la usa
     * MaterialLoadService, que ya no deja elegir origen de datos -- la carga
     * de material siempre se valida contra series/lotes. Devuelve tambien el
     * nombre del producto asociado (stock.lot.product_id), que se usa como
     * nombre automatico de una ranura suelta (ver conversacion 2026-07-30),
     * sin tener que resolver el codigo dos veces.
     */
    public Optional<SerialLookupResult> lookupSerial(String code) {
        return findRow(DataSourceType.ODOO_SERIALS, "name", code, null)
                .map(row -> new SerialLookupResult(stringId(row.get("id")), label(row), productLabel(row)));
    }

    public record SerialLookupResult(String value, String label, String productName) {
    }

    /** El many2one de Odoo llega como [id, "etiqueta"]; a veces ya viene solo el id. */
    private static String productLabel(Map<String, Object> row) {
        Object value = row.get("product_id");
        if (value instanceof List<?> pair && pair.size() > 1) {
            return String.valueOf(pair.get(1));
        }
        return null;
    }

    /**
     * stationId opcional: si el tipo es ordenes de fabricacion y se pasa,
     * un codigo que exista en Odoo pero cuyo producto no tenga ruta por esta
     * estacion se trata como "no encontrado" -- mismo mensaje de siempre, sin
     * distinguir "no existe" de "existe pero no aplica aqui" (ver
     * filterByRouteProducts).
     */
    private Optional<Map<String, Object>> findRow(DataSourceType type, String column, String code, Long stationId) {
        if (!lookupColumnsFor(type).contains(column)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    messages.get("dataSource.invalidLookupColumn", column, type));
        }
        String needle = code == null ? "" : code.trim();
        if (needle.isBlank()) {
            return Optional.empty();
        }
        OdooMasterDataEntity entity = odooEntity(type);
        List<Map<String, Object>> rows = masterDataService.list(entity, 500, 0);
        if (type == DataSourceType.ODOO_MANUFACTURING_ORDERS && stationId != null) {
            rows = filterByRouteProducts(rows, stationId);
        }
        return rows.stream()
                .filter(row -> {
                    Object value = row.get(column);
                    return value != null && value.toString().trim().equalsIgnoreCase(needle);
                })
                .findFirst();
    }

    /**
     * Resuelve un id ya guardado (p. ej. el valor que guarda de forma nativa
     * un DROPDOWN) a su etiqueta legible en Odoo. La usa StationService al
     * guardar un envio, para dejar en paralelo un valor apto para mostrar en
     * listados de registros/genealogia (bindingKey + "__label") sin que cada
     * pantalla que los lea tenga que volver a resolverlo contra Odoo.
     */
    public Optional<String> resolveLabel(DataSourceType type, String id) {
        if (type == DataSourceType.STATIC_LIST || id == null || id.isBlank()) {
            return Optional.empty();
        }
        OdooMasterDataEntity entity = odooEntity(type);
        return masterDataService.list(entity, 500, 0).stream()
                .filter(row -> id.equals(stringId(row.get("id"))))
                .findFirst()
                .map(DataSourceResolver::label);
    }

    private OdooMasterDataEntity odooEntity(DataSourceType type) {
        return switch (type) {
            case ODOO_PRODUCTS -> OdooMasterDataEntity.PRODUCT;
            case ODOO_BOMS -> OdooMasterDataEntity.BOM;
            case ODOO_MANUFACTURING_ORDERS -> OdooMasterDataEntity.MANUFACTURING_ORDER;
            case ODOO_OPERATORS -> OdooMasterDataEntity.OPERATOR;
            case ODOO_SERIALS -> OdooMasterDataEntity.SERIAL;
            case ODOO_WORKCENTERS -> OdooMasterDataEntity.WORKCENTER;
            case ODOO_WORKORDERS -> OdooMasterDataEntity.WORKORDER;
            case ODOO_LOSS_REASONS -> OdooMasterDataEntity.LOSS_REASON;
            case STATIC_LIST -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    messages.get("dataSource.staticListNotResolvable"));
        };
    }

    private static String stringId(Object id) {
        if (id instanceof Number n) {
            return String.valueOf(n.longValue());
        }
        return id == null ? "" : id.toString();
    }

    /** Etiqueta legible: display_name si viene, si no name, y como ultimo recurso el id. */
    private static String label(Map<String, Object> row) {
        Object displayName = row.get("display_name");
        if (displayName != null && !displayName.toString().isBlank()) {
            return displayName.toString();
        }
        Object name = row.get("name");
        if (name != null && !name.toString().isBlank()) {
            return name.toString();
        }
        return stringId(row.get("id"));
    }
}

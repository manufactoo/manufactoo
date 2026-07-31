package com.manufactoo.stations;

import com.manufactoo.common.Messages;
import com.manufactoo.masterdata.MasterDataService;
import com.manufactoo.odoo.connector.OdooMasterDataEntity;
import com.manufactoo.routes.Route;
import com.manufactoo.routes.RouteService;
import com.manufactoo.stations.dto.DataSourceOption;
import com.manufactoo.stations.dto.DataSourceTableDto;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

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
    private final Messages messages;

    public DataSourceResolver(MasterDataService masterDataService, RouteService routeService, Messages messages) {
        this.masterDataService = masterDataService;
        this.routeService = routeService;
        this.messages = messages;
    }

    public List<DataSourceOption> resolve(DataSourceType type, int limit) {
        return resolve(type, limit, null);
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
        OdooMasterDataEntity entity = odooEntity(type);
        List<Map<String, Object>> rows = masterDataService.list(entity, limit, 0);
        if (type == DataSourceType.ODOO_MANUFACTURING_ORDERS && stationId != null) {
            rows = filterByRouteProducts(rows, stationId);
        }
        return rows.stream()
                .map(row -> new DataSourceOption(stringId(row.get("id")), label(row)))
                .toList();
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
        Object value = row.get("product_id");
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
        OdooMasterDataEntity entity = odooEntity(type);
        List<DataSourceTableDto.Column> columns = displayColumnsFor(type).stream()
                .map(DataSourceTableDto.Column::of)
                .toList();
        return new DataSourceTableDto(columns, masterDataService.list(entity, limit, 0));
    }

    /**
     * Columnas de Odoo disponibles para mostrar de un dato maestro (tabla, y
     * el detalle opcional de un TEXT_INPUT validado -- ver detailColumns en
     * ScreenWidget.config). Mismo conjunto que ya se mostraba en el widget
     * TABLE; aqui se reutiliza para que el diseñador elija cuales enseñar.
     */
    private static final Map<DataSourceType, List<String>> DISPLAY_COLUMNS = new EnumMap<>(DataSourceType.class);

    static {
        DISPLAY_COLUMNS.put(DataSourceType.ODOO_PRODUCTS, List.of("display_name", "default_code", "qty_available", "uom_id"));
        DISPLAY_COLUMNS.put(DataSourceType.ODOO_MANUFACTURING_ORDERS, List.of("display_name", "product_qty", "state", "date_start"));
        DISPLAY_COLUMNS.put(DataSourceType.ODOO_OPERATORS, List.of("name", "job_title", "department_id", "work_email"));
        DISPLAY_COLUMNS.put(DataSourceType.ODOO_BOMS, List.of("display_name", "product_qty", "code", "type"));
        DISPLAY_COLUMNS.put(DataSourceType.ODOO_SERIALS, List.of("name", "product_id", "ref"));
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
     * lectura (no aplica a ordenes de fabricacion, que no se escanean por codigo).
     */
    private static final Map<DataSourceType, List<String>> LOOKUP_COLUMNS = new EnumMap<>(DataSourceType.class);

    static {
        LOOKUP_COLUMNS.put(DataSourceType.ODOO_OPERATORS, List.of("barcode"));
        LOOKUP_COLUMNS.put(DataSourceType.ODOO_PRODUCTS, List.of("barcode", "default_code"));
        LOOKUP_COLUMNS.put(DataSourceType.ODOO_BOMS, List.of("code"));
        LOOKUP_COLUMNS.put(DataSourceType.ODOO_SERIALS, List.of("name"));
        LOOKUP_COLUMNS.put(DataSourceType.ODOO_MANUFACTURING_ORDERS, List.of());
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
        return findRow(type, column, code).map(row -> new DataSourceOption(stringId(row.get("id")), label(row)));
    }

    /**
     * Igual que lookup(), pero devuelve la fila completa en vez de solo
     * {value,label}: la usa el widget TEXT_INPUT cuando el diseñador ha
     * elegido varios "datos a mostrar" (p. ej. nombre y departamento del
     * operario), no solo un unico texto resuelto.
     */
    public Optional<Map<String, Object>> lookupRow(DataSourceType type, String column, String code) {
        return findRow(type, column, code);
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
        return findRow(DataSourceType.ODOO_SERIALS, "name", code)
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

    private Optional<Map<String, Object>> findRow(DataSourceType type, String column, String code) {
        if (!lookupColumnsFor(type).contains(column)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    messages.get("dataSource.invalidLookupColumn", column, type));
        }
        String needle = code == null ? "" : code.trim();
        if (needle.isBlank()) {
            return Optional.empty();
        }
        OdooMasterDataEntity entity = odooEntity(type);
        return masterDataService.list(entity, 500, 0).stream()
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

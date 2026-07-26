package com.manufactoo.stations;

import com.manufactoo.masterdata.MasterDataService;
import com.manufactoo.odoo.connector.OdooMasterDataEntity;
import com.manufactoo.stations.dto.DataSourceOption;
import com.manufactoo.stations.dto.DataSourceTableDto;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

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

    public DataSourceResolver(MasterDataService masterDataService) {
        this.masterDataService = masterDataService;
    }

    public List<DataSourceOption> resolve(DataSourceType type, int limit) {
        OdooMasterDataEntity entity = odooEntity(type);
        return masterDataService.list(entity, limit, 0).stream()
                .map(row -> new DataSourceOption(stringId(row.get("id")), label(row)))
                .toList();
    }

    /**
     * Igual que resolve() pero devuelve filas completas + columnas, para el
     * widget TABLE (p. ej. una tabla enlazada a "ordenes" muestra todas las
     * ordenes con sus columnas). Las columnas reutilizan las etiquetas ya
     * traducidas de masterData.columns.* del frontend.
     */
    public DataSourceTableDto resolveTable(DataSourceType type, int limit) {
        OdooMasterDataEntity entity = odooEntity(type);
        List<DataSourceTableDto.Column> columns = switch (type) {
            case ODOO_PRODUCTS -> columnsOf("display_name", "default_code", "qty_available", "uom_id");
            case ODOO_MANUFACTURING_ORDERS -> columnsOf("display_name", "product_qty", "state", "date_start");
            case ODOO_OPERATORS -> columnsOf("name", "job_title", "department_id", "work_email");
            case ODOO_BOMS -> columnsOf("display_name", "product_qty", "code", "type");
            case ODOO_SERIALS -> columnsOf("name", "product_id", "ref");
            case STATIC_LIST -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Una lista estatica no tiene tabla: define sus opciones en el propio widget.");
        };
        return new DataSourceTableDto(columns, masterDataService.list(entity, limit, 0));
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
        if (!lookupColumnsFor(type).contains(column)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "La columna " + column + " no es una columna de busqueda valida para " + type + ".");
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
                .findFirst()
                .map(row -> new DataSourceOption(stringId(row.get("id")), label(row)));
    }

    private OdooMasterDataEntity odooEntity(DataSourceType type) {
        return switch (type) {
            case ODOO_PRODUCTS -> OdooMasterDataEntity.PRODUCT;
            case ODOO_BOMS -> OdooMasterDataEntity.BOM;
            case ODOO_MANUFACTURING_ORDERS -> OdooMasterDataEntity.MANUFACTURING_ORDER;
            case ODOO_OPERATORS -> OdooMasterDataEntity.OPERATOR;
            case ODOO_SERIALS -> OdooMasterDataEntity.SERIAL;
            case STATIC_LIST -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Una lista estatica no se resuelve en el servidor: sus opciones se definen en el propio widget.");
        };
    }

    private static List<DataSourceTableDto.Column> columnsOf(String... keys) {
        return java.util.Arrays.stream(keys).map(DataSourceTableDto.Column::of).toList();
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

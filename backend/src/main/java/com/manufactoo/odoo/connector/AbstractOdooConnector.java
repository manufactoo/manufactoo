package com.manufactoo.odoo.connector;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.List;
import java.util.Map;

public abstract class AbstractOdooConnector implements OdooConnector {

    protected final OdooJsonRpcClient rpcClient;
    private final OdooVersionInfo versionInfo;
    private final ObjectMapper objectMapper = new ObjectMapper();

    protected AbstractOdooConnector(OdooJsonRpcClient rpcClient, OdooVersionInfo versionInfo) {
        this.rpcClient = rpcClient;
        this.versionInfo = versionInfo;
    }

    @Override
    public OdooVersionInfo version() {
        return versionInfo;
    }

    @Override
    public Integer authenticate(String database, String username, String apiKeyOrPassword) {
        JsonNode result = rpcClient.call("common", "authenticate",
                List.of(database, username, apiKeyOrPassword, Map.of()));
        if (result == null || (result.isBoolean() && !result.asBoolean())) {
            return null;
        }
        return result.asInt();
    }

    @Override
    public void updateCompanyName(String database, int uid, String apiKeyOrPassword, String companyName) {
        rpcClient.call("object", "execute_kw", List.of(
                database, uid, apiKeyOrPassword,
                "res.company", "write",
                List.of(List.of(1), Map.of("name", companyName))
        ));
    }

    @Override
    public List<Map<String, Object>> listMasterData(OdooMasterDataEntity entity, String database, int uid,
                                                      String apiKeyOrPassword, int limit, int offset) {
        return searchRead(database, uid, apiKeyOrPassword, odooModel(entity), List.of(), odooFields(entity), limit, offset);
    }

    /**
     * Modelo Odoo de cada dato maestro. Punto de extension: si una version
     * sustituye o renombra un modelo, sobreescribir en el adapter concreto.
     */
    protected String odooModel(OdooMasterDataEntity entity) {
        return switch (entity) {
            case PRODUCT -> "product.product";
            case BOM -> "mrp.bom";
            case MANUFACTURING_ORDER -> "mrp.production";
            case OPERATOR -> "hr.employee";
            case SERIAL -> "stock.lot";
        };
    }

    /**
     * Campos pedidos por tipo de dato maestro. Punto de extension: si un
     * campo cambia de nombre entre versiones, sobreescribir en el adapter
     * concreto (OdooConnector18 / OdooConnector19) en vez de tocar aqui.
     */
    protected List<String> odooFields(OdooMasterDataEntity entity) {
        return switch (entity) {
            case PRODUCT -> List.of("id", "display_name", "default_code", "barcode", "qty_available", "uom_id");
            case BOM -> List.of("id", "display_name", "product_tmpl_id", "product_qty", "type", "code");
            case MANUFACTURING_ORDER -> List.of("id", "display_name", "product_id", "product_qty", "state",
                    "date_start", "date_finished");
            case OPERATOR -> List.of("id", "name", "job_title", "department_id", "work_email", "barcode");
            case SERIAL -> List.of("id", "name", "product_id", "ref");
        };
    }

    protected List<Map<String, Object>> searchRead(String database, int uid, String apiKeyOrPassword, String model,
                                                     List<Object> domain, List<String> fields, int limit, int offset) {
        JsonNode result = rpcClient.call("object", "execute_kw", List.of(
                database, uid, apiKeyOrPassword,
                model, "search_read",
                List.of(domain),
                Map.of("fields", fields, "limit", limit, "offset", offset)
        ));
        return objectMapper.convertValue(result, new TypeReference<List<Map<String, Object>>>() {
        });
    }
}

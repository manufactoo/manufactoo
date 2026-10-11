package com.manufactoo.masterdata;

import com.manufactoo.common.Messages;
import com.manufactoo.crypto.CryptoService;
import com.manufactoo.odoo.OdooConnection;
import com.manufactoo.odoo.OdooConnectionRepository;
import com.manufactoo.odoo.connector.OdooConnector;
import com.manufactoo.odoo.connector.OdooConnectorFactory;
import com.manufactoo.odoo.connector.OdooJsonRpcException;
import com.manufactoo.odoo.connector.OdooMasterDataEntity;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Lee datos maestros (productos, BOMs, ordenes de trabajo, operarios)
 * directamente de Odoo via JSON-RPC en cada peticion. Manufactoo NUNCA
 * replica ni cachea esta informacion en su propia BBDD: Odoo es la unica
 * fuente de verdad, siempre se accede a traves de su interfaz RPC.
 */
@Service
public class MasterDataService {

    private final OdooConnectionRepository odooConnectionRepository;
    private final CryptoService cryptoService;
    private final OdooConnectorFactory connectorFactory;
    private final Messages messages;

    public MasterDataService(OdooConnectionRepository odooConnectionRepository, CryptoService cryptoService,
                              OdooConnectorFactory connectorFactory, Messages messages) {
        this.odooConnectionRepository = odooConnectionRepository;
        this.cryptoService = cryptoService;
        this.connectorFactory = connectorFactory;
        this.messages = messages;
    }

    public List<Map<String, Object>> list(OdooMasterDataEntity entity, int limit, int offset) {
        OdooConnection connection = odooConnectionRepository.findAll().stream().findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        messages.get("masterData.noConnection")));

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
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    messages.get("masterData.authFailed"));
        }

        try {
            List<Map<String, Object>> rows = connector.listMasterData(entity, connection.getDatabase(), uid,
                    apiKeyOrPassword, limit, offset);
            if (entity == OdooMasterDataEntity.SERIAL) {
                enrichLotRoles(connector, connection.getDatabase(), uid, apiKeyOrPassword, rows);
            }
            return rows;
        } catch (OdooJsonRpcException e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, messages.get("masterData.readError", e.getMessage()));
        }
    }

    /**
     * stock.lot no tiene ningun campo de "tipo" propio -- si un lote es
     * materia prima o producto de una orden depende de COMO se ha usado, no
     * de un atributo suyo (ver conversacion 2026-08-08). Se deriva de 2
     * sitios reales de Odoo, los mismos que usa su propia UI para pintar la
     * pestaña "Trazabilidad" de una MO:
     *  - Consumido como componente: stock.move.line cuyo movimiento padre
     *    tiene raw_material_production_id (viene de move_raw_ids de la MO;
     *    OdooProductionService.recordUnit ya consulta estos mismos
     *    movimientos, solo que hoy pide product_id, no lot_id).
     *  - Producido por una MO: mrp.production.lot_producing_ids (el
     *    producto principal, valido en cualquier estado -- ya escrito por
     *    OdooProductionService.recordUnit) UNIDO a stock.move.line cuyo
     *    movimiento tiene production_id (cubre tambien subproductos, una
     *    vez movidos).
     * Un mismo lote puede caer en ambos conjuntos (semielaborado: producido
     * por una MO, consumido despues como componente de otra). Solo se
     * consulta para los lotes de la pagina actual (lotIds), nunca la tabla
     * completa de movimientos -- barato incluso con mucho historial.
     */
    private void enrichLotRoles(OdooConnector connector, String database, int uid, String apiKeyOrPassword,
                                 List<Map<String, Object>> rows) {
        List<Long> lotIds = rows.stream()
                .map(r -> r.get("id"))
                .filter(id -> id instanceof Number)
                .map(id -> ((Number) id).longValue())
                .toList();
        if (lotIds.isEmpty()) {
            return;
        }
        Set<Long> rawMaterialLotIds;
        Set<Long> producedLotIds;
        try {
            rawMaterialLotIds = lotIdsFromMoveLines(connector, database, uid, apiKeyOrPassword,
                    "move_id.raw_material_production_id", lotIds);
            producedLotIds = lotIdsFromMoveLines(connector, database, uid, apiKeyOrPassword,
                    "move_id.production_id", lotIds);
            producedLotIds.addAll(lotProducingIds(connector, database, uid, apiKeyOrPassword, lotIds));
        } catch (OdooJsonRpcException e) {
            // Consulta puramente decorativa (clasificacion) -- si falla (permisos,
            // version de Odoo sin mrp instalado...) no se rompe el listado de
            // series en si, que ya se leyo bien; simplemente se queda sin "lot_role".
            return;
        }
        for (Map<String, Object> row : rows) {
            Object idObj = row.get("id");
            if (!(idObj instanceof Number idNum)) {
                continue;
            }
            long id = idNum.longValue();
            boolean isRaw = rawMaterialLotIds.contains(id);
            boolean isProduced = producedLotIds.contains(id);
            String role = isRaw && isProduced ? "BOTH" : isRaw ? "RAW_MATERIAL" : isProduced ? "PRODUCED" : "UNLINKED";
            row.put("lot_role", role);
        }
    }

    /** IDs de lote (columna lot_id) de stock.move.line cuyo movimiento tenga linkField != false, restringido a lotIds. */
    @SuppressWarnings("unchecked")
    private Set<Long> lotIdsFromMoveLines(OdooConnector connector, String database, int uid, String apiKeyOrPassword,
                                           String linkField, List<Long> lotIds) {
        List<Object> domain = List.of(
                List.of("lot_id", "in", lotIds),
                List.of(linkField, "!=", false));
        Object result = connector.callMethod(database, uid, apiKeyOrPassword, "stock.move.line", "search_read",
                List.of(domain), Map.of("fields", List.of("lot_id")));
        Set<Long> ids = new HashSet<>();
        if (result instanceof List<?> list) {
            for (Object o : list) {
                if (o instanceof Map<?, ?> m && m.get("lot_id") instanceof List<?> lotRef
                        && !lotRef.isEmpty() && lotRef.get(0) instanceof Number n) {
                    ids.add(n.longValue());
                }
            }
        }
        return ids;
    }

    /** IDs de lote que son lot_producing_ids de alguna mrp.production, restringido a lotIds. */
    private Set<Long> lotProducingIds(OdooConnector connector, String database, int uid, String apiKeyOrPassword,
                                       List<Long> lotIds) {
        List<Object> domain = List.of(List.of("lot_producing_ids", "in", lotIds));
        Object result = connector.callMethod(database, uid, apiKeyOrPassword, "mrp.production", "search_read",
                List.of(domain), Map.of("fields", List.of("lot_producing_ids")));
        Set<Long> ids = new HashSet<>();
        if (result instanceof List<?> list) {
            for (Object o : list) {
                if (o instanceof Map<?, ?> m && m.get("lot_producing_ids") instanceof List<?> lpList) {
                    for (Object v : lpList) {
                        if (v instanceof Number n) {
                            ids.add(n.longValue());
                        }
                    }
                }
            }
        }
        return ids;
    }
}

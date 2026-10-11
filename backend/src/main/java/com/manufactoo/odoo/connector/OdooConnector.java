package com.manufactoo.odoo.connector;

import java.util.List;
import java.util.Map;

/**
 * Adapter comun a todas las versiones de Odoo soportadas (18 y 19).
 * Las implementaciones concretas (OdooConnector18 / OdooConnector19) solo
 * deben divergir de AbstractOdooConnector donde exista una diferencia real
 * de campos o metodos entre versiones; el transporte JSON-RPC es identico.
 * Las instancias se crean siempre via OdooConnectorFactory, que ya ha
 * detectado la version antes de elegir el adapter concreto.
 */
public interface OdooConnector {

    /** major version que este adapter soporta, ej. 18 o 19. */
    int supportedMajorVersion();

    /** Version detectada al crear este connector (cacheada, sin nueva llamada RPC). */
    OdooVersionInfo version();

    /** Llama a common.authenticate(); devuelve el uid o null si las credenciales son invalidas. */
    Integer authenticate(String database, String username, String apiKeyOrPassword);

    /**
     * Actualiza el nombre de la compania en Odoo (modo embebido, paso 3 del wizard).
     * Punto de extension: aqui es donde divergirian 18 y 19 si un campo de
     * res.company cambiase de nombre o tipo entre versiones.
     */
    void updateCompanyName(String database, int uid, String apiKeyOrPassword, String companyName);

    /**
     * Lee un dato maestro directamente de Odoo via search_read (JSON-RPC).
     * Manufactoo nunca replica ni cachea esta informacion en su propia BBDD:
     * cada llamada es una lectura en vivo. El modelo Odoo y los campos
     * pedidos por tipo de entidad estan en AbstractOdooConnector; si una
     * version de Odoo difiere en nombre de modelo o de campo, es el punto
     * de extension a sobreescribir en OdooConnector18 / OdooConnector19.
     */
    List<Map<String, Object>> listMasterData(OdooMasterDataEntity entity, String database, int uid,
                                              String apiKeyOrPassword, int limit, int offset);

    /**
     * Llamada generica a CUALQUIER metodo de CUALQUIER modelo de Odoo (via
     * execute_kw) -- a diferencia de listMasterData (solo lectura, catalogo
     * fijo de entidades), esto es el primitivo que usa OdooShopFloorService
     * para escribir de verdad en Odoo (botones button_start/button_pending/
     * button_finish/button_unblock de mrp.workorder, altas de
     * mrp.workcenter.productivity, etc. -- ver conversacion 2026-08-05,
     * investigacion en vivo). El resultado se devuelve tal cual lo convierte
     * Jackson (Boolean para los botones, Map/List<Map> para read/search_read).
     */
    Object callMethod(String database, int uid, String apiKeyOrPassword, String model, String method,
                       List<Object> args, Map<String, Object> kwargs);
}

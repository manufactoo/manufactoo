package com.manufactoo.odoo.connector;

/**
 * Adapter para Odoo 18 (Community Edition). Hoy no diverge del comportamiento
 * comun (AbstractOdooConnector): test de conexion, creacion de compania y
 * lectura de datos maestros (productos, BOMs, ordenes de trabajo, operarios)
 * usan el mismo modelo/campos que en la 19 porque no hay evidencia real de
 * que difieran. Si se detecta una diferencia real, sobreescribir aqui
 * odooModel(...)/odooFields(...) solo para la entidad afectada.
 */
public class OdooConnector18 extends AbstractOdooConnector {
    public OdooConnector18(OdooJsonRpcClient rpcClient, OdooVersionInfo versionInfo) {
        super(rpcClient, versionInfo);
    }

    @Override
    public int supportedMajorVersion() {
        return 18;
    }
}

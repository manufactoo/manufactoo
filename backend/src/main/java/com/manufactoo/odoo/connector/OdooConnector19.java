package com.manufactoo.odoo.connector;

/**
 * Adapter para Odoo 19 (Community Edition). Ver OdooConnector18 para el
 * razonamiento sobre por que hoy no hay divergencia real de comportamiento,
 * incluida la lectura de datos maestros.
 */
public class OdooConnector19 extends AbstractOdooConnector {
    public OdooConnector19(OdooJsonRpcClient rpcClient, OdooVersionInfo versionInfo) {
        super(rpcClient, versionInfo);
    }

    @Override
    public int supportedMajorVersion() {
        return 19;
    }
}

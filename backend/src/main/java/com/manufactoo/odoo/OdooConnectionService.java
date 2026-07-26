package com.manufactoo.odoo;

import com.manufactoo.odoo.connector.*;
import org.springframework.stereotype.Service;

/**
 * Orquesta la deteccion de version + autenticacion contra Odoo.
 * Usado por POST /api/wizard/odoo/test-connection y
 * POST /api/settings/odoo-connection/test (mismo endpoint reutilizado).
 */
@Service
public class OdooConnectionService {

    private final OdooConnectorFactory connectorFactory;

    public OdooConnectionService(OdooConnectorFactory connectorFactory) {
        this.connectorFactory = connectorFactory;
    }

    public OdooConnectionTestResult testConnection(String host, int port, String database,
                                                     String username, String apiKeyOrPassword) {
        try {
            OdooConnector connector = connectorFactory.connect(host, port);
            try {
                Integer uid = connector.authenticate(database, username, apiKeyOrPassword);
                if (uid == null) {
                    return OdooConnectionTestResult.failure(connector.version().serverSerie(),
                            "Credenciales invalidas: revisa base de datos, usuario y API key/contrasena.");
                }
                return OdooConnectionTestResult.success(connector.version().serverSerie(), uid);
            } catch (OdooJsonRpcException e) {
                return OdooConnectionTestResult.failure(connector.version().serverSerie(),
                        "Error autenticando en Odoo: " + e.getMessage());
            }
        } catch (OdooUnsupportedVersionException e) {
            return OdooConnectionTestResult.failure(e.getDetectedVersion(), e.getMessage());
        } catch (OdooJsonRpcException e) {
            return OdooConnectionTestResult.failure(null, e.getMessage() + dockerLocalhostHint(host));
        }
    }

    /**
     * Manufactoo corre dentro de un contenedor Docker en dev/prod. Si el
     * usuario apunta a "localhost"/"127.0.0.1" pensando en su propio equipo
     * (donde SI ve Odoo en su navegador), en realidad esta apuntando al
     * propio contenedor de Manufactoo, no al host. Es el fallo mas comun al
     * configurar un Odoo externo, asi que lo detectamos y lo explicamos en
     * vez de dejar solo un "connection refused" críptico.
     */
    private String dockerLocalhostHint(String host) {
        if ("localhost".equalsIgnoreCase(host) || "127.0.0.1".equals(host)) {
            return " Si Odoo esta instalado en tu propio equipo (no en un contenedor de esta misma red Docker), "
                    + "usa 'host.docker.internal' en vez de 'localhost': dentro del contenedor de Manufactoo, "
                    + "'localhost' se refiere al propio contenedor, no a tu maquina.";
        }
        return "";
    }

    /** Usado en el paso 3 del wizard cuando el modo es embebido. */
    public void updateCompanyName(String host, int port, String database, int uid,
                                   String apiKeyOrPassword, String companyName) {
        OdooConnector connector = connectorFactory.connect(host, port);
        connector.updateCompanyName(database, uid, apiKeyOrPassword, companyName);
    }
}

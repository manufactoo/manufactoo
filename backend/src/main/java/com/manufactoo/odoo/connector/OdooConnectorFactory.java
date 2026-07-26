package com.manufactoo.odoo.connector;

import org.springframework.stereotype.Component;

/** Detecta la version de una instancia Odoo y devuelve el adapter correcto (18 o 19). */
@Component
public class OdooConnectorFactory {

    public OdooConnector connect(String host, int port) {
        OdooJsonRpcClient client = new OdooJsonRpcClient(host, port);
        OdooVersionInfo version = OdooVersionProbe.detect(client);

        return switch (version.majorVersion()) {
            case 18 -> new OdooConnector18(client, version);
            case 19 -> new OdooConnector19(client, version);
            default -> throw new OdooUnsupportedVersionException(
                    version.serverSerie() != null && !version.serverSerie().isBlank()
                            ? version.serverSerie()
                            : String.valueOf(version.majorVersion()));
        };
    }
}

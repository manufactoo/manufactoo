package com.manufactoo.odoo.connector;

import com.fasterxml.jackson.databind.JsonNode;

import java.util.List;

/** Deteccion de version (common.version()), independiente del adapter final elegido. */
final class OdooVersionProbe {

    private OdooVersionProbe() {
    }

    static OdooVersionInfo detect(OdooJsonRpcClient client) {
        JsonNode result = client.call("common", "version", List.of());
        String serverVersion = result.path("server_version").asText("");
        String serverSerie = result.path("server_serie").asText(serverVersion);
        int major = parseMajorVersion(serverVersion);
        return new OdooVersionInfo(serverVersion, serverSerie, major);
    }

    private static int parseMajorVersion(String serverVersion) {
        try {
            String head = serverVersion.split("\\.")[0].replaceAll("[^0-9]", "");
            return head.isEmpty() ? -1 : Integer.parseInt(head);
        } catch (Exception e) {
            return -1;
        }
    }
}

package com.manufactoo.odoo.connector;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Cliente JSON-RPC 2.0 minimo contra el endpoint /jsonrpc de Odoo.
 * Comun a todas las versiones soportadas: el protocolo de transporte
 * (common.version, common.authenticate, object.execute_kw) es estable
 * entre Odoo 18 y 19; las diferencias reales estan en los campos/metodos
 * de los modelos de negocio, no en este transporte.
 */
public class OdooJsonRpcClient {

    private static final Duration TIMEOUT = Duration.ofSeconds(10);

    private final String baseUrl;
    private final HttpClient httpClient;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public OdooJsonRpcClient(String host, int port) {
        this(host, port, false);
    }

    public OdooJsonRpcClient(String host, int port, boolean https) {
        String scheme = https ? "https" : "http";
        this.baseUrl = scheme + "://" + host + ":" + port + "/jsonrpc";
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(TIMEOUT)
                .build();
    }

    public JsonNode call(String service, String method, List<Object> args) {
        try {
            ObjectNode params = objectMapper.createObjectNode();
            params.put("service", service);
            params.put("method", method);
            params.set("args", objectMapper.valueToTree(args));

            ObjectNode body = objectMapper.createObjectNode();
            body.put("jsonrpc", "2.0");
            body.put("method", "call");
            body.set("params", params);
            body.put("id", ThreadLocalRandom.current().nextInt(1, Integer.MAX_VALUE));

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(baseUrl))
                    .timeout(TIMEOUT)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(body)))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() != 200) {
                throw new OdooJsonRpcException("Odoo respondio HTTP " + response.statusCode());
            }

            JsonNode responseBody = objectMapper.readTree(response.body());

            if (responseBody.has("error")) {
                JsonNode error = responseBody.get("error");
                String message = error.path("data").path("message").asText(error.path("message").asText("Error desconocido de Odoo"));
                throw new OdooJsonRpcException(message);
            }

            return responseBody.get("result");
        } catch (IOException e) {
            String detail = e.getMessage();
            if (detail == null && e.getCause() != null) {
                detail = e.getCause().getMessage();
            }
            if (detail == null) {
                detail = e.getClass().getSimpleName();
            }
            throw new OdooJsonRpcException("No se pudo conectar con Odoo en " + baseUrl + ": " + detail, e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new OdooJsonRpcException("Conexion con Odoo interrumpida", e);
        }
    }
}

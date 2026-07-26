package com.manufactoo.updatecheck;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.manufactoo.config.UpdateCheckProperties;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

/**
 * Comprobacion de version manual, nunca automatica: solo se ejecuta cuando
 * el usuario pulsa el boton en Configuracion y manufactoo.update-check.enabled=true.
 * No envia ninguna telemetria, solo hace un GET publico a la API de GitHub.
 */
@Service
public class UpdateCheckService {

    private final UpdateCheckProperties properties;
    private final String currentVersion;
    private final HttpClient httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    private final ObjectMapper objectMapper = new ObjectMapper();

    public UpdateCheckService(UpdateCheckProperties properties, @Value("${manufactoo.version}") String currentVersion) {
        this.properties = properties;
        this.currentVersion = currentVersion;
    }

    public UpdateCheckResult check() {
        if (!properties.enabled()) {
            return new UpdateCheckResult(false, currentVersion, null, false, null);
        }

        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create("https://api.github.com/repos/" + properties.githubRepo() + "/releases/latest"))
                    .header("Accept", "application/vnd.github+json")
                    .timeout(Duration.ofSeconds(5))
                    .GET()
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                return new UpdateCheckResult(true, currentVersion, null, false, null);
            }
            JsonNode body = objectMapper.readTree(response.body());
            String latestTag = body.path("tag_name").asText(null);
            String latestVersion = latestTag != null && latestTag.startsWith("v") ? latestTag.substring(1) : latestTag;
            String releaseUrl = body.path("html_url").asText(null);
            boolean updateAvailable = latestVersion != null && !latestVersion.equals(currentVersion);
            return new UpdateCheckResult(true, currentVersion, latestVersion, updateAvailable, releaseUrl);
        } catch (Exception e) {
            return new UpdateCheckResult(true, currentVersion, null, false, null);
        }
    }

    public record UpdateCheckResult(boolean enabled, String currentVersion, String latestVersion,
                                     boolean updateAvailable, String releaseUrl) {
    }
}

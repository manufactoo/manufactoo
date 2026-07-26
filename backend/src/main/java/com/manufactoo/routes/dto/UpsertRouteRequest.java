package com.manufactoo.routes.dto;

import jakarta.validation.constraints.NotBlank;

import java.util.List;

/** El editor de rutas envia la ruta completa (aggregate); el backend reconcilia contra lo que ya hay (ver RouteService). */
public record UpsertRouteRequest(
        @NotBlank String name,
        String description,
        Long productId,
        String productName,
        @NotBlank String identifierBindingKey,
        boolean enabled,
        List<UpsertStep> steps
) {
    public record UpsertStep(Long id, Long stationId, int orderIndex, String name) {
    }
}

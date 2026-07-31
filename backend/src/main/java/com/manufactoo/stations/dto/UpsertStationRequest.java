package com.manufactoo.stations.dto;

import jakarta.validation.constraints.NotBlank;

import java.util.List;
import java.util.Map;

/**
 * El editor no-code envia la estacion completa (aggregate): sus pantallas y,
 * dentro de cada pantalla, la lista plana de widgets con su posicion en el grid.
 * El backend reconcilia contra lo que ya hay (ver StationService).
 */
public record UpsertStationRequest(
        @NotBlank String name,
        String description,
        boolean enabled,
        List<UpsertScreen> screens,
        List<String> positions
) {
    public record UpsertScreen(
            Long id,
            String title,
            int orderIndex,
            List<UpsertWidget> widgets
    ) {
    }

    public record UpsertWidget(
            Long id,
            String widgetType,
            String label,
            String bindingKey,
            boolean required,
            Long sourceDeviceId,
            Long sourceEventId,
            Map<String, Object> config,
            Map<String, Object> dataSource,
            Map<String, Object> layout,
            int orderIndex
    ) {
    }
}

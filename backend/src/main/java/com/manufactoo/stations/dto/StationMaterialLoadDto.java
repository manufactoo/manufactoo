package com.manufactoo.stations.dto;

import java.time.Instant;

/** Un lote activo ahora mismo en alguna estacion -- para la vista cruzada de toda la instalacion (GET /api/material-loads). */
public record StationMaterialLoadDto(
        Long id,
        Long stationId,
        String stationName,
        String name,
        String value,
        String label,
        String position,
        Instant loadedAt
) {
}

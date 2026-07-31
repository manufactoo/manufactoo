package com.manufactoo.stations.dto;

import java.time.Instant;
import java.util.Map;

/** Un paso concreto (un registro de trazabilidad) dentro de la genealogia de una unidad. */
public record GenealogyStepDto(
        Long recordId,
        Long stationId,
        String stationName,
        Instant createdAt,
        Map<String, Object> capturedData
) {
}

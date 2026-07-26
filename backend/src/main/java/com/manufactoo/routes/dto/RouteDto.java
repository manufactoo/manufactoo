package com.manufactoo.routes.dto;

import java.time.Instant;
import java.util.List;

public record RouteDto(
        Long id,
        String name,
        String description,
        Long productId,
        String productName,
        String identifierBindingKey,
        boolean enabled,
        List<RouteStepDto> steps,
        Instant createdAt,
        Instant updatedAt
) {
}

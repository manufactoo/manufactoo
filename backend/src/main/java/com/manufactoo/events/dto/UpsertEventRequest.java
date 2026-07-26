package com.manufactoo.events.dto;

import com.manufactoo.events.EventDirection;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record UpsertEventRequest(
        @NotBlank String name,
        @NotBlank String topic,
        @NotNull EventDirection direction,
        boolean enabled
) {
}

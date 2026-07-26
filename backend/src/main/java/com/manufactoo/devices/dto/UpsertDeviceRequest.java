package com.manufactoo.devices.dto;

import com.manufactoo.devices.DeviceCategory;
import com.manufactoo.devices.DeviceDirection;
import com.manufactoo.devices.Transport;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.Map;

public record UpsertDeviceRequest(
        @NotBlank String name,
        @NotNull DeviceCategory category,
        @NotNull DeviceDirection direction,
        @NotNull Transport transport,
        boolean enabled,
        Map<String, Object> connection,
        Map<String, Object> settings
) {
}

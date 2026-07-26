package com.manufactoo.devices.dto;

import com.manufactoo.devices.Device;

import java.time.Instant;
import java.util.Map;

public record DeviceDto(
        Long id,
        String name,
        String category,
        String direction,
        String transport,
        boolean enabled,
        Map<String, Object> connection,
        Map<String, Object> settings,
        Instant createdAt,
        Instant updatedAt
) {
    public static DeviceDto from(Device device) {
        return new DeviceDto(
                device.getId(),
                device.getName(),
                device.getCategory().name(),
                device.getDirection().name(),
                device.getTransport().name(),
                device.isEnabled(),
                device.getConnection(),
                device.getSettings(),
                device.getCreatedAt(),
                device.getUpdatedAt()
        );
    }
}

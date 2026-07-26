package com.manufactoo.devices.dto;

import com.manufactoo.devices.DeviceFieldDef;

import java.util.List;

public record DeviceCatalogDto(List<CategoryEntry> categories) {

    public record CategoryEntry(
            String category,
            String defaultDirection,
            List<String> directions,
            List<TransportOption> transports,
            List<DeviceFieldDef> settingsFields
    ) {
    }

    public record TransportOption(String transport, List<DeviceFieldDef> connectionFields) {
    }
}

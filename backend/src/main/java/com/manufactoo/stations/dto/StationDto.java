package com.manufactoo.stations.dto;

import com.manufactoo.stations.Station;

import java.time.Instant;
import java.util.List;

public record StationDto(
        Long id,
        String name,
        String description,
        boolean enabled,
        List<ScreenDto> screens,
        Instant createdAt,
        Instant updatedAt
) {
    public static StationDto from(Station station) {
        return new StationDto(
                station.getId(),
                station.getName(),
                station.getDescription(),
                station.isEnabled(),
                station.getScreens().stream().map(ScreenDto::from).toList(),
                station.getCreatedAt(),
                station.getUpdatedAt()
        );
    }
}

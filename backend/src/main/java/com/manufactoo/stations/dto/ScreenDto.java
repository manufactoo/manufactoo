package com.manufactoo.stations.dto;

import com.manufactoo.stations.StationScreen;

import java.util.List;

public record ScreenDto(
        Long id,
        String title,
        int orderIndex,
        List<WidgetDto> widgets
) {
    public static ScreenDto from(StationScreen screen) {
        return new ScreenDto(
                screen.getId(),
                screen.getTitle(),
                screen.getOrderIndex(),
                screen.getWidgets().stream().map(WidgetDto::from).toList()
        );
    }
}

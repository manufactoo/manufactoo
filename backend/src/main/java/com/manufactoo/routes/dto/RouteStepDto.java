package com.manufactoo.routes.dto;

import com.manufactoo.routes.RouteStep;

public record RouteStepDto(Long id, Long stationId, String stationName, int orderIndex, String name) {
    public static RouteStepDto from(RouteStep step, String stationName) {
        return new RouteStepDto(step.getId(), step.getStationId(), stationName, step.getOrderIndex(), step.getName());
    }
}

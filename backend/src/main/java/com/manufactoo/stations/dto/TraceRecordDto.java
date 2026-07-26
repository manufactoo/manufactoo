package com.manufactoo.stations.dto;

import com.manufactoo.stations.StationTraceRecord;

import java.time.Instant;
import java.util.Map;

/** Un registro de genealogia: los valores capturados en una ejecucion de la estacion. */
public record TraceRecordDto(
        Long id,
        Long stationId,
        Long screenId,
        Map<String, Object> capturedData,
        Instant createdAt
) {
    public static TraceRecordDto from(StationTraceRecord r) {
        return new TraceRecordDto(r.getId(), r.getStationId(), r.getScreenId(), r.getCapturedData(), r.getCreatedAt());
    }
}

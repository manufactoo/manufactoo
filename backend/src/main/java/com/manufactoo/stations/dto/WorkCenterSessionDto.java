package com.manufactoo.stations.dto;

import java.time.Instant;

/** Igual que WorkOrderSessionDto, con el nombre de la estacion -- para la vista cruzada de Work Centers (GET /api/work-order-sessions). */
public record WorkCenterSessionDto(
        Long id,
        Long stationId,
        String stationName,
        Long odooWorkorderId,
        Long odooWorkcenterId,
        String state,
        Long operatorEmployeeId,
        String operatorName,
        double qtyProducing,
        double qtyProduced,
        Long blockReasonOdooId,
        String blockReasonName,
        Instant startedAt,
        Instant finishedAt
) {
}

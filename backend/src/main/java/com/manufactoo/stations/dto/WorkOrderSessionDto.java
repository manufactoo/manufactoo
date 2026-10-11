package com.manufactoo.stations.dto;

import java.time.Instant;

/** Sesion de trabajo activa (o recien cerrada) de una estacion sobre un work order de Odoo. */
public record WorkOrderSessionDto(
        Long id,
        Long stationId,
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

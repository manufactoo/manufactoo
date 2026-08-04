package com.manufactoo.stations.dto;

import java.time.Instant;
import java.util.Map;

/**
 * Un paso concreto (un registro de trazabilidad) dentro de la genealogia de
 * una unidad. identifierValue: el valor de su identificador de ruta en ese
 * momento (routeIdentifierKeys, ver StationTraceRecord) -- null si el registro
 * no tenia ningun identificador de ruta aplicado. Se usa en el listado de
 * "recientes" para poder buscar ese codigo con un clic sin que el frontend
 * tenga que adivinar cual de las claves de captured_data es el identificador.
 */
public record GenealogyStepDto(
        Long recordId,
        Long stationId,
        String stationName,
        Instant createdAt,
        Map<String, Object> capturedData,
        String identifierValue
) {
}

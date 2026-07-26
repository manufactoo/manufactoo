package com.manufactoo.stations.dto;

import java.util.Map;

/** Envio del operario desde el runtime: la pantalla y el mapa de valores capturados. */
public record SubmitRecordRequest(
        Long screenId,
        Map<String, Object> values
) {
}

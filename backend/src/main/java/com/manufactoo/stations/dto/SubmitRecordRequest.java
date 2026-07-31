package com.manufactoo.stations.dto;

import java.util.Map;

/** Envio del operario desde el runtime: la pantalla, el mapa de valores capturados y el resultado OK/NG opcional (ver BUTTON action=SUBMIT). */
public record SubmitRecordRequest(
        Long screenId,
        Map<String, Object> values,
        String result
) {
}

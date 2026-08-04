package com.manufactoo.stations.dto;

import java.util.List;

/** Pagina de los registros de trazabilidad mas recientes de toda la app (cualquier estacion), para explorar genealogia sin conocer un codigo de antemano. */
public record GenealogyRecentPageDto(
        List<GenealogyStepDto> items,
        int page,
        int size,
        long totalItems
) {
}

package com.manufactoo.stations.dto;

import java.util.List;

/** Resultado de buscar un codigo en ambas direcciones: como identificador de unidad producida y como material consumido. */
public record GenealogySearchResultDto(
        List<GenealogyStepDto> asUnit,
        List<GenealogyStepDto> asMaterial
) {
}

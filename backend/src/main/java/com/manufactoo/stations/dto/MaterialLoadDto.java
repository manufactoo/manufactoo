package com.manufactoo.stations.dto;

import java.time.Instant;

/** Un lote/serie activo ahora mismo en una estacion -- name es el producto asociado, value el id de Odoo del lote, label su codigo, position su posicion fisica (null si no tiene). */
public record MaterialLoadDto(Long id, String name, String value, String label, String position, Instant loadedAt) {
}

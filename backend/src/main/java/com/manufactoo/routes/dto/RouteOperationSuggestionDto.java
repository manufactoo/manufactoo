package com.manufactoo.routes.dto;

/**
 * Una operacion de la ruta de Odoo de un producto (mrp.routing.workcenter),
 * en el orden de esa ruta -- para el atajo "Rellenar desde las operaciones
 * de Odoo" del formulario de Rutas (ver conversacion 2026-08-04). workcenterId
 * puede ser null si la operacion no tiene Work Center asignado en Odoo.
 */
public record RouteOperationSuggestionDto(String name, Long workcenterId, String workcenterName) {
}

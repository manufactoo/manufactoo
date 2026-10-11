package com.manufactoo.stations.dto;

/**
 * reasonId es el id de Odoo de mrp.workcenter.productivity.loss (catalogo
 * ODOO_LOSS_REASONS); reasonName va cacheado desde el propio desplegable del
 * frontend (mismo patron que Route.productName), asi el backend no necesita
 * resolverlo de vuelta contra Odoo solo para guardar la etiqueta.
 */
public record BlockWorkOrderSessionRequest(Long reasonId, String reasonName) {
}

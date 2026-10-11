package com.manufactoo.odoo.connector;

/** Tipos de dato maestro leidos en vivo desde Odoo (nunca replicados en Manufactoo). */
public enum OdooMasterDataEntity {
    PRODUCT,
    BOM,
    MANUFACTURING_ORDER,
    OPERATOR,
    /** Numeros de serie/lote (stock.lot): identifican una unidad o lote fisico concreto. */
    SERIAL,
    /** Work Centers (mrp.workcenter): recurso/maquina/linea con capacidad y coste asignable. */
    WORKCENTER,
    /** Ordenes de trabajo (mrp.workorder): instancia de una operacion para una orden de fabricacion concreta. */
    WORKORDER,
    /** Operaciones (mrp.routing.workcenter): paso de la ruta de un BOM, apunta a un WORKCENTER. Solo se usa internamente (ver DataSourceResolver.resolveOperations), no es un DataSourceType elegible por un widget. */
    OPERATION,
    /** Motivos de bloqueo (mrp.workcenter.productivity.loss): catalogo de causas de perdida/bloqueo de un Work Center. */
    LOSS_REASON
}

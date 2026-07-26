package com.manufactoo.odoo.connector;

/** Tipos de dato maestro leidos en vivo desde Odoo (nunca replicados en Manufactoo). */
public enum OdooMasterDataEntity {
    PRODUCT,
    BOM,
    MANUFACTURING_ORDER,
    OPERATOR,
    /** Numeros de serie/lote (stock.lot): identifican una unidad o lote fisico concreto. */
    SERIAL
}

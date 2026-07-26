package com.manufactoo.stations;

/**
 * De donde salen las opciones de un widget con origen de datos (p. ej. un
 * desplegable). Los ODOO_* se resuelven en vivo contra Odoo reutilizando
 * MasterDataService (Manufactoo nunca replica esos datos). STATIC_LIST usa una
 * lista fija que el usuario escribe al diseñar el layout.
 */
public enum DataSourceType {
    STATIC_LIST,
    ODOO_PRODUCTS,
    ODOO_MANUFACTURING_ORDERS,
    ODOO_OPERATORS,
    ODOO_BOMS,
    /** Numeros de serie/lote (stock.lot): la unidad fisica concreta que se esta fabricando. */
    ODOO_SERIALS
}

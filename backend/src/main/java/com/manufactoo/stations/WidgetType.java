package com.manufactoo.stations;

/**
 * Tipos de widget que el usuario puede colocar en el layout de una estacion.
 * El WidgetCatalog es la fuente unica de verdad de sus metadatos (categoria,
 * si necesita binding, si admite origen de datos, campos de configuracion).
 * Se empieza con un conjunto minimo (el desplegable es el caso estrella pedido)
 * y se amplia añadiendo entradas aqui y en WidgetCatalog.
 */
public enum WidgetType {
    /** Desplegable cuyas opciones salen de un origen de datos (Odoo o lista estatica). */
    DROPDOWN,
    /** Entrada de texto libre escrita por el operario. */
    TEXT_INPUT,
    /** Entrada numerica. */
    NUMBER_INPUT,
    /** Texto fijo de solo lectura (instrucciones, titulos). */
    LABEL,
    /** Imagen subida (p. ej. instrucciones de montaje). Solo muestra, no captura. */
    IMAGE,
    /** Tabla enlazada a un origen de datos: muestra todas sus filas (ordenes, productos...). */
    TABLE,
    /** Boton de navegacion de la secuencia (siguiente/anterior/ir a/finalizar). */
    BUTTON
}

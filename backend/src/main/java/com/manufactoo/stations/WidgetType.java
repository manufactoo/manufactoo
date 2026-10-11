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
    BUTTON,
    /**
     * Lista de series/lotes cargados en la estacion ahora mismo (p. ej. los
     * carretes de componentes de una maquina de pick and place). Puramente
     * informativo -- no requiere binding ni lo rellena el operario: los
     * lotes activos son un dato de la ESTACION, no de este widget ni de
     * ninguna "ranura" con nombre (varios lotes del mismo producto pueden
     * estar activos a la vez). Cada unidad que pasa mientras tanto los
     * hereda automaticamente (ver StationService.mergeActiveMaterialLoads).
     */
    STATION_MATERIALS,
    /**
     * Puramente decorativo: un rectangulo con borde (y fondo opcional) para
     * agrupar visualmente otros widgets colocados encima -- sin relacion real
     * de contenido/anidamiento en los datos, cada widget sigue siendo
     * independiente en la misma rejilla plana de la pantalla (ver
     * conversacion 2026-08-01). Se renderiza siempre detras del resto.
     */
    PANEL,
    /**
     * Ultimos registros de trazabilidad de ESTA estacion (station_trace_records),
     * no un origen de datos Odoo -- puramente informativo para que el operario
     * vea sobre la marcha lo ultimo que ha pasado por su puesto, sin salir a la
     * pagina de Registros. No requiere binding ni origen de datos propio (ver
     * conversacion 2026-08-02).
     */
    STATION_HISTORY,
    /**
     * Start/Pausar/Bloquear/Finalizar + cantidad sobre el work order
     * seleccionado en una TABLE(ODOO_WORKORDERS) vinculada (config.boundTo,
     * igual mecanismo que ya usa LABEL) -- escribe de verdad en Odoo
     * (mrp.workorder/mrp.workcenter.productivity, ver OdooShopFloorService) y
     * lleva ademas su propia sesion local (WorkOrderSessionService). No
     * requiere binding ni origen de datos propio: su "dato" es el work order
     * ya seleccionado en la tabla vinculada, no algo que rellene el operario
     * (ver conversacion 2026-08-05).
     */
    WORKORDER_ACTIONS
}

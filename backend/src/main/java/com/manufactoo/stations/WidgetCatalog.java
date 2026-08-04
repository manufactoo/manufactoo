package com.manufactoo.stations;

import java.util.Arrays;
import java.util.List;

/**
 * Fuente unica de verdad de los widgets disponibles en el editor de estaciones:
 * su categoria, si necesitan una clave de binding (para guardar el valor en
 * trazabilidad), si admiten un origen de datos, y que campos de configuracion
 * tienen. StationService valida contra esto mismo, asi que backend y frontend
 * no pueden divergir (el frontend solo pide GET /api/stations/widget-catalog).
 *
 * Mismo patron que DeviceCatalog. A diferencia del proyecto de referencia
 * analizado, donde el binding a "producto"/"orden" estaba cableado por tipo de
 * widget, aqui el binding a datos es generico: un unico widget DROPDOWN elige su
 * origen (Odoo productos/ordenes/operarios/BOM o lista estatica) via DataSource.
 */
public final class WidgetCatalog {

    private WidgetCatalog() {
    }

    public record WidgetDescriptor(
            String type,
            WidgetCategory category,
            boolean requiresBinding,
            boolean supportsDataSource,
            List<WidgetFieldDef> configFields
    ) {
    }

    private static final List<WidgetDescriptor> WIDGETS = List.of(
            new WidgetDescriptor(
                    WidgetType.DROPDOWN.name(), WidgetCategory.DATA, true, true,
                    List.of(
                            WidgetFieldDef.text("placeholder", false, ""),
                            // Si esta marcado, confirmar este campo (seleccionar una
                            // opcion, a mano o por escaneo/Player) finaliza el flujo
                            // de la estacion y registra la unidad como OK -- no hace
                            // falta un BUTTON aparte (ver conversacion 2026-07-31).
                            WidgetFieldDef.checkbox("finalizesFlow"),
                            // Si esta marcado, el valor de este campo NO se limpia tras
                            // enviar el registro -- se mantiene para la siguiente unidad
                            // (p. ej. el operario de turno: se elige una vez, no en cada
                            // unidad). Puramente de runtime, no afecta a la validacion.
                            WidgetFieldDef.checkbox("sticky"))),
            new WidgetDescriptor(
                    // supportsDataSource=true pero OPCIONAL para este tipo (ver
                    // StationService.validate): a diferencia de DROPDOWN/TABLE, un
                    // TEXT_INPUT sin origen de datos sigue siendo un texto libre
                    // valido. Si se elige uno + una columna de coincidencia, el
                    // codigo tecleado a mano se valida contra Odoo (p. ej. el
                    // codigo de operario) y se muestra un dato de detalle (nombre).
                    WidgetType.TEXT_INPUT.name(), WidgetCategory.DATA, true, true,
                    List.of(
                            WidgetFieldDef.text("placeholder", false, ""),
                            // Si esta marcado, pulsar Enter en este campo (p. ej. tras
                            // escanear un numero de serie) finaliza el flujo de la
                            // estacion y registra la unidad como OK, sin necesitar un
                            // BUTTON aparte.
                            WidgetFieldDef.checkbox("finalizesFlow"),
                            WidgetFieldDef.checkbox("sticky"))),
            new WidgetDescriptor(
                    WidgetType.NUMBER_INPUT.name(), WidgetCategory.DATA, true, false,
                    List.of(
                            WidgetFieldDef.text("placeholder", false, ""),
                            WidgetFieldDef.number("min", false, ""),
                            WidgetFieldDef.number("max", false, ""),
                            WidgetFieldDef.checkbox("sticky"))),
            new WidgetDescriptor(
                    // "text" ya no es obligatorio aqui: una Etiqueta puede llevar texto
                    // fijo (el caso de siempre) O estar vinculada a otro widget de la
                    // estacion (config.boundTo/boundField, ver StationService.validate y
                    // WidgetView) para mostrar en vivo un dato suyo -- el valor tecleado,
                    // o una columna resuelta de Odoo. Al menos una de las dos hace falta;
                    // eso se comprueba en StationService, no aqui (el catalogo no sabe de
                    // otros widgets de la misma estacion).
                    WidgetType.LABEL.name(), WidgetCategory.DISPLAY, false, false,
                    List.of(
                            WidgetFieldDef.text("text", false, ""),
                            WidgetFieldDef.checkbox("showDateTime"),
                            WidgetFieldDef.text("dateTimeFormat", false, "dd/MM/yyyy HH:mm:ss"),
                            // Mismo patron que showDateTime: un "contenido especial" en vez de
                            // texto tecleado, siempre en vivo (si se renombra la estacion o la
                            // pantalla, el LABEL no queda desincronizado como pasaria si se
                            // copiara el nombre a mano). Ver conversacion 2026-08-03: antes el
                            // runtime imponia el nombre de estacion/pantalla fijo arriba, sin
                            // poder moverlo, ocultarlo ni darle estilo -- ahora es un LABEL mas.
                            WidgetFieldDef.checkbox("showStationName"),
                            WidgetFieldDef.checkbox("showScreenTitle"))),
            new WidgetDescriptor(
                    WidgetType.IMAGE.name(), WidgetCategory.DISPLAY, false, false,
                    List.of(WidgetFieldDef.select("fit", false, List.of("CONTAIN", "COVER")))),
            new WidgetDescriptor(
                    WidgetType.TABLE.name(), WidgetCategory.DISPLAY, false, true,
                    List.of(
                            WidgetFieldDef.select("selectionMode", false, List.of("NONE", "SINGLE", "MULTI")),
                            WidgetFieldDef.text("valueColumn", false, "id"),
                            WidgetFieldDef.number("maxRows", false, "20"))),
            new WidgetDescriptor(
                    // MATERIALS abre el popup de gestion de lotes/series activos en la
                    // estacion (ver MaterialLoadService) -- no requiere ningun widget
                    // STATION_MATERIALS presente, ambos son independientes.
                    WidgetType.BUTTON.name(), WidgetCategory.DISPLAY, false, false,
                    List.of(
                            WidgetFieldDef.text("text", true, ""),
                            WidgetFieldDef.select("action", true, List.of("NEXT", "PREV", "GOTO", "SUBMIT", "MATERIALS")),
                            WidgetFieldDef.number("targetScreen", false, "1"),
                            // Solo tiene efecto con action=SUBMIT: dos BUTTON con action=SUBMIT
                            // (uno result=OK, otro result=NG) sustituyen al unico "Finalizar" de
                            // siempre cuando la estacion necesita marcar el paso como bueno/malo.
                            // NONE (por defecto) = comportamiento de siempre, sin resultado.
                            WidgetFieldDef.select("result", false, List.of("NONE", "OK", "NG")))),
            new WidgetDescriptor(
                    // Puramente informativo: pinta la lista de series/lotes activos
                    // ahora mismo en la ESTACION (no en este widget) -- no requiere
                    // binding (no hay "ranura" que nombrar: los lotes activos son un
                    // dato de la estacion, ver conversacion 2026-07-30, tercera vuelta)
                    // ni origen de datos propio (la carga siempre se valida contra
                    // series/lotes de Odoo, ver MaterialLoadService). No se rellena por
                    // envio -- cada unidad hereda los lotes activos automaticamente.
                    WidgetType.STATION_MATERIALS.name(), WidgetCategory.DISPLAY, false, false,
                    List.of()),
            new WidgetDescriptor(
                    // Sin config propia: el borde es fijo, el relleno (si se quiere)
                    // usa el mismo config.styles.panel.backgroundColor que cualquier
                    // otro widget -- ver WIDGET_STYLE_PARTS en WidgetView.tsx.
                    WidgetType.PANEL.name(), WidgetCategory.DISPLAY, false, false,
                    List.of()),
            new WidgetDescriptor(
                    // Puramente informativo: lee station_trace_records de ESTA estacion
                    // (no un DataSourceType, no es dato Odoo) -- sin binding (no rellena
                    // el formulario) ni origen de datos propio. maxRows limita cuantos
                    // registros recientes trae (mismo patron que TABLE.maxRows).
                    WidgetType.STATION_HISTORY.name(), WidgetCategory.DISPLAY, false, false,
                    List.of(WidgetFieldDef.number("maxRows", false, "10")))
    );

    public static List<WidgetDescriptor> widgets() {
        return WIDGETS;
    }

    public static WidgetDescriptor forType(String type) {
        return WIDGETS.stream().filter(w -> w.type().equals(type)).findFirst().orElse(null);
    }

    public static List<String> dataSourceTypes() {
        return Arrays.stream(DataSourceType.values()).map(Enum::name).toList();
    }
}

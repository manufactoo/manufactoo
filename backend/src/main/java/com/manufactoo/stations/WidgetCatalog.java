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
                            // Igual que en BUTTON: si no es NONE, confirmar este campo
                            // (seleccionar una opcion, a mano o por escaneo/Player)
                            // finaliza y registra la unidad con ese resultado -- no hace
                            // falta un BUTTON aparte (ver conversacion 2026-07-31).
                            WidgetFieldDef.select("result", false, List.of("NONE", "OK", "NG")))),
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
                            // Pulsar Enter en este campo (p. ej. tras escanear un numero
                            // de serie) finaliza y registra la unidad con este resultado,
                            // sin necesitar un BUTTON aparte.
                            WidgetFieldDef.select("result", false, List.of("NONE", "OK", "NG")))),
            new WidgetDescriptor(
                    WidgetType.NUMBER_INPUT.name(), WidgetCategory.DATA, true, false,
                    List.of(
                            WidgetFieldDef.text("placeholder", false, ""),
                            WidgetFieldDef.number("min", false, ""),
                            WidgetFieldDef.number("max", false, ""))),
            new WidgetDescriptor(
                    // "text" ya no es obligatorio aqui: una Etiqueta puede llevar texto
                    // fijo (el caso de siempre) O estar vinculada a otro widget de la
                    // estacion (config.boundTo/boundField, ver StationService.validate y
                    // WidgetView) para mostrar en vivo un dato suyo -- el valor tecleado,
                    // o una columna resuelta de Odoo. Al menos una de las dos hace falta;
                    // eso se comprueba en StationService, no aqui (el catalogo no sabe de
                    // otros widgets de la misma estacion).
                    WidgetType.LABEL.name(), WidgetCategory.DISPLAY, false, false,
                    List.of(WidgetFieldDef.text("text", false, ""))),
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
                    List.of())
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

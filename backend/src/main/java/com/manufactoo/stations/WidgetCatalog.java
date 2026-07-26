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
                    List.of(WidgetFieldDef.text("placeholder", false, ""))),
            new WidgetDescriptor(
                    WidgetType.TEXT_INPUT.name(), WidgetCategory.DATA, true, false,
                    List.of(WidgetFieldDef.text("placeholder", false, ""))),
            new WidgetDescriptor(
                    WidgetType.NUMBER_INPUT.name(), WidgetCategory.DATA, true, false,
                    List.of(
                            WidgetFieldDef.text("placeholder", false, ""),
                            WidgetFieldDef.number("min", false, ""),
                            WidgetFieldDef.number("max", false, ""))),
            new WidgetDescriptor(
                    WidgetType.LABEL.name(), WidgetCategory.DISPLAY, false, false,
                    List.of(WidgetFieldDef.text("text", true, ""))),
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
                    WidgetType.BUTTON.name(), WidgetCategory.DISPLAY, false, false,
                    List.of(
                            WidgetFieldDef.select("action", true, List.of("NEXT", "PREV", "GOTO", "SUBMIT")),
                            WidgetFieldDef.number("targetScreen", false, "1")))
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

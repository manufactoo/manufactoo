package com.manufactoo.stations;

import java.util.List;

/**
 * Definicion de un campo de configuracion de un widget. El editor construye el
 * panel de propiedades dinamicamente a partir de esto (igual que DeviceFieldDef
 * hace con el formulario de dispositivos), de modo que backend y frontend nunca
 * divergen: el frontend solo pide GET /api/stations/widget-catalog.
 */
public record WidgetFieldDef(
        String key,
        String labelKey,
        WidgetFieldType type,
        boolean required,
        List<String> options,
        String placeholder
) {
    public static WidgetFieldDef text(String key, boolean required, String placeholder) {
        return new WidgetFieldDef(key, "stations.fields." + key, WidgetFieldType.TEXT, required, List.of(), placeholder);
    }

    public static WidgetFieldDef number(String key, boolean required, String placeholder) {
        return new WidgetFieldDef(key, "stations.fields." + key, WidgetFieldType.NUMBER, required, List.of(), placeholder);
    }

    public static WidgetFieldDef select(String key, boolean required, List<String> options) {
        return new WidgetFieldDef(key, "stations.fields." + key, WidgetFieldType.SELECT, required, options, null);
    }

    public static WidgetFieldDef checkbox(String key) {
        return new WidgetFieldDef(key, "stations.fields." + key, WidgetFieldType.CHECKBOX, false, List.of(), null);
    }
}

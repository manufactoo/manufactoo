package com.manufactoo.devices;

import java.util.List;

/**
 * Definicion de un campo de configuracion (conexion o settings). El frontend
 * construye el formulario dinamicamente a partir de esto en vez de duplicar
 * la lista de campos por su cuenta, para que backend y frontend nunca
 * diverjan (a diferencia del proyecto de referencia analizado, donde el
 * catalogo solo vivia en el frontend y el backend no validaba nada).
 */
public record DeviceFieldDef(
        String key,
        String labelKey,
        FieldType type,
        boolean required,
        List<String> options,
        String placeholder
) {
    public static DeviceFieldDef text(String key, boolean required, String placeholder) {
        return new DeviceFieldDef(key, "devices.fields." + key, FieldType.TEXT, required, List.of(), placeholder);
    }

    public static DeviceFieldDef number(String key, boolean required, String placeholder) {
        return new DeviceFieldDef(key, "devices.fields." + key, FieldType.NUMBER, required, List.of(), placeholder);
    }

    public static DeviceFieldDef select(String key, boolean required, List<String> options) {
        return new DeviceFieldDef(key, "devices.fields." + key, FieldType.SELECT, required, options, null);
    }

    public static DeviceFieldDef csv(String key, boolean required, String placeholder) {
        return new DeviceFieldDef(key, "devices.fields." + key, FieldType.CSV, required, List.of(), placeholder);
    }
}

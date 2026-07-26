package com.manufactoo.stations.dto;

import java.util.List;
import java.util.Map;

/** Filas + columnas de un origen de datos, para el widget TABLE. */
public record DataSourceTableDto(List<Column> columns, List<Map<String, Object>> rows) {

    /** labelKey reutiliza las claves ya traducidas de masterData.columns.* del frontend. */
    public record Column(String key, String labelKey) {
        public static Column of(String key) {
            return new Column(key, "masterData.columns." + key);
        }
    }
}

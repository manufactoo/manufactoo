package com.manufactoo.stations.dto;

import com.manufactoo.stations.WidgetCatalog;

import java.util.List;
import java.util.Map;

public record WidgetCatalogDto(
        List<WidgetCatalog.WidgetDescriptor> widgets,
        List<String> dataSources,
        Map<String, List<String>> lookupColumns
) {
}

package com.manufactoo.stations.dto;

import com.manufactoo.stations.ScreenWidget;

import java.util.Map;

public record WidgetDto(
        Long id,
        String widgetType,
        String label,
        String bindingKey,
        boolean required,
        Long sourceDeviceId,
        Long sourceEventId,
        Map<String, Object> config,
        Map<String, Object> dataSource,
        Map<String, Object> layout,
        int orderIndex
) {
    public static WidgetDto from(ScreenWidget w) {
        return new WidgetDto(
                w.getId(),
                w.getWidgetType(),
                w.getLabel(),
                w.getBindingKey(),
                w.isRequired(),
                w.getSourceDeviceId(),
                w.getSourceEventId(),
                w.getConfig(),
                w.getDataSource(),
                w.getLayout(),
                w.getOrderIndex()
        );
    }
}

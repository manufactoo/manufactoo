package com.manufactoo.stations.dto;

/** Una orden de fabricacion abierta (no done/cancel), con su completitud calculada -- ver OdooProductionService.listOpenOrders. */
public record OpenManufacturingOrderDto(
        Long id,
        String name,
        String productName,
        double productQty,
        double qtyProducing,
        double completionPercent,
        String state
) {
}

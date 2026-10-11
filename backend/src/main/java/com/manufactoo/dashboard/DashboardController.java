package com.manufactoo.dashboard;

import com.manufactoo.stations.OdooProductionService;
import com.manufactoo.stations.dto.OpenManufacturingOrderDto;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Datos agregados para el Dashboard (Home) -- por ahora solo el grafico de ordenes de fabricacion abiertas. */
@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {

    private final OdooProductionService productionService;

    public DashboardController(OdooProductionService productionService) {
        this.productionService = productionService;
    }

    @GetMapping("/open-orders")
    public List<OpenManufacturingOrderDto> openOrders() {
        return productionService.listOpenOrders();
    }
}

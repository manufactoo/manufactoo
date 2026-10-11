package com.manufactoo.routes;

import com.manufactoo.routes.dto.RouteDto;
import com.manufactoo.routes.dto.RouteOperationSuggestionDto;
import com.manufactoo.routes.dto.UpsertRouteRequest;
import com.manufactoo.stations.DataSourceResolver;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/routes")
public class RouteController {

    private final RouteService service;
    // Inyectado directo (no via RouteService) para no crear una dependencia
    // circular: DataSourceResolver ya depende de RouteService (para filtrar
    // ordenes de fabricacion por ruta -- ver filterByRouteProducts), asi que
    // RouteService no puede depender de DataSourceResolver a su vez.
    private final DataSourceResolver dataSourceResolver;

    public RouteController(RouteService service, DataSourceResolver dataSourceResolver) {
        this.service = service;
        this.dataSourceResolver = dataSourceResolver;
    }

    /**
     * Operaciones de la ruta de Odoo de un producto, para el atajo "Rellenar
     * desde las operaciones de Odoo" del formulario de Rutas (ver
     * DataSourceResolver.resolveRouteOperations).
     */
    @GetMapping("/odoo-operations")
    public List<RouteOperationSuggestionDto> odooOperations(@RequestParam Long productId) {
        return dataSourceResolver.resolveRouteOperations(productId);
    }

    @GetMapping
    public List<RouteDto> list() {
        return service.list();
    }

    @GetMapping("/{id}")
    public RouteDto get(@PathVariable Long id) {
        return service.get(id);
    }

    @PostMapping
    public RouteDto create(@Valid @RequestBody UpsertRouteRequest request) {
        return service.create(request);
    }

    @PutMapping("/{id}")
    public RouteDto update(@PathVariable Long id, @Valid @RequestBody UpsertRouteRequest request) {
        return service.update(id, request);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) {
        service.delete(id);
    }
}

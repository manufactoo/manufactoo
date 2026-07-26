package com.manufactoo.routes;

import com.manufactoo.routes.dto.RouteDto;
import com.manufactoo.routes.dto.UpsertRouteRequest;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/routes")
public class RouteController {

    private final RouteService service;

    public RouteController(RouteService service) {
        this.service = service;
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

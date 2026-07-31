package com.manufactoo.stations;

import com.manufactoo.stations.dto.StationMaterialLoadDto;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Vista cruzada de materiales: que hay cargado ahora mismo en cada estacion de toda la instalacion. */
@RestController
@RequestMapping("/api/material-loads")
public class MaterialLoadController {

    private final MaterialLoadService service;

    public MaterialLoadController(MaterialLoadService service) {
        this.service = service;
    }

    @GetMapping
    public List<StationMaterialLoadDto> listAllActive() {
        return service.listAllActive();
    }
}

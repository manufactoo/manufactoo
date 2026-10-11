package com.manufactoo.stations;

import com.manufactoo.stations.dto.WorkCenterSessionDto;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Vista cruzada de Work Centers: que sesiones de work order estan activas ahora mismo en toda la instalacion. */
@RestController
@RequestMapping("/api/work-order-sessions")
public class WorkOrderSessionController {

    private final WorkOrderSessionService service;

    public WorkOrderSessionController(WorkOrderSessionService service) {
        this.service = service;
    }

    @GetMapping
    public List<WorkCenterSessionDto> listAllActive() {
        return service.listAllActive();
    }
}

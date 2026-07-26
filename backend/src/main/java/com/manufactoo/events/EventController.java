package com.manufactoo.events;

import com.manufactoo.events.dto.EventDto;
import com.manufactoo.events.dto.UpsertEventRequest;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/events")
public class EventController {

    private final EventService service;

    public EventController(EventService service) {
        this.service = service;
    }

    @GetMapping
    public List<EventDto> list() {
        return service.list();
    }

    @GetMapping("/{id}")
    public EventDto get(@PathVariable Long id) {
        return service.get(id);
    }

    @PostMapping
    public EventDto create(@Valid @RequestBody UpsertEventRequest request) {
        return service.create(request);
    }

    @PutMapping("/{id}")
    public EventDto update(@PathVariable Long id, @Valid @RequestBody UpsertEventRequest request) {
        return service.update(id, request);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) {
        service.delete(id);
    }
}

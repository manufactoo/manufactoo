package com.manufactoo.events;

import com.manufactoo.apps.AppService;
import com.manufactoo.apps.TraceabilityGenealogyApp;
import com.manufactoo.events.dto.EventDto;
import com.manufactoo.events.dto.UpsertEventRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
public class EventService {

    private final EventRepository repository;
    private final AppService appService;

    public EventService(EventRepository repository, AppService appService) {
        this.repository = repository;
        this.appService = appService;
    }

    public List<EventDto> list() {
        requireAppInstalled();
        return repository.findAll().stream().map(EventDto::from).toList();
    }

    public EventDto get(Long id) {
        requireAppInstalled();
        return EventDto.from(find(id));
    }

    public EventDto create(UpsertEventRequest request) {
        requireAppInstalled();
        Event event = new Event();
        applyRequest(event, request);
        repository.save(event);
        return EventDto.from(event);
    }

    public EventDto update(Long id, UpsertEventRequest request) {
        requireAppInstalled();
        Event event = find(id);
        applyRequest(event, request);
        repository.save(event);
        return EventDto.from(event);
    }

    public void delete(Long id) {
        requireAppInstalled();
        if (!repository.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Evento no encontrado.");
        }
        repository.deleteById(id);
    }

    private Event find(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Evento no encontrado."));
    }

    private void applyRequest(Event event, UpsertEventRequest request) {
        event.setName(request.name());
        event.setTopic(request.topic());
        event.setDirection(request.direction());
        event.setEnabled(request.enabled());
    }

    private void requireAppInstalled() {
        if (!appService.isInstalled(TraceabilityGenealogyApp.KEY)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Instala la app Trazabilidad y genealogia para gestionar eventos.");
        }
    }
}

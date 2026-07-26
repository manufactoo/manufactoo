package com.manufactoo.routes;

import com.manufactoo.apps.AppService;
import com.manufactoo.apps.TraceabilityGenealogyApp;
import com.manufactoo.routes.dto.RouteDto;
import com.manufactoo.routes.dto.RouteStepDto;
import com.manufactoo.routes.dto.UpsertRouteRequest;
import com.manufactoo.routes.dto.UpsertRouteRequest.UpsertStep;
import com.manufactoo.stations.Station;
import com.manufactoo.stations.StationRepository;
import jakarta.transaction.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

@Service
public class RouteService {

    private final RouteRepository repository;
    private final StationRepository stationRepository;
    private final AppService appService;

    public RouteService(RouteRepository repository, StationRepository stationRepository, AppService appService) {
        this.repository = repository;
        this.stationRepository = stationRepository;
        this.appService = appService;
    }

    @Transactional
    public List<RouteDto> list() {
        requireAppInstalled();
        return repository.findAll().stream().map(this::toDto).toList();
    }

    @Transactional
    public RouteDto get(Long id) {
        requireAppInstalled();
        return toDto(find(id));
    }

    @Transactional
    public RouteDto create(UpsertRouteRequest request) {
        requireAppInstalled();
        Route route = new Route();
        applyRequest(route, request);
        repository.save(route);
        return toDto(route);
    }

    @Transactional
    public RouteDto update(Long id, UpsertRouteRequest request) {
        requireAppInstalled();
        Route route = find(id);
        applyRequest(route, request);
        repository.save(route);
        return toDto(route);
    }

    public void delete(Long id) {
        requireAppInstalled();
        if (!repository.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Ruta no encontrada.");
        }
        repository.deleteById(id);
    }

    /** Rutas habilitadas que incluyen esta estacion como paso, con el indice de ese paso resuelto. Usado por la validacion de envio (ver StationService). */
    @Transactional
    public List<Route> findEnabledRoutesForStation(Long stationId) {
        return repository.findByEnabledTrue().stream()
                .filter(r -> r.getSteps().stream().anyMatch(s -> s.getStationId().equals(stationId)))
                .toList();
    }

    private Route find(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Ruta no encontrada."));
    }

    private void applyRequest(Route route, UpsertRouteRequest request) {
        route.setName(request.name());
        route.setDescription(request.description() != null ? request.description() : "");
        route.setProductId(request.productId());
        route.setProductName(request.productName());
        route.setIdentifierBindingKey(request.identifierBindingKey());
        route.setEnabled(request.enabled());

        List<UpsertStep> incoming = request.steps() != null ? request.steps() : List.of();
        if (incoming.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Una ruta necesita al menos un paso.");
        }

        Map<Long, Station> stations = stationRepository.findAllById(
                incoming.stream().map(UpsertStep::stationId).toList()
        ).stream().collect(java.util.stream.Collectors.toMap(Station::getId, s -> s));

        // Los pasos no tienen referencias externas (a diferencia de los widgets de
        // una pantalla, nada apunta a un route_step.id), asi que se reemplazan en
        // bloque: mas simple que reconciliar por id y sin ningun efecto secundario.
        route.getSteps().clear();
        int idx = 0;
        for (UpsertStep si : incoming) {
            Station station = stations.get(si.stationId());
            if (station == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Estacion " + si.stationId() + " no encontrada.");
            }
            RouteStep step = new RouteStep();
            step.setStationId(si.stationId());
            step.setOrderIndex(idx);
            step.setName(si.name() != null && !si.name().isBlank() ? si.name() : station.getName());
            route.addStep(step);
            idx++;
        }
    }

    private RouteDto toDto(Route route) {
        List<RouteStepDto> steps = route.getSteps().stream()
                .map(s -> RouteStepDto.from(s, stationRepository.findById(s.getStationId()).map(Station::getName).orElse(null)))
                .toList();
        return new RouteDto(route.getId(), route.getName(), route.getDescription(), route.getProductId(),
                route.getProductName(), route.getIdentifierBindingKey(), route.isEnabled(), steps,
                route.getCreatedAt(), route.getUpdatedAt());
    }

    private void requireAppInstalled() {
        if (!appService.isInstalled(TraceabilityGenealogyApp.KEY)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Instala la app Trazabilidad y genealogia para gestionar rutas.");
        }
    }
}

package com.manufactoo.routes;

import com.manufactoo.apps.AppService;
import com.manufactoo.apps.TraceabilityGenealogyApp;
import com.manufactoo.common.Messages;
import com.manufactoo.routes.dto.RouteDto;
import com.manufactoo.routes.dto.RouteStepDto;
import com.manufactoo.routes.dto.UpsertRouteRequest;
import com.manufactoo.routes.dto.UpsertRouteRequest.UpsertStep;
import com.manufactoo.stations.Station;
import com.manufactoo.stations.StationRepository;
import com.manufactoo.stations.StationService;
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
    private final Messages messages;

    public RouteService(RouteRepository repository, StationRepository stationRepository, AppService appService, Messages messages) {
        this.repository = repository;
        this.stationRepository = stationRepository;
        this.appService = appService;
        this.messages = messages;
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
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, messages.get("route.notFound"));
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

    private static boolean stationCapturesIdentifier(Station station, String identifierBindingKey) {
        return station.getScreens().stream()
                .flatMap(sc -> sc.getWidgets().stream())
                .anyMatch(w -> identifierBindingKey.equals(w.getBindingKey()) && StationService.capturesData(w));
    }

    private Route find(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, messages.get("route.notFound")));
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
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, messages.get("route.needsAtLeastOneStep"));
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
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, messages.get("route.step.stationNotFound", si.stationId()));
            }
            // Si la estacion no captura el identificador de la ruta en ningun
            // widget, la ruta nunca se aplicaria de verdad al llegar aqui
            // (StationService.resolveIdentifierKeys la salta en silencio cuando
            // el envio no trae esa clave) -- mejor fallar aqui, al guardar, con
            // un mensaje claro, que descubrirlo en produccion. Solo se exige si
            // la ruta se guarda HABILITADA: una ruta deshabilitada no tiene
            // ningun efecto en tiempo de ejecucion (ver findEnabledRoutesForStation),
            // asi que debe poder guardarse a medio configurar mientras se arregla
            // sin bloquear el propio guardado que la arreglaria.
            if (route.isEnabled() && !stationCapturesIdentifier(station, route.getIdentifierBindingKey())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        messages.get("route.step.identifierNotCaptured", station.getName(), route.getIdentifierBindingKey()));
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
                    messages.get("route.appNotInstalled"));
        }
    }
}

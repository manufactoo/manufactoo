package com.manufactoo.stations;

import com.manufactoo.apps.AppService;
import com.manufactoo.apps.TraceabilityGenealogyApp;
import com.manufactoo.routes.Route;
import com.manufactoo.routes.RouteService;
import com.manufactoo.routes.RouteStep;
import com.manufactoo.stations.dto.DataSourceOption;
import com.manufactoo.stations.dto.DataSourceTableDto;
import com.manufactoo.stations.dto.StationDto;
import com.manufactoo.stations.dto.SubmitRecordRequest;
import com.manufactoo.stations.dto.TraceRecordDto;
import com.manufactoo.stations.dto.UpsertStationRequest;
import com.manufactoo.stations.dto.UpsertStationRequest.UpsertScreen;
import com.manufactoo.stations.dto.UpsertStationRequest.UpsertWidget;
import jakarta.transaction.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class StationService {

    private static final Set<String> ALLOWED_IMAGE_TYPES = Set.of("image/png", "image/jpeg", "image/webp", "image/svg+xml", "image/gif");
    private static final long MAX_IMAGE_BYTES = 3L * 1024 * 1024; // 3 MB

    private final StationRepository repository;
    private final StationTraceRecordRepository traceRepository;
    private final StationAssetRepository assetRepository;
    private final DataSourceResolver dataSourceResolver;
    private final AppService appService;
    private final RouteService routeService;

    public StationService(StationRepository repository, StationTraceRecordRepository traceRepository,
                          StationAssetRepository assetRepository, DataSourceResolver dataSourceResolver,
                          AppService appService, RouteService routeService) {
        this.repository = repository;
        this.traceRepository = traceRepository;
        this.assetRepository = assetRepository;
        this.dataSourceResolver = dataSourceResolver;
        this.appService = appService;
        this.routeService = routeService;
    }

    /** Opciones de un desplegable resueltas en vivo desde su origen de datos Odoo. */
    public List<DataSourceOption> resolveDataSource(DataSourceType type, int limit) {
        requireAppInstalled();
        return dataSourceResolver.resolve(type, limit);
    }

    /** Filas + columnas de un origen de datos, para el widget TABLE. */
    public DataSourceTableDto resolveDataSourceTable(DataSourceType type, int limit) {
        requireAppInstalled();
        return dataSourceResolver.resolveTable(type, limit);
    }

    /**
     * Resuelve un codigo en bruto (leido por un dispositivo o evento MQTT, p.
     * ej. el codigo de barras de la credencial de un operario) al registro
     * Odoo real: lo que se muestra en pantalla es el nombre resuelto, y lo que
     * se guarda en trazabilidad es el id de ese registro, no el codigo leido.
     */
    public DataSourceOption resolveLookup(DataSourceType type, String column, String code) {
        requireAppInstalled();
        return dataSourceResolver.lookup(type, column, code)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "No se ha encontrado ningun registro con " + column + " = " + code));
    }

    /** Registros de genealogia de una estacion, mas recientes primero. */
    @Transactional
    public List<TraceRecordDto> listRecords(Long stationId) {
        requireAppInstalled();
        if (!repository.existsById(stationId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Estacion no encontrada.");
        }
        return traceRepository.findByStationIdOrderByCreatedAtDesc(stationId).stream()
                .map(TraceRecordDto::from).toList();
    }

    /** Sube una imagen para un widget IMAGE y devuelve su id. */
    public Long uploadAsset(MultipartFile file) {
        requireAppInstalled();
        if (file.isEmpty()) {
            throw badRequest("El fichero esta vacio.");
        }
        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_IMAGE_TYPES.contains(contentType)) {
            throw badRequest("Formato no soportado. Usa PNG, JPEG, WEBP, GIF o SVG.");
        }
        if (file.getSize() > MAX_IMAGE_BYTES) {
            throw badRequest("La imagen no puede superar 3 MB.");
        }
        try {
            StationAsset asset = new StationAsset();
            asset.setFilename(file.getOriginalFilename() != null ? file.getOriginalFilename() : "imagen");
            asset.setContentType(contentType);
            asset.setData(file.getBytes());
            assetRepository.save(asset);
            return asset.getId();
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No se pudo leer el fichero.");
        }
    }

    public StationAsset getAsset(Long assetId) {
        requireAppInstalled();
        return assetRepository.findById(assetId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Imagen no encontrada."));
    }

    @Transactional
    public List<StationDto> list() {
        requireAppInstalled();
        return repository.findAll().stream().map(StationDto::from).toList();
    }

    @Transactional
    public StationDto get(Long id) {
        requireAppInstalled();
        return StationDto.from(find(id));
    }

    @Transactional
    public StationDto create(UpsertStationRequest request) {
        requireAppInstalled();
        validate(request);

        Station station = new Station();
        applyRequest(station, request);
        repository.save(station);
        return StationDto.from(station);
    }

    @Transactional
    public StationDto update(Long id, UpsertStationRequest request) {
        requireAppInstalled();
        validate(request);

        Station station = find(id);
        applyRequest(station, request);
        repository.save(station);
        return StationDto.from(station);
    }

    @Transactional
    public void delete(Long id) {
        requireAppInstalled();
        if (!repository.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Estacion no encontrada.");
        }
        repository.deleteById(id);
    }

    /** Envio del operario desde el runtime: escribe un registro inmutable de trazabilidad. */
    @Transactional
    public Long submitRecord(Long stationId, SubmitRecordRequest request) {
        requireAppInstalled();
        Station station = find(stationId);
        Map<String, Object> values = request.values() != null ? request.values() : Map.of();
        validateSubmission(station, request.screenId(), values);
        validateRouteSequence(stationId, values);

        StationTraceRecord record = new StationTraceRecord();
        record.setStationId(stationId);
        record.setScreenId(request.screenId());
        record.setCapturedData(new LinkedHashMap<>(values));
        traceRepository.save(record);
        return record.getId();
    }

    private Station find(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Estacion no encontrada."));
    }

    /**
     * Reconcilia el aggregate contra lo que ya hay: mantiene las pantallas
     * existentes por id (para no romper la referencia de los registros de
     * trazabilidad) y reemplaza sus widgets en bloque (los widgets no tienen
     * referencias externas, asi que borrarlos y recrearlos es seguro).
     */
    private void applyRequest(Station station, UpsertStationRequest request) {
        station.setName(request.name());
        station.setDescription(request.description() != null ? request.description() : "");
        station.setEnabled(request.enabled());

        List<UpsertScreen> incoming = request.screens() != null ? request.screens() : List.of();

        Map<Long, StationScreen> existingById = station.getScreens().stream()
                .filter(s -> s.getId() != null)
                .collect(Collectors.toMap(StationScreen::getId, s -> s));

        Set<Long> keepIds = incoming.stream()
                .map(UpsertScreen::id)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        station.getScreens().removeIf(s -> s.getId() == null || !keepIds.contains(s.getId()));

        int screenIdx = 0;
        for (UpsertScreen si : incoming) {
            StationScreen screen = si.id() != null ? existingById.get(si.id()) : null;
            if (screen == null) {
                screen = new StationScreen();
                station.addScreen(screen);
            }
            screen.setTitle(si.title() != null ? si.title() : "");
            screen.setOrderIndex(si.orderIndex() != 0 ? si.orderIndex() : screenIdx);

            screen.getWidgets().clear();
            List<UpsertWidget> widgets = si.widgets() != null ? si.widgets() : List.of();
            int widgetIdx = 0;
            for (UpsertWidget wi : widgets) {
                ScreenWidget w = new ScreenWidget();
                w.setWidgetType(wi.widgetType());
                w.setLabel(wi.label() != null ? wi.label() : "");
                w.setBindingKey(blankToNull(wi.bindingKey()));
                w.setRequired(wi.required());
                w.setSourceDeviceId(wi.sourceDeviceId());
                w.setSourceEventId(wi.sourceEventId());
                w.setConfig(wi.config() != null ? new LinkedHashMap<>(wi.config()) : new LinkedHashMap<>());
                w.setDataSource(wi.dataSource() != null ? new LinkedHashMap<>(wi.dataSource()) : new LinkedHashMap<>());
                w.setLayout(wi.layout() != null ? new LinkedHashMap<>(wi.layout()) : new LinkedHashMap<>());
                w.setOrderIndex(widgetIdx);
                screen.addWidget(w);
                widgetIdx++;
            }
            screenIdx++;
        }

        if (station.getScreens().isEmpty()) {
            StationScreen screen = new StationScreen();
            screen.setOrderIndex(0);
            station.addScreen(screen);
        }
    }

    private void validate(UpsertStationRequest request) {
        List<UpsertScreen> screens = request.screens() != null ? request.screens() : List.of();
        for (UpsertScreen screen : screens) {
            List<UpsertWidget> widgets = screen.widgets() != null ? screen.widgets() : List.of();
            for (UpsertWidget w : widgets) {
                WidgetCatalog.WidgetDescriptor descriptor = WidgetCatalog.forType(w.widgetType());
                if (descriptor == null) {
                    throw badRequest("Tipo de widget desconocido: " + w.widgetType());
                }
                if (descriptor.requiresBinding() && isBlank(w.bindingKey())) {
                    throw badRequest("El widget " + w.widgetType() + " necesita una clave de datos (binding).");
                }
                if (descriptor.supportsDataSource()) {
                    Object dsType = w.dataSource() != null ? w.dataSource().get("type") : null;
                    if (dsType == null || dsType.toString().isBlank()) {
                        throw badRequest("El widget " + w.widgetType() + " necesita un origen de datos.");
                    }
                    try {
                        DataSourceType.valueOf(dsType.toString());
                    } catch (IllegalArgumentException e) {
                        throw badRequest("Origen de datos desconocido: " + dsType);
                    }
                }
                for (WidgetFieldDef field : descriptor.configFields()) {
                    if (field.required()) {
                        Object v = w.config() != null ? w.config().get(field.key()) : null;
                        if (v == null || v.toString().isBlank()) {
                            throw badRequest("Falta la configuracion '" + field.key() + "' del widget " + w.widgetType() + ".");
                        }
                    }
                }
            }
        }
    }

    /**
     * Comprueba que el operario ha rellenado todos los widgets de datos
     * obligatorios de TODA la secuencia (todas las pantallas), ya que un envio
     * representa una ejecucion completa de la estacion, no una sola pantalla.
     */
    private void validateSubmission(Station station, Long screenId, Map<String, Object> values) {
        for (StationScreen screen : station.getScreens()) {
            for (ScreenWidget w : screen.getWidgets()) {
                if (!capturesData(w) || !w.isRequired() || w.getBindingKey() == null) {
                    continue;
                }
                Object v = values.get(w.getBindingKey());
                boolean empty = v == null
                        || (v instanceof java.util.Collection<?> c && c.isEmpty())
                        || v.toString().isBlank();
                if (empty) {
                    throw badRequest("Falta rellenar el campo obligatorio: "
                            + (w.getLabel().isBlank() ? w.getBindingKey() : w.getLabel()));
                }
            }
        }
    }

    /**
     * Impide saltarse pasos de una ruta de fabricacion: por cada ruta habilitada
     * que incluya esta estacion, si el envio trae el identificador de esa ruta
     * (p. ej. "serial"), comprueba que TODOS los pasos anteriores ya tienen un
     * registro de trazabilidad con ese mismo identificador. Si el envio no trae
     * el identificador de una ruta dada, esa ruta simplemente no aplica a esta
     * unidad (una misma estacion puede compartirse entre varias rutas/productos).
     */
    private void validateRouteSequence(Long stationId, Map<String, Object> values) {
        for (Route route : routeService.findEnabledRoutesForStation(stationId)) {
            String idKey = route.getIdentifierBindingKey();
            Object idValue = values.get(idKey);
            if (idValue == null || idValue.toString().isBlank()) {
                continue;
            }
            String needle = idValue.toString();

            List<RouteStep> steps = route.getSteps();
            int currentOrder = steps.stream()
                    .filter(s -> s.getStationId().equals(stationId))
                    .mapToInt(RouteStep::getOrderIndex)
                    .findFirst()
                    .orElse(-1);
            if (currentOrder < 0) {
                continue;
            }

            for (RouteStep prior : steps) {
                if (prior.getOrderIndex() >= currentOrder) {
                    continue;
                }
                boolean completed = traceRepository.findByStationIdOrderByCreatedAtDesc(prior.getStationId()).stream()
                        .anyMatch(r -> needle.equals(String.valueOf(r.getCapturedData().get(idKey))));
                if (!completed) {
                    throw badRequest("La unidad '" + needle + "' no ha pasado todavia por la estacion '"
                            + prior.getName() + "' (paso " + (prior.getOrderIndex() + 1) + " de la ruta '"
                            + route.getName() + "'). No se puede saltar un paso de la ruta.");
                }
            }
        }
    }

    /** Un widget captura dato si tiene binding obligatorio o es una tabla seleccionable. */
    private static boolean capturesData(ScreenWidget w) {
        WidgetCatalog.WidgetDescriptor descriptor = WidgetCatalog.forType(w.getWidgetType());
        if (descriptor == null) {
            return false;
        }
        if (descriptor.requiresBinding()) {
            return true;
        }
        if (WidgetType.TABLE.name().equals(w.getWidgetType())) {
            Object mode = w.getConfig() != null ? w.getConfig().get("selectionMode") : null;
            return mode != null && !"NONE".equals(mode.toString());
        }
        return false;
    }

    private void requireAppInstalled() {
        if (!appService.isInstalled(TraceabilityGenealogyApp.KEY)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Instala la app Trazabilidad y genealogia para gestionar estaciones.");
        }
    }

    private static ResponseStatusException badRequest(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    private static String blankToNull(String s) {
        return isBlank(s) ? null : s;
    }
}

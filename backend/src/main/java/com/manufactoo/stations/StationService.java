package com.manufactoo.stations;

import com.manufactoo.apps.AppService;
import com.manufactoo.apps.TraceabilityGenealogyApp;
import com.manufactoo.common.Messages;
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
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
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
    private final MaterialLoadService materialLoadService;
    private final TraceRecordMaterialRepository traceRecordMaterialRepository;
    private final Messages messages;

    public StationService(StationRepository repository, StationTraceRecordRepository traceRepository,
                          StationAssetRepository assetRepository, DataSourceResolver dataSourceResolver,
                          AppService appService, RouteService routeService, MaterialLoadService materialLoadService,
                          TraceRecordMaterialRepository traceRecordMaterialRepository, Messages messages) {
        this.repository = repository;
        this.traceRepository = traceRepository;
        this.assetRepository = assetRepository;
        this.dataSourceResolver = dataSourceResolver;
        this.appService = appService;
        this.routeService = routeService;
        this.materialLoadService = materialLoadService;
        this.traceRecordMaterialRepository = traceRecordMaterialRepository;
        this.messages = messages;
    }

    /** Opciones de un desplegable resueltas en vivo desde su origen de datos Odoo. */
    public List<DataSourceOption> resolveDataSource(DataSourceType type, int limit) {
        requireAppInstalled();
        return dataSourceResolver.resolve(type, limit);
    }

    /** Igual, pero filtrando por las rutas de una estacion concreta (ver DataSourceResolver.resolve con stationId). */
    public List<DataSourceOption> resolveDataSource(DataSourceType type, int limit, Long stationId) {
        requireAppInstalled();
        return dataSourceResolver.resolve(type, limit, stationId);
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
                        messages.get("station.dataSource.recordNotFound", column, code)));
    }

    /**
     * Igual que resolveLookup() pero devuelve solo las columnas pedidas de la
     * fila encontrada (el "detalle" configurable de un TEXT_INPUT validado).
     */
    public Map<String, Object> resolveLookupRow(DataSourceType type, String column, String code, List<String> columns) {
        requireAppInstalled();
        Map<String, Object> row = dataSourceResolver.lookupRow(type, column, code)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        messages.get("station.dataSource.recordNotFound", column, code)));
        Map<String, Object> filtered = new LinkedHashMap<>();
        for (String col : columns) {
            filtered.put(col, row.get(col));
        }
        return filtered;
    }

    /** Registros de genealogia de una estacion, mas recientes primero. */
    @Transactional
    public List<TraceRecordDto> listRecords(Long stationId) {
        requireAppInstalled();
        if (!repository.existsById(stationId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, messages.get("station.notFound"));
        }
        return traceRepository.findByStationIdOrderByCreatedAtDesc(stationId).stream()
                .map(TraceRecordDto::from).toList();
    }

    /** Sube una imagen para un widget IMAGE y devuelve su id. */
    public Long uploadAsset(MultipartFile file) {
        requireAppInstalled();
        if (file.isEmpty()) {
            throw badRequest(messages.get("station.asset.empty"));
        }
        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_IMAGE_TYPES.contains(contentType)) {
            throw badRequest(messages.get("station.asset.unsupportedFormat"));
        }
        if (file.getSize() > MAX_IMAGE_BYTES) {
            throw badRequest(messages.get("station.asset.tooLarge"));
        }
        try {
            StationAsset asset = new StationAsset();
            asset.setFilename(file.getOriginalFilename() != null ? file.getOriginalFilename() : "imagen");
            asset.setContentType(contentType);
            asset.setData(file.getBytes());
            assetRepository.save(asset);
            return asset.getId();
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, messages.get("station.asset.readError"));
        }
    }

    public StationAsset getAsset(Long assetId) {
        requireAppInstalled();
        return assetRepository.findById(assetId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, messages.get("station.asset.notFound")));
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
        validateRouteIdentifiers(id, request);

        Station station = find(id);
        applyRequest(station, request);
        repository.save(station);
        return StationDto.from(station);
    }

    @Transactional
    public void delete(Long id) {
        requireAppInstalled();
        if (!repository.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, messages.get("station.notFound"));
        }
        repository.deleteById(id);
    }

    /** Envio del operario desde el runtime: escribe un registro inmutable de trazabilidad. */
    @Transactional
    public Long submitRecord(Long stationId, SubmitRecordRequest request) {
        requireAppInstalled();
        Station station = find(stationId);
        Map<String, Object> values = new LinkedHashMap<>(request.values() != null ? request.values() : Map.of());
        List<StationMaterialLoad> materialLoads = mergeActiveMaterialLoads(station, values);
        validateSubmission(station, request.screenId(), values);
        normalizeDataSourceValues(station, values);
        Set<String> routeIdentifierKeys = validateRouteSequence(station, values);

        StationTraceRecord record = new StationTraceRecord();
        record.setStationId(stationId);
        record.setScreenId(request.screenId());
        record.setCapturedData(new LinkedHashMap<>(values));
        record.setRouteIdentifierKeys(new ArrayList<>(routeIdentifierKeys));
        record.setResult(normalizeResult(request.result()));
        traceRepository.save(record);

        for (StationMaterialLoad load : materialLoads) {
            TraceRecordMaterial link = new TraceRecordMaterial();
            link.setTraceRecordId(record.getId());
            link.setMaterialLoadId(load.getId());
            traceRecordMaterialRepository.save(link);
        }

        return record.getId();
    }

    /** null = la estacion no usa el concepto OK/NG (comportamiento de siempre); cualquier otra cosa que no sea OK/NG es un envio invalido. */
    private String normalizeResult(String result) {
        if (result == null || result.isBlank()) {
            return null;
        }
        if (!"OK".equals(result) && !"NG".equals(result)) {
            throw badRequest(messages.get("station.submission.invalidResult", result));
        }
        return result;
    }

    private Station find(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, messages.get("station.notFound")));
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
        station.setPositions(normalizePositions(request.positions()));

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

    /** Limpia la lista de posiciones: sin espacios sobrantes, sin vacias, sin duplicados -- ver Station.positions. */
    private static List<String> normalizePositions(List<String> raw) {
        if (raw == null) {
            return new ArrayList<>();
        }
        return raw.stream().map(String::trim).filter(s -> !s.isBlank()).distinct().collect(Collectors.toCollection(ArrayList::new));
    }

    private void validate(UpsertStationRequest request) {
        List<UpsertScreen> screens = request.screens() != null ? request.screens() : List.of();

        // Claves de binding de TODA la estacion (no solo la pantalla actual): una
        // Etiqueta puede vincularse a un widget de otra pantalla, ya que "values"
        // se acumula a lo largo de toda la secuencia de la estacion (ver
        // validateSubmission, que ya recorre todas las pantallas por el mismo motivo).
        Set<String> allBindingKeys = screens.stream()
                .flatMap(s -> (s.widgets() != null ? s.widgets() : List.<UpsertWidget>of()).stream())
                .map(UpsertWidget::bindingKey)
                .filter(k -> !isBlank(k))
                .collect(Collectors.toSet());

        // Ya no hay un "Finalizar" implicito en el runtime (ver conversacion
        // 2026-07-31): el diseñador tiene que colocar EL/LOS widgets que
        // terminan el registro -- un BUTTON con action=SUBMIT, o un TEXT_INPUT/
        // DROPDOWN con resultado != NONE (confirmarlo finaliza directamente,
        // p. ej. escanear el numero de serie). Sin limite de cuantos puede
        // haber (el usuario decidio no imponer unicidad -- OK+NG conviven a
        // proposito), pero hace falta AL MENOS uno en toda la estacion, en
        // cualquier pantalla, o el registro nunca podria terminarse.
        boolean hasFinalizer = screens.stream()
                .flatMap(s -> (s.widgets() != null ? s.widgets() : List.<UpsertWidget>of()).stream())
                .anyMatch(StationService::isFinalizerWidget);
        if (!hasFinalizer) {
            throw badRequest(messages.get("station.validation.noFinalizer"));
        }

        for (UpsertScreen screen : screens) {
            List<UpsertWidget> widgets = screen.widgets() != null ? screen.widgets() : List.of();
            for (UpsertWidget w : widgets) {
                WidgetCatalog.WidgetDescriptor descriptor = WidgetCatalog.forType(w.widgetType());
                if (descriptor == null) {
                    throw badRequest(messages.get("station.widget.unknownType", w.widgetType()));
                }
                if (descriptor.requiresBinding() && isBlank(w.bindingKey())) {
                    throw badRequest(messages.get("station.widget.needsBindingKey", w.widgetType()));
                }
                if (WidgetType.LABEL.name().equals(w.widgetType())) {
                    validateLabelBinding(w, allBindingKeys);
                }
                if (descriptor.supportsDataSource()) {
                    Object dsType = w.dataSource() != null ? w.dataSource().get("type") : null;
                    boolean blank = dsType == null || dsType.toString().isBlank();
                    // DROPDOWN/TABLE necesitan un origen para saber que mostrar. En
                    // TEXT_INPUT el origen es opcional: sin el, es un texto libre
                    // normal; con el (+ columna de coincidencia), valida el codigo
                    // tecleado contra Odoo (ver validateDataSourceLookups).
                    if (blank && requiresDataSourceValue(w.widgetType())) {
                        throw badRequest(messages.get("station.widget.needsDataSource", w.widgetType()));
                    }
                    if (!blank) {
                        try {
                            DataSourceType.valueOf(dsType.toString());
                        } catch (IllegalArgumentException e) {
                            throw badRequest(messages.get("station.widget.unknownDataSource", dsType));
                        }
                    }
                }
                for (WidgetFieldDef field : descriptor.configFields()) {
                    if (field.required()) {
                        Object v = w.config() != null ? w.config().get(field.key()) : null;
                        if (v == null || v.toString().isBlank()) {
                            throw badRequest(messages.get("station.widget.missingConfig", field.key(), w.widgetType()));
                        }
                    }
                }
            }
        }
    }

    /** BUTTON con action=SUBMIT, o TEXT_INPUT/DROPDOWN con resultado != NONE -- ver validate(). */
    private static boolean isFinalizerWidget(UpsertWidget w) {
        Map<String, Object> config = w.config();
        if (WidgetType.BUTTON.name().equals(w.widgetType())) {
            Object action = config != null ? config.get("action") : null;
            return "SUBMIT".equals(action);
        }
        if (WidgetType.TEXT_INPUT.name().equals(w.widgetType()) || WidgetType.DROPDOWN.name().equals(w.widgetType())) {
            Object result = config != null ? config.get("result") : null;
            return result != null && !"NONE".equals(result.toString());
        }
        return false;
    }

    /**
     * Los lotes/series cargados en la estacion no se rellenan por envio como
     * el resto de widgets de datos: son un dato de la ESTACION (StationMaterialLoad,
     * cargados aparte -- ver MaterialLoadService), no de ningun widget ni
     * "ranura" con nombre, asi que cada unidad los hereda automaticamente
     * bajo una unica clave fija ("materials"), sin depender de que exista
     * ningun widget STATION_MATERIALS en el lienzo (ver conversacion
     * 2026-07-30, tercera vuelta). Devuelve la lista para que submitRecord
     * cree ademas la relacion consultable en TraceRecordMaterial (ver
     * conversacion 2026-07-31, "que unidades llevaron el lote X") -- el texto
     * que se guarda aqui en "values" sigue sirviendo solo para el resumen
     * legible por paso en Genealogia, nunca para consultar.
     */
    private List<StationMaterialLoad> mergeActiveMaterialLoads(Station station, Map<String, Object> values) {
        List<StationMaterialLoad> loads = materialLoadService.currentLoads(station.getId());
        if (loads.isEmpty()) {
            return loads;
        }
        values.put(MATERIALS_KEY, loads.stream().map(StationMaterialLoad::getValue).collect(Collectors.joining(",")));
        values.put(MATERIALS_KEY + LABEL_SUFFIX,
                loads.stream().map(StationService::materialSummary).collect(Collectors.joining(", ")));
        return loads;
    }

    /** "Producto (lote)", con "@ posicion" al final si la ranura tenia una -- ver mergeActiveMaterialLoads. */
    private static String materialSummary(StationMaterialLoad l) {
        String base = l.getName() + " (" + l.getLabel() + ")";
        return l.getPosition() != null && !l.getPosition().isBlank() ? base + " @ " + l.getPosition() : base;
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
                    throw badRequest(messages.get("station.submission.missingRequiredField",
                            w.getLabel().isBlank() ? w.getBindingKey() : w.getLabel()));
                }
            }
        }
    }

    /**
     * Impide saltarse pasos de una ruta de fabricacion: por cada ruta habilitada
     * que incluya esta estacion, si el envio trae el identificador de esa ruta
     * (p. ej. "serial"), comprueba que TODOS los pasos anteriores ya tienen un
     * registro de trazabilidad con ese mismo identificador Y con resultado
     * distinto de NG -- un paso anterior marcado NG (ver StationTraceRecord.result)
     * no cuenta como completado, exactamente igual que si no existiera, porque
     * una pieza que fallo un paso no deberia poder seguir avanzando por la ruta
     * normal (necesita repaso/desguace, no continuar como si nada). Un registro
     * sin resultado (result=null, la estacion no usa el concepto OK/NG) SI
     * cuenta como completado, igual que siempre -- solo un NG explicito bloquea.
     * Si el envio no trae el identificador de una ruta dada, esa ruta
     * simplemente no aplica a esta unidad (una misma estacion puede compartirse
     * entre varias rutas/productos).
     * <p>
     * Devuelve las claves de identificador que SI aplicaron a este envio (una
     * ruta puede no aplicar si el envio no trae su clave) -- submitRecord las
     * anota en el propio registro (StationTraceRecord.routeIdentifierKeys)
     * para que la Genealogia pueda agrupar unidades sin depender de la
     * configuracion actual de la ruta, que puede cambiar mas adelante.
     */
    private Set<String> validateRouteSequence(Station station, Map<String, Object> values) {
        Set<String> appliedKeys = new LinkedHashSet<>();
        Long stationId = station.getId();
        for (Route route : routeService.findEnabledRoutesForStation(stationId)) {
            String idKey = route.getIdentifierBindingKey();
            Object idValue = values.get(idKey);
            if (idValue == null || idValue.toString().isBlank()) {
                continue;
            }
            appliedKeys.add(idKey);
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
                List<StationTraceRecord> priorRecords = traceRepository.findByStationIdOrderByCreatedAtDesc(prior.getStationId()).stream()
                        .filter(r -> needle.equals(String.valueOf(r.getCapturedData().get(idKey))))
                        .toList();
                boolean completed = priorRecords.stream().anyMatch(r -> !"NG".equals(r.getResult()));
                if (!completed) {
                    boolean failed = priorRecords.stream().anyMatch(r -> "NG".equals(r.getResult()));
                    String msgKey = failed ? "station.route.stepFailed" : "station.route.stepSkipped";
                    throw badRequest(messages.get(msgKey,
                            needle, prior.getName(), prior.getOrderIndex() + 1, route.getName()));
                }
            }
        }
        return appliedKeys;
    }

    /**
     * Si esta estacion ya es un paso de alguna ruta habilitada, el identificador
     * de esa ruta (p. ej. "serial") tiene que seguir capturandose en algun
     * widget tras guardar -- si no, esa ruta dejaria de aplicarse en silencio
     * (validateRouteSequence simplemente la salta cuando el envio no trae la
     * clave) y el fallo no se notaria hasta produccion. Solo tiene sentido en
     * update: una estacion recien creada no puede ser todavia paso de ninguna
     * ruta (route_steps.station_id apunta a una estacion ya existente).
     */
    private void validateRouteIdentifiers(Long stationId, UpsertStationRequest request) {
        List<Route> routes = routeService.findEnabledRoutesForStation(stationId);
        if (routes.isEmpty()) {
            return;
        }
        Set<String> capturedKeys = (request.screens() != null ? request.screens() : List.<UpsertScreen>of()).stream()
                .flatMap(s -> (s.widgets() != null ? s.widgets() : List.<UpsertWidget>of()).stream())
                .filter(StationService::capturesData)
                .map(UpsertWidget::bindingKey)
                .filter(k -> k != null && !k.isBlank())
                .collect(Collectors.toSet());
        for (Route route : routes) {
            if (!capturedKeys.contains(route.getIdentifierBindingKey())) {
                throw badRequest(messages.get("station.route.identifierNotCaptured",
                        route.getName(), route.getIdentifierBindingKey()));
            }
        }
    }

    /** Igual que capturesData(ScreenWidget), pero sobre el DTO entrante (antes de convertirlo a entidad) -- lo usa validateRouteIdentifiers. */
    private static boolean capturesData(UpsertWidget w) {
        WidgetCatalog.WidgetDescriptor descriptor = WidgetCatalog.forType(w.widgetType());
        if (descriptor == null) {
            return false;
        }
        if (descriptor.requiresBinding()) {
            return true;
        }
        if (WidgetType.TABLE.name().equals(w.widgetType())) {
            Object mode = w.config() != null ? w.config().get("selectionMode") : null;
            return mode != null && !"NONE".equals(mode.toString());
        }
        return false;
    }

    private static boolean requiresDataSourceValue(String widgetType) {
        return WidgetType.DROPDOWN.name().equals(widgetType) || WidgetType.TABLE.name().equals(widgetType);
    }

    /**
     * Una Etiqueta es texto fijo o esta vinculada a otro widget (config.boundTo
     * = su bindingKey), pero necesita al menos una de las dos cosas -- si no,
     * no enseñaria nada. Si esta vinculada, boundTo debe apuntar a un widget que
     * de verdad exista en la estacion (evita una vinculacion "colgada" tras
     * borrar o renombrar el widget origen).
     */
    private void validateLabelBinding(UpsertWidget w, Set<String> allBindingKeys) {
        Object text = w.config() != null ? w.config().get("text") : null;
        Object boundTo = w.config() != null ? w.config().get("boundTo") : null;
        boolean hasText = text != null && !text.toString().isBlank();
        boolean hasBinding = boundTo != null && !boundTo.toString().isBlank();
        if (!hasText && !hasBinding) {
            throw badRequest(messages.get("station.label.needsTextOrBinding"));
        }
        if (hasBinding && !allBindingKeys.contains(boundTo.toString())) {
            throw badRequest(messages.get("station.label.boundToMissing", boundTo));
        }
    }

    /** Sufijo de la clave "hermana" que guarda la version legible de un valor con origen de datos (ver normalizeDataSourceValues). */
    static final String LABEL_SUFFIX = "__label";

    /** Clave fija bajo la que se capturan los lotes/series activos de la estacion en cada envio (ver mergeActiveMaterialLoads). */
    private static final String MATERIALS_KEY = "materials";

    /**
     * Dos cosas para cada widget con origen de datos Odoo, antes de guardar el
     * envio:
     * <p>
     * 1) TEXT_INPUT: valida contra Odoo el codigo tecleado a mano (p. ej. un
     * campo "Operario" donde se escribe el codigo de empleado) -- el frontend
     * ya avisa en vivo, pero no hay que confiar solo en esa validacion del
     * cliente. Y SUSTITUYE el codigo tecleado por el id resuelto: si no, la
     * misma unidad guardaria identidades distintas segun el tipo de widget que
     * la capturo en cada estacion (un DROPDOWN siempre guarda el id) y
     * comparaciones como la de validateRouteSequence (o una genealogia futura)
     * fallarian aunque fuera la misma pieza.
     * <p>
     * 2) DROPDOWN y TEXT_INPUT: guardan ademas, en paralelo, bindingKey +
     * "__label" con el nombre legible de Odoo (p. ej. "0000001" en vez del id
     * "1") -- solo para pantalla (listados de registros/genealogia); nunca se
     * usa para comparar identidad.
     */
    private void normalizeDataSourceValues(Station station, Map<String, Object> values) {
        for (StationScreen screen : station.getScreens()) {
            for (ScreenWidget w : screen.getWidgets()) {
                if (w.getBindingKey() == null) {
                    continue;
                }
                Object dsTypeRaw = w.getDataSource() != null ? w.getDataSource().get("type") : null;
                if (dsTypeRaw == null || dsTypeRaw.toString().isBlank()) {
                    continue;
                }
                Object value = values.get(w.getBindingKey());
                if (value == null || value.toString().isBlank()) {
                    continue;
                }
                DataSourceType dsType;
                try {
                    dsType = DataSourceType.valueOf(dsTypeRaw.toString());
                } catch (IllegalArgumentException e) {
                    continue;
                }
                if (dsType == DataSourceType.STATIC_LIST) {
                    continue;
                }

                if (WidgetType.TEXT_INPUT.name().equals(w.getWidgetType())) {
                    Object lookupColumnRaw = w.getConfig() != null ? w.getConfig().get("lookupColumn") : null;
                    if (lookupColumnRaw == null || lookupColumnRaw.toString().isBlank()) {
                        continue;
                    }
                    String code = value.toString();
                    DataSourceOption resolved = dataSourceResolver.lookup(dsType, lookupColumnRaw.toString(), code)
                            .orElseThrow(() -> badRequest(messages.get("station.dataSource.invalidCode",
                                    code, w.getLabel().isBlank() ? w.getBindingKey() : w.getLabel())));
                    values.put(w.getBindingKey(), resolved.value());
                    values.put(w.getBindingKey() + LABEL_SUFFIX, resolved.label());
                } else if (WidgetType.DROPDOWN.name().equals(w.getWidgetType())) {
                    dataSourceResolver.resolveLabel(dsType, value.toString())
                            .ifPresent(label -> values.put(w.getBindingKey() + LABEL_SUFFIX, label));
                }
            }
        }
    }

    /** Un widget captura dato si tiene binding obligatorio o es una tabla seleccionable. Publico: RouteService lo reutiliza para exigir que el identificador de una ruta este realmente capturado en cada estacion (ver RouteService.applyRequest / StationService.validateRouteIdentifiers). */
    public static boolean capturesData(ScreenWidget w) {
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
                    messages.get("station.appNotInstalled"));
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

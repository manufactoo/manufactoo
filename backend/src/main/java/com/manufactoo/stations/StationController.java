package com.manufactoo.stations;

import com.manufactoo.stations.dto.BlockWorkOrderSessionRequest;
import com.manufactoo.stations.dto.DataSourceOption;
import com.manufactoo.stations.dto.DataSourceTableDto;
import com.manufactoo.stations.dto.LoadMaterialRequest;
import com.manufactoo.stations.dto.MaterialLoadDto;
import com.manufactoo.stations.dto.SetSessionQtyRequest;
import com.manufactoo.stations.dto.StartWorkOrderSessionRequest;
import com.manufactoo.stations.dto.StationDto;
import com.manufactoo.stations.dto.SubmitRecordRequest;
import com.manufactoo.stations.dto.TraceRecordDto;
import com.manufactoo.stations.dto.UpsertStationRequest;
import com.manufactoo.stations.dto.WidgetCatalogDto;
import com.manufactoo.stations.dto.WorkOrderSessionDto;
import jakarta.validation.Valid;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/stations")
public class StationController {

    private final StationService service;
    private final MaterialLoadService materialLoadService;
    private final WorkOrderSessionService workOrderSessionService;

    public StationController(StationService service, MaterialLoadService materialLoadService,
                              WorkOrderSessionService workOrderSessionService) {
        this.service = service;
        this.materialLoadService = materialLoadService;
        this.workOrderSessionService = workOrderSessionService;
    }

    /** Catalogo estatico de widgets y origenes de datos que consume el editor no-code. */
    @GetMapping("/widget-catalog")
    public WidgetCatalogDto widgetCatalog() {
        Map<String, List<String>> lookupColumns = new java.util.LinkedHashMap<>();
        Map<String, List<String>> displayColumns = new java.util.LinkedHashMap<>();
        for (DataSourceType type : DataSourceType.values()) {
            lookupColumns.put(type.name(), DataSourceResolver.lookupColumnsFor(type));
            displayColumns.put(type.name(), DataSourceResolver.displayColumnsFor(type));
        }
        return new WidgetCatalogDto(WidgetCatalog.widgets(), WidgetCatalog.dataSourceTypes(), lookupColumns, displayColumns);
    }

    /**
     * Resuelve un origen de datos a opciones {value,label} (para poblar un
     * desplegable). stationId es opcional: si se pasa (y el tipo es ordenes
     * de fabricacion), limita las opciones a los productos de las rutas
     * habilitadas que incluyen esa estacion (ver DataSourceResolver).
     */
    @GetMapping("/data-source-options")
    public List<DataSourceOption> dataSourceOptions(@RequestParam DataSourceType type,
                                                    @RequestParam(defaultValue = "100") int limit,
                                                    @RequestParam(required = false) Long stationId,
                                                    @RequestParam(required = false) Long operationId) {
        return service.resolveDataSource(type, limit, stationId, operationId);
    }

    /**
     * Resuelve un origen de datos a filas + columnas (para el widget TABLE).
     * stationId opcional: igual que en data-source-options, filtra ordenes
     * por rutas de la estacion cuando el widget lo pide (config.filterByStationRoute),
     * o workorders por el Work Center de la estacion (automatico para
     * ODOO_WORKORDERS, sin casilla -- ver conversacion 2026-08-04).
     * operationId opcional: estrecha ODOO_WORKORDERS a una Operacion concreta
     * (config.operationId).
     */
    @GetMapping("/data-source-table")
    public DataSourceTableDto dataSourceTable(@RequestParam DataSourceType type,
                                              @RequestParam(defaultValue = "50") int limit,
                                              @RequestParam(required = false) Long stationId,
                                              @RequestParam(required = false) Long operationId) {
        return service.resolveDataSourceTable(type, limit, stationId, operationId);
    }

    /** Operaciones (mrp.routing.workcenter) de un Work Center, para el picker "Estrechar a una operacion" del widget TABLE. */
    @GetMapping("/data-source-operations")
    public List<DataSourceOption> dataSourceOperations(@RequestParam(required = false) Long workcenterId) {
        return service.resolveOperations(workcenterId);
    }

    /**
     * Resuelve un codigo en bruto (escaneado por un dispositivo/evento, o
     * tecleado a mano) al registro Odoo real: {value,label} donde value es el
     * id a guardar en trazabilidad y label el nombre a mostrar en pantalla.
     * stationId opcional: igual que en data-source-options, un codigo de una
     * orden cuyo producto no tiene ruta por esta estacion se trata como no
     * encontrado (ver DataSourceResolver.findRow).
     */
    @GetMapping("/data-source-lookup")
    public DataSourceOption dataSourceLookup(@RequestParam DataSourceType type,
                                             @RequestParam String column,
                                             @RequestParam String code,
                                             @RequestParam(required = false) Long stationId) {
        return service.resolveLookup(type, column, code, stationId);
    }

    /**
     * Igual que data-source-lookup, pero devuelve varios campos de la fila
     * Odoo (no solo {value,label}): lo usa un TEXT_INPUT validado cuando el
     * diseñador ha elegido que datos de detalle mostrar (p. ej. nombre y
     * departamento del operario), no solo un unico texto resuelto.
     */
    @GetMapping("/data-source-lookup-row")
    public Map<String, Object> dataSourceLookupRow(@RequestParam DataSourceType type,
                                                   @RequestParam String column,
                                                   @RequestParam String code,
                                                   @RequestParam List<String> columns,
                                                   @RequestParam(required = false) Long stationId) {
        return service.resolveLookupRow(type, column, code, columns, stationId);
    }

    /** Sube una imagen para un widget IMAGE; devuelve su id. */
    @PostMapping(value = "/assets", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String, Object> uploadAsset(@RequestParam("file") MultipartFile file) {
        return Map.of("id", service.uploadAsset(file));
    }

    /** Sirve una imagen subida (autenticada, igual que el logo de empresa). */
    @GetMapping("/assets/{assetId}")
    public ResponseEntity<byte[]> getAsset(@PathVariable Long assetId) {
        StationAsset asset = service.getAsset(assetId);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(asset.getContentType()))
                .cacheControl(CacheControl.maxAge(java.time.Duration.ofHours(1)))
                .body(asset.getData());
    }

    @GetMapping
    public List<StationDto> list() {
        return service.list();
    }

    @GetMapping("/{id}")
    public StationDto get(@PathVariable Long id) {
        return service.get(id);
    }

    @PostMapping
    public StationDto create(@Valid @RequestBody UpsertStationRequest request) {
        return service.create(request);
    }

    @PutMapping("/{id}")
    public StationDto update(@PathVariable Long id, @Valid @RequestBody UpsertStationRequest request) {
        return service.update(id, request);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) {
        service.delete(id);
    }

    /** Envio del operario desde el runtime; devuelve el id del registro de trazabilidad creado. */
    @PostMapping("/{id}/records")
    public Map<String, Object> submit(@PathVariable Long id, @RequestBody SubmitRecordRequest request) {
        Long recordId = service.submitRecord(id, request);
        return Map.of("recordId", recordId);
    }

    /**
     * Registros de genealogia de una estacion (consulta). limit opcional: lo
     * usa el widget STATION_HISTORY para traer solo los N mas recientes; sin
     * el, se mantiene el comportamiento de siempre (todos, para la pagina de
     * Registros).
     */
    @GetMapping("/{id}/records")
    public List<TraceRecordDto> records(@PathVariable Long id, @RequestParam(required = false) Integer limit) {
        return service.listRecords(id, limit);
    }

    /** Lotes/series activos ahora mismo en la estacion. */
    @GetMapping("/{id}/material-loads")
    public List<MaterialLoadDto> materialLoads(@PathVariable Long id) {
        return materialLoadService.listActive(id);
    }

    /** Carga un lote nuevo en la estacion: valida el codigo contra series/lotes de Odoo. */
    @PostMapping("/{id}/material-loads")
    public MaterialLoadDto loadMaterial(@PathVariable Long id, @RequestBody LoadMaterialRequest request) {
        return materialLoadService.load(id, request);
    }

    /** Descarga un lote concreto (ya no esta disponible en la estacion). */
    @DeleteMapping("/{id}/material-loads/{loadId}")
    public void unloadMaterial(@PathVariable Long id, @PathVariable Long loadId) {
        materialLoadService.unload(id, loadId);
    }

    /** Sesion de work order activa ahora mismo en la estacion (null si no hay ninguna). */
    @GetMapping("/{id}/work-order-sessions/active")
    public WorkOrderSessionDto activeWorkOrderSession(@PathVariable Long id) {
        return workOrderSessionService.getActive(id);
    }

    /** Inicia una sesion de work order (Start) -- ver WorkOrderSessionService. */
    @PostMapping("/{id}/work-order-sessions/start")
    public WorkOrderSessionDto startWorkOrderSession(@PathVariable Long id, @RequestBody StartWorkOrderSessionRequest request) {
        return workOrderSessionService.start(id, request);
    }

    @PostMapping("/{id}/work-order-sessions/{sessionId}/pause")
    public WorkOrderSessionDto pauseWorkOrderSession(@PathVariable Long id, @PathVariable Long sessionId) {
        return workOrderSessionService.pause(id, sessionId);
    }

    /** operatorCode opcional: permite re-escanear el operario al reanudar (p. ej. cambio de turno). */
    @PostMapping("/{id}/work-order-sessions/{sessionId}/resume")
    public WorkOrderSessionDto resumeWorkOrderSession(@PathVariable Long id, @PathVariable Long sessionId,
                                                       @RequestParam(required = false) String operatorCode) {
        return workOrderSessionService.resume(id, sessionId, operatorCode);
    }

    @PostMapping("/{id}/work-order-sessions/{sessionId}/block")
    public WorkOrderSessionDto blockWorkOrderSession(@PathVariable Long id, @PathVariable Long sessionId,
                                                      @RequestBody BlockWorkOrderSessionRequest request) {
        return workOrderSessionService.block(id, sessionId, request);
    }

    @PostMapping("/{id}/work-order-sessions/{sessionId}/qty")
    public WorkOrderSessionDto setWorkOrderSessionQty(@PathVariable Long id, @PathVariable Long sessionId,
                                                       @RequestBody SetSessionQtyRequest request) {
        return workOrderSessionService.setQty(id, sessionId, request);
    }

    @PostMapping("/{id}/work-order-sessions/{sessionId}/finish")
    public WorkOrderSessionDto finishWorkOrderSession(@PathVariable Long id, @PathVariable Long sessionId) {
        return workOrderSessionService.finish(id, sessionId);
    }
}

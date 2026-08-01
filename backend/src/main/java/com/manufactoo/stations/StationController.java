package com.manufactoo.stations;

import com.manufactoo.stations.dto.DataSourceOption;
import com.manufactoo.stations.dto.DataSourceTableDto;
import com.manufactoo.stations.dto.LoadMaterialRequest;
import com.manufactoo.stations.dto.MaterialLoadDto;
import com.manufactoo.stations.dto.StationDto;
import com.manufactoo.stations.dto.SubmitRecordRequest;
import com.manufactoo.stations.dto.TraceRecordDto;
import com.manufactoo.stations.dto.UpsertStationRequest;
import com.manufactoo.stations.dto.WidgetCatalogDto;
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

    public StationController(StationService service, MaterialLoadService materialLoadService) {
        this.service = service;
        this.materialLoadService = materialLoadService;
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
                                                    @RequestParam(required = false) Long stationId) {
        return service.resolveDataSource(type, limit, stationId);
    }

    /**
     * Resuelve un origen de datos a filas + columnas (para el widget TABLE).
     * stationId opcional: igual que en data-source-options, filtra ordenes
     * por rutas de la estacion cuando el widget lo pide (config.filterByStationRoute).
     */
    @GetMapping("/data-source-table")
    public DataSourceTableDto dataSourceTable(@RequestParam DataSourceType type,
                                              @RequestParam(defaultValue = "50") int limit,
                                              @RequestParam(required = false) Long stationId) {
        return service.resolveDataSourceTable(type, limit, stationId);
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

    /** Registros de genealogia de una estacion (consulta). */
    @GetMapping("/{id}/records")
    public List<TraceRecordDto> records(@PathVariable Long id) {
        return service.listRecords(id);
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
}

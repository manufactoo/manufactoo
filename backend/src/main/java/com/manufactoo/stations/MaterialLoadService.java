package com.manufactoo.stations;

import com.manufactoo.apps.AppService;
import com.manufactoo.apps.TraceabilityGenealogyApp;
import com.manufactoo.common.Messages;
import com.manufactoo.stations.dto.LoadMaterialRequest;
import com.manufactoo.stations.dto.MaterialLoadDto;
import com.manufactoo.stations.dto.StationMaterialLoadDto;
import jakarta.transaction.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Series/lotes de Odoo cargados en una estacion (p. ej. los carretes de
 * componentes de una maquina de pick and place): un dato de la ESTACION, no
 * de ningun widget ni "ranura" con nombre -- pueden estar activos a la vez
 * varios lotes distintos, incluso del mismo producto (dos carretes del mismo
 * valor de resistencia en dos posiciones fisicas). La identidad de cada
 * carga es el propio lote (value = id de Odoo), nunca una clave que alguien
 * eligiera. A diferencia de un dato de formulario normal, no se rellenan por
 * cada unidad -- quedan activos hasta que se descargan explicitamente;
 * StationService los hereda automaticamente en cada envio mientras tanto
 * (ver StationService.mergeActiveMaterialLoads).
 */
@Service
public class MaterialLoadService {

    private final StationMaterialLoadRepository repository;
    private final StationRepository stationRepository;
    private final DataSourceResolver dataSourceResolver;
    private final AppService appService;
    private final Messages messages;

    public MaterialLoadService(StationMaterialLoadRepository repository, StationRepository stationRepository,
                                DataSourceResolver dataSourceResolver, AppService appService, Messages messages) {
        this.repository = repository;
        this.stationRepository = stationRepository;
        this.dataSourceResolver = dataSourceResolver;
        this.appService = appService;
        this.messages = messages;
    }

    /** Lotes activos ahora mismo en una estacion. */
    public List<MaterialLoadDto> listActive(Long stationId) {
        requireAppInstalled();
        return repository.findByStationIdAndUnloadedAtIsNullOrderByLoadedAtDesc(stationId).stream()
                .map(MaterialLoadService::toDto)
                .toList();
    }

    private static MaterialLoadDto toDto(StationMaterialLoad l) {
        return new MaterialLoadDto(l.getId(), l.getName(), l.getValue(), l.getLabel(), l.getPosition(), l.getLoadedAt());
    }

    /**
     * Carga un lote nuevo en la estacion: valida el codigo escaneado/tecleado
     * contra series/lotes de Odoo (stock.lot) y lo añade a los activos. El
     * nombre es siempre el producto de Odoo asociado al lote (stock.lot.product_id).
     * <p>
     * La comprobacion de "ya esta cargado" es POR POSICION, no global: un
     * mismo lote puede estar activo a la vez en varias posiciones distintas
     * (en Odoo un lote no es necesariamente una unidad serializada unica --
     * puede haber varias unidades fisicas del mismo lote de fabricacion,
     * cada una en su propia posicion). Con posicion: si ESE lote ya esta
     * activo EN ESA posicion, no duplica -- si hay otro lote distinto ahi, lo
     * sustituye (lo cierra) antes de crear el nuevo. Sin posicion: si ese
     * lote ya esta activo en alguna entrada SIN posicion, no duplica; si solo
     * esta activo con alguna posicion, se añade igualmente sin posicion (son
     * registros independientes -- ver conversacion 2026-07-31).
     */
    @Transactional
    public MaterialLoadDto load(Long stationId, LoadMaterialRequest request) {
        requireAppInstalled();
        if (stationRepository.findById(stationId).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, messages.get("station.notFound"));
        }
        String position = request.position() != null && !request.position().isBlank() ? request.position().trim() : null;

        DataSourceResolver.SerialLookupResult resolved = dataSourceResolver.lookupSerial(request.code())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        messages.get("station.dataSource.invalidCode", request.code(), request.code())));

        if (position != null) {
            StationMaterialLoad atPosition = repository.findByStationIdAndPositionAndUnloadedAtIsNull(stationId, position).orElse(null);
            if (atPosition != null && atPosition.getValue().equals(resolved.value())) {
                return toDto(atPosition);
            }
            if (atPosition != null) {
                atPosition.setUnloadedAt(Instant.now());
                repository.save(atPosition);
            }
        } else {
            StationMaterialLoad unpositioned = repository.findByStationIdAndValueAndPositionIsNullAndUnloadedAtIsNull(stationId, resolved.value())
                    .orElse(null);
            if (unpositioned != null) {
                return toDto(unpositioned);
            }
        }

        StationMaterialLoad load = new StationMaterialLoad();
        load.setStationId(stationId);
        load.setName(resolved.productName() != null && !resolved.productName().isBlank() ? resolved.productName() : resolved.label());
        load.setValue(resolved.value());
        load.setLabel(resolved.label());
        load.setPosition(position);
        repository.save(load);
        return toDto(load);
    }

    /** Descarga un lote concreto (ya no esta disponible en la estacion). Idempotente -- descargar uno ya inactivo no es un error. */
    @Transactional
    public void unload(Long stationId, Long loadId) {
        requireAppInstalled();
        repository.findById(loadId)
                .filter(l -> l.getStationId().equals(stationId) && l.getUnloadedAt() == null)
                .ifPresent(l -> {
                    l.setUnloadedAt(Instant.now());
                    repository.save(l);
                });
    }

    /** Lo cargado ahora mismo en TODA la instalacion, para la vista cruzada de estaciones. */
    public List<StationMaterialLoadDto> listAllActive() {
        requireAppInstalled();
        Map<Long, String> stationNames = new LinkedHashMap<>();
        stationRepository.findAll().forEach(s -> stationNames.put(s.getId(), s.getName()));
        return repository.findByUnloadedAtIsNullOrderByLoadedAtDesc().stream()
                .map(l -> new StationMaterialLoadDto(l.getId(), l.getStationId(),
                        stationNames.getOrDefault(l.getStationId(), String.valueOf(l.getStationId())),
                        l.getName(), l.getValue(), l.getLabel(), l.getPosition(), l.getLoadedAt()))
                .toList();
    }

    /** Lotes activos ahora mismo en una estacion -- usado por StationService para mezclarlos en cada envio (ver mergeActiveMaterialLoads). */
    List<StationMaterialLoad> currentLoads(Long stationId) {
        return repository.findByStationIdAndUnloadedAtIsNullOrderByLoadedAtDesc(stationId);
    }

    private void requireAppInstalled() {
        if (!appService.isInstalled(TraceabilityGenealogyApp.KEY)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, messages.get("station.appNotInstalled"));
        }
    }
}

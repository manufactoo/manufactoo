package com.manufactoo.stations;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface StationMaterialLoadRepository extends JpaRepository<StationMaterialLoad, Long> {

    /** Lotes activos ahora mismo en una estacion -- la lista que ve el operario y la que hereda cada unidad. */
    List<StationMaterialLoad> findByStationIdAndUnloadedAtIsNullOrderByLoadedAtDesc(Long stationId);

    /** Si ESE lote concreto (mismo id de Odoo) ya esta activo SIN posicion -- evita duplicarlo si se escanea dos veces sin indicar una. No mira las entradas CON posicion: el mismo lote puede estar tambien activo en una o mas posiciones a la vez (ver MaterialLoadService.load). */
    Optional<StationMaterialLoad> findByStationIdAndValueAndPositionIsNullAndUnloadedAtIsNull(Long stationId, String value);

    /** Lo que hay activo ahora mismo en una posicion concreta (cualquier lote) -- se cierra al cargar otro en la misma posicion. */
    Optional<StationMaterialLoad> findByStationIdAndPositionAndUnloadedAtIsNull(Long stationId, String position);

    /** Lo cargado ahora mismo en TODA la instalacion, para la vista cruzada de estaciones (ver MaterialLoadService.listAllActive). */
    List<StationMaterialLoad> findByUnloadedAtIsNullOrderByLoadedAtDesc();

    /** TODAS las cargas de ESE lote concreto (cualquier estacion, activas o no) -- para la busqueda "que unidades llevaron el lote X" (ver GenealogyService.searchByMaterialCode). */
    List<StationMaterialLoad> findByValue(String value);
}

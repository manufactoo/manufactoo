package com.manufactoo.stations;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/**
 * Un lote/serie de Odoo (stock.lot) cargado en una estacion -- ver la
 * migracion V19 para el porque de unloaded_at en vez de borrar filas. No
 * tiene ninguna "ranura" ni clave que lo identifique: su identidad es el
 * propio lote (value = id de Odoo), asi que pueden estar activos a la vez
 * varios lotes distintos del mismo producto (ver conversacion 2026-07-30,
 * tercera vuelta).
 */
@Entity
@Table(name = "station_material_loads")
@Getter
@Setter
@NoArgsConstructor
public class StationMaterialLoad {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "station_id", nullable = false)
    private Long stationId;

    /** Nombre del producto asociado a este lote (stock.lot.product_id), no del lote en si. */
    @Column(nullable = false)
    private String name;

    /** Id de Odoo del lote -- es la identidad de esta carga, no una clave elegida por nadie. */
    @Column(nullable = false)
    private String value;

    /** Codigo del lote (p. ej. el numero de serie/lote legible). */
    @Column(nullable = false)
    private String label;

    /**
     * Posicion fisica de la estacion donde se cargo (p. ej. "R1"), si se
     * indico una -- opcional: sin ella, este material se añade sin
     * sustituir nada. Cargar OTRO lote en la MISMA posicion cierra este
     * (ver MaterialLoadService.load), recuperando el comportamiento de
     * sustitucion de una posicion fisica real.
     */
    @Column
    private String position;

    @Column(name = "loaded_at", nullable = false, updatable = false)
    private Instant loadedAt = Instant.now();

    @Column(name = "unloaded_at")
    private Instant unloadedAt;
}

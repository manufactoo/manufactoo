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

/**
 * Que lote/serie (StationMaterialLoad) estaba activo cuando se registro una
 * unidad (StationTraceRecord) -- relacion muchos-a-muchos consultable
 * ("que unidades llevaron el lote X"), en paralelo al resumen en texto que
 * ya se guarda en StationTraceRecord.capturedData (ver
 * StationService.mergeActiveMaterialLoads). Ver la migracion V25 para el
 * porque de no llevar claves foraneas.
 */
@Entity
@Table(name = "trace_record_materials")
@Getter
@Setter
@NoArgsConstructor
public class TraceRecordMaterial {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "trace_record_id", nullable = false)
    private Long traceRecordId;

    @Column(name = "material_load_id", nullable = false)
    private Long materialLoadId;
}

package com.manufactoo.stations;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TraceRecordMaterialRepository extends JpaRepository<TraceRecordMaterial, Long> {

    List<TraceRecordMaterial> findByTraceRecordId(Long traceRecordId);

    /** Todas las unidades que llevaron ESE lote concreto -- la consulta tipica de una retirada/recall. */
    List<TraceRecordMaterial> findByMaterialLoadId(Long materialLoadId);
}

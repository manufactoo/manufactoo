package com.manufactoo.stations;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface StationTraceRecordRepository extends JpaRepository<StationTraceRecord, Long> {
    List<StationTraceRecord> findByStationIdOrderByCreatedAtDesc(Long stationId);

    /** Pagina de TODOS los registros (cualquier estacion), mas recientes primero -- ver GenealogyService.listRecent. */
    Page<StationTraceRecord> findAllByOrderByCreatedAtDesc(Pageable pageable);
}

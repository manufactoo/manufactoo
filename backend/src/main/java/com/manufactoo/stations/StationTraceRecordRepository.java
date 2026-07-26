package com.manufactoo.stations;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface StationTraceRecordRepository extends JpaRepository<StationTraceRecord, Long> {
    List<StationTraceRecord> findByStationIdOrderByCreatedAtDesc(Long stationId);
}

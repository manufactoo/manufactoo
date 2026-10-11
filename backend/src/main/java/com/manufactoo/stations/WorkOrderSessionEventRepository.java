package com.manufactoo.stations;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface WorkOrderSessionEventRepository extends JpaRepository<WorkOrderSessionEvent, Long> {

    List<WorkOrderSessionEvent> findBySessionIdOrderByCreatedAtDesc(Long sessionId);
}

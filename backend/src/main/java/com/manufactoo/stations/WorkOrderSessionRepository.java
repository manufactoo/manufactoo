package com.manufactoo.stations;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface WorkOrderSessionRepository extends JpaRepository<WorkOrderSession, Long> {

    /** La sesion activa (si hay alguna) de una estacion -- a lo sumo una por estacion, ver WorkOrderSessionService. */
    Optional<WorkOrderSession> findByStationIdAndStateNot(Long stationId, String state);

    /** Lo activo ahora mismo en TODA la instalacion, para el panel cruzado de Work Centers. */
    List<WorkOrderSession> findByStateNotOrderByUpdatedAtDesc(String state);
}

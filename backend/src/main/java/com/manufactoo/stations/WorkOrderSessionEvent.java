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
 * Registro inmutable append-only de cada transicion de una WorkOrderSession
 * (START/PAUSE/RESUME/BLOCK/UNBLOCK/FINISH) -- mismo criterio que
 * StationTraceRecord: nunca se actualiza ni se borra desde la aplicacion.
 * <p>
 * odooProductivityLogId guarda el id de Odoo (mrp.workcenter.productivity)
 * que este evento abrio o cerro -- lo usa
 * OdooShopFloorService.reattributeLastTimeLog para reasignar el tramo de
 * tiempo al operario real DESPUES de cerrarlo (reasignar antes rompe el
 * estado interno de Odoo, ver investigacion 2026-08-05).
 */
@Entity
@Table(name = "work_order_session_events")
@Getter
@Setter
@NoArgsConstructor
public class WorkOrderSessionEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "session_id", nullable = false)
    private Long sessionId;

    /** START/PAUSE/RESUME/BLOCK/UNBLOCK/FINISH. */
    @Column(name = "event_type", nullable = false, length = 20)
    private String eventType;

    @Column(name = "operator_employee_id")
    private Long operatorEmployeeId;

    @Column(name = "operator_name")
    private String operatorName;

    @Column(name = "block_reason_odoo_id")
    private Long blockReasonOdooId;

    @Column(name = "block_reason_name")
    private String blockReasonName;

    @Column(name = "qty_producing")
    private Double qtyProducing;

    @Column(name = "odoo_productivity_log_id")
    private Long odooProductivityLogId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();
}

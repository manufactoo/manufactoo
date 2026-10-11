package com.manufactoo.stations;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/**
 * Sesion de trabajo activa (o ya cerrada) sobre un work order de Odoo, en una
 * estacion concreta -- el equivalente a los botones Start/Pausar/Bloquear/
 * Finalizar del Shop Floor de Odoo (ver conversacion 2026-08-05). No duplica
 * el work order: odooWorkorderId solo referencia el id real de
 * mrp.workorder, que se sigue leyendo en vivo de Odoo (igual patron que
 * Station.odooWorkcenterId -- id + nombre cacheado, sin FK real).
 * <p>
 * A lo sumo una fila con state != DONE por estacion a la vez (lo exige
 * WorkOrderSessionService, no una constraint de BD -- mismo criterio que
 * StationMaterialLoad con unloadedAt).
 */
@Entity
@Table(name = "work_order_sessions")
@Getter
@Setter
@NoArgsConstructor
public class WorkOrderSession {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "station_id", nullable = false)
    private Long stationId;

    @Column(name = "odoo_workorder_id", nullable = false)
    private Long odooWorkorderId;

    @Column(name = "odoo_workcenter_id")
    private Long odooWorkcenterId;

    /** RUNNING/PAUSED/BLOCKED/DONE -- ver WorkOrderSessionService para las transiciones validas. */
    @Column(nullable = false, length = 20)
    private String state;

    @Column(name = "operator_employee_id")
    private Long operatorEmployeeId;

    @Column(name = "operator_name")
    private String operatorName;

    @Column(name = "qty_producing", nullable = false)
    private double qtyProducing;

    @Column(name = "qty_produced", nullable = false)
    private double qtyProduced;

    @Column(name = "block_reason_odoo_id")
    private Long blockReasonOdooId;

    @Column(name = "block_reason_name")
    private String blockReasonName;

    @Column(name = "started_at", nullable = false)
    private Instant startedAt = Instant.now();

    @Column(name = "finished_at")
    private Instant finishedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @PreUpdate
    void onUpdate() {
        this.updatedAt = Instant.now();
    }
}

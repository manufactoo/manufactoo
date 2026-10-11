-- Sesion de trabajo sobre un work order de Odoo (mrp.workorder), a nivel de
-- Work Center/estacion -- lo que en el Shop Floor de Odoo serian los botones
-- Start/Pausar/Bloquear/Finalizar + cantidad producida (ver conversacion
-- 2026-08-05, investigacion en vivo contra Odoo real). No duplica el work
-- order en si (eso sigue viviendo en Odoo, se sigue leyendo en vivo via
-- ODOO_WORKORDERS); esta tabla es solo el ESTADO/tiempo/operario/cantidad que
-- Manufactoo lleva localmente, ademas de escribirlo en Odoo (mrp.workorder +
-- mrp.workcenter.productivity) en el mismo momento -- ver WorkOrderSessionService.
--
-- A lo sumo una sesion activa (state != 'DONE') por estacion a la vez: lo
-- exige el servicio, no una constraint aqui (mismo criterio que
-- station_material_loads con unloaded_at).
CREATE TABLE work_order_sessions (
    id                    BIGSERIAL PRIMARY KEY,
    station_id            BIGINT       NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    odoo_workorder_id     BIGINT       NOT NULL,
    odoo_workcenter_id    BIGINT,
    state                 VARCHAR(20)  NOT NULL, -- RUNNING/PAUSED/BLOCKED/DONE
    operator_employee_id  BIGINT,
    operator_name         VARCHAR(255),
    qty_producing         DOUBLE PRECISION NOT NULL DEFAULT 0,
    qty_produced          DOUBLE PRECISION NOT NULL DEFAULT 0,
    block_reason_odoo_id  BIGINT,
    block_reason_name     VARCHAR(255),
    started_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
    finished_at           TIMESTAMPTZ,
    created_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_work_order_sessions_station ON work_order_sessions(station_id);
CREATE INDEX idx_work_order_sessions_active ON work_order_sessions(station_id) WHERE state <> 'DONE';

-- Log inmutable append-only de cada transicion de una sesion (igual criterio
-- que station_trace_records: nunca se actualiza ni se borra desde la
-- aplicacion). odoo_productivity_log_id guarda el id de Odoo
-- (mrp.workcenter.productivity) que este evento abrio/cerro -- lo necesita
-- WorkOrderSessionService para reatribuir el tiempo al operario real DESPUES
-- de cerrar el tramo, sin romper el estado interno de Odoo.
CREATE TABLE work_order_session_events (
    id                       BIGSERIAL PRIMARY KEY,
    session_id               BIGINT      NOT NULL REFERENCES work_order_sessions(id) ON DELETE CASCADE,
    event_type               VARCHAR(20) NOT NULL, -- START/PAUSE/RESUME/BLOCK/UNBLOCK/FINISH
    operator_employee_id     BIGINT,
    operator_name            VARCHAR(255),
    block_reason_odoo_id     BIGINT,
    block_reason_name        VARCHAR(255),
    qty_producing             DOUBLE PRECISION,
    odoo_productivity_log_id BIGINT,
    created_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_work_order_session_events_session ON work_order_session_events(session_id);

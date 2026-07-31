-- Lote de material cargado en una estacion (p. ej. el carrete de resistencias
-- en una ranura de una maquina de pick and place). No es un dato por unidad:
-- se carga UNA vez (al cambiar el carrete) y queda activo hasta el siguiente
-- cambio -- StationService.submitRecord anota automaticamente el lote activo
-- en cada unidad que pasa mientras tanto (ver StationTraceRecord.capturedData).
-- unloaded_at NULL = carga actualmente activa; al cargar uno nuevo para la
-- misma binding_key se cierra el anterior (unloaded_at = now) en vez de
-- borrarlo, asi queda un historial completo de que estuvo cargado y cuando.
CREATE TABLE station_material_loads (
    id          BIGSERIAL PRIMARY KEY,
    station_id  BIGINT       NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    binding_key VARCHAR(100) NOT NULL,
    value       VARCHAR(255) NOT NULL,
    label       VARCHAR(255) NOT NULL,
    loaded_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    unloaded_at TIMESTAMPTZ
);
CREATE INDEX idx_station_material_loads_station ON station_material_loads(station_id);
CREATE INDEX idx_station_material_loads_active ON station_material_loads(station_id, binding_key) WHERE unloaded_at IS NULL;

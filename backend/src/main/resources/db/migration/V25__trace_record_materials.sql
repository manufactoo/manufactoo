-- Relacion unidad<->lote: que lotes/series estaban activos cuando se registro
-- cada unidad. Antes esto solo se guardaba como texto concatenado dentro de
-- captured_data (util para mostrarlo, pero no para consultarlo) -- esta tabla
-- es la version consultable ("que unidades llevaron el lote X", tipico de una
-- retirada/recall), sin sustituir el texto (que sigue sirviendo para el
-- resumen de cada paso en Genealogia). Sin claves foraneas, igual que el
-- resto del esquema (station_trace_records.station_id, station_material_loads.station_id
-- tampoco las tienen): los registros de trazabilidad son append-only e
-- independientes del ciclo de vida de las entidades vivas.
CREATE TABLE trace_record_materials (
    id BIGSERIAL PRIMARY KEY,
    trace_record_id BIGINT NOT NULL,
    material_load_id BIGINT NOT NULL
);

CREATE INDEX idx_trace_record_materials_trace_record_id ON trace_record_materials (trace_record_id);
CREATE INDEX idx_trace_record_materials_material_load_id ON trace_record_materials (material_load_id);

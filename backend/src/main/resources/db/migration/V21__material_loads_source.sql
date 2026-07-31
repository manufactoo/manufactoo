-- El origen automatico (dispositivo/evento) pasa de vivir en el widget
-- MATERIAL_LOT a vivir en la propia ranura (StationMaterialLoad): asi
-- funciona igual para una ranura con widget en el lienzo que para una suelta,
-- y el widget queda puramente informativo (ver MaterialLoadService).
--
-- data_source_type/lookup_column dejan de hacer falta: la carga de material
-- siempre se resuelve contra series/lotes de Odoo (ODOO_SERIALS / name), ya
-- no es configurable por ranura.
ALTER TABLE station_material_loads
    ADD COLUMN source_device_id BIGINT,
    ADD COLUMN source_event_id BIGINT;

ALTER TABLE station_material_loads
    DROP COLUMN data_source_type,
    DROP COLUMN lookup_column;

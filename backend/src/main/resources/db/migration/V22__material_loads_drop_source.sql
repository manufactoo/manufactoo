-- El origen automatico (dispositivo/evento) de una ranura de material vuelve
-- a decidirlo el DISENADOR en el widget MATERIAL_LOT (Station Builder), no el
-- operario en el popup de Materiales en tiempo real -- exactamente igual que
-- cualquier otro widget con origen (TEXT_INPUT, DROPDOWN...), donde ese campo
-- ya vive en screen_widgets.source_device_id/source_event_id. Guardarlo
-- tambien por fila en station_material_loads (V21) era redundante y permitia
-- cambiarlo desde el popup, que es justo lo que no se queria.
ALTER TABLE station_material_loads
    DROP COLUMN source_device_id,
    DROP COLUMN source_event_id;

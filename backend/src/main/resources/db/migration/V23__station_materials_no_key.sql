-- Los lotes/series cargados en una estacion dejan de tener "ranura" o clave
-- que los identifique (binding_key): son un dato de la ESTACION, y su
-- identidad es el propio lote (value = id de Odoo) -- pueden estar activos a
-- la vez varios lotes distintos, incluso del mismo producto (ver
-- conversacion 2026-07-30, tercera vuelta). No se migran datos existentes
-- (formato incompatible, y se ha pedido limpiar de todos modos).
DELETE FROM station_material_loads;

ALTER TABLE station_material_loads
    DROP COLUMN binding_key;

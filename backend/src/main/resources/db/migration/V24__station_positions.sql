-- Posiciones fisicas de una estacion (p. ej. "R1", "Feeder-A"): una lista
-- fija que define el diseñador, independiente de los widgets. Al cargar un
-- material indicando una posicion, sustituye lo que hubiera antes en esa
-- misma posicion (recupera el comportamiento de sustitucion que se perdio al
-- quitar el concepto de "ranura" ligada a un widget -- ver conversacion
-- 2026-07-31). Sin posicion, un material simplemente se añade (como ahora).
ALTER TABLE stations
    ADD COLUMN positions jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE station_material_loads
    ADD COLUMN position VARCHAR(255);

-- Anota, en cada registro de trazabilidad, que clave(s) de identificador de
-- ruta se le aplicaban EN ESE MOMENTO (ver StationService.validateRouteSequence).
-- Es una foto congelada: si una ruta cambia su identifier_binding_key mas
-- adelante, los registros ya guardados conservan la clave con la que
-- realmente se capturaron, asi la Genealogia nunca pierde ni reinterpreta
-- datos historicos por un cambio de configuracion posterior.
ALTER TABLE station_trace_records
    ADD COLUMN route_identifier_keys JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Estaciones avanzadas: dispositivos asociados a campos, imagenes y navegacion
-- entre pantallas (secuencia tipo Tulip Steps). La genealogia sigue guardandose
-- en station_trace_records (un registro por ejecucion completa de la secuencia).

-- Un widget de dato puede alimentarse de un dispositivo de entrada creado en
-- Dispositivos (p. ej. un lector de codigo de barras que rellena el campo
-- "operario"). El I/O real del dispositivo es trabajo futuro; esto guarda la
-- asociacion para que el runtime sepa que campo escucha a que dispositivo.
ALTER TABLE screen_widgets
    ADD COLUMN source_device_id BIGINT REFERENCES devices(id) ON DELETE SET NULL;

-- Imagenes (u otros assets) subidos para usarse en widgets IMAGE. Se guardan en
-- la propia BBDD (on-prem, sin dependencias externas) y se sirven autenticados,
-- igual que el logo de empresa.
CREATE TABLE station_assets (
    id           BIGSERIAL PRIMARY KEY,
    filename     VARCHAR(255) NOT NULL,
    content_type VARCHAR(100) NOT NULL,
    data         BYTEA        NOT NULL,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

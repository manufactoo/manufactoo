-- Separa "que es" (category) de "como se conecta" (transport), y separa la
-- configuracion de conexion de la configuracion propia de la categoria.
-- La tabla no tiene filas reales todavia (solo pruebas ya borradas), asi
-- que se redefine directamente en vez de migrar datos.
ALTER TABLE devices
    DROP COLUMN device_type,
    DROP COLUMN config_json,
    ADD COLUMN category         VARCHAR(50)  NOT NULL,
    ADD COLUMN transport        VARCHAR(50)  NOT NULL,
    ADD COLUMN connection_json  JSONB        NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN settings_json    JSONB        NOT NULL DEFAULT '{}'::jsonb;

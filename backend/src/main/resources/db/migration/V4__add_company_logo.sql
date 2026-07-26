-- Logo de la empresa, mostrado en la cabecera del sidebar. Migracion
-- aditiva y no destructiva: columnas nullable, sin afectar filas existentes.
ALTER TABLE company_settings
    ADD COLUMN logo_image BYTEA,
    ADD COLUMN logo_content_type VARCHAR(100),
    ADD COLUMN logo_updated_at TIMESTAMPTZ;

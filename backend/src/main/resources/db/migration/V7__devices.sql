-- Dispositivos de planta (app "traceability_genealogy"). config_json guarda
-- los parametros propios de cada tipo (puerto serie, IP de impresora, etc.);
-- de momento son solo metadatos: la comunicacion real con el dispositivo
-- (drivers) es trabajo futuro.
CREATE TABLE devices (
    id              BIGSERIAL PRIMARY KEY,
    name            VARCHAR(255)    NOT NULL,
    device_type     VARCHAR(50)     NOT NULL,
    direction       VARCHAR(20)     NOT NULL,
    enabled         BOOLEAN         NOT NULL DEFAULT true,
    config_json     JSONB           NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT now()
);

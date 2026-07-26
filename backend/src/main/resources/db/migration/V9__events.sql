-- Eventos MQTT (app "traceability_genealogy"). Distintos de "devices": un
-- device es una conexion punto a punto (puerto serie, socket a una IP);
-- un evento es un topic del broker MQTT embebido de Manufactoo, en el que
-- Manufactoo se suscribe (SUBSCRIBE) o publica (PUBLISH). El broker en si
-- (y la comunicacion real con el) es trabajo futuro: esto solo modela la
-- configuracion.
CREATE TABLE events (
    id              BIGSERIAL PRIMARY KEY,
    name            VARCHAR(255)    NOT NULL,
    topic           VARCHAR(500)    NOT NULL,
    direction       VARCHAR(20)     NOT NULL,
    enabled         BOOLEAN         NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT now()
);

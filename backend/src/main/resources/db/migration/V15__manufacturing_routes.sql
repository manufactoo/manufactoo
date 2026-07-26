-- Ruta de fabricacion: la secuencia ordenada de estaciones por las que debe
-- pasar una unidad de un producto/modelo determinado. Se define por producto
-- (como en el routing de mrp.bom de Odoo), no por unidad individual; lo que
-- se rastrea unidad a unidad es el IDENTIFICADOR (identifier_binding_key: la
-- clave de datos -- serial, orden, etc. -- que aparece en capturedData de
-- station_trace_records y que correlaciona los pasos de una misma unidad).
CREATE TABLE manufacturing_routes (
    id                     BIGSERIAL PRIMARY KEY,
    name                   VARCHAR(255)  NOT NULL,
    description            VARCHAR(1000) NOT NULL DEFAULT '',
    product_id             BIGINT,
    product_name           VARCHAR(255),
    identifier_binding_key VARCHAR(255)  NOT NULL,
    enabled                BOOLEAN       NOT NULL DEFAULT true,
    created_at             TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE TABLE route_steps (
    id          BIGSERIAL PRIMARY KEY,
    route_id    BIGINT      NOT NULL REFERENCES manufacturing_routes(id) ON DELETE CASCADE,
    station_id  BIGINT      NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    order_index INT         NOT NULL,
    name        VARCHAR(255) NOT NULL DEFAULT ''
);

CREATE INDEX idx_route_steps_route_id ON route_steps(route_id);
CREATE INDEX idx_route_steps_station_id ON route_steps(station_id);

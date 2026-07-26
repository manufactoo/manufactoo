-- Estaciones no-code (app "traceability_genealogy"). Modelo relacional plano
-- inspirado en el proyecto de referencia analizado: station -> screen -> widget.
-- Cada widget es UNA fila con su posicion en un grid de 12 columnas (layout jsonb)
-- y su configuracion/binding en jsonb; no hay arbol anidado. La MISMA fila que
-- escribe el editor no-code es la que lee el runtime del operario: no existe una
-- copia "compilada" o "publicada" aparte.

CREATE TABLE stations (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(255)  NOT NULL,
    description VARCHAR(1000) NOT NULL DEFAULT '',
    enabled     BOOLEAN       NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- Una estacion puede tener varias pantallas (pasos). El runtime las recorre en
-- orden. En el slice inicial el builder trabaja con una unica pantalla por
-- estacion, pero el modelo ya soporta N.
CREATE TABLE station_screens (
    id          BIGSERIAL PRIMARY KEY,
    station_id  BIGINT       NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    title       VARCHAR(255) NOT NULL DEFAULT '',
    order_index INT          NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_station_screens_station ON station_screens(station_id);

-- Un widget del layout. widget_type sale del WidgetCatalog (fuente unica de
-- verdad backend). binding_key es la clave bajo la que se guarda el valor
-- capturado en trazabilidad (obligatoria para widgets de datos). data_source
-- describe de donde salen las opciones de un desplegable (Odoo o lista estatica).
CREATE TABLE screen_widgets (
    id          BIGSERIAL PRIMARY KEY,
    screen_id   BIGINT       NOT NULL REFERENCES station_screens(id) ON DELETE CASCADE,
    widget_type VARCHAR(50)  NOT NULL,
    label       VARCHAR(255) NOT NULL DEFAULT '',
    binding_key VARCHAR(100),
    required    BOOLEAN      NOT NULL DEFAULT false,
    config      JSONB        NOT NULL DEFAULT '{}'::jsonb,
    data_source JSONB        NOT NULL DEFAULT '{}'::jsonb,
    layout      JSONB        NOT NULL DEFAULT '{}'::jsonb,
    order_index INT          NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_screen_widgets_screen ON screen_widgets(screen_id);

-- Registro inmutable de trazabilidad: cada envio del operario en una estacion
-- genera una fila append-only con el mapa de valores capturados (captured_data).
CREATE TABLE station_trace_records (
    id            BIGSERIAL PRIMARY KEY,
    station_id    BIGINT      NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    screen_id     BIGINT      REFERENCES station_screens(id) ON DELETE SET NULL,
    captured_data JSONB       NOT NULL DEFAULT '{}'::jsonb,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_station_trace_records_station ON station_trace_records(station_id);

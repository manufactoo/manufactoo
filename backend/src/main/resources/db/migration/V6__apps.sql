-- Framework de apps instalables. El catalogo de apps y sus dependencias
-- vive en codigo (interfaz ManufactooApp); esta tabla solo persiste el
-- ESTADO de instalacion, que es lo unico realmente mutable por el usuario.
CREATE TABLE apps (
    app_key         VARCHAR(100) PRIMARY KEY,
    status          VARCHAR(20)  NOT NULL DEFAULT 'NOT_INSTALLED',
    installed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

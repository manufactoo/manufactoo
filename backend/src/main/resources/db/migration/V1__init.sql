-- Manufactoo - esquema inicial (wizard de instalacion + dashboard base)
-- Migraciones Flyway: siempre hacia adelante, no destructivas por defecto.

CREATE TABLE users (
    id              BIGSERIAL PRIMARY KEY,
    name            VARCHAR(255)        NOT NULL,
    email           VARCHAR(255)        NOT NULL UNIQUE,
    password_hash   VARCHAR(255)        NOT NULL,
    role            VARCHAR(50)         NOT NULL DEFAULT 'ADMIN',
    language        VARCHAR(10)         NOT NULL DEFAULT 'es',
    theme           VARCHAR(10)         NOT NULL DEFAULT 'system',
    accent_color    VARCHAR(30)         NOT NULL DEFAULT 'default',
    created_at      TIMESTAMPTZ         NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ         NOT NULL DEFAULT now()
);

CREATE TABLE company_settings (
    id              BIGSERIAL PRIMARY KEY,
    name            VARCHAR(255)        NOT NULL,
    sector          VARCHAR(50),
    created_at      TIMESTAMPTZ         NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ         NOT NULL DEFAULT now()
);

CREATE TABLE odoo_connection (
    id                  BIGSERIAL PRIMARY KEY,
    mode                VARCHAR(20)     NOT NULL, -- embedded | external
    host                VARCHAR(255)    NOT NULL,
    port                INTEGER         NOT NULL DEFAULT 8069,
    database            VARCHAR(255)    NOT NULL,
    username            VARCHAR(255)    NOT NULL,
    -- Cifrado AES-256-GCM: nonce (12 bytes) + tag van embebidos en el binario cifrado.
    api_key_encrypted   BYTEA           NOT NULL,
    odoo_version        VARCHAR(10),           -- '18' | '19', detectada al conectar
    last_test_status    VARCHAR(20),           -- success | failure | never_tested
    last_test_at        TIMESTAMPTZ,
    last_test_error     TEXT,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT now()
);

CREATE TABLE installation_wizard_state (
    id              BIGSERIAL PRIMARY KEY,
    current_step    INTEGER             NOT NULL DEFAULT 1,
    payload_json    JSONB               NOT NULL DEFAULT '{}'::jsonb,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ         NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ         NOT NULL DEFAULT now()
);

-- Instalacion de instancia unica: como mucho una fila viva en cada tabla de configuracion.
CREATE UNIQUE INDEX uq_company_settings_singleton ON company_settings ((true));
CREATE UNIQUE INDEX uq_odoo_connection_singleton ON odoo_connection ((true));
CREATE UNIQUE INDEX uq_wizard_state_singleton ON installation_wizard_state ((true));

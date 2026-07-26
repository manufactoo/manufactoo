-- Versiones publicadas del Manufactoo Player (Electron), alojadas en el propio
-- servidor Manufactoo para que electron-updater pueda comprobar/descargar
-- actualizaciones dentro de la LAN de la empresa, sin salir a internet.
CREATE TABLE player_releases (
    id              BIGSERIAL PRIMARY KEY,
    version         VARCHAR(50)     NOT NULL,
    platform        VARCHAR(20)     NOT NULL, -- WINDOWS | MAC | LINUX
    filename        VARCHAR(255)    NOT NULL,
    content_type    VARCHAR(100)    NOT NULL,
    data            BYTEA           NOT NULL,
    size_bytes      BIGINT          NOT NULL,
    sha512_base64   VARCHAR(255)    NOT NULL,
    release_notes   TEXT,
    published_at    TIMESTAMPTZ     NOT NULL DEFAULT now()
);

CREATE INDEX idx_player_releases_platform_published ON player_releases(platform, published_at DESC);

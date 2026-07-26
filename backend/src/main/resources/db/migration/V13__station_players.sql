-- Manufactoo Player (Electron): identidad y emparejamiento de un puesto fisico.
-- Flujo tipo "device code" (como emparejar una smart TV): el Player genera un
-- codigo de emparejamiento y lo muestra en pantalla; un administrador, desde el
-- panel web, asigna ese Player pendiente a una estacion; el Player (que sigue
-- sondeando) recibe entonces un token de larga duracion UNA SOLA VEZ y lo
-- guarda localmente. A partir de ahi el Player se autentica con ese token
-- (cabecera X-Player-Token), nunca con credenciales de usuario.
CREATE TABLE station_players (
    id                      BIGSERIAL PRIMARY KEY,
    name                    VARCHAR(255)    NOT NULL,
    hostname                VARCHAR(255),
    pairing_id              VARCHAR(64)     UNIQUE,
    pairing_code            VARCHAR(12),
    pairing_expires_at      TIMESTAMPTZ,
    token_delivered         BOOLEAN         NOT NULL DEFAULT false,
    device_token_hash       VARCHAR(255),
    station_id              BIGINT          REFERENCES stations(id) ON DELETE SET NULL,
    player_version          VARCHAR(50),
    last_seen_at            TIMESTAMPTZ,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT now()
);

CREATE INDEX idx_station_players_station_id ON station_players(station_id);

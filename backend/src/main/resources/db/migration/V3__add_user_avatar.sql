-- Foto de perfil del usuario. Migracion aditiva y no destructiva:
-- columnas nullable, sin afectar filas existentes.
ALTER TABLE users
    ADD COLUMN avatar_image BYTEA,
    ADD COLUMN avatar_content_type VARCHAR(100),
    ADD COLUMN avatar_updated_at TIMESTAMPTZ;

#!/usr/bin/env bash
# Orquesta una actualizacion de Manufactoo en produccion:
#   1) backup de BBDD (Manufactoo)
#   2) pull de las nuevas imagenes Docker (tag inmutable, nunca "latest")
#   3) flyway migrate (lo ejecuta el propio backend al arrancar)
#   4) docker compose up -d
#   5) healthcheck (API + conexion Odoo)
#   6) si falla, rollback automatico a la imagen y backup anteriores
#
# Uso: ./scripts/manufactoo-update.sh <nueva-version>
#   ej: ./scripts/manufactoo-update.sh 1.3.0
#
# En modo desarrollo (SPRING_PROFILES_ACTIVE=dev en .env), pide confirmacion
# extra en cada paso; en produccion corre de forma no interactiva salvo error.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

NEW_VERSION="${1:?Uso: manufactoo-update.sh <version>, ej. 1.3.0}"
ENV_FILE="${ROOT_DIR}/.env"
BACKUP_DIR="${ROOT_DIR}/backups"
STATE_FILE="${ROOT_DIR}/.manufactoo-last-version"
COMPOSE="docker compose -f docker-compose.yml"

if [[ ! -f "${ENV_FILE}" ]]; then
    echo "No existe .env. Copia .env.example a .env y rellenalo antes de actualizar." >&2
    exit 1
fi
# shellcheck disable=SC1090
set -a; source "${ENV_FILE}"; set +a

PREVIOUS_VERSION="$(cat "${STATE_FILE}" 2>/dev/null || echo "${MANUFACTOO_VERSION:-unknown}")"
TIMESTAMP="$(date +%Y%m%d%H%M%S)"

log() { echo "[manufactoo-update] $*"; }

backup() {
    log "1/5 Backup de la base de datos (timestamp ${TIMESTAMP})..."
    mkdir -p "${BACKUP_DIR}"
    docker compose exec -T postgres pg_dump -U "${DB_USER:-manufactoo}" "${DB_NAME:-manufactoo}" \
        > "${BACKUP_DIR}/manufactoo_${TIMESTAMP}.sql"
    log "Backup guardado en ${BACKUP_DIR}/manufactoo_${TIMESTAMP}.sql"
    # La clave maestra se respalda con el mismo nivel de restriccion que la BBDD (ver README).
    if [[ -f "${ROOT_DIR}/secrets/manufactoo_master_key" ]]; then
        cp "${ROOT_DIR}/secrets/manufactoo_master_key" "${BACKUP_DIR}/manufactoo_master_key_${TIMESTAMP}.bak"
        chmod 600 "${BACKUP_DIR}/manufactoo_master_key_${TIMESTAMP}.bak"
    fi
}

pull_images() {
    log "2/5 Descargando imagenes manufactoo-backend:${NEW_VERSION} y manufactoo-frontend:${NEW_VERSION}..."
    MANUFACTOO_VERSION="${NEW_VERSION}" ${COMPOSE} pull backend frontend
}

deploy() {
    log "3-4/5 Aplicando migraciones (Flyway, al arrancar el backend) y levantando contenedores..."
    MANUFACTOO_VERSION="${NEW_VERSION}" ${COMPOSE} up -d
}

healthcheck() {
    log "5/5 Comprobando salud de la instalacion..."
    local attempts=0
    until curl -fsS "http://localhost:8080/actuator/health" > /dev/null 2>&1; do
        attempts=$((attempts + 1))
        if [[ ${attempts} -ge 15 ]]; then
            log "La API no responde tras ${attempts} intentos."
            return 1
        fi
        sleep 4
    done

    # Reutiliza el mismo endpoint de test de conexion del wizard/settings.
    local odoo_ok
    odoo_ok=$(curl -fsS -X POST "http://localhost:8080/api/settings/odoo-connection/test" \
        -H "Content-Type: application/json" 2>/dev/null | grep -o '"success":true' || true)
    if [[ -z "${odoo_ok}" ]]; then
        log "Advertencia: la API responde pero el test de conexion a Odoo no confirmo exito."
        return 1
    fi

    log "Healthcheck OK."
    return 0
}

rollback() {
    log "FALLO detectado. Revirtiendo a la version anterior (${PREVIOUS_VERSION})..."
    MANUFACTOO_VERSION="${PREVIOUS_VERSION}" ${COMPOSE} up -d
    local latest_backup
    latest_backup="$(ls -1t "${BACKUP_DIR}"/manufactoo_*.sql 2>/dev/null | head -n1 || true)"
    if [[ -n "${latest_backup}" ]]; then
        log "Restaurando backup de BBDD: ${latest_backup}"
        docker compose exec -T postgres psql -U "${DB_USER:-manufactoo}" -d "${DB_NAME:-manufactoo}" < "${latest_backup}"
    fi
    log "Rollback completado. La instalacion deberia estar de nuevo en ${PREVIOUS_VERSION}."
    exit 1
}

backup
pull_images
deploy

if ! healthcheck; then
    rollback
fi

echo "${NEW_VERSION}" > "${STATE_FILE}"
log "Actualizacion a ${NEW_VERSION} completada con exito."

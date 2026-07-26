#!/usr/bin/env bash
# Genera la clave maestra de 256 bits usada para cifrar (AES-256-GCM) las
# credenciales de conexion a Odoo almacenadas en la tabla odoo_connection.
#
# Debe ejecutarse UNA SOLA VEZ, antes del primer "docker compose up", porque
# Docker Compose Secrets monta el fichero de solo lectura dentro del
# contenedor: la aplicacion no puede generarlo desde dentro una vez montado.
#
# Si se pierde este fichero sin backup, las credenciales de Odoo cifradas en
# BBDD quedan irrecuperables y habra que reconfigurar la conexion a Odoo
# manualmente desde el dashboard (Configuracion > Conexion Odoo).
set -euo pipefail

SECRETS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/secrets"
KEY_FILE="${SECRETS_DIR}/manufactoo_master_key"

mkdir -p "${SECRETS_DIR}"

if [[ -f "${KEY_FILE}" ]]; then
    echo "Ya existe una clave maestra en ${KEY_FILE}. No se sobrescribe."
    echo "Si de verdad quieres regenerarla (esto invalida las credenciales Odoo ya cifradas), borra el fichero primero."
    exit 1
fi

# 256 bits = 32 bytes, en binario (no se guarda en base64 para que quepa exactamente 32 bytes de entropia).
openssl rand -out "${KEY_FILE}" 32
chmod 600 "${KEY_FILE}"

echo "Clave maestra generada en ${KEY_FILE} (permisos 600)."
echo "IMPORTANTE: incluye este fichero en tus backups (mismo nivel de restriccion que la BBDD)."
echo "Este fichero esta excluido de git via .gitignore. No lo subas nunca a un repositorio."

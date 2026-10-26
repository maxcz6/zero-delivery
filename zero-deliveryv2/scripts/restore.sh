#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# Zero Delivery — Script de Restauración de PostgreSQL (CA-15)
# =============================================================================

BACKUP_INPUT="${1:?Uso: ./scripts/restore.sh <ruta-al-archivo.dump|.dump.enc>}"
TARGET_DATABASE_URL="${TARGET_DATABASE_URL:?Debes definir TARGET_DATABASE_URL}"

RESTORE_FILE="${BACKUP_INPUT}"

if [[ "${BACKUP_INPUT}" == *.enc ]]; then
  : "${BACKUP_PASSPHRASE:?Debes definir BACKUP_PASSPHRASE para descifrar un backup .enc}"
  RESTORE_FILE="${BACKUP_INPUT%.enc}.tmp.dump"
  openssl enc -d -aes-256-cbc -pbkdf2 -in "${BACKUP_INPUT}" -out "${RESTORE_FILE}" -pass env:BACKUP_PASSPHRASE
fi

echo "[restore] Restaurando ${RESTORE_FILE} en la base de destino..."
pg_restore --clean --if-exists --no-owner --no-privileges --dbname="${TARGET_DATABASE_URL}" "${RESTORE_FILE}"

if [[ "${RESTORE_FILE}" != "${BACKUP_INPUT}" ]]; then
  rm -f "${RESTORE_FILE}"
fi

echo "[restore] Restauración completada."

#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# Zero Delivery — Script de Copia de Seguridad de PostgreSQL (CA-15)
# =============================================================================

DATABASE_URL="${DATABASE_URL:?Debes definir DATABASE_URL}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
TIMESTAMP="$(date -u +%Y%m%d_%H%M%S)"
DUMP_FILE="${BACKUP_DIR}/zd_backup_${TIMESTAMP}.dump"

mkdir -p "${BACKUP_DIR}"

echo "[backup] Generando copia de seguridad en ${DUMP_FILE}..."
pg_dump --format=custom --no-owner --no-privileges --file="${DUMP_FILE}" "${DATABASE_URL}"

if [[ -n "${BACKUP_PASSPHRASE:-}" ]]; then
  echo "[backup] Cifrando copia con AES-256..."
  openssl enc -aes-256-cbc -pbkdf2 -salt -in "${DUMP_FILE}" -out "${DUMP_FILE}.enc" -pass env:BACKUP_PASSPHRASE
  rm -f "${DUMP_FILE}"
  DUMP_FILE="${DUMP_FILE}.enc"
fi

sha256sum "${DUMP_FILE}" > "${DUMP_FILE}.sha256"
find "${BACKUP_DIR}" -type f -mtime +"${RETENTION_DAYS}" -delete

echo "[backup] Completado exitosamente: ${DUMP_FILE}"

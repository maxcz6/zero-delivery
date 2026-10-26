# Runbook: Copias de Seguridad y Restauración de PostgreSQL (`backup` / `restore`)

> **Criterio de Aceptación:** `CA-15` · **Scripts asociados:** `scripts/backup.sh` y `scripts/restore.sh`

---

## 1. Requisitos Previos

- Cliente `pg_dump` y `psql` (PostgreSQL 16+) disponibles en el entorno o a través del contenedor Docker `zero-delivery-db`.
- Variable de entorno `DATABASE_URL` configurada.
- Opcional (recomendado en producción): `BACKUP_PASSPHRASE` para cifrado simétrico AES-256 con `openssl` o `gpg`.

---

## 2. Generación de Copia de Seguridad (`scripts/backup.sh`)

```bash
# Ejecución manual
DATABASE_URL="postgres://postgres:postgres@localhost:5433/zero_delivery" \
BACKUP_DIR="./backups" \
RETENTION_DAYS=14 \
./scripts/backup.sh
```

**Qué hace el script:**
1. Crea el directorio de salida si no existe.
2. Ejecuta `pg_dump --format=custom --no-owner --no-privileges` generando un archivo `.dump` con marca de tiempo UTC (`zd_backup_YYYYMMDD_HHMMSS.dump`).
3. Si `BACKUP_PASSPHRASE` está definida, cifra el archivo con `openssl enc -aes-256-cbc -pbkdf2`.
4. Calcula y guarda el hash `SHA-256` (`.sha256`).
5. Elimina copias locales con antigüedad mayor a `RETENTION_DAYS` (por defecto 14 días).

---

## 3. Procedimiento de Restauración (`scripts/restore.sh`)

> [!CAUTION]
> La restauración sobrescribe los objetos de la base de datos de destino. En producción, restaura siempre primero en una base de datos temporal (`zero_delivery_restore_test`) para verificar la integridad de las tablas de solo-inserción (`wallet_entries`, `audit_logs`, `orders`).

```bash
# Restaurar en una base de verificación
TARGET_DATABASE_URL="postgres://postgres:postgres@localhost:5433/zero_delivery_restore_test" \
./scripts/restore.sh ./backups/zd_backup_20261026_080000.dump
```

**Verificación post-restauración:**
1. Comprobar conteo de pedidos y asientos de billetera:
   ```sql
   SELECT count(*) FROM orders;
   SELECT count(*), COALESCE(SUM(amount_cents), 0) FROM wallet_entries;
   ```
2. Comprobar que el trigger de inmutabilidad sigue activo:
   ```sql
   -- Debe fallar con restrict_violation:
   DELETE FROM audit_logs WHERE false;
   ```

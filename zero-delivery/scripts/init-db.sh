#!/usr/bin/env bash
# Inicializa y valida el esquema canonico de Zero Delivery.
# Uso:
#   ./scripts/init-db.sh              # carga si esta vacio y valida
#   ./scripts/init-db.sh --force      # DESTRUCTIVO: recrea el esquema
#   ./scripts/init-db.sh --validate   # solo valida
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SQL_FILE="$REPO_ROOT/0001_esquema_zero_delivery_es.sql"
COMPOSE_FILE="$REPO_ROOT/docker-compose.yml"

DB_USER="${POSTGRES_USER:-postgres}"
DB_NAME="${POSTGRES_DB:-zero_delivery}"
FORCE=0
VALIDATE_ONLY=0

for arg in "$@"; do
  case "$arg" in
    --force|-f)     FORCE=1 ;;
    --validate|-v)  VALIDATE_ONLY=1 ;;
    *) echo "Argumento desconocido: $arg" >&2; exit 2 ;;
  esac
done

[ -f "$SQL_FILE" ] || { echo "No se encontro el DDL en $SQL_FILE" >&2; exit 1; }

if docker compose --project-directory "$REPO_ROOT" -f "$COMPOSE_FILE" ps postgres >/dev/null 2>&1; then
  PSQL=(docker compose --project-directory "$REPO_ROOT" -f "$COMPOSE_FILE" exec -T postgres psql -U "$DB_USER")
  ENGINE="docker compose (servicio postgres)"
else
  export PGPASSWORD="${POSTGRES_PASSWORD:-postgres}"
  PSQL=(psql -h 127.0.0.1 -p "${POSTGRES_PORT:-5434}" -U "$DB_USER")
  ENGINE="psql local 127.0.0.1:${POSTGRES_PORT:-5434}"
fi

psql_run() { "${PSQL[@]}" -d "$DB_NAME" "$@"; }

echo "Zero Delivery - init-db"
echo "  motor      : $ENGINE"
echo "  base datos : $DB_NAME"
echo "  DDL        : $SQL_FILE"

exists="$(psql_run -tAc "SELECT to_regclass('public.pedidos') IS NOT NULL;")"

if [ "$FORCE" -eq 1 ]; then
  [ "$VALIDATE_ONLY" -eq 1 ] && { echo "--force y --validate son incompatibles" >&2; exit 2; }
  echo "  accion     : DROP SCHEMA public CASCADE + recarga (DESTRUCTIVO)"
  psql_run -v ON_ERROR_STOP=1 -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;" >/dev/null
  exists="f"
fi

if [ "$exists" != "t" ] && [ "$VALIDATE_ONLY" -eq 0 ]; then
  echo "  accion     : cargando DDL canonico..."
  sed '1s/^\xEF\xBB\xBF//' "$SQL_FILE" | psql_run -v ON_ERROR_STOP=1 -f - >/dev/null
  echo "  carga      : OK"
elif [ "$VALIDATE_ONLY" -eq 0 ]; then
  echo "  accion     : el esquema ya existe; no se recarga (use --force)"
fi

scalar() { psql_run -tAc "$1" | tr -d '[:space:]'; }

fail=0
check() {
  local nombre="$1" sql="$2" esperado="$3" modo="$4" valor ok
  valor="$(scalar "$sql")"
  if [ "$modo" = "min" ]; then ok=$([ "${valor:-0}" -ge "$esperado" ] && echo 1 || echo 0)
  else ok=$([ "${valor:-0}" -eq "$esperado" ] && echo 1 || echo 0); fi
  if [ "$ok" -eq 1 ]; then
    printf "  [OK]   %-30s %s\n" "$nombre" "$valor"
  else
    printf "  [FAIL] %-30s %s (esperado %s)\n" "$nombre" "$valor" "$esperado"; fail=$((fail+1))
  fi
}

echo
echo "Validacion del esquema:"
check "tablas (esperado 45)"      "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';" 45 eq
check "triggers (minimo 10)"      "SELECT count(DISTINCT trigger_name) FROM information_schema.triggers WHERE trigger_schema='public';" 10 min
check "vistas (minimo 1)"         "SELECT count(*) FROM information_schema.views WHERE table_schema='public';" 1 min
check "fn sembrar_configuracion"  "SELECT count(*) FROM pg_proc WHERE proname='sembrar_configuracion_predeterminada';" 1 eq
check "extension pg_trgm"         "SELECT count(*) FROM pg_extension WHERE extname='pg_trgm';" 1 eq
check "tablas solo-insercion"     "SELECT count(DISTINCT event_object_table) FROM information_schema.triggers WHERE trigger_schema='public' AND event_object_table IN ('registro_auditoria','historial_estados_pedido','eventos_pago','movimientos_billetera');" 4 eq

echo
if [ "$fail" -eq 0 ]; then echo "Esquema canonico VALIDADO."; exit 0
else echo "$fail verificacion(es) fallaron."; exit 1; fi

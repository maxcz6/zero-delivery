#!/usr/bin/env bash
# =============================================================================
# Script de Despliegue Automatizado en VPS (Ubuntu / Debian)
# Zero Delivery + Vocero CRM
# =============================================================================
set -euo pipefail

echo "=================================================================="
echo "  Despliegue de Producción: Zero Delivery + Vocero CRM"
echo "=================================================================="

# 1. Verificar Docker y Docker Compose
if ! command -v docker >/dev/null 2>&1; then
  echo "[1/5] Instalando Docker..."
  curl -fsSL https://get.docker.com | sh
else
  echo "[1/5] Docker detectado: $(docker --version)"
fi

# 2. Asegurar memoria Swap de al menos 2 GB para evitar bloqueos al compilar Next.js/NestJS
SWAP_TOTAL_MB=$(free -m | awk '/^Swap:/ {print $2}')
if [ "${SWAP_TOTAL_MB:-0}" -lt 2000 ] && [ ! -f /swapfile ]; then
  echo "[2/5] Creando archivo Swap de 4 GB para compilación segura en VPS..."
  sudo fallocate -l 4G /swapfile || sudo dd if=/dev/zero of=/swapfile bs=1M count=4096
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  if ! grep -q "/swapfile" /etc/fstab; then
    echo "/swapfile none swap sw 0 0" | sudo tee -a /etc/fstab >/dev/null
  fi
else
  echo "[2/5] Memoria Swap verificada (${SWAP_TOTAL_MB} MB)."
fi

# 3. Inicializar submódulo vocero-crm si está vacío
echo "[3/5] Verificando submódulos Git..."
git submodule update --init --recursive || true

# 4. Generar archivo .env de producción con contraseñas seguras si no existe
if [ ! -f .env ]; then
  echo "[4/5] Generando archivo .env con claves aleatorias seguras..."
  cp .env.production.example .env
  PG_PASS=$(openssl rand -hex 16)
  MONGO_PASS=$(openssl rand -hex 16)
  RABBIT_PASS=$(openssl rand -hex 16)
  VOCERO_DB_PASS=$(openssl rand -hex 16)
  SHARED_BOT_KEY=$(openssl rand -hex 24)
  AUTH_SECRET=$(openssl rand -hex 32)

  sed -i "s/CAMBIAR_PASSWORD_POSTGRES_SEGURO_2026/${PG_PASS}/g" .env
  sed -i "s/CAMBIAR_PASSWORD_MONGO_SEGURO_2026/${MONGO_PASS}/g" .env
  sed -i "s/CAMBIAR_PASSWORD_RABBIT_SEGURO_2026/${RABBIT_PASS}/g" .env
  sed -i "s/CAMBIAR_PASSWORD_VOCERO_DB_2026/${VOCERO_DB_PASS}/g" .env
  sed -i "s/zero-delivery-vocero-shared-bot-key-prod-2026/${SHARED_BOT_KEY}/g" .env
  sed -i "s/63e393acb21e0cc8dbec4c172ff4bd76cf90200c204816f8978abdc0fd16159d/${AUTH_SECRET}/g" .env
  echo "  -> Archivo .env generado correctamente."
else
  echo "[4/5] Archivo .env existente detectado."
fi

# 5. Construir y levantar todos los contenedores de producción
echo "[5/5] Construyendo y levantando contenedores (Zero Delivery + Vocero CRM)..."
docker compose -f docker-compose.prod.yml up -d --build

echo ""
echo "=================================================================="
echo "  ¡DESPLIEGUE COMPLETADO CON ÉXITO!"
echo "=================================================================="
echo "  Zero Delivery Web : http://$(hostname -I | awk '{print $1}'):3001"
echo "  Vocero CRM        : http://$(hostname -I | awk '{print $1}'):3000"
echo "  Estado de contenedores:"
docker compose -f docker-compose.prod.yml ps

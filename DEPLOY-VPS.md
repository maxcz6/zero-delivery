# Guía de Despliegue en VPS (Producción) — Zero Delivery + Vocero CRM

Este repositorio ya incluye la pila unificada de producción ([`docker-compose.prod.yml`](file:///c:/Users/Zero/Documents/max/zero-delivery/docker-compose.prod.yml)), el proxy inverso HTTPS con Caddy ([`Caddyfile.prod`](file:///c:/Users/Zero/Documents/max/zero-delivery/Caddyfile.prod)), la plantilla de variables ([`.env.production.example`](file:///c:/Users/Zero/Documents/max/zero-delivery/.env.production.example)) y el instalador automático ([`deploy-vps.sh`](file:///c:/Users/Zero/Documents/max/zero-delivery/deploy-vps.sh)).

---

## 1. Requisitos del VPS
- **Sistema Operativo**: Ubuntu 22.04 LTS / 24.04 LTS o Debian 12.
- **Recursos recomendados**: 2 vCPU, 4 GB RAM (el script `deploy-vps.sh` configura automáticamente 4 GB de Swap si el VPS tiene poca RAM), 40 GB SSD.
- **Puertos abiertos en el Firewall del VPS**:
  - `80` y `443` (Tráfico web HTTP/HTTPS con Caddy)
  - `3001` (Acceso directo opcional a Zero Delivery por IP)
  - `3000` (Acceso directo opcional a Vocero CRM por IP)
  - *(Nota: PostgreSQL, Redis, MongoDB y RabbitMQ quedan blindados en `127.0.0.1` y red interna Docker).*

---

## 2. Despliegue Rápido en el VPS (3 comandos)

Conéctate por SSH a tu VPS y ejecuta:

```bash
git clone --recurse-submodules https://github.com/maxcz6/zero-delivery.git
cd zero-delivery
bash deploy-vps.sh
```

¿Qué hace `bash deploy-vps.sh` automáticamente?
1. Instala Docker y Docker Compose si no están instalados.
2. Verifica la memoria Swap y crea un archivo Swap de 4 GB si el VPS tiene menos de 2 GB de Swap.
3. Genera el archivo `.env` a partir de `.env.production.example` con contraseñas aleatorias seguras (`openssl rand -hex`) para PostgreSQL, MongoDB, RabbitMQ, Vocero DB y la clave compartida `VOCERO_BOT_API_KEY`.
4. Compila y levanta todos los contenedores (`zero-postgres`, `zero-redis`, `zero-mongodb`, `zero-rabbitmq`, `zero-api`, `zero-web`, `vocero-db`, `vocero-app` y `zero-caddy`).
5. Inicializa automáticamente el esquema SQL (`0001_esquema_zero_delivery_es.sql`) y los usuarios/sucursales base (`0002_seed_inicial.sql` y `0003_seed_recomendaciones.sql`).

---

## 3. Configurar Dominios con HTTPS Automático (Opcional pero Recomendado)

Si tienes un dominio (por ejemplo `tudominio.com`), crea dos registros DNS tipo **A** apuntando a la IP pública de tu VPS:
- `delivery.tudominio.com` ➔ `IP_DE_TU_VPS`
- `crm.tudominio.com` ➔ `IP_DE_TU_VPS`

Luego edita el archivo `.env` en el VPS:

```env
DELIVERY_DOMAIN=delivery.tudominio.com
VOCERO_DOMAIN=crm.tudominio.com
APP_PUBLIC_URL=https://delivery.tudominio.com
VOCERO_PUBLIC_URL=https://crm.tudominio.com
COOKIE_SECURE=true
```

Y aplica los cambios:

```bash
docker compose -f docker-compose.prod.yml up -d
```

Caddy descargará y renovará automáticamente los certificados SSL (Let's Encrypt) para ambos subdominios.

---

## 4. Comandos Útiles en el VPS

- **Ver estado de los servicios**:
  ```bash
  docker compose -f docker-compose.prod.yml ps
  ```
- **Ver logs en vivo de la API y del Bot**:
  ```bash
  docker compose -f docker-compose.prod.yml logs -f api vocero-app
  ```
- **Actualizar el VPS cuando subas nuevos cambios a GitHub**:
  ```bash
  git pull origin main
  docker compose -f docker-compose.prod.yml up -d --build
  ```

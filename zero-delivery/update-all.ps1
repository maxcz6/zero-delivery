# Actualizar todo: reconstruir sin caché y levantar
Write-Host "=== PARANDO CONTENEDORES ===" -ForegroundColor Cyan
docker compose down

Write-Host "`n=== RECONSTRUYENDO SIN CACHÉ (API + WEB) ===" -ForegroundColor Cyan
docker compose build --no-cache api web

Write-Host "`n=== LEVANTANDO TODO ===" -ForegroundColor Cyan
docker compose up -d

Write-Host "`n=== ESPERANDO 30 SEGUNDOS ===" -ForegroundColor Cyan
Start-Sleep -Seconds 30

Write-Host "`n=== ESTADO ===" -ForegroundColor Cyan
docker compose ps

Write-Host "`n=== HEALTHCHECK API ===" -ForegroundColor Cyan
try { curl.exe -s http://localhost:4000/api/v1/health | Write-Host } catch { Write-Host "API no responde" }

Write-Host "`n=== HEALTHCHECK WEB ===" -ForegroundColor Cyan
try { $r = curl.exe -s -o $null -w "%{http_code}" http://localhost:3001; Write-Host "HTTP:$r" } catch { Write-Host "WEB no responde" }

Write-Host "`n=== LOGS RECIENTES API ===" -ForegroundColor Cyan
docker compose logs --tail 20 api

Write-Host "`n=== LOGS RECIENTES WEB ===" -ForegroundColor Cyan
docker compose logs --tail 15 web

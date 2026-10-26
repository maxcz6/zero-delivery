#Requires -Version 5.1
<#
.SYNOPSIS
  Inicializa y valida el esquema canónico de Zero Delivery.

.DESCRIPTION
  Carga `0001_esquema_zero_delivery_es.sql` en PostgreSQL (contenedor `postgres` de
  docker-compose por defecto, o `psql` local como respaldo) y verifica que el
  resultado coincida con el DDL: 45 tablas, triggers, vista y función de sembrado.

.PARAMETER Force
  Recrea el esquema `public` antes de cargar. DESTRUCTIVO: borra todos los datos.

.PARAMETER ValidateOnly
  No carga nada; solo valida el estado actual.

.EXAMPLE
  pwsh ./scripts/init-db.ps1
  pwsh ./scripts/init-db.ps1 -ValidateOnly
#>
param(
  [switch]$Force,
  [switch]$ValidateOnly
)

$ErrorActionPreference = "Stop"

$repoRoot    = Split-Path -Parent $PSScriptRoot
$sqlFile     = Join-Path $repoRoot "0001_esquema_zero_delivery_es.sql"
$composeFile = Join-Path $repoRoot "docker-compose.yml"

$dbUser = if ($env:POSTGRES_USER) { $env:POSTGRES_USER } else { "postgres" }
$dbName = if ($env:POSTGRES_DB)   { $env:POSTGRES_DB }   else { "zero_delivery" }

if (-not (Test-Path $sqlFile)) { throw "No se encontro el DDL canonico en $sqlFile" }

function Test-DockerAvailable {
  try {
    & docker compose --project-directory $repoRoot -f $composeFile ps postgres 2>$null | Out-Null
    return ($LASTEXITCODE -eq 0)
  } catch { return $false }
}

$useDocker = Test-DockerAvailable

function Invoke-Psql {
  param(
    [Parameter(Mandatory = $true)][string[]]$PsqlArgs,
    [string]$InputText
  )
  if ($useDocker) {
    if ($PSBoundParameters.ContainsKey("InputText")) {
      $InputText | & docker compose --project-directory $repoRoot -f $composeFile exec -T postgres psql -U $dbUser -d $dbName @PsqlArgs
    } else {
      & docker compose --project-directory $repoRoot -f $composeFile exec -T postgres psql -U $dbUser -d $dbName @PsqlArgs
    }
  } else {
    $env:PGPASSWORD = if ($env:POSTGRES_PASSWORD) { $env:POSTGRES_PASSWORD } else { "postgres" }
    $port = if ($env:POSTGRES_PORT) { $env:POSTGRES_PORT } else { "5434" }
    $base = @("-h", "127.0.0.1", "-p", $port, "-U", $dbUser, "-d", $dbName)
    if ($PSBoundParameters.ContainsKey("InputText")) {
      $InputText | & psql @base @PsqlArgs
    } else {
      & psql @base @PsqlArgs
    }
  }
  if ($LASTEXITCODE -ne 0) { throw "psql fallo con codigo de salida $LASTEXITCODE" }
}

function Get-Scalar {
  param([string]$Sql)
  $out = Invoke-Psql -PsqlArgs @("-tAc", $Sql)
  return ($out | Where-Object { $_ -ne $null -and "$_".Trim() -ne "" } | Select-Object -First 1).ToString().Trim()
}

Write-Host "Zero Delivery - init-db" -ForegroundColor Cyan
Write-Host ("  motor      : " + $(if ($useDocker) { "docker compose (servicio postgres)" } else { "psql local 127.0.0.1:$($env:POSTGRES_PORT)" }))
Write-Host "  base datos : $dbName"
Write-Host "  DDL        : $sqlFile"

$schemaExists = (Get-Scalar "SELECT to_regclass('public.pedidos') IS NOT NULL;") -eq "t"

if ($Force) {
  if ($ValidateOnly) { throw "-Force y -ValidateOnly son incompatibles." }
  Write-Host "  accion     : DROP SCHEMA public CASCADE + recarga (DESTRUCTIVO)" -ForegroundColor Yellow
  Invoke-Psql -PsqlArgs @("-v", "ON_ERROR_STOP=1", "-c", "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;") | Out-Null
  $schemaExists = $false
}

if (-not $schemaExists -and -not $ValidateOnly) {
  Write-Host "  accion     : cargando DDL canonico..." -ForegroundColor Yellow
  $sql = [System.IO.File]::ReadAllText($sqlFile)
  $sql = $sql.TrimStart([char]0xFEFF)
  Invoke-Psql -PsqlArgs @("-v", "ON_ERROR_STOP=1", "-f", "-") -InputText $sql | Out-Null
  Write-Host "  carga      : OK" -ForegroundColor Green
} elseif (-not $ValidateOnly) {
  Write-Host "  accion     : el esquema ya existe; no se recarga (use -Force para recrear)" -ForegroundColor DarkYellow
}

# ---------------------------- Validacion ----------------------------
$checks = @(
  @{ Nombre = "tablas (esperado 45)";      Sql = "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';"; Esperado = 45 },
  @{ Nombre = "triggers (minimo 10)";      Sql = "SELECT count(DISTINCT trigger_name) FROM information_schema.triggers WHERE trigger_schema='public';"; Esperado = 10 },
  @{ Nombre = "vistas (minimo 1)";         Sql = "SELECT count(*) FROM information_schema.views WHERE table_schema='public';"; Esperado = 1 },
  @{ Nombre = "fn sembrar_configuracion";  Sql = "SELECT count(*) FROM pg_proc WHERE proname='sembrar_configuracion_predeterminada';"; Esperado = 1 },
  @{ Nombre = "extension pg_trgm";         Sql = "SELECT count(*) FROM pg_extension WHERE extname='pg_trgm';"; Esperado = 1 },
  @{ Nombre = "tablas solo-insercion";     Sql = "SELECT count(DISTINCT event_object_table) FROM information_schema.triggers WHERE trigger_schema='public' AND event_object_table IN ('registro_auditoria','historial_estados_pedido','eventos_pago','movimientos_billetera');"; Esperado = 4 }
)

$fail = 0
Write-Host ""
Write-Host "Validacion del esquema:" -ForegroundColor Cyan
foreach ($c in $checks) {
  $valor = [int](Get-Scalar $c.Sql)
  $ok = if ($c.Nombre -like "*minimo*") { $valor -ge $c.Esperado } else { $valor -eq $c.Esperado }
  if ($ok) {
    Write-Host ("  [OK]   {0,-30} {1}" -f $c.Nombre, $valor) -ForegroundColor Green
  } else {
    Write-Host ("  [FAIL] {0,-30} {1} (esperado {2})" -f $c.Nombre, $valor, $c.Esperado) -ForegroundColor Red
    $fail++
  }
}

Write-Host ""
if ($fail -eq 0) {
  Write-Host "Esquema canonico VALIDADO." -ForegroundColor Green
  exit 0
} else {
  Write-Host "$fail verificacion(es) fallaron." -ForegroundColor Red
  exit 1
}

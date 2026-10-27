# Ejecuta la prueba realista de k6 contra la API local.
# Uso:
#   .\run.ps1
#   .\run.ps1 -Duration 30s -Scale 0.5
#   .\run.ps1 -BaseUrl http://localhost:4000 -Duration 5m -Scale 2
param(
  [string]$Duration = "2m",
  [double]$Scale = 1,
  [string]$BaseUrl = "http://localhost:4000"
)

$k6 = "C:\Program Files\k6\k6.exe"
if (-not (Test-Path $k6)) {
  $cmd = Get-Command k6 -ErrorAction SilentlyContinue
  if (-not $cmd) {
    throw "k6 no está instalado. Instálalo con: winget install GrafanaLabs.k6"
  }
  $k6 = $cmd.Source
}

& $k6 run -e "BASE_URL=$BaseUrl" -e "DURATION=$Duration" -e "SCALE=$Scale" (Join-Path $PSScriptRoot "realistic-flows.js")
exit $LASTEXITCODE

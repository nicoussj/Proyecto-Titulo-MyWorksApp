# Genera DBML desde la base Supabase (PostgreSQL), no MySQL.
# El ejemplo de dbdiagram.io usa mysql://... MyWorksApp es Postgres.
#
# 1) Instalar (ya hecho si corriste npm install -g @dbml/cli):
#      npm install -g @dbml/cli
#
# 2) En Supabase: Connect → URI → Session pooler o Direct.
#    Pega la URI aquí o en la variable de entorno DATABASE_URL.
#
# 3) Ejecutar:
#      powershell -ExecutionPolicy Bypass -File .\scripts\generar-dbml.ps1
#      # o:
#      .\scripts\generar-dbml.ps1 -ConnectionString "postgresql://postgres.REF:CLAVE@aws-0-REGION.pooler.supabase.com:5432/postgres?schemas=public"

param(
  [string]$ConnectionString = $env:DATABASE_URL,
  [string]$OutFile = ""
)

$ErrorActionPreference = "Stop"

if (-not $OutFile) {
  $root = Join-Path $PSScriptRoot "..\..\Fase 2" | Resolve-Path
  $OutFile = Join-Path $root "modelo_entidad_relacion.live.dbml"
}

if (-not (Get-Command db2dbml -ErrorAction SilentlyContinue)) {
  Write-Host "Instalando @dbml/cli..."
  npm install -g @dbml/cli
}

if (-not $ConnectionString) {
  Write-Host ""
  Write-Host "Falta la cadena de conexion." -ForegroundColor Yellow
  Write-Host "MyWorksApp no es MySQL. El comando correcto es:"
  Write-Host ""
  Write-Host "  db2dbml postgres `"postgresql://postgres.wxqrfcqifkfgawrnqmnj:TU_CLAVE@aws-0-sa-east-1.pooler.supabase.com:5432/postgres?schemas=public`" -o `"$OutFile`""
  Write-Host ""
  Write-Host "Obten la URI en: https://supabase.com/dashboard/project/wxqrfcqifkfgawrnqmnj (boton Connect)."
  Write-Host "Luego:"
  Write-Host "  `$env:DATABASE_URL = 'postgresql://...'"
  Write-Host "  powershell -ExecutionPolicy Bypass -File .\scripts\generar-dbml.ps1"
  exit 1
}

# Forzar esquema public (db2dbml lo lee del query string)
if ($ConnectionString -notmatch 'schemas=') {
  $sep = if ($ConnectionString -match '\?') { '&' } else { '?' }
  $ConnectionString = "$ConnectionString${sep}schemas=public"
}

Write-Host "Generando DBML en $OutFile"
db2dbml postgres $ConnectionString -o $OutFile
Write-Host "Listo: $OutFile"

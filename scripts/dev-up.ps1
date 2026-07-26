# Start local Postgres via Docker and (optionally) the API on the host.
# Usage:
#   .\scripts\dev-up.ps1           # db only
#   .\scripts\dev-up.ps1 -Api      # db + cargo run API
#   .\scripts\dev-up.ps1 -Full     # docker compose --profile full (db + api container)

param(
  [switch]$Api,
  [switch]$Full
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

function Ensure-Docker {
  $docker = Get-Command docker -ErrorAction SilentlyContinue
  if (-not $docker) {
    $candidates = @(
      "$env:ProgramFiles\Docker\Docker\resources\bin\docker.exe",
      "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe"
    )
    foreach ($c in $candidates) {
      if (Test-Path $c) {
        $env:Path = "$(Split-Path $c);$env:Path"
        break
      }
    }
  }
  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host @"

Docker is not available in PATH.

1) Install Docker Desktop: https://www.docker.com/products/docker-desktop/
   or: winget install Docker.DockerDesktop
2) Start Docker Desktop and wait until it says "Running"
3) Re-run this script

"@ -ForegroundColor Yellow
    exit 1
  }

  docker info 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Docker is installed but the engine is not running." -ForegroundColor Yellow
    Write-Host "Start Docker Desktop, wait ~30s, then re-run." -ForegroundColor Yellow
    if (Test-Path "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe") {
      Start-Process "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe"
      Write-Host "Launched Docker Desktop..."
    }
    exit 1
  }
}

Ensure-Docker

if ($Full) {
  Write-Host "Starting Postgres + API containers (build may take several minutes)..."
  docker compose --profile full up -d --build
  Write-Host ""
  Write-Host "API:  http://127.0.0.1:8080/healthz"
  Write-Host "App:  http://127.0.0.1:8080/  (SPA served by API)"
  Write-Host "Or run Vite: cd apps\web; npm run dev"
  exit 0
}

Write-Host "Starting Postgres..."
docker compose up -d db

Write-Host "Waiting for Postgres healthy..."
$ok = $false
for ($i = 0; $i -lt 30; $i++) {
  $status = docker inspect --format='{{.State.Health.Status}}' cookbook-db 2>$null
  if ($status -eq "healthy") { $ok = $true; break }
  Start-Sleep -Seconds 2
}
if (-not $ok) {
  Write-Host "Postgres did not become healthy in time. Check: docker logs cookbook-db" -ForegroundColor Red
  exit 1
}

Write-Host "Postgres is up on localhost:5432 (user/pass/db: cookbook)" -ForegroundColor Green

if (-not (Test-Path "$Root\.env")) {
  Copy-Item "$Root\.env.example" "$Root\.env"
  Write-Host "Created .env from .env.example"
}

if ($Api) {
  Write-Host "Starting API with cargo (MSVC env if available)..."
  $env:DATABASE_URL = "postgres://cookbook:cookbook@127.0.0.1:5432/cookbook"
  $env:CATALOG_PATH = "$Root\apps\web\public\data\catalog.json"
  $env:JWT_SECRET = "local-dev-jwt-secret-change-in-production-32"
  $env:PORT = "8080"
  $env:HOST = "127.0.0.1"
  $vcvars = "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
  if (Test-Path $vcvars) {
    cmd /c "`"$vcvars`" >nul 2>&1 && set PATH=$env:USERPROFILE\.cargo\bin;%PATH% && set RUSTUP_HOME=$env:USERPROFILE\.rustup && set CARGO_HOME=$env:USERPROFILE\.cargo && set DATABASE_URL=$env:DATABASE_URL && set CATALOG_PATH=$env:CATALOG_PATH && set JWT_SECRET=$env:JWT_SECRET && set PORT=8080 && set HOST=127.0.0.1 && cd /d $Root && cargo run -p cookbook-api --target x86_64-pc-windows-msvc"
  } else {
    $env:Path = "$env:USERPROFILE\.cargo\bin;$env:Path"
    cargo run -p cookbook-api --target x86_64-pc-windows-msvc
  }
} else {
  Write-Host ""
  Write-Host "Next: run the API in another terminal:"
  Write-Host "  cargo run -p cookbook-api --target x86_64-pc-windows-msvc"
  Write-Host "Then web:"
  Write-Host "  cd apps\web; npm run dev"
  Write-Host ""
  Write-Host "Or: .\scripts\dev-up.ps1 -Api"
}

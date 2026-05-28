# ListTodo Build Script (Windows)
$ErrorActionPreference = "Stop"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  ListTodo Build" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "[1/5] Installing Tauri CLI..." -ForegroundColor Yellow
$tauri = Get-Command cargo-tauri -ErrorAction SilentlyContinue
if (-not $tauri) {
    cargo install tauri-cli --version "^2"
}

Write-Host ""
Write-Host "[2/5] Installing frontend deps..." -ForegroundColor Yellow
Push-Location frontend
npm install
Pop-Location

Write-Host ""
Write-Host "[3/5] Building frontend..." -ForegroundColor Yellow
Push-Location frontend
npm run build
Pop-Location

Write-Host ""
Write-Host "[4/5] Building backend..." -ForegroundColor Yellow
cargo build -p backend --release

Write-Host ""
Write-Host "[5/5] Building Tauri desktop..." -ForegroundColor Yellow
cargo tauri build

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Build complete!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Backend: target/release/backend.exe"
Write-Host "  Frontend: frontend/dist/"
Write-Host "  Tauri: src-tauri/target/release/bundle/"

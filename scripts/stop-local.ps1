# ============================================
# CLİXER LOKAL DURDURMA SCRİPTİ (Windows)
# ============================================
# Kullanım: PowerShell'de çalıştırın
#   .\scripts\stop-local.ps1
# ============================================

$ErrorActionPreference = "Continue"
$ProjectRoot = "C:\projeler\clixer_windows-main"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   CLİXER - Durdurma Scripti" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Node.js Servislerini Durdur
Write-Host "[1/2] Node.js servisleri durduruluyor..." -ForegroundColor Yellow

# npm run dev ile başlatılan tüm node process'lerini bul ve durdur
$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    $nodeProcesses | ForEach-Object {
        Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
    }
    Write-Host "  [OK] $($nodeProcesses.Count) Node.js process'i durduruldu" -ForegroundColor Green
} else {
    Write-Host "  [OK] Calisan Node.js process'i bulunamadi" -ForegroundColor Gray
}

# 2. Docker Container'larını Durdur
Write-Host ""
Write-Host "[2/2] Docker container'lari durduruluyor..." -ForegroundColor Yellow
Set-Location "$ProjectRoot\docker"

$stopContainers = Read-Host "Docker container'larini da durdurmak istiyor musunuz? (E/H)"
if ($stopContainers -eq "E" -or $stopContainers -eq "e") {
    docker-compose stop 2>$null
    Write-Host "  [OK] PostgreSQL, Redis, ClickHouse durduruldu" -ForegroundColor Green
} else {
    Write-Host "  [OK] Docker container'lari calismaya devam ediyor" -ForegroundColor Gray
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "   CLİXER DURDURULDU" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

Set-Location $ProjectRoot

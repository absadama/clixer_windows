# ============================================
# CLiXER LOKAL DURDURMA SCRiPTi (Windows)
# ============================================
# Versiyon: 2.0 - Akilli Durdur
# - Tum port'lari temizle
# - Docker container'lari (opsiyonel)
# ============================================

param (
    [switch]$IncludeDocker = $false  # -IncludeDocker ile Docker'i da durdur
)

$ErrorActionPreference = "Continue"
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

# Renkli cikti fonksiyonlari
function Write-Success($message) {
    Write-Host "  [OK] $message" -ForegroundColor Green
}

function Write-Info($message) {
    Write-Host "  -> $message" -ForegroundColor Gray
}

# Header
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   CLiXER - Durdurma Scripti" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ============================================
# ADIM 1: Node.js Process'lerini Durdur
# ============================================
Write-Host "[1/3] Node.js servisleri durduruluyor..." -ForegroundColor Yellow

$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    $nodeProcesses | ForEach-Object {
        Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
    }
    Write-Success "$($nodeProcesses.Count) Node.js process'i durduruldu"
} else {
    Write-Info "Calisan Node.js process'i bulunamadi"
}

# ============================================
# ADIM 2: Port'lari Temizle (Kalan process varsa)
# ============================================
Write-Host ""
Write-Host "[2/3] Port'lar temizleniyor..." -ForegroundColor Yellow

$ports = @(3000, 4000, 4001, 4002, 4003, 4004, 4005)
$killedCount = 0

foreach ($port in $ports) {
    try {
        $connections = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
        foreach ($conn in $connections) {
            $processId = $conn.OwningProcess
            $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
            if ($process -and $process.Name -ne "System") {
                Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
                Write-Info "Port $port temizlendi (PID: $processId)"
                $killedCount++
            }
        }
    } catch {
        # Port zaten bos
    }
}

if ($killedCount -eq 0) {
    Write-Info "Tum portlar zaten bos"
} else {
    Write-Success "$killedCount port temizlendi"
}

# ============================================
# ADIM 3: Docker Container'larini Durdur (Opsiyonel)
# ============================================
Write-Host ""
Write-Host "[3/3] Docker durumu..." -ForegroundColor Yellow

if ($IncludeDocker) {
    Write-Info "Docker container'lari durduruluyor..."
    Set-Location "$ProjectRoot\docker"
    docker-compose stop 2>$null
    Write-Success "PostgreSQL, Redis, ClickHouse durduruldu"
    Set-Location $ProjectRoot
} else {
    Write-Info "Docker container'lari calismayi surduruyor"
    Write-Info "(Durdurmak icin: .\scripts\stop-local.ps1 -IncludeDocker)"
}

# ============================================
# SONUC
# ============================================
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "   CLiXER DURDURULDU" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Tekrar baslatmak icin: CLIXER-BASLAT.bat" -ForegroundColor Cyan
Write-Host ""

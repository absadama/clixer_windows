# ============================================
# CLİXER LOKAL BAŞLATMA SCRİPTİ (Windows)
# ============================================
# Kullanım: PowerShell'de çalıştırın
#   .\scripts\start-local.ps1
# ============================================

$ErrorActionPreference = "Continue"
$ProjectRoot = "C:\projeler\clixer_windows-main"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   CLİXER - Lokal Başlatma Scripti" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Docker Desktop Kontrolü
Write-Host "[1/5] Docker Desktop kontrol ediliyor..." -ForegroundColor Yellow
$dockerRunning = docker info 2>$null
if (-not $dockerRunning) {
    Write-Host "  -> Docker Desktop baslatiliyor..." -ForegroundColor Gray
    Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    Write-Host "  -> Docker'in hazir olmasi bekleniyor (60 saniye)..." -ForegroundColor Gray
    Start-Sleep -Seconds 60
}
Write-Host "  [OK] Docker Desktop calisiyor" -ForegroundColor Green

# 2. Veritabanı Container'larını Başlat
Write-Host ""
Write-Host "[2/5] Veritabani container'lari baslatiliyor..." -ForegroundColor Yellow
Set-Location "$ProjectRoot\docker"
docker-compose up -d postgres redis clickhouse 2>$null
Start-Sleep -Seconds 5
Write-Host "  [OK] PostgreSQL, Redis, ClickHouse baslatildi" -ForegroundColor Green

# 3. Shared Modülü Build Et
Write-Host ""
Write-Host "[3/5] Shared modulu build ediliyor..." -ForegroundColor Yellow
Set-Location "$ProjectRoot\shared"
npm run build 2>$null | Out-Null
Write-Host "  [OK] Shared modul hazir" -ForegroundColor Green

# 4. Backend Servislerini Başlat
Write-Host ""
Write-Host "[4/5] Backend servisleri baslatiliyor..." -ForegroundColor Yellow

$services = @(
    @{ Name = "Gateway"; Path = "gateway"; Port = 4000 },
    @{ Name = "Auth"; Path = "services\auth-service"; Port = 4001 },
    @{ Name = "Core"; Path = "services\core-service"; Port = 4002 },
    @{ Name = "Data"; Path = "services\data-service"; Port = 4003 },
    @{ Name = "Notification"; Path = "services\notification-service"; Port = 4004 },
    @{ Name = "Analytics"; Path = "services\analytics-service"; Port = 4005 }
)

foreach ($service in $services) {
    $servicePath = Join-Path $ProjectRoot $service.Path
    Start-Process -WindowStyle Hidden powershell -ArgumentList "-NoExit", "-Command", "cd '$servicePath'; npm run dev"
    Write-Host "  -> $($service.Name) (port $($service.Port)) baslatildi" -ForegroundColor Gray
}

# 5. Frontend'i Başlat
Write-Host ""
Write-Host "[5/5] Frontend baslatiliyor..." -ForegroundColor Yellow
$frontendPath = Join-Path $ProjectRoot "frontend"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$frontendPath'; npm run dev"
Write-Host "  [OK] Frontend (port 3000) baslatildi" -ForegroundColor Green

# Servislerin hazır olmasını bekle
Write-Host ""
Write-Host "Servisler baslatiliyor, lutfen bekleyin..." -ForegroundColor Yellow
Start-Sleep -Seconds 15

# Durum Kontrolü
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   DURUM KONTROLU" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$ports = @(3000, 4000, 4001, 4002, 4003, 4004, 4005)
$portNames = @{
    3000 = "Frontend"
    4000 = "Gateway"
    4001 = "Auth"
    4002 = "Core"
    4003 = "Data"
    4004 = "Notification"
    4005 = "Analytics"
}

$allOk = $true
foreach ($port in $ports) {
    $listening = netstat -ano | Select-String ":$port " | Select-String "LISTENING"
    if ($listening) {
        Write-Host "  [OK] $($portNames[$port]) (port $port)" -ForegroundColor Green
    } else {
        Write-Host "  [X] $($portNames[$port]) (port $port) - BASLATILMADI!" -ForegroundColor Red
        $allOk = $false
    }
}

Write-Host ""
if ($allOk) {
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "   CLIXER BASARIYLA AYAGA KALKTI!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "  URL: http://localhost:3000" -ForegroundColor White
    Write-Host "  Email: admin@clixer" -ForegroundColor White
    Write-Host "  Sifre: Admin1234!" -ForegroundColor White
    Write-Host ""
    
    # Tarayıcıyı aç
    $openBrowser = Read-Host "Tarayicida acilsin mi? (E/H)"
    if ($openBrowser -eq "E" -or $openBrowser -eq "e") {
        Start-Process "http://localhost:3000"
    }
} else {
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "   BAZI SERVISLER BASLATILMADI!" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "  Loglar icin terminal pencerelerini kontrol edin." -ForegroundColor Yellow
}

Set-Location $ProjectRoot

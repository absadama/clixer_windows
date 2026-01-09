# ============================================
# CLiXER LOKAL BASLATMA SCRiPTi (Windows)
# ============================================
# Versiyon: 2.0 - Akilli Baslat
# - Port temizligi
# - Docker bekleme
# - Sirayla baslat
# ============================================

$ErrorActionPreference = "Continue"
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

# Renkli cikti fonksiyonlari
function Write-Step($step, $total, $message) {
    Write-Host ""
    Write-Host "[$step/$total] $message" -ForegroundColor Yellow
}

function Write-Success($message) {
    Write-Host "  [OK] $message" -ForegroundColor Green
}

function Write-Error($message) {
    Write-Host "  [HATA] $message" -ForegroundColor Red
}

function Write-Info($message) {
    Write-Host "  -> $message" -ForegroundColor Gray
}

function Write-Wait($message) {
    Write-Host "  ... $message" -ForegroundColor DarkGray
}

# ============================================
# ADIM 1: Eski Process'leri Temizle
# ============================================
function Stop-ClixerProcesses {
    Write-Step 1 7 "Eski Clixer process'leri temizleniyor..."
    
    # Clixer ile ilgili Node.js process'lerini bul ve oldur
    $clixerProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object {
        $_.MainWindowTitle -like "*clixer*" -or 
        $_.CommandLine -like "*clixer*" -or
        $_.Path -like "*clixer*"
    }
    
    # Port kullanan process'leri bul ve oldur
    $ports = @(3000, 4000, 4001, 4002, 4003, 4004, 4005)
    $killedCount = 0
    
    foreach ($port in $ports) {
        $netstatOutput = netstat -ano | Select-String ":$port " | Select-String "LISTENING"
        if ($netstatOutput) {
            $line = $netstatOutput -split '\s+' | Where-Object { $_ -ne '' }
            $pid = $line[-1]
            if ($pid -and $pid -match '^\d+$') {
                try {
                    Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
                    $killedCount++
                    Write-Info "Port $port serbest birakildi (PID: $pid)"
                } catch {
                    # Ignore
                }
            }
        }
    }
    
    if ($killedCount -gt 0) {
        Write-Success "$killedCount process sonlandirildi, portlar serbest"
    } else {
        Write-Success "Temizlenecek process bulunamadi"
    }
    
    Start-Sleep -Seconds 2
}

# ============================================
# ADIM 2: Docker Desktop Kontrol ve Baslat
# ============================================
function Start-DockerDesktop {
    Write-Step 2 7 "Docker Desktop kontrol ediliyor..."
    
    # Docker Desktop process'i calisyor mu?
    $dockerProcess = Get-Process -Name "Docker Desktop" -ErrorAction SilentlyContinue
    
    # Docker daemon calisyor mu kontrol et
    $dockerInfo = docker info 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Docker Desktop zaten calisiyor"
        return $true
    }
    
    # Docker Desktop process var mi ama daemon hazir degil mi?
    if ($dockerProcess) {
        Write-Info "Docker Desktop baslatilmis, daemon hazir olmasi bekleniyor..."
    } else {
        Write-Info "Docker Desktop baslatiliyor..."
        
        # Docker Desktop'i bul ve baslat
        $dockerPath = "C:\Program Files\Docker\Docker\Docker Desktop.exe"
        if (-not (Test-Path $dockerPath)) {
            Write-Error "Docker Desktop bulunamadi: $dockerPath"
            Write-Error "Lutfen Docker Desktop'i manuel olarak baslatin"
            return $false
        }
        
        Start-Process $dockerPath
    }
    
    # Docker daemon hazir olana kadar bekle (max 120 saniye)
    $maxWait = 120
    $waited = 0
    
    while ($waited -lt $maxWait) {
        Start-Sleep -Seconds 5
        $waited += 5
        
        $dockerInfo = docker info 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Docker Desktop hazir ($waited saniye)"
            return $true
        }
        
        Write-Wait "Docker daemon bekleniyor... ($waited/$maxWait saniye)"
    }
    
    Write-Error "Docker Desktop $maxWait saniyede hazir olmadi!"
    Write-Error "Lutfen Docker Desktop'i manuel olarak acin ve tekrar deneyin."
    return $false
}

# ============================================
# ADIM 3: Docker Container'lari Baslat
# ============================================
function Start-DockerContainers {
    Write-Step 3 7 "Docker container'lari baslatiliyor..."
    
    Set-Location "$ProjectRoot\docker"
    
    # Container'lari baslat
    docker-compose up -d postgres redis clickhouse 2>&1 | Out-Null
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Docker container'lari baslatilamadi!"
        Set-Location $ProjectRoot
        return $false
    }
    
    Write-Info "Container'lar baslatildi, baglanti bekleniyor..."
    
    Set-Location $ProjectRoot
    return $true
}

# ============================================
# ADIM 4: Veritabanlari Hazir mi Bekle
# ============================================
function Wait-ForDatabases {
    Write-Step 4 7 "Veritabanlari hazir olmasi bekleniyor..."
    
    $maxWait = 60
    $waited = 0
    
    # PostgreSQL hazir mi?
    Write-Info "PostgreSQL bekleniyor..."
    while ($waited -lt $maxWait) {
        $pgReady = docker exec clixer_postgres pg_isready -U clixer 2>&1
        if ($pgReady -like "*accepting connections*") {
            Write-Success "PostgreSQL hazir"
            break
        }
        Start-Sleep -Seconds 2
        $waited += 2
        Write-Wait "PostgreSQL bekleniyor... ($waited/$maxWait)"
    }
    
    if ($waited -ge $maxWait) {
        Write-Error "PostgreSQL $maxWait saniyede hazir olmadi!"
        return $false
    }
    
    # ClickHouse hazir mi?
    $waited = 0
    Write-Info "ClickHouse bekleniyor..."
    while ($waited -lt $maxWait) {
        $chReady = docker exec clixer_clickhouse clickhouse-client --user clixer --password clixer_click_2025 --query "SELECT 1" 2>&1
        if ($chReady -eq "1") {
            Write-Success "ClickHouse hazir"
            break
        }
        Start-Sleep -Seconds 2
        $waited += 2
        Write-Wait "ClickHouse bekleniyor... ($waited/$maxWait)"
    }
    
    if ($waited -ge $maxWait) {
        Write-Error "ClickHouse $maxWait saniyede hazir olmadi!"
        return $false
    }
    
    # Redis hazir mi?
    $waited = 0
    Write-Info "Redis bekleniyor..."
    while ($waited -lt $maxWait) {
        $redisReady = docker exec clixer_redis redis-cli ping 2>&1
        if ($redisReady -eq "PONG") {
            Write-Success "Redis hazir"
            break
        }
        Start-Sleep -Seconds 2
        $waited += 2
        Write-Wait "Redis bekleniyor... ($waited/$maxWait)"
    }
    
    if ($waited -ge $maxWait) {
        Write-Error "Redis $maxWait saniyede hazir olmadi!"
        return $false
    }
    
    return $true
}

# ============================================
# ADIM 5: Shared Modulu Build Et
# ============================================
function Build-SharedModule {
    Write-Step 5 7 "Shared modulu build ediliyor..."
    
    Set-Location "$ProjectRoot\shared"
    
    # node_modules yoksa kur
    if (-not (Test-Path "node_modules")) {
        Write-Info "npm install calistiriliyor..."
        npm install 2>&1 | Out-Null
    }
    
    npm run build 2>&1 | Out-Null
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Shared modul build basarisiz!"
        Set-Location $ProjectRoot
        return $false
    }
    
    Write-Success "Shared modul hazir"
    Set-Location $ProjectRoot
    return $true
}

# ============================================
# ADIM 6: Backend Servislerini Baslat
# ============================================
function Start-BackendServices {
    Write-Step 6 7 "Backend servisleri baslatiliyor..."
    
    $services = @(
        @{ Name = "Gateway"; Path = "gateway"; Port = 4000 },
        @{ Name = "Auth"; Path = "services\auth-service"; Port = 4001 },
        @{ Name = "Core"; Path = "services\core-service"; Port = 4002 },
        @{ Name = "Data"; Path = "services\data-service"; Port = 4003 },
        @{ Name = "Notification"; Path = "services\notification-service"; Port = 4004 },
        @{ Name = "Analytics"; Path = "services\analytics-service"; Port = 4005 },
        @{ Name = "ETL Worker"; Path = "services\etl-worker"; Port = 0 }
    )
    
    foreach ($service in $services) {
        $servicePath = Join-Path $ProjectRoot $service.Path
        
        # node_modules yoksa kur
        if (-not (Test-Path "$servicePath\node_modules")) {
            Write-Info "$($service.Name) - npm install calistiriliyor..."
            Set-Location $servicePath
            npm install 2>&1 | Out-Null
            Set-Location $ProjectRoot
        }
        
        # Yeni terminal penceresinde baslat
        $title = "Clixer - $($service.Name)"
        Start-Process cmd -ArgumentList "/k", "title $title && cd /d `"$servicePath`" && npm run dev"
        
        if ($service.Port -gt 0) {
            Write-Info "$($service.Name) baslatildi (port $($service.Port))"
        } else {
            Write-Info "$($service.Name) baslatildi"
        }
        
        # Servisler arasi kisa bekleme
        Start-Sleep -Milliseconds 500
    }
    
    Write-Success "Tum backend servisleri baslatildi"
    return $true
}

# ============================================
# ADIM 7: Frontend Baslat
# ============================================
function Start-Frontend {
    Write-Step 7 7 "Frontend baslatiliyor..."
    
    $frontendPath = "$ProjectRoot\frontend"
    
    # node_modules yoksa kur
    if (-not (Test-Path "$frontendPath\node_modules")) {
        Write-Info "npm install calistiriliyor..."
        Set-Location $frontendPath
        npm install 2>&1 | Out-Null
        Set-Location $ProjectRoot
    }
    
    # Yeni terminal penceresinde baslat
    Start-Process cmd -ArgumentList "/k", "title Clixer - Frontend && cd /d `"$frontendPath`" && npm run dev"
    
    Write-Success "Frontend baslatildi (port 3000)"
    return $true
}

# ============================================
# Servislerin Hazir Olmasini Bekle
# ============================================
function Wait-ForServices {
    Write-Host ""
    Write-Host "Servislerin hazir olmasi bekleniyor (15 saniye)..." -ForegroundColor Yellow
    
    for ($i = 15; $i -gt 0; $i--) {
        Write-Host "`r  Kalan: $i saniye   " -NoNewline -ForegroundColor DarkGray
        Start-Sleep -Seconds 1
    }
    Write-Host ""
}

# ============================================
# Durum Kontrolu
# ============================================
function Test-ServiceStatus {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "   SERVIS DURUM KONTROLU" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    
    $ports = @(
        @{ Port = 3000; Name = "Frontend" },
        @{ Port = 4000; Name = "Gateway" },
        @{ Port = 4001; Name = "Auth" },
        @{ Port = 4002; Name = "Core" },
        @{ Port = 4003; Name = "Data" },
        @{ Port = 4004; Name = "Notification" },
        @{ Port = 4005; Name = "Analytics" }
    )
    
    $allOk = $true
    
    foreach ($p in $ports) {
        $listening = netstat -ano | Select-String ":$($p.Port) " | Select-String "LISTENING"
        if ($listening) {
            Write-Host "  [OK] $($p.Name) (port $($p.Port))" -ForegroundColor Green
        } else {
            Write-Host "  [X] $($p.Name) (port $($p.Port)) - CALISMIYOR!" -ForegroundColor Red
            $allOk = $false
        }
    }
    
    return $allOk
}

# ============================================
# ANA AKIS
# ============================================
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   CLiXER - LOKAL BASLATMA SCRiPTi" -ForegroundColor Cyan
Write-Host "   Versiyon 2.0 - Akilli Baslat" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Proje: $ProjectRoot" -ForegroundColor DarkGray

# Adim 1: Eski process'leri temizle
Stop-ClixerProcesses

# Adim 2: Docker Desktop baslat
$dockerOk = Start-DockerDesktop
if (-not $dockerOk) {
    Write-Host ""
    Write-Error "Docker Desktop baslatilamadi! Script sonlandiriliyor."
    exit 1
}

# Adim 3: Docker container'lari baslat
$containersOk = Start-DockerContainers
if (-not $containersOk) {
    Write-Error "Docker container'lari baslatilamadi! Script sonlandiriliyor."
    exit 1
}

# Adim 4: Veritabanlari hazir mi bekle
$dbOk = Wait-ForDatabases
if (-not $dbOk) {
    Write-Error "Veritabanlari hazir olmadi! Script sonlandiriliyor."
    exit 1
}

# Adim 5: Shared modulu build et
$sharedOk = Build-SharedModule
if (-not $sharedOk) {
    Write-Error "Shared modul build edilemedi! Script sonlandiriliyor."
    exit 1
}

# Adim 6: Backend servislerini baslat
$backendOk = Start-BackendServices
if (-not $backendOk) {
    Write-Error "Backend servisleri baslatilamadi! Script sonlandiriliyor."
    exit 1
}

# Adim 7: Frontend baslat
$frontendOk = Start-Frontend
if (-not $frontendOk) {
    Write-Error "Frontend baslatilamadi! Script sonlandiriliyor."
    exit 1
}

# Servislerin hazir olmasini bekle
Wait-ForServices

# Durum kontrolu
$allServicesOk = Test-ServiceStatus

Write-Host ""
if ($allServicesOk) {
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "   CLiXER BASARIYLA AYAGA KALKTI!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "  URL: http://localhost:3000" -ForegroundColor White
    Write-Host "  Email: admin@clixer" -ForegroundColor White
    Write-Host "  Sifre: Admin1234!" -ForegroundColor White
    Write-Host ""
    
    # Tarayiciyi otomatik ac
    Start-Process "http://localhost:3000"
    Write-Host "  Tarayici acildi!" -ForegroundColor Cyan
} else {
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "   BAZI SERVISLER BASLATILMADI!" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "  Terminal pencerelerini kontrol edin." -ForegroundColor Yellow
    Write-Host "  Hata gormek icin ilgili servisi elle baslatin." -ForegroundColor Yellow
}

Write-Host ""
exit 0

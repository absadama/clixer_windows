# ============================================
# CLIXER - MÜŞTERİ VERİTABANI GERİ YÜKLEME
# ============================================
# Bu script Windows'ta çalıştırılır
# Müşteriden alınan dump'ları lokale yükler
# ============================================

param(
    [string]$DumpDir = "C:\projeler\clixer_windows-main\customer_dump",
    [switch]$SkipDownload,
    [string]$RemoteHost = "",
    [string]$RemotePath = ""
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "============================================" -ForegroundColor Blue
Write-Host "   CLIXER - MÜŞTERİ VERİTABANI GERİ YÜKLEME" -ForegroundColor Blue
Write-Host "============================================" -ForegroundColor Blue
Write-Host ""

# ============================================
# 0. DUMP KLASÖRÜNÜ KONTROL ET / OLUŞTUR
# ============================================
if (-not (Test-Path $DumpDir)) {
    New-Item -ItemType Directory -Path $DumpDir -Force | Out-Null
    Write-Host "[0/5] Dump klasoru olusturuldu: $DumpDir" -ForegroundColor Yellow
}

# ============================================
# 1. SSH İLE İNDİR (opsiyonel)
# ============================================
if (-not $SkipDownload -and $RemoteHost -and $RemotePath) {
    Write-Host "[1/5] Dosyalar indiriliyor..." -ForegroundColor Blue
    
    # Arşiv varsa onu indir
    $remoteArchive = "$RemotePath/customer_dump.tar.gz"
    $localArchive = Join-Path $DumpDir "customer_dump.tar.gz"
    
    try {
        scp "${RemoteHost}:${remoteArchive}" $localArchive
        Write-Host "   Arsiv indirildi: $localArchive" -ForegroundColor Green
        
        # Arşivi aç
        Push-Location $DumpDir
        tar -xzvf customer_dump.tar.gz
        Pop-Location
        Write-Host "   Arsiv acildi" -ForegroundColor Green
    }
    catch {
        Write-Host "   Arsiv indirilemedi, tek tek deneniyor..." -ForegroundColor Yellow
        
        # PostgreSQL
        scp "${RemoteHost}:${RemotePath}/postgresql_full.sql" $DumpDir
        
        # ClickHouse dosyaları
        scp "${RemoteHost}:${RemotePath}/*.csv" $DumpDir
        scp "${RemoteHost}:${RemotePath}/*_schema.sql" $DumpDir
        scp "${RemoteHost}:${RemotePath}/ch_tables.txt" $DumpDir
    }
    Write-Host ""
}
else {
    Write-Host "[1/5] Indirme atlandi. Dosyalar $DumpDir klasorunde olmali." -ForegroundColor Yellow
    Write-Host ""
}

# ============================================
# 2. DOSYALARI KONTROL ET
# ============================================
Write-Host "[2/5] Dosyalar kontrol ediliyor..." -ForegroundColor Blue

$pgDump = Join-Path $DumpDir "postgresql_full.sql"
$chTables = Join-Path $DumpDir "ch_tables.txt"

if (-not (Test-Path $pgDump)) {
    Write-Host "   HATA: postgresql_full.sql bulunamadi!" -ForegroundColor Red
    Write-Host "   Beklenen konum: $pgDump" -ForegroundColor Red
    exit 1
}
Write-Host "   PostgreSQL dump: OK" -ForegroundColor Green

# ClickHouse CSV dosyalarını bul
$csvFiles = Get-ChildItem -Path $DumpDir -Filter "*_data.csv" -ErrorAction SilentlyContinue
$schemaFiles = Get-ChildItem -Path $DumpDir -Filter "*_schema.sql" -ErrorAction SilentlyContinue

Write-Host "   ClickHouse tablolari: $($csvFiles.Count) tablo" -ForegroundColor Green
Write-Host ""

# ============================================
# 3. DOCKER CONTAINER'LARI KONTROL ET
# ============================================
Write-Host "[3/5] Docker container'lari kontrol ediliyor..." -ForegroundColor Blue

$dockerPs = docker ps --format "{{.Names}}"
$postgresRunning = $dockerPs -match "clixer_postgres"
$clickhouseRunning = $dockerPs -match "clixer_clickhouse"

if (-not $postgresRunning) {
    Write-Host "   PostgreSQL calismıyor. Baslatiliyor..." -ForegroundColor Yellow
    Push-Location "C:\projeler\clixer_windows-main\docker"
    docker-compose up -d postgres
    Pop-Location
    Start-Sleep -Seconds 5
}
Write-Host "   PostgreSQL: OK" -ForegroundColor Green

if (-not $clickhouseRunning) {
    Write-Host "   ClickHouse calismıyor. Baslatiliyor..." -ForegroundColor Yellow
    Push-Location "C:\projeler\clixer_windows-main\docker"
    docker-compose up -d clickhouse
    Pop-Location
    Start-Sleep -Seconds 5
}
Write-Host "   ClickHouse: OK" -ForegroundColor Green
Write-Host ""

# ============================================
# 4. POSTGRESQL GERİ YÜKLE
# ============================================
Write-Host "[4/5] PostgreSQL geri yukleniyor..." -ForegroundColor Blue
Write-Host "   Bu islem birkaç dakika surebilir..." -ForegroundColor Yellow

try {
    # Mevcut verileri temizle ve yeniden yükle
    $pgContent = Get-Content $pgDump -Raw -Encoding UTF8
    $pgContent | docker exec -i clixer_postgres psql -U clixer -d clixer
    
    # Satır sayısını kontrol et
    $userCount = docker exec clixer_postgres psql -U clixer -d clixer -t -c "SELECT COUNT(*) FROM users;"
    $storeCount = docker exec clixer_postgres psql -U clixer -d clixer -t -c "SELECT COUNT(*) FROM stores;"
    $datasetCount = docker exec clixer_postgres psql -U clixer -d clixer -t -c "SELECT COUNT(*) FROM datasets;"
    
    Write-Host "   Kullanicilar: $($userCount.Trim())" -ForegroundColor Green
    Write-Host "   Magazalar: $($storeCount.Trim())" -ForegroundColor Green
    Write-Host "   Datasetler: $($datasetCount.Trim())" -ForegroundColor Green
}
catch {
    Write-Host "   HATA: PostgreSQL geri yukleme basarisiz!" -ForegroundColor Red
    Write-Host "   Detay: $_" -ForegroundColor Red
}
Write-Host ""

# ============================================
# 5. CLICKHOUSE GERİ YÜKLE
# ============================================
Write-Host "[5/5] ClickHouse geri yukleniyor..." -ForegroundColor Blue

# Önce clixer_analytics veritabanını oluştur
$createDbQuery = "CREATE DATABASE IF NOT EXISTS clixer_analytics"
try {
    Invoke-WebRequest -Uri "http://localhost:8123/?user=clixer&password=clixer_click_2025" -Method POST -Body $createDbQuery -ErrorAction SilentlyContinue | Out-Null
}
catch {}

foreach ($schemaFile in $schemaFiles) {
    $tableName = $schemaFile.BaseName -replace '_schema', ''
    $csvFile = Join-Path $DumpDir "${tableName}_data.csv"
    
    Write-Host "   $tableName..." -ForegroundColor Cyan
    
    try {
        # Mevcut tabloyu sil
        $dropQuery = "DROP TABLE IF EXISTS clixer_analytics.$tableName"
        Invoke-WebRequest -Uri "http://localhost:8123/?user=clixer&password=clixer_click_2025" -Method POST -Body $dropQuery -ErrorAction SilentlyContinue | Out-Null
        
        # Şemayı oluştur
        $schemaContent = Get-Content $schemaFile.FullName -Raw -Encoding UTF8
        # SHOW CREATE çıktısı "CREATE TABLE clixer_analytics.xxx ..." şeklinde
        # Direkt çalıştırılabilir
        $response = Invoke-WebRequest -Uri "http://localhost:8123/?user=clixer&password=clixer_click_2025" -Method POST -Body $schemaContent -ErrorAction Stop
        Write-Host "      Schema: OK" -ForegroundColor Green
        
        # Veriyi yükle
        if (Test-Path $csvFile) {
            $csvContent = Get-Content $csvFile -Raw -Encoding UTF8
            if ($csvContent.Length -gt 100) {  # Boş CSV değilse
                $insertUri = "http://localhost:8123/?user=clixer&password=clixer_click_2025&query=" + [System.Web.HttpUtility]::UrlEncode("INSERT INTO clixer_analytics.$tableName FORMAT CSVWithNames")
                $response = Invoke-WebRequest -Uri $insertUri -Method POST -Body $csvContent -ContentType "text/csv; charset=utf-8" -ErrorAction Stop
                
                # Satır sayısını kontrol et
                $countQuery = "SELECT count() FROM clixer_analytics.$tableName"
                $countResult = Invoke-WebRequest -Uri "http://localhost:8123/?user=clixer&password=clixer_click_2025" -Method POST -Body $countQuery
                Write-Host "      Data: $($countResult.Content.Trim()) satir" -ForegroundColor Green
            }
            else {
                Write-Host "      Data: Bos tablo" -ForegroundColor Yellow
            }
        }
    }
    catch {
        Write-Host "      HATA: $_" -ForegroundColor Red
    }
}

Write-Host ""

# ============================================
# ÖZET
# ============================================
Write-Host "============================================" -ForegroundColor Blue
Write-Host "   GERI YUKLEME TAMAMLANDI" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Blue
Write-Host ""
Write-Host "Simdi servisleri baslatin:" -ForegroundColor Yellow
Write-Host "   .\CLIXER-BASLAT.bat" -ForegroundColor Cyan
Write-Host ""
Write-Host "Veya PowerShell ile:" -ForegroundColor Yellow
Write-Host "   .\scripts\start-local.ps1" -ForegroundColor Cyan
Write-Host ""
Write-Host "Giris bilgileri:" -ForegroundColor Yellow
Write-Host "   URL: http://localhost:3000" -ForegroundColor Cyan
Write-Host "   (Musteri kullanicilari ile giris yapabilirsiniz)" -ForegroundColor Cyan
Write-Host ""

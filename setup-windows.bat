@echo off
echo ========================================
echo   CLIXER - Windows Kurulum Scripti
echo ========================================
echo.

REM Docker kontrolü
docker --version > nul 2>&1
if errorlevel 1 (
    echo [HATA] Docker bulunamadi!
    echo Docker Desktop'i yukleyin: https://www.docker.com/products/docker-desktop/
    pause
    exit /b 1
)

echo [OK] Docker bulundu

REM Docker Compose kontrolü
docker-compose --version > nul 2>&1
if errorlevel 1 (
    echo [HATA] Docker Compose bulunamadi!
    pause
    exit /b 1
)

echo [OK] Docker Compose bulundu

REM Docker çalışıyor mu?
docker info > nul 2>&1
if errorlevel 1 (
    echo [HATA] Docker Desktop calismiyor!
    echo Lutfen Docker Desktop'i baslatin ve tekrar deneyin.
    pause
    exit /b 1
)

echo [OK] Docker Desktop calisiyor

echo.
echo ========================================
echo   1/3 - Docker Container'lar Baslatiliyor
echo ========================================

cd docker
docker-compose up -d

if errorlevel 1 (
    echo [HATA] Docker Compose hatasi!
    pause
    exit /b 1
)

echo [OK] Container'lar basladi

echo.
echo ========================================
echo   2/3 - Veritabanlari Hazirlaniyor
echo ========================================

echo 30 saniye bekleniyor (veritabanlari baslasin)...
timeout /t 30 /nobreak > nul

REM PostgreSQL check
docker exec clixer_postgres pg_isready -U clixer > nul 2>&1
if errorlevel 1 (
    echo [UYARI] PostgreSQL henuz hazir degil, 30 saniye daha bekleniyor...
    timeout /t 30 /nobreak > nul
)

echo [OK] PostgreSQL hazir

echo.
echo ========================================
echo   3/3 - Kurulum Tamamlandi!
echo ========================================
echo.
echo Servisler:
echo   - PostgreSQL: localhost:5432
echo   - ClickHouse: localhost:8123
echo   - Redis: localhost:6379
echo.
echo Sonraki adim:
echo   1. Yeni terminal ac
echo   2. start-services.bat calistir
echo.
pause


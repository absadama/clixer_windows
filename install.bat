@echo off
chcp 65001 >nul
echo ═══════════════════════════════════════════════════════════════
echo    CLIXER - Enterprise Analytics Platform
echo    Kurulum Scripti (Windows)
echo ═══════════════════════════════════════════════════════════════
echo.

:: Gereksinim kontrolü
echo [1/7] Gereksinimler kontrol ediliyor...
where docker >nul 2>&1
if %errorlevel% neq 0 (
    echo [HATA] Docker bulunamadi! Docker Desktop yukleyin.
    echo https://www.docker.com/products/docker-desktop
    pause
    exit /b 1
)

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [HATA] Node.js bulunamadi! Node.js 18+ yukleyin.
    echo https://nodejs.org/
    pause
    exit /b 1
)

echo [OK] Docker ve Node.js mevcut
echo.

:: Docker servislerini başlat
echo [2/7] Docker servisleri baslatiliyor...
cd docker
docker-compose up -d
if %errorlevel% neq 0 (
    echo [HATA] Docker servisleri baslatilamadi!
    pause
    exit /b 1
)
cd ..
echo [OK] PostgreSQL, ClickHouse, Redis baslatildi
echo.

:: Veritabanı hazır olana kadar bekle
echo [3/7] Veritabani hazir olana kadar bekleniyor...
timeout /t 10 /nobreak >nul
echo [OK] Veritabani hazir
echo.

:: Shared modülü kur ve derle
echo [4/7] Shared modul kuruluyor...
cd shared
call npm install --silent
call npm run build
cd ..
echo [OK] Shared modul derlendi
echo.

:: Gateway kur
echo [5/7] Gateway kuruluyor...
cd gateway
call npm install --silent
cd ..
echo [OK] Gateway kuruldu
echo.

:: Servisleri kur
echo [6/7] Mikroservisler kuruluyor...
for %%s in (auth-service core-service data-service analytics-service notification-service etl-worker) do (
    echo     - %%s
    cd services\%%s
    call npm install --silent
    cd ..\..
)
echo [OK] Tum servisler kuruldu
echo.

:: Frontend kur
echo [7/7] Frontend kuruluyor...
cd frontend
call npm install --silent
cd ..
echo [OK] Frontend kuruldu
echo.

echo ═══════════════════════════════════════════════════════════════
echo    KURULUM TAMAMLANDI!
echo ═══════════════════════════════════════════════════════════════
echo.
echo    Baslatmak icin: start.bat
echo.
echo    Admin Giris:
echo    - URL: http://localhost:3000
echo    - Email: admin@clixer
echo    - Sifre: Admin123!
echo.
pause


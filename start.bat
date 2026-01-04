@echo off
chcp 65001 >nul
echo ═══════════════════════════════════════════════════════════════
echo    CLIXER - Enterprise Analytics Platform
echo    Baslatma Scripti (Windows)
echo ═══════════════════════════════════════════════════════════════
echo.

:: Docker kontrol
echo [1/4] Docker servisleri kontrol ediliyor...
cd docker
docker-compose ps | findstr "Up" >nul 2>&1
if %errorlevel% neq 0 (
    echo Docker servisleri baslatiliyor...
    docker-compose up -d
    timeout /t 10 /nobreak >nul
)
cd ..
echo [OK] Docker servisleri calisiyor
echo.

:: Servisleri arka planda başlat
echo [2/4] Backend servisleri baslatiliyor...

:: Gateway
start "Clixer Gateway" /min cmd /c "cd gateway && npm run dev"

:: Mikroservisler
start "Clixer Auth" /min cmd /c "cd services\auth-service && npm run dev"
start "Clixer Core" /min cmd /c "cd services\core-service && npm run dev"
start "Clixer Data" /min cmd /c "cd services\data-service && npm run dev"
start "Clixer Analytics" /min cmd /c "cd services\analytics-service && npm run dev"
start "Clixer Notification" /min cmd /c "cd services\notification-service && npm run dev"
start "Clixer ETL Worker" /min cmd /c "cd services\etl-worker && npm run dev"

echo [OK] 7 backend servisi baslatildi
echo.

:: Servislerin hazır olmasını bekle
echo [3/4] Servisler hazir olana kadar bekleniyor...
timeout /t 8 /nobreak >nul
echo [OK] Servisler hazir
echo.

:: Frontend başlat
echo [4/4] Frontend baslatiliyor...
start "Clixer Frontend" cmd /c "cd frontend && npm run dev"
echo [OK] Frontend baslatildi
echo.

:: Tarayıcıda aç
timeout /t 5 /nobreak >nul
start http://localhost:3000

echo ═══════════════════════════════════════════════════════════════
echo    CLIXER CALISIYOR!
echo ═══════════════════════════════════════════════════════════════
echo.
echo    URL: http://localhost:3000
echo    Email: admin@clixer
echo    Sifre: Admin123!
echo.
echo    Durdurmak icin: stop.bat
echo.
echo    Acik pencereler:
echo    - Clixer Gateway (4000)
echo    - Clixer Auth (4001)
echo    - Clixer Core (4002)
echo    - Clixer Data (4003)
echo    - Clixer Analytics (4005)
echo    - Clixer Notification (4004)
echo    - Clixer ETL Worker
echo    - Clixer Frontend (3000)
echo.
pause


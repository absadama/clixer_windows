@echo off
chcp 65001 >nul
title Clixer Analytics Platform - Başlatılıyor...
color 0B

echo.
echo ╔═══════════════════════════════════════════════════════════════╗
echo ║         CLIXER ANALYTICS PLATFORM - BAŞLATILIYOR              ║
echo ║                   Olağanüstü Veri Hızı                        ║
echo ╚═══════════════════════════════════════════════════════════════╝
echo.

cd /d %~dp0..

REM Docker kontrol
echo [1/8] Docker container'lar kontrol ediliyor...
docker ps >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker çalışmıyor! Lütfen Docker Desktop'ı başlatın.
    pause
    exit /b 1
)

REM PostgreSQL, ClickHouse, Redis kontrol
docker ps --format "{{.Names}}" | findstr clixer_postgres >nul
if %errorlevel% neq 0 (
    echo [1/8] Veritabanları başlatılıyor...
    cd docker
    docker-compose -f docker-compose.db.yml up -d
    cd ..
    timeout /t 5 /nobreak >nul
) else (
    echo ✓ Veritabanları zaten çalışıyor
)

REM Servisleri arka planda başlat
echo [2/8] Gateway başlatılıyor (Port 4000)...
start /B /MIN cmd /c "cd gateway && npm run dev > nul 2>&1"

echo [3/8] Auth Service başlatılıyor (Port 4001)...
start /B /MIN cmd /c "cd services\auth-service && npm run dev > nul 2>&1"

echo [4/8] Core Service başlatılıyor (Port 4002)...
start /B /MIN cmd /c "cd services\core-service && npm run dev > nul 2>&1"

echo [5/8] Data Service başlatılıyor (Port 4003)...
start /B /MIN cmd /c "cd services\data-service && npm run dev > nul 2>&1"

echo [6/8] Notification Service başlatılıyor (Port 4004)...
start /B /MIN cmd /c "cd services\notification-service && npm run dev > nul 2>&1"

echo [7/8] Analytics Service başlatılıyor (Port 4005)...
start /B /MIN cmd /c "cd services\analytics-service && npm run dev > nul 2>&1"

echo [8/8] Frontend başlatılıyor (Port 3000)...
start /B /MIN cmd /c "cd frontend && npm run dev > nul 2>&1"

echo.
echo ════════════════════════════════════════════════════════════════
echo.

REM Servislerin başlamasını bekle
echo Servisler başlatılıyor, lütfen bekleyin...
timeout /t 8 /nobreak >nul

REM Health check
echo.
echo Sistem durumu kontrol ediliyor...
echo.

curl -s http://localhost:4000/health >nul 2>&1
if %errorlevel% equ 0 (
    echo ✓ Gateway          : http://localhost:4000
) else (
    echo ❌ Gateway          : Başlatılamadı
)

curl -s http://localhost:3000 >nul 2>&1
if %errorlevel% equ 0 (
    echo ✓ Frontend         : http://localhost:3000
) else (
    echo ❌ Frontend         : Başlatılamadı
)

echo.
echo ════════════════════════════════════════════════════════════════
echo.
echo ✅ CLIXER HAZIR!
echo.
echo    Tarayıcınızda açın: http://localhost:3000
echo.
echo    Giriş Bilgileri:
echo    Email: admin@clixer
echo    Şifre: Admin1234!
echo.
echo ════════════════════════════════════════════════════════════════
echo.
echo Bu pencereyi kapatmak servisleri DURDURMAZ.
echo Servisleri durdurmak için: stop-clixer.bat
echo.
pause


@echo off
echo ========================================
echo   CLIXER - Servisleri Baslat
echo ========================================
echo.

REM Proje dizinine git
cd /d "%~dp0"

echo [1/8] Shared modulu derleniyor...
cd shared
call npm install --silent 2>nul
call npm run build
if errorlevel 1 (
    echo [HATA] Shared modulu derlenemedi!
    pause
    exit /b 1
)
echo [OK] Shared modulu hazir

cd ..

echo.
echo [2/8] Gateway baslatiliyor...
start "Gateway" cmd /c "cd gateway && npm install --silent 2>nul && npm run dev"

echo [3/8] Auth Service baslatiliyor...
start "Auth" cmd /c "cd services\auth-service && npm install --silent 2>nul && npm run dev"

echo [4/8] Core Service baslatiliyor...
start "Core" cmd /c "cd services\core-service && npm install --silent 2>nul && npm run dev"

echo [5/8] Data Service baslatiliyor...
start "Data" cmd /c "cd services\data-service && npm install --silent 2>nul && npm run dev"

echo [6/8] Analytics Service baslatiliyor...
start "Analytics" cmd /c "cd services\analytics-service && npm install --silent 2>nul && npm run dev"

echo [7/8] Notification Service baslatiliyor...
start "Notification" cmd /c "cd services\notification-service && npm install --silent 2>nul && npm run dev"

echo [8/8] ETL Worker baslatiliyor...
start "ETL" cmd /c "cd services\etl-worker && npm install --silent 2>nul && npm run dev"

echo.
echo ========================================
echo   Servisler Baslatildi!
echo ========================================
echo.
echo 15 saniye bekleniyor (servisler yuklensin)...
timeout /t 15 /nobreak > nul

echo.
echo [9/9] Frontend baslatiliyor...
start "Frontend" cmd /c "cd frontend && npm install --silent 2>nul && npm run dev"

echo.
echo ========================================
echo   CLIXER HAZIR!
echo ========================================
echo.
echo Tarayicida ac: http://localhost:3000
echo.
echo Giris Bilgileri:
echo   Email: admin@clixer
echo   Sifre: Admin1234!
echo.
echo Not: Her servis ayri pencerede calisiyor.
echo      Kapatmak icin tum pencereleri kapatin.
echo.
pause


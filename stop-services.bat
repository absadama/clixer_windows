@echo off
echo ========================================
echo   CLIXER - Servisleri Durdur
echo ========================================
echo.

REM Node.js işlemlerini sonlandır
taskkill /f /im node.exe 2>nul
echo [OK] Node.js islemleri durduruldu

echo.
echo ========================================
echo   Docker Container Yonetimi
echo ========================================
echo.
echo Docker container'lari durdurmak ister misiniz?
echo   1 - Evet, durdur (veriler korunur)
echo   2 - Hayir, calistirmaya devam et
echo.
set /p choice="Seciminiz (1/2): "

if "%choice%"=="1" (
    cd docker
    docker-compose stop
    echo [OK] Docker container'lar durduruldu
)

echo.
echo Clixer durduruldu.
pause


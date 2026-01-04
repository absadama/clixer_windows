@echo off
chcp 65001 >nul
echo ═══════════════════════════════════════════════════════════════
echo    CLIXER - Durdurma Scripti (Windows)
echo ═══════════════════════════════════════════════════════════════
echo.

echo [1/2] Node.js servisleri durduruluyor...
taskkill /f /im node.exe >nul 2>&1
echo [OK] Tum Node.js islemleri durduruldu
echo.

echo [2/2] Docker servisleri durduruluyor...
cd docker
docker-compose stop
cd ..
echo [OK] Docker servisleri durduruldu
echo.

echo ═══════════════════════════════════════════════════════════════
echo    CLIXER DURDURULDU
echo ═══════════════════════════════════════════════════════════════
echo.
echo    Tekrar baslatmak icin: start.bat
echo.
pause


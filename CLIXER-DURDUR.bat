@echo off
title Clixer Durduruluyor...
echo.
echo ========================================
echo    CLiXER DURDURULUYOR...
echo ========================================
echo.

:: PowerShell scriptini calistir
PowerShell -ExecutionPolicy Bypass -NoProfile -File "%~dp0scripts\stop-local.ps1"

echo.
echo ========================================
echo    CLiXER DURDURULDU
echo ========================================
echo.
echo Tekrar baslatmak icin: CLIXER-BASLAT.bat
echo.
pause

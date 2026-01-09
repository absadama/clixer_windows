@echo off
title Clixer Baslatiliyor...
echo.
echo ========================================
echo    CLiXER BASLATILIYOR...
echo ========================================
echo.

:: PowerShell scriptini calistir
PowerShell -ExecutionPolicy Bypass -NoProfile -File "%~dp0scripts\start-local.ps1"

:: Hata kontrolu
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [HATA] Baslat scripti basarisiz oldu!
    echo.
    pause
    exit /b 1
)

echo.
echo ========================================
echo    CLiXER BASARIYLA BASLATILDI!
echo ========================================
echo.
echo Tarayicinizda http://localhost:3000 acilacak...
echo Bu pencereyi kapatabilirsiniz.
echo.
pause

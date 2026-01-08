@echo off
title Clixer Durduruluyor...
echo.
echo ========================================
echo    CLiXER DURDURULUYOR...
echo ========================================
echo.
PowerShell -ExecutionPolicy Bypass -File "%~dp0scripts\stop-local.ps1"
pause

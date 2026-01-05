@echo off
chcp 65001 >nul
title Clixer Analytics Platform - Durduruluyor...
color 0C

echo.
echo ╔═══════════════════════════════════════════════════════════════╗
echo ║         CLIXER ANALYTICS PLATFORM - DURDURULUYOR              ║
echo ╚═══════════════════════════════════════════════════════════════╝
echo.

echo Node.js servisleri durduruluyor...
taskkill /F /IM node.exe >nul 2>&1

echo.
echo ✅ Tüm Clixer servisleri durduruldu.
echo.
echo Not: Docker veritabanları (PostgreSQL, ClickHouse, Redis) 
echo      hala çalışıyor olabilir. Bunları durdurmak için:
echo      docker-compose -f docker/docker-compose.db.yml down
echo.
pause


#!/bin/bash
# ============================================
# CLIXER - TÜM SERVİSLERİ DURDUR
# ============================================
# v4.21 - Systemd entegrasyonu eklendi
# ============================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${YELLOW}CLIXER servisleri durduruluyor...${NC}"

# ============================================
# Linux (Systemd) vs macOS/Windows Algılama
# ============================================
USE_SYSTEMD=false
if [ -f /etc/os-release ] && command -v systemctl >/dev/null 2>&1; then
    if systemctl list-unit-files clixer-gateway.service >/dev/null 2>&1; then
        USE_SYSTEMD=true
    fi
fi

if [ "$USE_SYSTEMD" = true ]; then
    # ============================================
    # SYSTEMD MODE (Production - Ubuntu)
    # ============================================
    echo -e "${BLUE}Systemd modu aktif${NC}"
    
    sudo systemctl stop clixer-etl-worker 2>/dev/null || true
    sudo systemctl stop clixer-analytics 2>/dev/null || true
    sudo systemctl stop clixer-notification 2>/dev/null || true
    sudo systemctl stop clixer-data 2>/dev/null || true
    sudo systemctl stop clixer-core 2>/dev/null || true
    sudo systemctl stop clixer-auth 2>/dev/null || true
    sudo systemctl stop clixer-gateway 2>/dev/null || true
    
    echo -e "${GREEN}✓ Tüm Clixer servisleri durduruldu (systemd)${NC}"
else
    # ============================================
    # NOHUP MODE (Development)
    # ============================================
    echo -e "${BLUE}Development modu${NC}"
    
    # Node servisleri
    pkill -f "ts-node-dev.*gateway" 2>/dev/null || true
    pkill -f "ts-node-dev.*auth-service" 2>/dev/null || true
    pkill -f "ts-node-dev.*core-service" 2>/dev/null || true
    pkill -f "ts-node-dev.*data-service" 2>/dev/null || true
    pkill -f "ts-node-dev.*analytics-service" 2>/dev/null || true
    pkill -f "ts-node-dev.*notification-service" 2>/dev/null || true
    pkill -f "ts-node-dev.*etl-worker" 2>/dev/null || true
    pkill -f "vite.*frontend" 2>/dev/null || true

    echo -e "${GREEN}✓ Tüm servisler durduruldu${NC}"
fi

echo ""
echo -e "${YELLOW}Not: Docker container'ları (PostgreSQL, Redis, ClickHouse) çalışmaya devam ediyor.${NC}"
echo -e "Onları da durdurmak için: docker stop clixer_postgres clixer_redis clixer_clickhouse"
echo ""

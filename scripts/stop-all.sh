#!/bin/bash
# ============================================
# CLIXER - TÜM SERVİSLERİ DURDUR
# ============================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}CLIXER servisleri durduruluyor...${NC}"

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
echo ""
echo -e "${YELLOW}Not: Docker container'ları (PostgreSQL, Redis, ClickHouse) çalışmaya devam ediyor.${NC}"
echo -e "Onları da durdurmak için: docker stop clixer_postgres clixer_redis clixer_clickhouse"



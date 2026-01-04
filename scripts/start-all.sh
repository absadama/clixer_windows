#!/bin/bash
# ============================================
# CLIXER - TEK KOMUTLA BAŞLATMA
# Tüm servisler, veritabanları ve frontend
# ============================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

# ============================================
# .env dosyasını yükle (varsa)
# ============================================
if [ -f ".env" ]; then
  set -a
  source .env
  set +a
fi

# ============================================
# Environment Variables (Servislere aktarılacak)
# ============================================
export POSTGRES_HOST="${POSTGRES_HOST:-127.0.0.1}"
export POSTGRES_PORT="${POSTGRES_PORT:-5432}"
export POSTGRES_DB="${POSTGRES_DB:-clixer}"
export POSTGRES_USER="${POSTGRES_USER:-clixer}"
export POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-clixer_secret_2025}"
export REDIS_HOST="${REDIS_HOST:-localhost}"
export REDIS_PORT="${REDIS_PORT:-6379}"
export CLICKHOUSE_HOST="${CLICKHOUSE_HOST:-localhost}"
export CLICKHOUSE_PORT="${CLICKHOUSE_PORT:-8123}"
export CLICKHOUSE_URL="${CLICKHOUSE_URL:-http://localhost:8123}"
export CLICKHOUSE_USER="${CLICKHOUSE_USER:-clixer}"
export CLICKHOUSE_PASSWORD="${CLICKHOUSE_PASSWORD:-clixer_click_2025}"
export CLICKHOUSE_DB="${CLICKHOUSE_DB:-clixer_analytics}"
export JWT_SECRET="${JWT_SECRET:-clixer_jwt_secret_2025_very_secure}"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║           CLIXER - Enterprise Analytics Platform           ║${NC}"
echo -e "${BLUE}║                  Tek Komutla Başlatma                       ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# ============================================
# 1. Docker Kontrolü
# ============================================
echo -e "${YELLOW}[1/5]${NC} Docker kontrol ediliyor..."

if ! docker info >/dev/null 2>&1; then
    echo -e "${YELLOW}Docker başlatılıyor...${NC}"
    open -a Docker
    echo -n "Docker'ın hazır olması bekleniyor"
    for i in {1..60}; do
        if docker info >/dev/null 2>&1; then
            echo ""
            echo -e "${GREEN}✓ Docker hazır${NC}"
            break
        fi
        echo -n "."
        sleep 1
    done
    
    if ! docker info >/dev/null 2>&1; then
        echo -e "${RED}✗ Docker başlatılamadı. Lütfen Docker Desktop'u manuel açın.${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✓ Docker çalışıyor${NC}"
fi

# ============================================
# 2. Veritabanı Container'ları
# ============================================
echo -e "${YELLOW}[2/5]${NC} Veritabanları başlatılıyor..."

# PostgreSQL
if docker ps -a --format '{{.Names}}' | grep -q "clixer_postgres"; then
    docker start clixer_postgres >/dev/null 2>&1 || true
else
    echo -e "${YELLOW}PostgreSQL container bulunamadı, docker-compose ile oluşturuluyor...${NC}"
    cd docker && docker-compose up -d postgres && cd ..
fi

# Redis
if docker ps -a --format '{{.Names}}' | grep -q "clixer_redis"; then
    docker start clixer_redis >/dev/null 2>&1 || true
else
    cd docker && docker-compose up -d redis && cd ..
fi

# ClickHouse
if docker ps -a --format '{{.Names}}' | grep -q "clixer_clickhouse"; then
    docker start clixer_clickhouse >/dev/null 2>&1 || true
else
    cd docker && docker-compose up -d clickhouse && cd ..
fi

# Container'ların hazır olmasını bekle
sleep 3

# Durum kontrolü
POSTGRES_OK=$(docker ps --filter "name=clixer_postgres" --filter "status=running" -q)
REDIS_OK=$(docker ps --filter "name=clixer_redis" --filter "status=running" -q)
CLICKHOUSE_OK=$(docker ps --filter "name=clixer_clickhouse" --filter "status=running" -q)

if [ -n "$POSTGRES_OK" ] && [ -n "$REDIS_OK" ] && [ -n "$CLICKHOUSE_OK" ]; then
    echo -e "${GREEN}✓ PostgreSQL çalışıyor (port 5432)${NC}"
    echo -e "${GREEN}✓ Redis çalışıyor (port 6379)${NC}"
    echo -e "${GREEN}✓ ClickHouse çalışıyor (port 8123)${NC}"
else
    echo -e "${RED}✗ Bazı veritabanları başlatılamadı${NC}"
    docker ps -a --filter "name=clixer"
    exit 1
fi

# ============================================
# 3. Backend Servisleri
# ============================================
echo -e "${YELLOW}[3/5]${NC} Backend servisleri başlatılıyor..."

# Önceki servisleri temizle
pkill -f "ts-node-dev.*gateway" 2>/dev/null || true
pkill -f "ts-node-dev.*auth-service" 2>/dev/null || true
pkill -f "ts-node-dev.*core-service" 2>/dev/null || true
pkill -f "ts-node-dev.*data-service" 2>/dev/null || true
pkill -f "ts-node-dev.*analytics-service" 2>/dev/null || true
pkill -f "ts-node-dev.*notification-service" 2>/dev/null || true
pkill -f "ts-node-dev.*etl-worker" 2>/dev/null || true
sleep 2

# Servisleri başlat
cd "$PROJECT_DIR/gateway" && npm run dev >/dev/null 2>&1 &
cd "$PROJECT_DIR/services/auth-service" && npm run dev >/dev/null 2>&1 &
cd "$PROJECT_DIR/services/core-service" && npm run dev >/dev/null 2>&1 &
cd "$PROJECT_DIR/services/data-service" && npm run dev >/dev/null 2>&1 &
cd "$PROJECT_DIR/services/analytics-service" && npm run dev >/dev/null 2>&1 &
cd "$PROJECT_DIR/services/notification-service" && npm run dev >/dev/null 2>&1 &

sleep 3

echo -e "${GREEN}✓ Gateway (port 4000)${NC}"
echo -e "${GREEN}✓ Auth Service (port 4001)${NC}"
echo -e "${GREEN}✓ Core Service (port 4002)${NC}"
echo -e "${GREEN}✓ Data Service (port 4003)${NC}"
echo -e "${GREEN}✓ Notification Service (port 4004)${NC}"
echo -e "${GREEN}✓ Analytics Service (port 4005)${NC}"

# ============================================
# 4. ETL Worker
# ============================================
echo -e "${YELLOW}[4/5]${NC} ETL Worker başlatılıyor..."

cd "$PROJECT_DIR/services/etl-worker" && npm run dev >/dev/null 2>&1 &
sleep 2

echo -e "${GREEN}✓ ETL Worker (Streaming ETL - 9M+ satır destekli)${NC}"

# ============================================
# 5. Frontend
# ============================================
echo -e "${YELLOW}[5/5]${NC} Frontend başlatılıyor..."

# Önceki frontend'i temizle
pkill -f "vite.*frontend" 2>/dev/null || true
sleep 1

cd "$PROJECT_DIR/frontend" && npm run dev >/dev/null 2>&1 &
sleep 3

echo -e "${GREEN}✓ Frontend (port 3000)${NC}"

# ============================================
# TAMAMLANDI
# ============================================
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                    CLIXER HAZIR! 🚀                        ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BLUE}Frontend:${NC}    http://localhost:3000"
echo -e "  ${BLUE}Gateway:${NC}     http://localhost:4000"
echo -e ""
echo -e "  ${YELLOW}Veritabanları:${NC}"
echo -e "    PostgreSQL:  localhost:5432"
echo -e "    Redis:       localhost:6379"
echo -e "    ClickHouse:  localhost:8123"
echo ""
echo -e "  ${GREEN}Durdurmak için:${NC} ./scripts/stop-all.sh"
echo ""



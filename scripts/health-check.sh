#!/bin/bash

# Clixer Health Check Script
# Tüm servislerin durumunu kontrol eder

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🏥 CLİXER SİSTEM SAĞLIK KONTROLÜ"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📅 $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# Renk kodları
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Başarı/Hata sayaçları
SUCCESS=0
FAILED=0

# Fonksiyon: Servis kontrolü
check_service() {
    local name=$1
    local url=$2
    local expected=$3
    
    response=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$url" 2>/dev/null)
    
    if [ "$response" == "$expected" ] || [ "$response" == "200" ]; then
        echo -e "  ${GREEN}✅${NC} $name ${GREEN}ÇALIŞIYOR${NC} (HTTP $response)"
        ((SUCCESS++))
    else
        echo -e "  ${RED}❌${NC} $name ${RED}ÇALIŞMIYOR${NC} (HTTP $response)"
        ((FAILED++))
    fi
}

# Fonksiyon: Docker container kontrolü
check_docker() {
    local name=$1
    local container=$2
    
    status=$(docker inspect -f '{{.State.Status}}' "$container" 2>/dev/null)
    
    if [ "$status" == "running" ]; then
        echo -e "  ${GREEN}✅${NC} $name ${GREEN}ÇALIŞIYOR${NC}"
        ((SUCCESS++))
    else
        echo -e "  ${RED}❌${NC} $name ${RED}ÇALIŞMIYOR${NC} (Status: $status)"
        ((FAILED++))
    fi
}

# Fonksiyon: Port kontrolü
check_port() {
    local name=$1
    local port=$2
    
    if lsof -i :$port > /dev/null 2>&1; then
        echo -e "  ${GREEN}✅${NC} $name (Port $port) ${GREEN}AÇIK${NC}"
        ((SUCCESS++))
    else
        echo -e "  ${RED}❌${NC} $name (Port $port) ${RED}KAPALI${NC}"
        ((FAILED++))
    fi
}

# ═══════════════════════════════════════════════════════════
# 1. DOCKER CONTAINERS
# ═══════════════════════════════════════════════════════════
echo "📦 DOCKER CONTAINERS"
echo "───────────────────────────────────────────────────────"
check_docker "PostgreSQL" "clixer_postgres"
check_docker "ClickHouse" "clixer_clickhouse"
check_docker "Redis" "clixer_redis"
echo ""

# ═══════════════════════════════════════════════════════════
# 2. BACKEND SERVİSLERİ
# ═══════════════════════════════════════════════════════════
echo "🔧 BACKEND SERVİSLERİ"
echo "───────────────────────────────────────────────────────"
check_port "API Gateway" 4000
check_port "Auth Service" 4001
check_port "Core Service" 4002
check_port "Data Service" 4003
check_port "Notification Service" 4004
check_port "Analytics Service" 4005
echo ""

# ═══════════════════════════════════════════════════════════
# 3. API HEALTH ENDPOINTS
# ═══════════════════════════════════════════════════════════
echo "🌐 API HEALTH ENDPOINTS"
echo "───────────────────────────────────────────────────────"
check_service "Gateway /health" "http://localhost:4000/health" "200"
check_service "Auth /health" "http://localhost:4001/health" "200"
check_service "Core /health" "http://localhost:4002/health" "200"
check_service "Data /health" "http://localhost:4003/health" "200"
check_service "Analytics /health" "http://localhost:4005/health" "200"
echo ""

# ═══════════════════════════════════════════════════════════
# 4. FRONTEND
# ═══════════════════════════════════════════════════════════
echo "🖥️  FRONTEND"
echo "───────────────────────────────────────────────────────"
check_port "Frontend (Vite)" 3000
echo ""

# ═══════════════════════════════════════════════════════════
# 5. VERİTABANI BAĞLANTILARI
# ═══════════════════════════════════════════════════════════
echo "🗄️  VERİTABANI BAĞLANTILARI"
echo "───────────────────────────────────────────────────────"

# PostgreSQL
pg_result=$(docker exec clixer_postgres pg_isready -U clixer 2>/dev/null)
if [[ $pg_result == *"accepting connections"* ]]; then
    echo -e "  ${GREEN}✅${NC} PostgreSQL ${GREEN}BAĞLANTI OK${NC}"
    ((SUCCESS++))
else
    echo -e "  ${RED}❌${NC} PostgreSQL ${RED}BAĞLANTI HATASI${NC}"
    ((FAILED++))
fi

# ClickHouse
ch_result=$(curl -s "http://localhost:8123/ping" 2>/dev/null)
if [ "$ch_result" == "Ok." ]; then
    echo -e "  ${GREEN}✅${NC} ClickHouse ${GREEN}BAĞLANTI OK${NC}"
    ((SUCCESS++))
else
    echo -e "  ${RED}❌${NC} ClickHouse ${RED}BAĞLANTI HATASI${NC}"
    ((FAILED++))
fi

# Redis
redis_result=$(docker exec clixer_redis redis-cli ping 2>/dev/null)
if [ "$redis_result" == "PONG" ]; then
    echo -e "  ${GREEN}✅${NC} Redis ${GREEN}BAĞLANTI OK${NC}"
    ((SUCCESS++))
else
    echo -e "  ${RED}❌${NC} Redis ${RED}BAĞLANTI HATASI${NC}"
    ((FAILED++))
fi

echo ""

# ═══════════════════════════════════════════════════════════
# ÖZET
# ═══════════════════════════════════════════════════════════
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 ÖZET"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "  ${GREEN}✅ Başarılı:${NC} $SUCCESS"
echo -e "  ${RED}❌ Başarısız:${NC} $FAILED"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "  ${GREEN}🎉 TÜM SİSTEMLER ÇALIŞIYOR!${NC}"
else
    echo -e "  ${YELLOW}⚠️  BAZI SERVİSLER ÇALIŞMIYOR!${NC}"
    echo ""
    echo "  Çözüm önerileri:"
    echo "  1. Docker: docker-compose up -d"
    echo "  2. Servisler: ./scripts/start-all.sh"
    echo "  3. Loglar: docker logs <container_name>"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"


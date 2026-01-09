#!/bin/bash
# ============================================
# CLIXER - SERVİS DURUM KONTROLÜ
# ============================================
# v4.21 - Systemd entegrasyonu
# ============================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║              CLIXER - SERVİS DURUMU                        ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# ============================================
# Linux (Systemd) vs macOS/Windows Algılama
# ============================================
USE_SYSTEMD=false
if [ -f /etc/os-release ] && command -v systemctl >/dev/null 2>&1; then
    if systemctl list-unit-files clixer-gateway.service >/dev/null 2>&1; then
        USE_SYSTEMD=true
    fi
fi

# ============================================
# 1. Docker Containers
# ============================================
echo -e "${CYAN}=== DOCKER CONTAINERS ===${NC}"

check_container() {
    local name=$1
    local port=$2
    if docker ps --filter "name=$name" --filter "status=running" -q | grep -q .; then
        echo -e "  ${GREEN}✓${NC} $name ${BLUE}(port $port)${NC}"
    else
        echo -e "  ${RED}✗${NC} $name ${RED}DURMUŞ${NC}"
    fi
}

check_container "clixer_postgres" "5432"
check_container "clixer_redis" "6379"
check_container "clixer_clickhouse" "8123"

echo ""

# ============================================
# 2. Backend Services
# ============================================
echo -e "${CYAN}=== BACKEND SERVİSLERİ ===${NC}"

if [ "$USE_SYSTEMD" = true ]; then
    # Systemd durumları
    check_service() {
        local service=$1
        local port=$2
        if systemctl is-active --quiet clixer-$service 2>/dev/null; then
            echo -e "  ${GREEN}✓${NC} clixer-$service ${BLUE}(port $port)${NC}"
        else
            echo -e "  ${RED}✗${NC} clixer-$service ${RED}DURMUŞ${NC}"
        fi
    }
    
    check_service "gateway" "4000"
    check_service "auth" "4001"
    check_service "core" "4002"
    check_service "data" "4003"
    check_service "notification" "4004"
    check_service "analytics" "4005"
    check_service "etl-worker" "-"
else
    # Process kontrolü (development)
    check_process() {
        local pattern=$1
        local name=$2
        local port=$3
        if pgrep -f "$pattern" >/dev/null 2>&1; then
            echo -e "  ${GREEN}✓${NC} $name ${BLUE}(port $port)${NC}"
        else
            echo -e "  ${RED}✗${NC} $name ${RED}DURMUŞ${NC}"
        fi
    }
    
    check_process "ts-node-dev.*gateway" "Gateway" "4000"
    check_process "ts-node-dev.*auth-service" "Auth Service" "4001"
    check_process "ts-node-dev.*core-service" "Core Service" "4002"
    check_process "ts-node-dev.*data-service" "Data Service" "4003"
    check_process "ts-node-dev.*notification-service" "Notification Service" "4004"
    check_process "ts-node-dev.*analytics-service" "Analytics Service" "4005"
    check_process "ts-node-dev.*etl-worker" "ETL Worker" "-"
fi

echo ""

# ============================================
# 3. Frontend / Nginx
# ============================================
echo -e "${CYAN}=== FRONTEND ===${NC}"

if systemctl is-active --quiet nginx 2>/dev/null; then
    echo -e "  ${GREEN}✓${NC} Nginx ${BLUE}(HTTPS)${NC}"
elif pgrep -f "vite.*frontend" >/dev/null 2>&1; then
    echo -e "  ${GREEN}✓${NC} Vite Dev Server ${BLUE}(port 3000)${NC}"
else
    echo -e "  ${YELLOW}○${NC} Frontend kontrolü yapılamadı"
fi

echo ""

# ============================================
# 4. API Health Check
# ============================================
echo -e "${CYAN}=== API HEALTH CHECK ===${NC}"

check_api() {
    local url=$1
    local name=$2
    if curl -s --max-time 2 "$url" >/dev/null 2>&1; then
        echo -e "  ${GREEN}✓${NC} $name yanıt veriyor"
    else
        echo -e "  ${RED}✗${NC} $name yanıt YOK"
    fi
}

check_api "http://localhost:4000/health" "Gateway"
check_api "http://localhost:4001/health" "Auth Service"
check_api "http://localhost:4002/health" "Core Service"
check_api "http://localhost:4003/health" "Data Service"

echo ""

# ============================================
# 5. Schedule Durumu
# ============================================
echo -e "${CYAN}=== ZAMANLANMIŞ GÖREVLER ===${NC}"

if docker ps --filter "name=clixer_postgres" --filter "status=running" -q | grep -q .; then
    # LDAP
    LDAP_INFO=$(docker exec clixer_postgres psql -U clixer -d clixer -t -c "
        SELECT 
            CASE WHEN last_sync_at IS NOT NULL THEN '✓' ELSE '✗' END || ' LDAP: ' ||
            COALESCE(TO_CHAR(last_sync_at AT TIME ZONE 'Europe/Istanbul', 'DD.MM HH24:MI'), 'Hiç çalışmadı')
        FROM ldap_config WHERE is_active = true LIMIT 1;
    " 2>/dev/null | xargs)
    
    if [ -n "$LDAP_INFO" ]; then
        echo -e "  ${GREEN}$LDAP_INFO${NC}"
    fi
    
    # ETL Jobs
    ETL_COUNT=$(docker exec clixer_postgres psql -U clixer -d clixer -t -c "
        SELECT COUNT(*) FROM etl_schedules WHERE is_active = true;
    " 2>/dev/null | xargs)
    
    RUNNING_JOBS=$(docker exec clixer_postgres psql -U clixer -d clixer -t -c "
        SELECT COUNT(*) FROM etl_jobs WHERE status = 'running';
    " 2>/dev/null | xargs)
    
    echo -e "  ${GREEN}○${NC} ETL Schedules: ${BLUE}$ETL_COUNT aktif${NC}"
    if [ "$RUNNING_JOBS" != "0" ] && [ -n "$RUNNING_JOBS" ]; then
        echo -e "  ${YELLOW}⚙${NC} Çalışan Job: ${YELLOW}$RUNNING_JOBS${NC}"
    fi
fi

echo ""

# ============================================
# 6. Sistem Bilgisi
# ============================================
echo -e "${CYAN}=== SİSTEM BİLGİSİ ===${NC}"
echo -e "  ${BLUE}Sunucu Saati:${NC} $(date '+%d.%m.%Y %H:%M %Z')"
echo -e "  ${BLUE}Uptime:${NC} $(uptime -p 2>/dev/null || uptime | awk '{print $3,$4,$5}')"

if [ "$USE_SYSTEMD" = true ]; then
    echo -e "  ${BLUE}Mode:${NC} Production (Systemd)"
else
    echo -e "  ${BLUE}Mode:${NC} Development (Process)"
fi

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

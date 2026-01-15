#!/bin/bash
# ============================================
# CLIXER - FULL SYSTEM RESTART
# ============================================
# This script stops all services, cleans up, and restarts them.
# ============================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_FILE="/opt/clixer/logs/restart.log"

mkdir -p /opt/clixer/logs

echo "$(date): --- RESTART STARTED ---" >> $LOG_FILE

# 1. Stop all services
echo -e "${YELLOW}[1/4] Stopping all services...${NC}"
echo "$(date): Stopping services..." >> $LOG_FILE

# Sudo içinden çağrıldığında sudo komutları şifre isteyebilir. 
# Zaten bu script sudo ile çalışıyor, içindeki sudo'ları kaldırıp doğrudan komut veriyoruz.
if systemctl list-unit-files clixer-gateway.service >/dev/null 2>&1; then
    systemctl stop clixer-analytics.service clixer-auth.service clixer-core.service clixer-data.service clixer-etl-worker.service clixer-gateway.service clixer-notification.service >> $LOG_FILE 2>&1
else
    bash "$SCRIPT_DIR/stop-all.sh" >> $LOG_FILE 2>&1
fi
sleep 5

# 2. Force kill any remaining node processes (safety net)
echo -e "${YELLOW}[2/4] Cleaning up remaining processes and ports...${NC}"
echo "$(date): Cleaning up processes and ports..." >> $LOG_FILE

# Önce servisleri durdur
pkill -9 -f "node.*/services/" || true
pkill -9 -f "node.*/gateway/" || true
pkill -9 -f "ts-node-dev" || true
pkill -9 -f "vite" || true

# Portları kullananları bul ve öldür (Portlar: 4000..4005)
for port in 4000 4001 4002 4003 4004 4005 3000; do
    # fuser veya lsof kullanarak portu temizle
    fuser -k $port/tcp >> $LOG_FILE 2>&1 || true
done

sleep 5

# 3. Start all services
echo -e "${YELLOW}[3/4] Starting all services...${NC}"
echo "$(date): Starting services..." >> $LOG_FILE

if systemctl list-unit-files clixer-gateway.service >/dev/null 2>&1; then
    # Servisleri sırayla başlat (bağımlılıklar için daha güvenli)
    systemctl start clixer-gateway.service
    sleep 2
    systemctl start clixer-auth.service clixer-core.service clixer-data.service clixer-analytics.service clixer-notification.service clixer-etl-worker.service >> $LOG_FILE 2>&1
else
    bash "$SCRIPT_DIR/start-all.sh" >> $LOG_FILE 2>&1
fi

# Gateway'in hazır olmasını bekle (max 60sn)
echo "$(date): Waiting for Gateway to be ready..." >> $LOG_FILE
for i in {1..12}; do
    if curl -s http://localhost:4000/health > /dev/null; then
        echo "$(date): Gateway is ready!" >> $LOG_FILE
        break
    fi
    sleep 5
done
sleep 5

# 4. Check status
echo -e "${YELLOW}[4/4] Verifying system status...${NC}"
echo "$(date): Checking status..." >> $LOG_FILE
bash "$SCRIPT_DIR/status.sh" >> $LOG_FILE 2>&1

echo "$(date): --- RESTART COMPLETED ---" >> $LOG_FILE
echo -e "${GREEN}Restart process completed!${NC}"

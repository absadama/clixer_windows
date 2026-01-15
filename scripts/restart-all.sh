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
echo -e "${YELLOW}[2/4] Cleaning up remaining processes...${NC}"
echo "$(date): Cleaning up processes..." >> $LOG_FILE
pkill -9 -f "node" || true
pkill -9 -f "ts-node" || true
pkill -9 -f "vite" || true
pkill -9 -f "clixer" || true

# 3. Start all services
echo -e "${YELLOW}[3/4] Starting all services...${NC}"
echo "$(date): Starting services..." >> $LOG_FILE

if systemctl list-unit-files clixer-gateway.service >/dev/null 2>&1; then
    systemctl start clixer-gateway.service clixer-auth.service clixer-core.service clixer-data.service clixer-analytics.service clixer-notification.service clixer-etl-worker.service >> $LOG_FILE 2>&1
else
    bash "$SCRIPT_DIR/start-all.sh" >> $LOG_FILE 2>&1
fi
sleep 5

# 4. Check status
echo -e "${YELLOW}[4/4] Verifying system status...${NC}"
echo "$(date): Checking status..." >> $LOG_FILE
bash "$SCRIPT_DIR/status.sh" >> $LOG_FILE 2>&1

echo "$(date): --- RESTART COMPLETED ---" >> $LOG_FILE
echo -e "${GREEN}Restart process completed!${NC}"

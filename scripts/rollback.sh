#!/bin/bash
# ============================================
# CLIXER - Rollback Scripti
# Güncelleme başarısız olursa önceki versiyona döner
# ============================================
# Kullanım: bash /opt/clixer/scripts/rollback.sh [backup_dir]

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

CLIXER_DIR="/opt/clixer"
BACKUP_BASE="/opt/clixer-backups"

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "   CLIXER - Rollback Scripti"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Backup dizinini bul
if [ -n "$1" ]; then
    BACKUP_DIR="$1"
else
    # En son backup'ı bul
    BACKUP_DIR=$(ls -td $BACKUP_BASE/*/ 2>/dev/null | head -1)
fi

if [ -z "$BACKUP_DIR" ] || [ ! -d "$BACKUP_DIR" ]; then
    log_error "Backup dizini bulunamadı!"
    log_info "Mevcut backuplar:"
    ls -la $BACKUP_BASE 2>/dev/null || echo "  Hiç backup yok"
    exit 1
fi

log_info "Kullanılacak backup: $BACKUP_DIR"

# Önceki versiyonu oku
if [ -f "$BACKUP_DIR/previous_version.txt" ]; then
    PREVIOUS_VERSION=$(cat $BACKUP_DIR/previous_version.txt)
    log_info "Geri dönülecek versiyon: $PREVIOUS_VERSION"
else
    log_error "previous_version.txt bulunamadı!"
    exit 1
fi

# Onay al
echo ""
read -p "⚠️ $PREVIOUS_VERSION versiyonuna geri dönülecek. Emin misiniz? (y/N): " confirm
if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    log_info "Rollback iptal edildi."
    exit 0
fi

cd $CLIXER_DIR

# Git checkout
log_info "Kod geri alınıyor..."
git checkout $PREVIOUS_VERSION

# Bağımlılıkları yeniden yükle
log_info "Bağımlılıklar yeniden yükleniyor..."
cd $CLIXER_DIR/shared && npm install --silent && npm run build

SERVICES=("gateway" "services/auth-service" "services/core-service" "services/data-service" "services/notification-service" "services/analytics-service" "services/etl-worker" "frontend")
for service in "${SERVICES[@]}"; do
    log_info "$service..."
    cd $CLIXER_DIR/$service
    npm install --silent
    npm run build 2>/dev/null || true
done

cd $CLIXER_DIR

# PM2 reload
log_info "Servisler yeniden başlatılıyor..."
pm2 reload ecosystem.config.js --update-env

# PostgreSQL restore (opsiyonel)
if [ -f "$BACKUP_DIR/postgresql_backup.sql" ]; then
    echo ""
    read -p "PostgreSQL yedeğini de geri yüklemek ister misiniz? (y/N): " restore_db
    if [ "$restore_db" = "y" ] || [ "$restore_db" = "Y" ]; then
        log_info "PostgreSQL geri yükleniyor..."
        docker exec -i clixer_postgres psql -U clixer -d clixer < $BACKUP_DIR/postgresql_backup.sql
        log_info "PostgreSQL geri yüklendi"
    fi
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo -e "   ${GREEN}✅ ROLLBACK TAMAMLANDI${NC}"
echo "   Aktif Versiyon: $PREVIOUS_VERSION"
echo "═══════════════════════════════════════════════════════════════"
echo ""


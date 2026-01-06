#!/bin/bash
# ============================================
# CLIXER - Müşteri Sunucu Güncelleme Scripti
# Bu script müşteri sunucusunda çalışır
# ============================================
# Kullanım: bash /opt/clixer/scripts/update.sh [version]
# Örnek: bash /opt/clixer/scripts/update.sh v4.0.6

set -e

# Renk kodları
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step() { echo -e "${BLUE}[STEP]${NC} $1"; }

# Değişkenler
CLIXER_DIR="/opt/clixer"
VERSION=${1:-"latest"}
BACKUP_DIR="/opt/clixer-backups/$(date +%Y%m%d_%H%M%S)"

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "   CLIXER - Güncelleme Scripti"
echo "   Hedef Versiyon: $VERSION"
echo "═══════════════════════════════════════════════════════════════"
echo ""

cd $CLIXER_DIR

# ============================================
# 1. Mevcut Versiyonu Kaydet (Rollback için)
# ============================================
log_step "[1/7] Mevcut versiyon yedekleniyor..."
CURRENT_VERSION=$(git describe --tags --always 2>/dev/null || echo "unknown")
log_info "Mevcut versiyon: $CURRENT_VERSION"

# Backup dizini oluştur
mkdir -p $BACKUP_DIR
echo "$CURRENT_VERSION" > $BACKUP_DIR/previous_version.txt
log_info "Yedek dizini: $BACKUP_DIR"

# ============================================
# 2. PostgreSQL Yedeği (Opsiyonel ama önerilir)
# ============================================
log_step "[2/7] PostgreSQL yedeği alınıyor..."
if docker ps | grep -q clixer_postgres; then
    docker exec clixer_postgres pg_dump -U clixer -d clixer > $BACKUP_DIR/postgresql_backup.sql 2>/dev/null || true
    log_info "PostgreSQL yedeği alındı"
else
    log_warn "PostgreSQL container bulunamadı, yedek atlandı"
fi

# ============================================
# 3. Git Pull
# ============================================
log_step "[3/7] Kod güncelleniyor..."
git fetch origin

if [ "$VERSION" = "latest" ]; then
    git checkout master
    git pull origin master
    VERSION=$(git describe --tags --always)
else
    git checkout $VERSION
fi

log_info "Kod güncellendi: $VERSION"

# ============================================
# 4. Dependencies (shared önce!)
# ============================================
log_step "[4/7] Bağımlılıklar güncelleniyor..."

# Shared modülü önce (diğerleri buna bağımlı)
log_info "shared modülü..."
cd $CLIXER_DIR/shared
npm install --silent
npm run build

# Gateway
log_info "gateway..."
cd $CLIXER_DIR/gateway
npm install --silent
npm run build 2>/dev/null || true

# Services
SERVICES=("auth-service" "core-service" "data-service" "notification-service" "analytics-service" "etl-worker")

for service in "${SERVICES[@]}"; do
    log_info "$service..."
    cd $CLIXER_DIR/services/$service
    npm install --silent
    npm run build 2>/dev/null || true
done

# Frontend
log_info "frontend..."
cd $CLIXER_DIR/frontend
npm install --silent
npm run build

cd $CLIXER_DIR
log_info "Tüm bağımlılıklar güncellendi"

# ============================================
# 5. Veritabanı Migrasyonları (varsa)
# ============================================
log_step "[5/7] Veritabanı migrasyonları kontrol ediliyor..."
if [ -f "$CLIXER_DIR/scripts/migrate.sh" ]; then
    bash $CLIXER_DIR/scripts/migrate.sh || true
    log_info "Migrasyonlar uygulandı"
else
    log_info "Migrasyon scripti yok, atlanıyor"
fi

# ============================================
# 6. PM2 Reload (Zero-downtime)
# ============================================
log_step "[6/7] Servisler yeniden başlatılıyor..."
if command -v pm2 &> /dev/null; then
    pm2 reload ecosystem.config.js --update-env
    log_info "PM2 servisleri yeniden yüklendi"
else
    log_warn "PM2 bulunamadı! Servisleri manuel başlatın."
fi

# ============================================
# 7. Health Check
# ============================================
log_step "[7/7] Sağlık kontrolü yapılıyor..."
sleep 5

# Gateway health check
if curl -s http://localhost:4000/health | grep -q "ok"; then
    log_info "✅ Gateway: ÇALIŞIYOR"
else
    log_error "❌ Gateway: HATA!"
fi

# Frontend check
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    log_info "✅ Frontend: ÇALIŞIYOR"
else
    log_warn "⚠️ Frontend: Kontrol edilemedi (production'da nginx arkasında olabilir)"
fi

# ============================================
# TAMAMLANDI
# ============================================
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo -e "   ${GREEN}✅ GÜNCELLEME TAMAMLANDI${NC}"
echo "   Önceki Versiyon: $CURRENT_VERSION"
echo "   Yeni Versiyon: $VERSION"
echo "   Yedek Dizini: $BACKUP_DIR"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "Rollback için: bash /opt/clixer/scripts/rollback.sh"
echo ""


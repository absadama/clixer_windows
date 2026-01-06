#!/bin/bash
# ============================================
# CLIXER - Veritabanı Migrasyon Scripti
# Yeni şema değişikliklerini uygular
# ============================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[MIGRATE]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[MIGRATE]${NC} $1"; }
log_error() { echo -e "${RED}[MIGRATE]${NC} $1"; }

CLIXER_DIR="/opt/clixer"
MIGRATIONS_DIR="$CLIXER_DIR/migrations"

echo ""
log_info "Veritabanı migrasyonları başlıyor..."

# Migrations dizini var mı?
if [ ! -d "$MIGRATIONS_DIR" ]; then
    log_info "migrations/ dizini yok, migrasyon atlanıyor"
    exit 0
fi

# Uygulanan migrasyonlar tablosu oluştur (yoksa)
docker exec clixer_postgres psql -U clixer -d clixer -c "
    CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMP DEFAULT NOW()
    );
" 2>/dev/null || true

# Her SQL dosyasını sırayla uygula
for migration in $(ls $MIGRATIONS_DIR/*.sql 2>/dev/null | sort); do
    MIGRATION_NAME=$(basename $migration)
    
    # Bu migrasyon daha önce uygulandı mı?
    APPLIED=$(docker exec clixer_postgres psql -U clixer -d clixer -t -c "
        SELECT COUNT(*) FROM _migrations WHERE name = '$MIGRATION_NAME';
    " 2>/dev/null | tr -d ' ')
    
    if [ "$APPLIED" = "1" ]; then
        log_info "⏭️ $MIGRATION_NAME (zaten uygulanmış)"
        continue
    fi
    
    # Migrasyonu uygula
    log_info "▶️ $MIGRATION_NAME uygulanıyor..."
    if docker exec -i clixer_postgres psql -U clixer -d clixer < $migration; then
        # Başarılı - kaydet
        docker exec clixer_postgres psql -U clixer -d clixer -c "
            INSERT INTO _migrations (name) VALUES ('$MIGRATION_NAME');
        " 2>/dev/null
        log_info "✅ $MIGRATION_NAME tamamlandı"
    else
        log_error "❌ $MIGRATION_NAME başarısız!"
        exit 1
    fi
done

log_info "Tüm migrasyonlar tamamlandı"


#!/bin/bash
# Clixer v4.36 Migration Script
# Tarih: 26 Ocak 2026
# Kullanım: sudo bash migrate-v436.sh

set -e

echo "=========================================="
echo "  Clixer v4.36 Migration Script"
echo "=========================================="
echo ""

# Renk kodları
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Fonksiyonlar
success() { echo -e "${GREEN}✓ $1${NC}"; }
warning() { echo -e "${YELLOW}⚠ $1${NC}"; }
error() { echo -e "${RED}✗ $1${NC}"; exit 1; }

# Root kontrolü
if [ "$EUID" -ne 0 ]; then
    error "Bu script root olarak çalıştırılmalı: sudo bash migrate-v436.sh"
fi

# Clixer dizini kontrolü
CLIXER_DIR="/opt/clixer"
if [ ! -d "$CLIXER_DIR" ]; then
    error "Clixer dizini bulunamadı: $CLIXER_DIR"
fi

echo "1. PostgreSQL Container Kontrolü..."
if ! docker exec clixer_postgres pg_isready -U clixer > /dev/null 2>&1; then
    error "PostgreSQL container'ı çalışmıyor!"
fi
success "PostgreSQL OK"

echo ""
echo "2. Database Migration'ları Uygulanıyor..."

# Users tablosu güncellemeleri
echo "   - users tablosu güncelleniyor..."
docker exec clixer_postgres psql -U clixer -d clixer -c "
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_see_all_categories BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS filter_level VARCHAR(50) DEFAULT 'store';
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_active BOOLEAN DEFAULT true;
CREATE INDEX IF NOT EXISTS idx_users_phone_number ON users(phone_number) WHERE phone_number IS NOT NULL;
" > /dev/null 2>&1
success "users tablosu güncellendi"

# Report categories tablosu
echo "   - report_categories tablosu oluşturuluyor..."
docker exec clixer_postgres psql -U clixer -d clixer -c "
CREATE TABLE IF NOT EXISTS report_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    code VARCHAR(100),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    icon VARCHAR(100) DEFAULT 'Folder',
    color VARCHAR(50) DEFAULT '#6366f1',
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(tenant_id, name)
);
CREATE INDEX IF NOT EXISTS idx_report_categories_tenant ON report_categories(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_report_categories_code ON report_categories(tenant_id, code);
" > /dev/null 2>&1
success "report_categories tablosu OK"

# User report categories tablosu
echo "   - user_report_categories tablosu oluşturuluyor..."
docker exec clixer_postgres psql -U clixer -d clixer -c "
CREATE TABLE IF NOT EXISTS user_report_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES report_categories(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES users(id),
    assigned_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, category_id)
);
CREATE INDEX IF NOT EXISTS idx_user_report_categories_user ON user_report_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_user_report_categories_category ON user_report_categories(category_id);
" > /dev/null 2>&1
success "user_report_categories tablosu OK"

# Navigation items tablosu
echo "   - navigation_items tablosu oluşturuluyor..."
if [ -f "$CLIXER_DIR/docker/init-scripts/postgres/migrations/20260125_navigation_items.sql" ]; then
    docker exec -i clixer_postgres psql -U clixer -d clixer < "$CLIXER_DIR/docker/init-scripts/postgres/migrations/20260125_navigation_items.sql" > /dev/null 2>&1
    success "navigation_items tablosu OK"
else
    warning "navigation_items migration dosyası bulunamadı"
fi

# Navigation seed data
echo "   - navigation_items seed data ekleniyor..."
if [ -f "$CLIXER_DIR/docker/init-scripts/postgres/migrations/20260125_navigation_seed.sql" ]; then
    docker exec -i clixer_postgres psql -U clixer -d clixer < "$CLIXER_DIR/docker/init-scripts/postgres/migrations/20260125_navigation_seed.sql" > /dev/null 2>&1
    success "navigation_items seed OK"
else
    warning "navigation_items seed dosyası bulunamadı"
fi

echo ""
echo "3. Gateway pg Paketi Kontrolü..."
cd "$CLIXER_DIR/gateway"
if ! npm list pg > /dev/null 2>&1; then
    echo "   - pg paketi kuruluyor..."
    npm install pg > /dev/null 2>&1
    success "pg paketi kuruldu"
else
    success "pg paketi zaten kurulu"
fi

echo ""
echo "4. Systemd Service Dosyaları Güncelleniyor..."
for f in /etc/systemd/system/clixer-*.service; do
    if [ -f "$f" ]; then
        if ! grep -q "EnvironmentFile" "$f"; then
            sed -i '/WorkingDirectory=/a EnvironmentFile=/opt/clixer/.env' "$f"
            success "$(basename $f) güncellendi"
        else
            success "$(basename $f) zaten güncel"
        fi
    fi
done
systemctl daemon-reload
success "Systemd reload edildi"

echo ""
echo "5. Environment Dosyası Kontrolü..."
ENV_FILE="$CLIXER_DIR/.env"
if [ -f "$ENV_FILE" ]; then
    # JWT_SECRET kontrolü
    JWT_LEN=$(grep JWT_SECRET "$ENV_FILE" | awk -F= '{print length($2)}')
    if [ "$JWT_LEN" -lt 32 ]; then
        warning "JWT_SECRET 32 karakterden kısa! Güncellenmeli."
    else
        success "JWT_SECRET OK ($JWT_LEN karakter)"
    fi
    
    # ENCRYPTION_KEY kontrolü
    if grep -q "ENCRYPTION_KEY" "$ENV_FILE"; then
        success "ENCRYPTION_KEY mevcut"
    else
        warning "ENCRYPTION_KEY eksik! .env dosyasına ekle:"
        echo "   ENCRYPTION_KEY=$(openssl rand -hex 32)"
    fi
    
    # CORS kontrolü
    CORS=$(grep CORS_ORIGIN "$ENV_FILE" | cut -d= -f2)
    if [ "$CORS" == "*" ]; then
        warning "CORS_ORIGIN=* ayarlı! Domain ile değiştir."
    else
        success "CORS_ORIGIN OK: $CORS"
    fi
    
    # NODE_ENV kontrolü
    if grep -q "NODE_ENV=production" "$ENV_FILE"; then
        success "NODE_ENV=production OK"
    else
        warning "NODE_ENV production değil!"
    fi
else
    error ".env dosyası bulunamadı: $ENV_FILE"
fi

echo ""
echo "6. Firewall Kontrolü..."
if command -v ufw &> /dev/null; then
    if ufw status | grep -q "4000.*ALLOW"; then
        warning "Port 4000 firewall'da açık! Kapatılması önerilir:"
        echo "   sudo ufw delete allow 4000/tcp"
    else
        success "Port 4000 kapalı (güvenli)"
    fi
fi

echo ""
echo "=========================================="
echo "  Migration Tamamlandı!"
echo "=========================================="
echo ""
echo "Sonraki adımlar:"
echo "  1. .env dosyasındaki uyarıları düzelt"
echo "  2. Frontend'i build et: cd frontend && npm run build"
echo "  3. Servisleri yeniden başlat:"
echo "     sudo systemctl restart clixer-auth clixer-core clixer-data clixer-analytics clixer-etl-worker clixer-notification clixer-gateway"
echo "  4. Health check yap: curl http://localhost:4000/health"
echo ""

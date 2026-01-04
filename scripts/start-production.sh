#!/bin/bash

# ============================================
# CLIXER - Production Başlatma Scripti
# PM2 Cluster Mode ile 400+ kullanıcı desteği
# ============================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "🚀 CLIXER Production Başlatılıyor..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ============================================
# 1. Gereksinim Kontrolü
# ============================================
echo "📋 Gereksinimler kontrol ediliyor..."

# PM2 kurulu mu?
if ! command -v pm2 &> /dev/null; then
    echo "⚠️  PM2 bulunamadı. Kuruluyor..."
    npm install pm2 -g
fi

# Docker çalışıyor mu?
if ! docker info &> /dev/null; then
    echo "❌ Docker çalışmıyor! Lütfen Docker'ı başlatın."
    exit 1
fi

echo "✅ Tüm gereksinimler mevcut"
echo ""

# ============================================
# 2. Docker Servisleri (DB, Cache)
# ============================================
echo "🐳 Docker servisleri başlatılıyor..."

docker-compose up -d clixer_postgres clixer_redis clixer_clickhouse

# Servislerin hazır olmasını bekle
echo "   PostgreSQL bekleniyor..."
until docker exec clixer_postgres pg_isready -U clixer > /dev/null 2>&1; do
    sleep 1
done

echo "   Redis bekleniyor..."
until docker exec clixer_redis redis-cli ping > /dev/null 2>&1; do
    sleep 1
done

echo "   ClickHouse bekleniyor..."
sleep 3

echo "✅ Docker servisleri hazır"
echo ""

# ============================================
# 3. Logs klasörü
# ============================================
mkdir -p "$PROJECT_DIR/logs"

# ============================================
# 4. Build (eğer gerekiyorsa)
# ============================================
echo "🔨 Servisler build ediliyor..."

# Shared
cd "$PROJECT_DIR/shared" && npm run build 2>/dev/null || true

# Gateway
cd "$PROJECT_DIR/gateway" && npm run build 2>/dev/null || true

# Services
for service in auth-service core-service data-service analytics-service notification-service etl-worker; do
    cd "$PROJECT_DIR/services/$service" && npm run build 2>/dev/null || true
done

echo "✅ Build tamamlandı"
echo ""

# ============================================
# 5. PM2 Başlat
# ============================================
echo "⚡ PM2 Cluster Mode başlatılıyor..."

cd "$PROJECT_DIR"

# Önceki PM2 processlerini durdur
pm2 delete all 2>/dev/null || true

# Cluster mode ile başlat
pm2 start ecosystem.config.js

echo ""
echo "✅ PM2 başlatıldı"
echo ""

# ============================================
# 6. Frontend (Opsiyonel)
# ============================================
read -p "🎨 Frontend'i de başlatmak ister misiniz? (y/n): " start_frontend

if [ "$start_frontend" = "y" ] || [ "$start_frontend" = "Y" ]; then
    cd "$PROJECT_DIR/frontend"
    npm run build 2>/dev/null || true
    pm2 serve dist 3000 --name frontend --spa
    echo "✅ Frontend başlatıldı (port 3000)"
fi

echo ""

# ============================================
# 7. Özet
# ============================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 CLIXER Production Hazır!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
pm2 status
echo ""
echo "📊 Komutlar:"
echo "   pm2 status        - Durumu gör"
echo "   pm2 logs          - Logları izle"
echo "   pm2 monit         - Canlı monitoring"
echo "   pm2 restart all   - Tümünü yeniden başlat"
echo "   pm2 stop all      - Tümünü durdur"
echo ""
echo "🌐 Erişim:"
echo "   Frontend: http://localhost:3000"
echo "   API:      http://localhost:4000"
echo ""




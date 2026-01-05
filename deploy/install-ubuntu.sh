#!/bin/bash
# ============================================
# CLIXER - Ubuntu Production Kurulum Scripti
# ============================================
# Kullanım: curl -fsSL https://raw.githubusercontent.com/absadama/clixer_windows/main/deploy/install-ubuntu.sh | sudo bash
# veya: sudo bash install-ubuntu.sh

set -e

echo "═══════════════════════════════════════════════════════════════"
echo "   CLIXER - Enterprise Analytics Platform"
echo "   Ubuntu Production Kurulumu"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Renk kodları
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Fonksiyonlar
log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Root kontrolü
if [ "$EUID" -ne 0 ]; then
    log_error "Bu script root olarak çalıştırılmalı!"
    log_info "Kullanım: sudo bash install-ubuntu.sh"
    exit 1
fi

# Değişkenler
CLIXER_DIR="/opt/clixer"
CLIXER_USER="clixer"
DOMAIN=${DOMAIN:-"localhost"}

log_info "Kurulum dizini: $CLIXER_DIR"
log_info "Domain: $DOMAIN"
echo ""

# ============================================
# 1. Sistem Güncellemesi
# ============================================
log_info "[1/8] Sistem güncelleniyor..."
apt-get update -qq
apt-get upgrade -y -qq

# ============================================
# 2. Gerekli Paketler
# ============================================
log_info "[2/8] Gerekli paketler kuruluyor..."
apt-get install -y -qq \
    curl \
    git \
    nginx \
    ufw \
    fail2ban \
    htop \
    unzip \
    ca-certificates \
    gnupg \
    lsb-release

# ============================================
# 3. Docker Kurulumu
# ============================================
log_info "[3/8] Docker kuruluyor..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
else
    log_info "Docker zaten kurulu"
fi

# Docker Compose
if ! command -v docker-compose &> /dev/null; then
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
fi

# ============================================
# 4. Node.js Kurulumu
# ============================================
log_info "[4/8] Node.js kuruluyor..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y -qq nodejs
else
    log_info "Node.js zaten kurulu: $(node -v)"
fi

# ============================================
# 5. Clixer Kullanıcısı ve Dizin
# ============================================
log_info "[5/8] Clixer kullanıcısı ve dizin oluşturuluyor..."
if ! id "$CLIXER_USER" &>/dev/null; then
    useradd -m -s /bin/bash $CLIXER_USER
    usermod -aG docker $CLIXER_USER
fi

mkdir -p $CLIXER_DIR
chown -R $CLIXER_USER:$CLIXER_USER $CLIXER_DIR

# ============================================
# 6. Clixer İndirme
# ============================================
log_info "[6/8] Clixer indiriliyor..."
cd $CLIXER_DIR

if [ -d ".git" ]; then
    log_info "Mevcut kurulum güncelleniyor..."
    sudo -u $CLIXER_USER git pull
else
    sudo -u $CLIXER_USER git clone https://github.com/absadama/clixer_windows.git .
fi

# .env oluştur
if [ ! -f ".env" ]; then
    log_info ".env dosyası oluşturuluyor..."
    
    # Güçlü rastgele şifreler oluştur
    DB_PASS=$(openssl rand -base64 32 | tr -d '/+=' | head -c 32)
    CH_PASS=$(openssl rand -base64 32 | tr -d '/+=' | head -c 32)
    JWT_SEC=$(openssl rand -base64 64 | tr -d '/+=' | head -c 64)
    
    log_info "Güvenli şifreler oluşturuldu (bu şifreleri güvenli bir yerde saklayın!)"
    
    cat > .env << EOF
# ╔═══════════════════════════════════════════════════════════════╗
# ║  CLIXER PRODUCTION ENVIRONMENT                                ║
# ║  Bu dosyadaki şifreler otomatik oluşturulmuştur.              ║
# ║  GÜVENLİ BİR YERDE YEDEKLE!                                   ║
# ╚═══════════════════════════════════════════════════════════════╝

# PostgreSQL
POSTGRES_PASSWORD=${DB_PASS}
DB_HOST=localhost
DB_PORT=5432
DB_NAME=clixer
DB_USER=clixer
DB_PASSWORD=${DB_PASS}
DATABASE_URL=postgresql://clixer:${DB_PASS}@localhost:5432/clixer

# ClickHouse
CLICKHOUSE_HOST=localhost
CLICKHOUSE_PORT=8123
CLICKHOUSE_USER=clixer
CLICKHOUSE_PASSWORD=${CH_PASS}
CLICKHOUSE_URL=http://localhost:8123

# Redis
REDIS_URL=redis://localhost:6379

# JWT (64 karakter güçlü secret)
JWT_SECRET=${JWT_SEC}

# Environment
NODE_ENV=production

# CORS (production domain ekle)
# CORS_ORIGINS=https://analytics.yourdomain.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=200
EOF
    
    chown $CLIXER_USER:$CLIXER_USER .env
    chmod 600 .env
    
    log_warn "ÖNEMLİ: .env dosyasındaki şifreleri güvenli bir yerde yedekleyin!"
    log_info "PostgreSQL şifresi: ${DB_PASS}"
    log_info "ClickHouse şifresi: ${CH_PASS}"
    log_info "JWT Secret: ${JWT_SEC:0:20}..."
fi

# ============================================
# 7. Docker Servisleri Başlat
# ============================================
log_info "[7/8] Docker servisleri başlatılıyor..."

# ClickHouse users.xml dosyasını güncelle (rastgele şifre ile)
log_info "ClickHouse kullanıcı dosyası güncelleniyor..."
cat > $CLIXER_DIR/docker/clickhouse/users.xml << EOF
<?xml version="1.0"?>
<clickhouse>
    <users>
        <!-- Default user (şifresiz - sadece localhost) -->
        <default>
            <password></password>
            <networks><ip>127.0.0.1</ip><ip>::1</ip></networks>
            <profile>default</profile>
            <quota>default</quota>
            <access_management>1</access_management>
        </default>
        
        <!-- Clixer user (şifreli - production) -->
        <clixer>
            <password>${CH_PASS}</password>
            <networks><ip>::/0</ip></networks>
            <profile>default</profile>
            <quota>default</quota>
            <access_management>1</access_management>
        </clixer>
    </users>
</clickhouse>
EOF
chown $CLIXER_USER:$CLIXER_USER $CLIXER_DIR/docker/clickhouse/users.xml

cd $CLIXER_DIR/docker
docker-compose up -d postgres clickhouse redis

log_info "Veritabanlarının hazır olması bekleniyor (30 saniye)..."
sleep 30

# PostgreSQL yedeğini yükle
if [ -f "$CLIXER_DIR/db-backup/postgresql_full.sql" ]; then
    log_info "PostgreSQL yedeği yükleniyor..."
    docker exec -i clixer_postgres psql -U clixer -d clixer < $CLIXER_DIR/db-backup/postgresql_full.sql 2>/dev/null || true
fi

# ============================================
# 8. Node.js Servisleri
# ============================================
log_info "[8/8] Node.js servisleri kuruluyor..."
cd $CLIXER_DIR

# Shared modül
cd shared && npm install --silent && npm run build && cd ..

# Her servis için npm install
for service in gateway services/auth-service services/core-service services/data-service services/analytics-service services/notification-service services/etl-worker frontend; do
    log_info "  → $service"
    cd $CLIXER_DIR/$service
    npm install --silent 2>/dev/null
done

cd $CLIXER_DIR

# ============================================
# Systemd Servisleri Oluştur
# ============================================
log_info "Systemd servisleri oluşturuluyor..."

# Ana servis dosyası
cat > /etc/systemd/system/clixer.service << EOF
[Unit]
Description=Clixer Analytics Platform
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
User=$CLIXER_USER
WorkingDirectory=$CLIXER_DIR
ExecStart=$CLIXER_DIR/scripts/start-all.sh
ExecStop=$CLIXER_DIR/scripts/stop-all.sh

[Install]
WantedBy=multi-user.target
EOF

# PM2 ile başlatma scripti
cat > $CLIXER_DIR/scripts/start-production.sh << 'EOF'
#!/bin/bash
set -e

echo "═══════════════════════════════════════════════════════════════"
echo "   CLIXER - Production Servisleri Başlatılıyor"
echo "═══════════════════════════════════════════════════════════════"

cd /opt/clixer

# .env dosyasını yükle
if [ -f ".env" ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Docker servisleri
echo "[1/4] Docker servisleri başlatılıyor..."
cd docker && docker-compose up -d && cd ..
sleep 10

# PM2 kurulu değilse kur
if ! command -v pm2 &> /dev/null; then
    echo "[2/4] PM2 kuruluyor..."
    npm install -g pm2
fi

# Mevcut PM2 process'lerini temizle
pm2 delete all 2>/dev/null || true

echo "[3/4] Node.js servisleri başlatılıyor..."

# TypeScript için ts-node kullan (development) veya compiled JS (production)
if [ -f "gateway/dist/index.js" ]; then
    # Production - compiled JS
    pm2 start gateway/dist/index.js --name clixer-gateway
    pm2 start services/auth-service/dist/index.js --name clixer-auth
    pm2 start services/core-service/dist/index.js --name clixer-core
    pm2 start services/data-service/dist/index.js --name clixer-data
    pm2 start services/analytics-service/dist/index.js --name clixer-analytics
    pm2 start services/notification-service/dist/index.js --name clixer-notification
    pm2 start services/etl-worker/dist/index.js --name clixer-etl
else
    # Development - ts-node
    pm2 start gateway/src/index.ts --name clixer-gateway --interpreter ./node_modules/.bin/ts-node
    pm2 start services/auth-service/src/index.ts --name clixer-auth --interpreter ./node_modules/.bin/ts-node
    pm2 start services/core-service/src/index.ts --name clixer-core --interpreter ./node_modules/.bin/ts-node
    pm2 start services/data-service/src/index.ts --name clixer-data --interpreter ./node_modules/.bin/ts-node
    pm2 start services/analytics-service/src/index.ts --name clixer-analytics --interpreter ./node_modules/.bin/ts-node
    pm2 start services/notification-service/src/index.ts --name clixer-notification --interpreter ./node_modules/.bin/ts-node
    pm2 start services/etl-worker/src/index.ts --name clixer-etl --interpreter ./node_modules/.bin/ts-node
fi

# Frontend (build ve serve)
echo "[4/4] Frontend başlatılıyor..."
cd frontend
if [ ! -d "dist" ]; then
    npm run build
fi
pm2 serve dist 3000 --name clixer-frontend --spa

# PM2 durumunu kaydet (sunucu restart'ında otomatik başlaması için)
pm2 save

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "   ✅ CLIXER BAŞLATILDI!"
echo "   Durum: pm2 status"
echo "   Loglar: pm2 logs"
echo "═══════════════════════════════════════════════════════════════"
EOF
chmod +x $CLIXER_DIR/scripts/start-production.sh
chown $CLIXER_USER:$CLIXER_USER $CLIXER_DIR/scripts/start-production.sh

# Stop scripti
cat > $CLIXER_DIR/scripts/stop-production.sh << 'EOF'
#!/bin/bash
echo "CLIXER servisleri durduruluyor..."
pm2 stop all
cd /opt/clixer/docker && docker-compose stop
echo "✅ Tüm servisler durduruldu."
EOF
chmod +x $CLIXER_DIR/scripts/stop-production.sh
chown $CLIXER_USER:$CLIXER_USER $CLIXER_DIR/scripts/stop-production.sh

# ============================================
# Nginx Konfigürasyonu
# ============================================
log_info "Nginx yapılandırılıyor..."

cat > /etc/nginx/sites-available/clixer << EOF
server {
    listen 80;
    server_name $DOMAIN;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_cache_bypass \$http_upgrade;
    }

    # API Gateway
    location /api {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_read_timeout 300;
        proxy_connect_timeout 300;
    }

    # WebSocket
    location /socket.io {
        proxy_pass http://localhost:4004;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
EOF

ln -sf /etc/nginx/sites-available/clixer /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# ============================================
# Firewall
# ============================================
log_info "Firewall yapılandırılıyor..."
ufw --force enable
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw reload

# ============================================
# Fail2ban
# ============================================
log_info "Fail2ban yapılandırılıyor..."
systemctl enable fail2ban
systemctl start fail2ban

# ============================================
# PM2 Startup (Sunucu restart'ında otomatik başla)
# ============================================
log_info "PM2 startup yapılandırılıyor..."

# PM2'yi global kur
npm install -g pm2 --silent

# PM2 startup scripti oluştur (systemd ile entegrasyon)
sudo -u $CLIXER_USER bash -c "cd $CLIXER_DIR && pm2 startup systemd -u $CLIXER_USER --hp /home/$CLIXER_USER" 2>/dev/null || true

# Docker'ın da startup'ta başlamasını sağla
systemctl enable docker

log_info "✅ PM2 startup yapılandırıldı. Sunucu restart olduğunda Clixer otomatik başlayacak."

# ============================================
# Tamamlandı
# ============================================
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo -e "   ${GREEN}CLIXER KURULUMU TAMAMLANDI!${NC}"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "   📂 Dizin: $CLIXER_DIR"
echo "   👤 Kullanıcı: $CLIXER_USER"
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo -e "   ${YELLOW}⚠️  ÖNEMLİ: ŞİFRELERİ KAYDEDIN!${NC}"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "   Şifreler .env dosyasında: $CLIXER_DIR/.env"
echo "   Bu dosyayı güvenli bir yerde yedekleyin!"
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "   BAŞLATMA ADIMLARI"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "   1. Servisleri başlat:"
echo "      sudo -u $CLIXER_USER $CLIXER_DIR/scripts/start-production.sh"
echo ""
echo "   2. SSL sertifikası al:"
echo "      sudo apt install certbot python3-certbot-nginx"
echo "      sudo certbot --nginx -d $DOMAIN"
echo ""
echo "   3. Admin şifresini değiştir (UI'dan ilk girişte):"
echo "      URL: http://$DOMAIN"
echo "      Email: admin@clixer"
echo "      Şifre: Admin1234!"
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo -e "   ${GREEN}Kurulum tamamlandı. İyi çalışmalar! 🚀${NC}"
echo "═══════════════════════════════════════════════════════════════"


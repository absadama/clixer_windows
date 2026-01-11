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

# Persistent Uploads Klasörü (WhiteLabel için)
mkdir -p /opt/clixer/uploads
chown -R www-data:www-data /opt/clixer/uploads
chmod 755 /opt/clixer/uploads

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
    cat > .env << 'EOF'
# PostgreSQL
POSTGRES_PASSWORD=clixer_secret_2025
DB_HOST=localhost
DB_PORT=5432
DB_NAME=clixer
DB_USER=clixer
DB_PASSWORD=clixer_secret_2025
DATABASE_URL=postgresql://clixer:clixer_secret_2025@localhost:5432/clixer

# ClickHouse
CLICKHOUSE_HOST=localhost
CLICKHOUSE_PORT=8123
CLICKHOUSE_USER=clixer
CLICKHOUSE_PASSWORD=clixer_click_2025
CLICKHOUSE_URL=http://localhost:8123

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=clixer_jwt_super_secret_2025

# Environment
NODE_ENV=production
EOF
    chown $CLIXER_USER:$CLIXER_USER .env
fi

# ============================================
# 7. Docker Servisleri Başlat
# ============================================
log_info "[7/8] Docker servisleri başlatılıyor..."
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
cd /opt/clixer

# Docker servisleri
cd docker && docker-compose up -d && cd ..

# PM2 ile Node.js servisleri
npm install -g pm2 2>/dev/null

pm2 start gateway/src/index.ts --name clixer-gateway --interpreter ./node_modules/.bin/ts-node
pm2 start services/auth-service/src/index.ts --name clixer-auth --interpreter ./node_modules/.bin/ts-node
pm2 start services/core-service/src/index.ts --name clixer-core --interpreter ./node_modules/.bin/ts-node
pm2 start services/data-service/src/index.ts --name clixer-data --interpreter ./node_modules/.bin/ts-node
pm2 start services/analytics-service/src/index.ts --name clixer-analytics --interpreter ./node_modules/.bin/ts-node
pm2 start services/notification-service/src/index.ts --name clixer-notification --interpreter ./node_modules/.bin/ts-node
pm2 start services/etl-worker/src/index.ts --name clixer-etl --interpreter ./node_modules/.bin/ts-node

# Frontend - HTTPS için .env.production düzelt
cd frontend

# 🔴 KRİTİK: Mixed Content hatası önlemek için /api kullan
echo 'VITE_API_URL=/api' > .env.production

npm run build

# Build doğrulama
HARDCODED_COUNT=$(grep -o "http://[^\"']*:4000" dist/assets/*.js 2>/dev/null | wc -l)
if [ "$HARDCODED_COUNT" -gt 0 ]; then
    echo "⚠️  UYARI: Build'de $HARDCODED_COUNT adet hardcoded URL var!"
    echo "   Mixed Content hatası oluşabilir!"
fi

# Nginx dist klasöründen serve ediyor, PM2'ye gerek yok
# İzinleri ayarla
chown -R www-data:www-data /opt/clixer/frontend/dist
chmod -R 755 /opt/clixer/frontend/dist

pm2 save
EOF
chmod +x $CLIXER_DIR/scripts/start-production.sh
chown $CLIXER_USER:$CLIXER_USER $CLIXER_DIR/scripts/start-production.sh

# ============================================
# Nginx Konfigürasyonu
# ============================================
log_info "Nginx yapılandırılıyor..."

cat > /etc/nginx/sites-available/clixer << EOF
# HTTP -> HTTPS yönlendirme (SSL kurulduktan sonra aktif edin)
# server {
#     listen 80;
#     server_name $DOMAIN;
#     return 301 https://\$host\$request_uri;
# }

server {
    listen 80 default_server;
    # listen 443 ssl http2 default_server;  # SSL için bu satırı açın
    server_name $DOMAIN;

    # SSL ayarları (sertifika kurulduktan sonra açın)
    # ssl_certificate /etc/ssl/certs/certificate.crt;
    # ssl_certificate_key /etc/ssl/private/certificate.key;
    # ssl_protocols TLSv1.2 TLSv1.3;
    # ssl_prefer_server_ciphers on;

    # Sıkıştırma
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    # Frontend - Static dosyalar (Production Build)
    location / {
        root /opt/clixer/frontend/dist;
        index index.html;
        try_files \$uri \$uri/ /index.html;

        # Önbellekleme
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
            expires 30d;
            add_header Cache-Control "public, no-transform";
        }
    }

    # API Gateway
    location /api {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 300;
        proxy_connect_timeout 300;
    }

    # WebSocket
    location /socket.io/ {
        proxy_pass http://localhost:4004;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
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
# Tamamlandı
# ============================================
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo -e "   ${GREEN}CLIXER KURULUMU TAMAMLANDI!${NC}"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "   Dizin: $CLIXER_DIR"
echo "   Kullanıcı: $CLIXER_USER"
echo ""
echo "   Servisleri başlatmak için:"
echo "   sudo -u $CLIXER_USER $CLIXER_DIR/scripts/start-production.sh"
echo ""
echo "   URL: http://$DOMAIN"
echo "   Email: admin@clixer"
echo "   Şifre: Admin1234!"
echo ""
echo "   SSL için (Let's Encrypt):"
echo "   sudo apt install certbot python3-certbot-nginx"
echo "   sudo certbot --nginx -d $DOMAIN"
echo ""
echo "   SSL için (Özel Sertifika - PFX):"
echo "   1. scp C:\\cert.pfx user@server:/tmp/"
echo "   2. openssl pkcs12 -in /tmp/cert.pfx -clcerts -nokeys -out /etc/ssl/certs/certificate.crt"
echo "   3. openssl pkcs12 -in /tmp/cert.pfx -nocerts -nodes -out /etc/ssl/private/certificate.key"
echo "   4. /etc/nginx/sites-available/clixer dosyasında SSL satırlarını açın"
echo "   5. sudo nginx -t && sudo systemctl restart nginx"
echo ""
echo "   🔴 HTTPS Sonrası Build (KRİTİK!):"
echo "   echo 'VITE_API_URL=/api' > /opt/clixer/frontend/.env.production"
echo "   cd /opt/clixer/frontend && npm run build"
echo "   chown -R www-data:www-data /opt/clixer/frontend/dist"
echo ""
echo "═══════════════════════════════════════════════════════════════"


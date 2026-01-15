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

# 🔴 NPM YOLU STANDARTLAŞTIRMA
# Farklı Node.js kurulum yöntemleri (apt, nvm, manual) npm'i farklı yerlere koyar.
# Systemd servisleri /usr/bin/npm kullanır, bu yüzden symlink oluşturuyoruz.
ACTUAL_NPM=$(which npm)
if [ "$ACTUAL_NPM" != "/usr/bin/npm" ]; then
    log_info "NPM yolu standartlaştırılıyor: $ACTUAL_NPM -> /usr/bin/npm"
    ln -sf "$ACTUAL_NPM" /usr/bin/npm
fi
log_info "NPM yolu: $(which npm) -> $(readlink -f $(which npm) 2>/dev/null || which npm)"

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

# Script yetkilerini ayarla
log_info "Script yetkileri ayarlanıyor..."
chmod +x $CLIXER_DIR/scripts/*.sh

# Sudoers yetkisi - clixer kullanıcısı restart scriptini şifresiz çalıştırabilsin (UI'dan restart için)
log_info "Sudoers yapılandırması ekleniyor..."
echo "$CLIXER_USER ALL=(ALL) NOPASSWD: $CLIXER_DIR/scripts/restart-all.sh" > /etc/sudoers.d/clixer
chmod 440 /etc/sudoers.d/clixer

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

# ============================================
# PostgreSQL Şema Kontrolü ve Kurulumu
# ============================================
log_info "PostgreSQL şema kontrolü yapılıyor..."

# tenants tablosu var mı kontrol et (init-scripts çalışmış mı?)
TABLES_EXIST=$(docker exec clixer_postgres psql -U clixer -d clixer -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tenants';" 2>/dev/null | tr -d ' ')

if [ "$TABLES_EXIST" != "1" ]; then
    log_warn "Tablolar bulunamadı! Init scripts çalışmamış olabilir."
    log_info "PostgreSQL şeması manuel olarak yükleniyor..."
    
    # Ana şema dosyası
    if [ -f "$CLIXER_DIR/docker/init-scripts/postgres/00-schema-and-seed.sql" ]; then
        log_info "  → 00-schema-and-seed.sql yükleniyor..."
        docker exec -i clixer_postgres psql -U clixer -d clixer < "$CLIXER_DIR/docker/init-scripts/postgres/00-schema-and-seed.sql" 2>&1 || {
            log_error "Ana şema yüklenemedi! BOM encoding sorunu olabilir."
            log_info "Lütfen Windows'ta scripts/fix-bom.ps1 çalıştırın ve tekrar deneyin."
        }
    fi
    
    # Labels tablosu
    if [ -f "$CLIXER_DIR/docker/init-scripts/postgres/07-labels.sql" ]; then
        log_info "  → 07-labels.sql yükleniyor..."
        docker exec -i clixer_postgres psql -U clixer -d clixer < "$CLIXER_DIR/docker/init-scripts/postgres/07-labels.sql" 2>&1 || true
    fi
    
    # Grid designs tablosu
    if [ -f "$CLIXER_DIR/docker/init-scripts/postgres/08-grid-designs.sql" ]; then
        log_info "  → 08-grid-designs.sql yükleniyor..."
        docker exec -i clixer_postgres psql -U clixer -d clixer < "$CLIXER_DIR/docker/init-scripts/postgres/08-grid-designs.sql" 2>&1 || true
    fi
    
    # Diğer init scriptleri (varsa)
    for script in "$CLIXER_DIR/docker/init-scripts/postgres/"*.sql; do
        BASENAME=$(basename "$script")
        if [[ "$BASENAME" != "00-schema-and-seed.sql" && "$BASENAME" != "07-labels.sql" && "$BASENAME" != "08-grid-designs.sql" ]]; then
            log_info "  → $BASENAME yükleniyor..."
            docker exec -i clixer_postgres psql -U clixer -d clixer < "$script" 2>&1 || true
        fi
    done
    
    # Şema kontrolü tekrar
    TABLES_AFTER=$(docker exec clixer_postgres psql -U clixer -d clixer -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | tr -d ' ')
    log_info "Oluşturulan tablo sayısı: $TABLES_AFTER"
else
    log_info "PostgreSQL şeması zaten mevcut. (tenants tablosu bulundu)"
fi

# ============================================
# Şema Doğrulama (Kritik Tablolar)
# ============================================
log_info "Kritik tabloları doğrulama..."

CRITICAL_TABLES="tenants users positions regions stores system_settings metrics designs data_connections datasets etl_jobs etl_schedules labels grid_designs design_widgets menu_permissions ldap_config"

MISSING_TABLES=""
for table in $CRITICAL_TABLES; do
    EXISTS=$(docker exec clixer_postgres psql -U clixer -d clixer -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '$table';" 2>/dev/null | tr -d ' ')
    if [ "$EXISTS" != "1" ]; then
        MISSING_TABLES="$MISSING_TABLES $table"
    fi
done

if [ -n "$MISSING_TABLES" ]; then
    log_error "Eksik tablolar var:$MISSING_TABLES"
    log_error "Kurulum tam değil! Lütfen manuel olarak tabloları oluşturun."
else
    log_info "✓ Tüm kritik tablolar mevcut."
fi

# ⚠️ NOT: db-backup/postgresql_full.sql dosyası eski müşteri verilerini içerebilir.
# Yeni kurulumda kullanılMAMALI! Init scripts temiz şema oluşturur.

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

    # Uploads - Persistent Logo Storage (WhiteLabel)
    # ^~ prefix ile regex location'lardan önce eşleşir
    location ^~ /uploads/ {
        alias /opt/clixer/uploads/;
        expires 30d;
        add_header Cache-Control "public, no-transform";
        add_header Access-Control-Allow-Origin "*";
    }

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


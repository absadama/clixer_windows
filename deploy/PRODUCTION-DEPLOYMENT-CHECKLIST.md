# Clixer Production Deployment Checklist
# Versiyon: 4.36+ (26 Ocak 2026)

Bu döküman, Clixer'ı production ortamına deploy ederken veya mevcut bir kurulumu güncellerken yapılması gereken tüm adımları içerir.

---

## Ön Gereksinimler

- Ubuntu 22.04+ sunucu
- Docker & Docker Compose kurulu
- Node.js 18+ kurulu
- Nginx kurulu
- SSL sertifikası hazır

---

## 1. Kod Güncelleme

```bash
cd /opt/clixer
sudo git fetch origin
sudo git pull origin master
```

---

## 2. Shared Module Build

```bash
cd /opt/clixer/shared
sudo npm install
sudo npm run build
cd ..
```

---

## 3. Gateway'e pg Paketi Kurulumu

**ÖNEMLİ:** Gateway, IP whitelist için doğrudan PostgreSQL'e bağlanır.

```bash
cd /opt/clixer/gateway
sudo npm install pg
cd ..
```

---

## 4. Environment Dosyası Kontrolü

`/opt/clixer/.env` dosyasında şunlar olmalı:

```bash
# Minimum gerekli değişkenler
NODE_ENV=production
CORS_ORIGIN=https://YOUR_DOMAIN.com  # * OLMAMALI!

# JWT - EN AZ 32 KARAKTER!
JWT_SECRET=your_super_secret_jwt_key_at_least_32_chars

# Encryption Key (şifreli bağlantı credential'ları için)
ENCRYPTION_KEY=<openssl rand -hex 32 ile üret>

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=clixer
DB_USER=clixer
DB_PASSWORD=your_db_password

# ClickHouse
CLICKHOUSE_HOST=localhost
CLICKHOUSE_PORT=8123
CLICKHOUSE_USER=clixer
CLICKHOUSE_PASSWORD=your_clickhouse_password

# Redis
REDIS_URL=redis://localhost:6379
```

**ENCRYPTION_KEY üretmek için:**
```bash
openssl rand -hex 32
```

---

## 5. Systemd Service Dosyalarına EnvironmentFile Ekleme

**KRİTİK:** Tüm servis dosyalarına `.env` dosyasını yükleyen satır eklenmeli.

```bash
# Otomatik ekleme (tüm servislere)
for f in /etc/systemd/system/clixer-*.service; do
  sudo grep -q "EnvironmentFile" "$f" || sudo sed -i '/WorkingDirectory=/a EnvironmentFile=/opt/clixer/.env' "$f"
done

# Doğrula
grep "EnvironmentFile" /etc/systemd/system/clixer-*.service

# Systemd'yi yeniden yükle
sudo systemctl daemon-reload
```

---

## 6. Database Migration'ları

### 6.1 Users Tablosu Güncellemeleri

```bash
docker exec clixer_postgres psql -U clixer -d clixer -c "
-- Yeni kolonlar
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_see_all_categories BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS filter_level VARCHAR(50) DEFAULT 'store';
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_active BOOLEAN DEFAULT true;

-- Index
CREATE INDEX IF NOT EXISTS idx_users_phone_number ON users(phone_number) WHERE phone_number IS NOT NULL;
"
```

### 6.2 Report Categories Tablosu

```bash
docker exec clixer_postgres psql -U clixer -d clixer -c "
-- Tablo oluştur
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

-- Index'ler
CREATE INDEX IF NOT EXISTS idx_report_categories_tenant ON report_categories(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_report_categories_code ON report_categories(tenant_id, code);
"
```

### 6.3 User Report Categories Tablosu

```bash
docker exec clixer_postgres psql -U clixer -d clixer -c "
-- Tablo oluştur
CREATE TABLE IF NOT EXISTS user_report_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES report_categories(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES users(id),
    assigned_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, category_id)
);

-- Index'ler
CREATE INDEX IF NOT EXISTS idx_user_report_categories_user ON user_report_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_user_report_categories_category ON user_report_categories(category_id);
"
```

### 6.4 Navigation Items Tablosu

```bash
docker exec clixer_postgres psql -U clixer -d clixer < /opt/clixer/docker/init-scripts/postgres/migrations/20260125_navigation_items.sql
docker exec clixer_postgres psql -U clixer -d clixer < /opt/clixer/docker/init-scripts/postgres/migrations/20260125_navigation_seed.sql
```

---

## 7. Frontend Build

```bash
cd /opt/clixer/frontend
sudo npm install
sudo npm install --save-dev @types/node  # ErrorBoundary için gerekli
sudo npm run build
cd ..
```

---

## 8. Servisleri Başlatma/Yeniden Başlatma

```bash
sudo systemctl restart clixer-auth clixer-core clixer-data clixer-analytics clixer-etl-worker clixer-notification clixer-gateway

# 10 saniye bekle
sleep 10

# Durumu kontrol et
systemctl status clixer-* --no-pager | grep -E "●|Active:"
```

---

## 9. Firewall Ayarları

```bash
# Gereksiz portları kapat
sudo ufw delete allow 4000/tcp 2>/dev/null
sudo ufw delete allow 3000/tcp 2>/dev/null
sudo ufw reload

# Sadece bunlar açık olmalı: 22, 80, 443
sudo ufw status
```

---

## 10. Health Check

```bash
echo "Gateway:" && curl -s http://localhost:4000/health
echo "Auth:" && curl -s http://localhost:4001/health
echo "Core:" && curl -s http://localhost:4002/health
echo "Data:" && curl -s http://localhost:4003/health
echo "Analytics:" && curl -s http://localhost:4005/health
```

---

## 11. SSL Sertifikası Kontrolü

```bash
# Sertifika geçerlilik tarihi
sudo openssl x509 -in /etc/ssl/certs/YOUR_CERT.crt -noout -dates

# Nginx config testi
sudo nginx -t
```

---

## 12. Final Güvenlik Kontrolü

```bash
# CORS
grep CORS_ORIGIN /opt/clixer/.env

# NODE_ENV
grep NODE_ENV /opt/clixer/.env

# Firewall
sudo ufw status | grep -E "22|80|443|4000"

# JWT_SECRET uzunluğu (32+ karakter olmalı)
grep JWT_SECRET /opt/clixer/.env | awk -F= '{print length($2)}'
```

---

## Sorun Giderme

### "JWT_SECRET must be at least 32 characters"
- `.env` dosyasında `JWT_SECRET` en az 32 karakter olmalı

### "IP_NOT_ALLOWED" hatası
- Gateway'e `pg` paketi kurulmuş mu kontrol et
- Systemd service dosyasında `EnvironmentFile` var mı kontrol et
- `admin_ip_whitelist` ayarı `["*"]` mı kontrol et

### "column X does not exist" hataları
- İlgili migration script'ini çalıştır

### MSSQL/External DB bağlantı hatası
- `ENCRYPTION_KEY` değiştiyse, bağlantı şifrelerini yeniden gir

---

## Versiyon Notları

**v4.36 (26 Ocak 2026):**
- 2FA sistemi
- IP Whitelist güvenliği
- SSRF koruması
- Smart Search (Navigation Items)
- Report Categories
- Phone Security Layer

# CLIXER - Production Deployment Guide

## 🚀 Hızlı Kurulum (Ubuntu 22.04+)

### SSH ile Sunucuya Bağlan

```bash
ssh root@SUNUCU_IP
```

### Tek Komutla Kurulum

```bash
curl -fsSL https://raw.githubusercontent.com/absadama/clixer_windows/main/deploy/install-ubuntu.sh | sudo bash
```

### veya Manuel Kurulum

```bash
# 1. Scripti indir
wget https://raw.githubusercontent.com/absadama/clixer_windows/main/deploy/install-ubuntu.sh

# 2. Domain ayarla (opsiyonel)
export DOMAIN="analytics.sirketiniz.com"

# 3. Çalıştır
sudo bash install-ubuntu.sh
```

---

## 📋 Kurulum Sonrası

### Servisleri Başlat

```bash
sudo -u clixer /opt/clixer/scripts/start-production.sh
```

### Durumu Kontrol Et

```bash
pm2 status
docker ps
```

### Logları İzle

```bash
pm2 logs
```

---

## 🔒 SSL Sertifikası

### Seçenek 1: Let's Encrypt (Ücretsiz, Domain Gerekli)

```bash
# Certbot kur
sudo apt install certbot python3-certbot-nginx -y

# SSL al (domain DNS ayarlı olmalı)
sudo certbot --nginx -d analytics.sirketiniz.com

# Otomatik yenileme test
sudo certbot renew --dry-run
```

### Seçenek 2: Özel Sertifika (PFX dosyasından)

```bash
# 1. PFX dosyasını sunucuya kopyala (Windows'tan)
scp C:\cert.pfx kullanici@SUNUCU_IP:/tmp/

# 2. PFX'ten CRT ve KEY çıkar
cd /tmp
sudo openssl pkcs12 -in cert.pfx -clcerts -nokeys -out /etc/ssl/certs/certificate.crt
sudo openssl pkcs12 -in cert.pfx -nocerts -nodes -out /etc/ssl/private/certificate.key

# 3. İzinleri ayarla
sudo chmod 600 /etc/ssl/private/certificate.key
sudo chmod 644 /etc/ssl/certs/certificate.crt

# 4. Nginx'i yeniden başlat
sudo nginx -t && sudo systemctl restart nginx
```

---

## 🔴🔴🔴 HTTPS İÇİN KRİTİK ADIM: Frontend .env.production

**MUTLAKA** production build öncesi `.env.production` dosyasını kontrol edin!

### Problem
Vite, build sırasında `.env.production` dosyasındaki `VITE_API_URL` değerini JavaScript'e hardcode eder. Eğer bu değer `http://IP:4000/api` ise, HTTPS sayfasında **"Mixed Content"** hatası oluşur ve uygulama ÇALIŞMAZ!

### Çözüm

```bash
# .env.production dosyasını düzelt
echo 'VITE_API_URL=/api' | sudo tee /opt/clixer/frontend/.env.production

# Yeniden build al
cd /opt/clixer/frontend
sudo rm -rf dist node_modules/.vite
sudo npm run build

# DOĞRULAMA (0 dönmeli!)
grep -o "http://[^\"']*:4000" /opt/clixer/frontend/dist/assets/*.js | wc -l

# İzinler
sudo chown -R www-data:www-data /opt/clixer/frontend/dist
sudo chmod -R 755 /opt/clixer/frontend/dist
sudo systemctl restart nginx
```

### Nginx HTTPS Yapılandırması

`/etc/nginx/sites-available/default` dosyası:

```nginx
server {
    listen 80 default_server;
    server_name _;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2 default_server;
    server_name _;

    ssl_certificate /etc/ssl/certs/certificate.crt;
    ssl_certificate_key /etc/ssl/private/certificate.key;
    ssl_protocols TLSv1.2 TLSv1.3;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript;

    location / {
        root /opt/clixer/frontend/dist;
        index index.html;
        try_files $uri $uri/ /index.html;

        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
            expires 30d;
            add_header Cache-Control "public, no-transform";
        }
    }

    location /api {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /socket.io/ {
        proxy_pass http://localhost:4004;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }

    # WhiteLabel Logo Uploads (v4.20+)
    location /uploads/ {
        alias /opt/clixer/frontend/dist/uploads/;
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }
}
```

---

## 🔧 Yapılandırma

### Environment Değişkenleri

`/opt/clixer/.env` dosyasını düzenleyin:

```bash
sudo nano /opt/clixer/.env
```

### Nginx Ayarları

```bash
sudo nano /etc/nginx/sites-available/clixer
sudo nginx -t
sudo systemctl reload nginx
```

---

## 📊 Sistem Gereksinimleri

| Kaynak | Minimum | Önerilen |
|--------|---------|----------|
| CPU | 2 core | 4+ core |
| RAM | 4 GB | 8+ GB |
| Disk | 20 GB | 50+ GB SSD |
| OS | Ubuntu 20.04+ | Ubuntu 22.04 LTS |

---

## 🔥 Firewall Kuralları

Kurulum scripti otomatik ayarlar:

| Port | Servis | Durum |
|------|--------|-------|
| 22 | SSH | ✅ Açık |
| 80 | HTTP | ✅ Açık |
| 443 | HTTPS | ✅ Açık |
| 3000 | Frontend | 🔒 Sadece localhost |
| 4000-4005 | Backend | 🔒 Sadece localhost |
| 5432 | PostgreSQL | 🔒 Sadece localhost |
| 8123 | ClickHouse | 🔒 Sadece localhost |
| 6379 | Redis | 🔒 Sadece localhost |

---

## 🔄 Güncelleme

```bash
cd /opt/clixer
sudo -u clixer git pull
sudo -u clixer npm install --prefix shared
sudo -u clixer npm run build --prefix shared
pm2 restart all
```

---

## 🎨 WhiteLabel Logo Yönetimi (v4.20+)

Müşteriler kendi logolarını UI üzerinden yükleyebilir. Logo otomatik olarak sidebar, PWA, favicon ve login sayfasında görünür.

### Güncelleme Scripti

Mevcut kurulumu WhiteLabel özelliğiyle güncellemek için:

```bash
sudo bash /opt/clixer/deploy/update-whitelabel.sh
```

Bu script:
1. Yedek alır
2. GitHub'dan en son kodu çeker
3. Core service bağımlılıklarını kurar (multer, sharp)
4. Uploads klasörünü oluşturur
5. Servisleri yeniden başlatır
6. Frontend build alır

### Nginx Ayarı (Tek Seferlik)

Script çalıştıktan sonra Nginx'e uploads location ekleyin:

```bash
sudo nano /etc/nginx/sites-available/default
```

Server bloğuna ekleyin:

```nginx
# WhiteLabel Logo Uploads
location /uploads/ {
    alias /opt/clixer/frontend/dist/uploads/;
    expires 30d;
    add_header Cache-Control "public, no-transform";
}
```

Nginx'i yeniden başlatın:

```bash
sudo nginx -t && sudo systemctl restart nginx
```

### Logo Yükleme

1. Admin Panel → Sistem Ayarları → Marka Logosu
2. PNG veya SVG dosyası yükleyin (min 512x512 piksel)
3. Logo otomatik olarak tüm alanlarda görünür:
   - Sidebar logo
   - PWA/Mobil ikon
   - Favicon
   - Login sayfası

### Logo Gereksinimleri

| Kural | Değer |
|-------|-------|
| Format | PNG veya SVG |
| Minimum boyut | 512x512 piksel |
| Maksimum dosya | 5 MB |
| Arka plan | Şeffaf (hem açık hem koyu temada çalışır) |

### Otomatik Oluşturulan Boyutlar

| Dosya | Boyut | Kullanım |
|-------|-------|----------|
| logo-512.png | 512x512 | PWA büyük ikon |
| logo-192.png | 192x192 | PWA küçük ikon, Apple Touch |
| logo-96.png | 96x96 | Alternatif |
| logo-72.png | 72x72 | Mobil |
| logo-32.png | 32x32 | Favicon |

---

## 🛟 Sorun Giderme

### Port Kontrolü

```bash
netstat -tlnp | grep -E '(3000|4000|4001|4002|4003|4004|4005)'
```

### Docker Durumu

```bash
docker ps
docker logs clixer_postgres
docker logs clixer_clickhouse
docker logs clixer_redis
```

### PM2 Logları

```bash
pm2 logs clixer-gateway --lines 100
pm2 logs clixer-auth --lines 100
```

### Servisleri Yeniden Başlat

```bash
pm2 restart all
# veya
pm2 delete all && /opt/clixer/scripts/start-production.sh
```

---

## 📞 Destek

- **Email**: support@clixer.com
- **Dökümentasyon**: https://docs.clixer.com


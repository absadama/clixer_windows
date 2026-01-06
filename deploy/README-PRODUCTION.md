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


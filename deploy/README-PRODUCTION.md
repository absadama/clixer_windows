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

## 🔒 SSL Sertifikası (Let's Encrypt)

```bash
# Certbot kur
sudo apt install certbot python3-certbot-nginx -y

# SSL al (domain DNS ayarlı olmalı)
sudo certbot --nginx -d analytics.sirketiniz.com

# Otomatik yenileme test
sudo certbot renew --dry-run
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


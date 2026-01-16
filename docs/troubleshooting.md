# CLİXER - Hata Çözümleri ve Debugging

Bu dosya yaygın hatalar ve çözümlerini içerir.

---

## Servis Hataları

### 502 Bad Gateway
**Sebep:** Backend servisleri çalışmıyor veya başlangıç aşamasında.

**Çözüm:**
```bash
# Servislerin durumunu kontrol et
sudo systemctl status clixer-gateway clixer-core clixer-data

# Servis loglarını kontrol et
sudo journalctl -u clixer-data -n 50

# Servisleri restart et
sudo /opt/clixer/scripts/restart-all.sh

# 20-30 saniye bekle (ts-node-dev başlangıç süresi)
sleep 30 && curl http://localhost:4000/health
```

### Port Already in Use (EADDRINUSE)
**Sebep:** Önceki process düzgün kapanmamış.

**Çözüm:**
```bash
# Portu kullanan process'i bul ve öldür
sudo fuser -k 4002/tcp

# Veya tüm portları temizle
for port in 4000 4001 4002 4003 4004 4005 3000; do
    sudo fuser -k $port/tcp 2>/dev/null
done

# Servisleri restart et
sudo /opt/clixer/scripts/restart-all.sh
```

### Service Degraded (database: error, clickhouse: error)
**Sebep:** Docker container'ları çalışmıyor.

**Çözüm:**
```bash
# Docker container durumunu kontrol et
docker ps

# Container'ları başlat
cd /opt/clixer/docker && docker-compose up -d postgres clickhouse redis

# 15-20 saniye bekle
sleep 20 && curl http://localhost:4003/health
```

### npm ENOENT / spawn npm ENOENT
**Sebep:** npm farklı yolda kurulu, systemd `/usr/bin/npm` arıyor.

**Çözüm:**
```bash
# npm yolunu kontrol et
which npm

# Symlink oluştur
sudo ln -sf $(which npm) /usr/bin/npm

# Veya setup-services.sh çalıştır (otomatik yapar)
sudo /opt/clixer/scripts/setup-services.sh
```

---

## Frontend Hataları

### Mixed Content Error
**Sebep:** HTTPS sitede HTTP API çağrısı yapılıyor.

**Çözüm:**
```bash
# .env.production dosyasını kontrol et
cat /opt/clixer/frontend/.env.production
# VITE_API_URL=/api olmalı!

# Yeniden build al
cd /opt/clixer/frontend
sudo rm -rf dist
echo 'VITE_API_URL=/api' > .env.production
sudo npm run build
sudo chown -R www-data:www-data dist
sudo systemctl restart nginx
```

### Hardcoded URL Sorunu
**Sebep:** Build'de localhost:4000 kalmış.

**Çözüm:**
```bash
# Kontrol et
grep -o "http://[^\"']*:4000" /opt/clixer/frontend/dist/assets/*.js | wc -l
# 0 dönmeli!

# Yeniden build
cd /opt/clixer/frontend
sudo rm -rf dist
echo 'VITE_API_URL=/api' > .env.production
sudo npm run build
```

### Sayfa Güncellenmiyor (Cache)
**Çözüm:**
1. Tarayıcıda Ctrl+Shift+R (hard refresh)
2. DevTools > Application > Storage > Clear site data

---

## Veritabanı Hataları

### PostgreSQL Bağlantı Hatası
```bash
# Container durumunu kontrol et
docker ps | grep postgres

# Container loglarını kontrol et
docker logs clixer_postgres

# Container'ı restart et
docker restart clixer_postgres
```

### ClickHouse Bağlantı Hatası
```bash
# Container durumunu kontrol et
docker ps | grep clickhouse

# Health check
curl http://localhost:8123/ping

# Container'ı restart et
docker restart clixer_clickhouse
```

### Tablolar Eksik (PostgreSQL)
```bash
# Tabloları kontrol et
docker exec clixer_postgres psql -U clixer -d clixer -c "\dt"

# Manuel şema yükle
docker exec -i clixer_postgres psql -U clixer -d clixer < /opt/clixer/docker/init-scripts/postgres/00-schema-and-seed.sql
```

---

## Git Hataları

### Dubious Ownership
**Sebep:** Farklı kullanıcı ile clone edilmiş.

**Çözüm:**
```bash
sudo git config --global --add safe.directory /opt/clixer
```

### Push Başarısız
```bash
# Durumu kontrol et
git status

# Origin'i kontrol et
git remote -v

# Force pull (dikkatli!)
sudo git fetch origin && sudo git reset --hard origin/master
```

---

## Nginx Hataları

### 404 Not Found
**Sebep:** Static dosyalar yok veya yanlış path.

**Çözüm:**
```bash
# dist klasörünü kontrol et
ls -la /opt/clixer/frontend/dist/

# Nginx config'i test et
sudo nginx -t

# Nginx'i restart et
sudo systemctl restart nginx
```

### Permission Denied
```bash
# İzinleri düzelt
sudo chown -R www-data:www-data /opt/clixer/frontend/dist
sudo chmod -R 755 /opt/clixer/frontend/dist
```

---

## Systemd Hataları

### Service Failed to Start
```bash
# Detaylı hata mesajını gör
sudo journalctl -u clixer-gateway -n 100 --no-pager

# Service dosyasını kontrol et
cat /etc/systemd/system/clixer-gateway.service
```

### Process Remains Running After Stop
**Sebep:** Child process'ler düzgün kapanmamış.

**Çözüm:** Service dosyasında `KillMode=mixed` olmalı.

```bash
# Tüm node process'lerini öldür
pkill -9 -f "node.*/services/"
pkill -9 -f "node.*/gateway/"
pkill -9 -f "ts-node-dev"

# Servisleri restart et
sudo /opt/clixer/scripts/restart-all.sh
```

---

## PowerShell Hataları (Windows)

### $pid Çakışması
**Sebep:** PowerShell'de $pid rezerve değişken.

**Çözüm:** Kod içinde `$foundPid` kullan, `$pid` değil.

### && Operatör Hatası
**Sebep:** Eski PowerShell versiyonu.

**Çözüm:** `;` kullan veya ayrı satırlarda çalıştır.

---

## Restart Sistemi Hataları

### 502 on Restart Button Click
**Sebep:** Backend kapanırken response gönderemedi.

**Çözüm:** Bu normaldir, 30-60 saniye bekle ve sayfayı yenile.

### Restart Yarıda Kalıyor
**Sebep:** `at` komutu yüklü değil.

**Çözüm:**
```bash
sudo apt install at
sudo systemctl enable --now atd
```

---

## Debug Komutları

### Genel Sağlık Kontrolü
```bash
# Tüm servisleri kontrol et
curl http://localhost:4000/health
curl http://localhost:4001/health
curl http://localhost:4002/health
curl http://localhost:4003/health
curl http://localhost:4004/health
curl http://localhost:4005/health

# Docker container'ları kontrol et
docker ps

# Systemd servisleri kontrol et
sudo systemctl status clixer-* --no-pager
```

### Log Okuma
```bash
# Gateway log
tail -100 /opt/clixer/logs/gateway.log

# Data service error log
tail -100 /opt/clixer/logs/data-error.log

# Systemd journal
sudo journalctl -u clixer-data -f
```

### Port Kontrolü
```bash
ss -tlnp | grep -E "3000|4000|4001|4002|4003|4004|4005"
```

---

## Sık Karşılaşılan Senaryolar

### Sunucu Restart Sonrası Çalışmıyor
```bash
# Docker container'ları başlat
cd /opt/clixer/docker && docker-compose up -d postgres clickhouse redis

# 30 saniye bekle
sleep 30

# Servisleri başlat (systemd enabled ise otomatik başlar)
sudo /opt/clixer/scripts/restart-all.sh
```

### Git Pull Sonrası Çalışmıyor
```bash
# Scriptlere çalıştırma izni ver
sudo chmod +x /opt/clixer/scripts/*.sh

# Setup-services çalıştır (npm symlink + systemd güncelleme)
sudo /opt/clixer/scripts/setup-services.sh

# Restart
sudo /opt/clixer/scripts/restart-all.sh
```

### UI Değişikliği Görünmüyor
```bash
# Frontend build al
cd /opt/clixer/frontend
sudo rm -rf dist
sudo npm run build
sudo chown -R www-data:www-data dist
sudo systemctl restart nginx

# Tarayıcıda Ctrl+Shift+R
```

---

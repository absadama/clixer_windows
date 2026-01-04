# Deploy Checker Agent

## Görev
Production deployment öncesi tüm kontrolleri yap.

## Çalıştırma
```
claude "Production deploy kontrolü yap"
```

## Pre-Deployment Checklist

### 1. Kod Kontrolleri
```bash
# TypeScript hataları
cd frontend && npx tsc --noEmit
cd ../services/auth-service && npx tsc --noEmit
cd ../core-service && npx tsc --noEmit
cd ../data-service && npx tsc --noEmit
cd ../analytics-service && npx tsc --noEmit

# ESLint (varsa)
npm run lint
```

### 2. Build Testi
```bash
# Frontend build
cd frontend && npm run build

# Build başarılı olmalı, hata vermemeli
```

### 3. Environment Kontrolleri
```bash
# .env dosyası var mı?
test -f .env && echo "OK" || echo "EKSIK!"

# Gerekli değişkenler tanımlı mı?
grep -q "POSTGRES_PASSWORD" .env && echo "PostgreSQL OK"
grep -q "CLICKHOUSE_PASSWORD" .env && echo "ClickHouse OK"
grep -q "JWT_SECRET" .env && echo "JWT OK"
grep -q "REDIS_URL" .env && echo "Redis OK"
```

### 4. Docker Kontrolleri
```bash
# Docker çalışıyor mu?
docker info > /dev/null 2>&1 && echo "Docker OK"

# Compose dosyası geçerli mi?
docker-compose -f docker/docker-compose.yml config > /dev/null && echo "Compose OK"

# İmajlar güncel mi?
docker-compose -f docker/docker-compose.yml pull
```

### 5. Veritabanı Kontrolleri
```bash
# PostgreSQL dump mevcut mu?
test -f db-backup/postgresql_full.sql && echo "DB Backup OK"

# Dump boyutu makul mü? (en az 100KB)
size=$(stat -f%z db-backup/postgresql_full.sql 2>/dev/null || stat -c%s db-backup/postgresql_full.sql)
[ $size -gt 100000 ] && echo "Backup size OK: $size bytes"
```

### 6. Git Kontrolleri
```bash
# Commit edilmemiş değişiklik var mı?
git status --porcelain

# Hangi branch'tayız?
git branch --show-current

# Son commit
git log -1 --oneline
```

### 7. Port Kontrolleri (Hedef Sunucu)
```bash
# Portlar boş mu?
for port in 3000 4000 4001 4002 4003 4004 4005 5432 8123 6379; do
  nc -z localhost $port 2>/dev/null && echo "Port $port KULLANIMDA!" || echo "Port $port OK"
done
```

## Deployment Özet Raporu

```
╔══════════════════════════════════════════════════════════════╗
║                 CLIXER DEPLOYMENT RAPORU                     ║
╠══════════════════════════════════════════════════════════════╣
║ Tarih:        [TARIH]                                        ║
║ Versiyon:     [VERSION]                                      ║
║ Branch:       [BRANCH]                                       ║
║ Commit:       [COMMIT]                                       ║
╠══════════════════════════════════════════════════════════════╣
║ TypeScript:   ✅ / ❌                                        ║
║ Build:        ✅ / ❌                                        ║
║ Environment:  ✅ / ❌                                        ║
║ Docker:       ✅ / ❌                                        ║
║ Database:     ✅ / ❌                                        ║
║ Git:          ✅ / ❌                                        ║
╠══════════════════════════════════════════════════════════════╣
║ SONUÇ:        DEPLOY EDİLEBİLİR / SORUNLAR VAR               ║
╚══════════════════════════════════════════════════════════════╝
```

## Deployment Komutu (Tüm kontroller geçtiyse)

### Ubuntu Sunucu
```bash
ssh root@SUNUCU_IP
curl -fsSL https://raw.githubusercontent.com/absadama/clixer_windows/main/deploy/install-ubuntu.sh | sudo bash
```

### Güncelleme (Mevcut kurulum)
```bash
cd /opt/clixer
git pull
pm2 restart all
```


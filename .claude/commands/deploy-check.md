# /deploy-check - Production Deploy Kontrolü

Production'a deploy etmeden önce tüm kontrolleri çalıştır.

## Kontrol Adımları

### 1. API Testleri
```bash
# Tüm servisler çalışıyor mu?
curl -sf http://localhost:4000/health || echo "Gateway FAIL"
curl -sf http://localhost:4001/health || echo "Auth FAIL"
curl -sf http://localhost:4002/health || echo "Core FAIL"
curl -sf http://localhost:4003/health || echo "Data FAIL"
curl -sf http://localhost:4004/health || echo "Notification FAIL"
curl -sf http://localhost:4005/health || echo "Analytics FAIL"

# Login testi
curl -sf -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@clixer","password":"Admin1234!"}' || echo "Login FAIL"
```

### 2. Veritabanı Sağlığı
```bash
docker exec clixer_postgres pg_isready -U clixer
docker exec clixer_clickhouse clickhouse-client --user clixer --password clixer_click_2025 --query "SELECT 1"
docker exec clixer_redis redis-cli ping
```

### 3. Güvenlik Kontrolü
```bash
# .env gitignore'da mı?
grep -q ".env" .gitignore && echo ".env OK" || echo ".env MISSING in gitignore!"

# Hardcoded password var mı?
grep -r "password.*=" --include="*.ts" --include="*.tsx" | grep -v ".env" | grep -v "password:" | head -5
```

### 4. Production Dosyaları
```bash
test -f deploy/install-ubuntu.sh && echo "install-ubuntu.sh OK" || echo "MISSING!"
test -f deploy/README-PRODUCTION.md && echo "README-PRODUCTION.md OK" || echo "MISSING!"
test -f db-backup/postgresql_full.sql && echo "postgresql_full.sql OK" || echo "MISSING!"
```

### 5. Build Kontrolü
```bash
cd shared && npm run build
cd ../frontend && npm run build
```

### 6. Git Durumu
```bash
git status --porcelain
# Boş dönmeli!
```

## Başarı Kriterleri

✅ Tüm kontroller geçerse → DEPLOY EDİLEBİLİR
❌ Herhangi biri başarısızsa → DEPLOY YAPMA!


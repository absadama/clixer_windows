# Verify App Agent

## Görev
Uygulamanın uçtan uca (E2E) çalıştığını doğrula.

## Çalıştırma
```
claude "Uygulamayı doğrula"
```

## Doğrulama Adımları

### 1. Servislerin Çalıştığını Doğrula
```bash
# Tüm portları kontrol et
for port in 3000 4000 4001 4002 4003 4004 4005; do
  curl -s -o /dev/null -w "%{http_code}" http://localhost:$port/health 2>/dev/null || echo "Port $port: DOWN"
done
```

**Beklenen:** Tüm portlar yanıt vermeli

### 2. Login Akışı
```bash
# 1. Login
TOKEN=$(curl -s -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@clixer","password":"Admin1234!"}' | jq -r '.data.accessToken')

echo "Token: ${TOKEN:0:20}..."

# 2. Token doğrulama
curl -s http://localhost:4000/api/auth/me \
  -H "Authorization: Bearer $TOKEN" | jq '.data.email'
```

**Beklenen:** Token alınmalı ve `admin@clixer` dönmeli

### 3. CRUD İşlemleri
```bash
# Kullanıcıları listele
curl -s http://localhost:4000/api/users \
  -H "Authorization: Bearer $TOKEN" | jq '.data | length'

# Tasarımları listele
curl -s http://localhost:4000/api/designs \
  -H "Authorization: Bearer $TOKEN" | jq '.data | length'

# Ayarları al
curl -s http://localhost:4000/api/settings \
  -H "Authorization: Bearer $TOKEN" | jq '.data | length'
```

### 4. Veri Bağlantıları
```bash
# Bağlantıları listele
curl -s http://localhost:4000/api/connections \
  -H "Authorization: Bearer $TOKEN" | jq '.data | length'

# Dataset'leri listele
curl -s http://localhost:4000/api/datasets \
  -H "Authorization: Bearer $TOKEN" | jq '.data | length'
```

### 5. Metrikler
```bash
# Metrikleri listele
curl -s http://localhost:4000/api/metrics \
  -H "Authorization: Bearer $TOKEN" | jq '.data | length'
```

### 6. Dashboard Verisi
```bash
# Dashboard full endpoint (varsa design)
curl -s "http://localhost:4000/api/dashboard/1/full" \
  -H "Authorization: Bearer $TOKEN" | jq '.data.design.name // "No design"'
```

### 7. Frontend Erişimi
```bash
# Frontend HTML dönüyor mu?
curl -s http://localhost:3000 | grep -q "<title>" && echo "Frontend OK" || echo "Frontend FAIL"

# Assets yükleniyor mu?
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/logo.png
```

### 8. WebSocket (Opsiyonel)
```bash
# Notification service WS
curl -s http://localhost:4004/socket.io/ 2>&1 | grep -q "socket" && echo "WebSocket OK" || echo "WebSocket N/A"
```

## Tam Doğrulama Scripti

```bash
#!/bin/bash
echo "═══════════════════════════════════════════════════════════════"
echo "              CLIXER UYGULAMA DOĞRULAMA                        "
echo "═══════════════════════════════════════════════════════════════"

PASS=0
FAIL=0

check() {
  if [ $? -eq 0 ]; then
    echo "✅ $1"
    ((PASS++))
  else
    echo "❌ $1"
    ((FAIL++))
  fi
}

# Servisler
curl -s http://localhost:4000/health > /dev/null; check "Gateway"
curl -s http://localhost:4001/health > /dev/null; check "Auth Service"
curl -s http://localhost:4002/health > /dev/null; check "Core Service"
curl -s http://localhost:4003/health > /dev/null; check "Data Service"
curl -s http://localhost:4004/health > /dev/null; check "Notification Service"
curl -s http://localhost:4005/health > /dev/null; check "Analytics Service"
curl -s http://localhost:3000 | grep -q "<" > /dev/null; check "Frontend"

# Docker
docker exec clixer_postgres pg_isready -U clixer > /dev/null 2>&1; check "PostgreSQL"
curl -s http://localhost:8123/ping > /dev/null; check "ClickHouse"
docker exec clixer_redis redis-cli PING > /dev/null 2>&1; check "Redis"

# Login
TOKEN=$(curl -s -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@clixer","password":"Admin1234!"}' | jq -r '.data.accessToken')
[ -n "$TOKEN" ] && [ "$TOKEN" != "null" ]; check "Login"

echo "═══════════════════════════════════════════════════════════════"
echo "SONUÇ: $PASS başarılı, $FAIL başarısız"
if [ $FAIL -eq 0 ]; then
  echo "🎉 TÜM TESTLER BAŞARILI!"
else
  echo "⚠️ BAZI TESTLER BAŞARISIZ!"
fi
echo "═══════════════════════════════════════════════════════════════"
```

## Hızlı Kontrol (Tek Komut)

```bash
curl -s http://localhost:4000/health && \
curl -s -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@clixer","password":"Admin1234!"}' | jq -r '.success' | grep -q "true" && \
echo "✅ UYGULAMA ÇALIŞIYOR" || echo "❌ SORUN VAR"
```


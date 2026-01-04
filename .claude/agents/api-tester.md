# API Tester Agent

## Görev
Clixer API endpoint'lerini test et ve sonuçları raporla.

## Çalıştırma
```
claude "API testlerini çalıştır"
```

## Test Senaryoları

### 1. Health Check
```bash
# Gateway
curl http://localhost:4000/health

# Tüm servisler
curl http://localhost:4001/health  # Auth
curl http://localhost:4002/health  # Core
curl http://localhost:4003/health  # Data
curl http://localhost:4004/health  # Notification
curl http://localhost:4005/health  # Analytics
```

### 2. Authentication
```bash
# Login
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@clixer","password":"Admin1234!"}'

# Token doğrulama
curl http://localhost:4000/api/auth/me \
  -H "Authorization: Bearer <TOKEN>"
```

### 3. Core API
```bash
# Kullanıcılar
curl http://localhost:4000/api/users \
  -H "Authorization: Bearer <TOKEN>"

# Tasarımlar
curl http://localhost:4000/api/designs \
  -H "Authorization: Bearer <TOKEN>"

# Ayarlar
curl http://localhost:4000/api/settings \
  -H "Authorization: Bearer <TOKEN>"
```

### 4. Data API
```bash
# Bağlantılar
curl http://localhost:4000/api/connections \
  -H "Authorization: Bearer <TOKEN>"

# Dataset'ler
curl http://localhost:4000/api/datasets \
  -H "Authorization: Bearer <TOKEN>"

# Metrikler
curl http://localhost:4000/api/metrics \
  -H "Authorization: Bearer <TOKEN>"
```

### 5. Analytics API
```bash
# Dashboard verisi
curl http://localhost:4000/api/dashboard/1/full \
  -H "Authorization: Bearer <TOKEN>"
```

## Beklenen Sonuçlar
- Tüm health endpoint'ler `200 OK` dönmeli
- Login başarılı olmalı ve token dönmeli
- Yetkilendirme gerektiren endpoint'ler token ile çalışmalı

## Hata Durumları
- `502 Bad Gateway`: İlgili servis çalışmıyor
- `401 Unauthorized`: Token eksik veya geçersiz
- `403 Forbidden`: Yetki yok
- `500 Internal Server Error`: Backend hatası


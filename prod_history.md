# Clixer Production Sorun Giderme Geçmişi

Bu dosya, production ortamında karşılaşılan sorunları ve çözümlerini içerir.

---

## 📅 7 Ocak 2026 - Cache Key Tarih Parametresi Sorunu

### Belirti
- Dashboard'da tarih filtreleri değiştirildiğinde veriler güncellenmiyor
- 01.11-07.11 ve 01.11-08.11 seçildiğinde **aynı değerler** dönüyor
- ClickHouse'da doğru veriler var ama API yanlış değer döndürüyor

### Teşhis Süreci

1. **İlk kontrol:** Redis cache temizlendi → Sorun devam etti
2. **ClickHouse kontrolü:** Farklı tarihler için farklı değerler döndürüyor ✅
   ```bash
   # 7 gün: 650916 / 269M
   # 8 gün: 771239 / 319M
   # 9 gün: 894074 / 369M
   ```
3. **API kontrolü:** Cache temizlenmesine rağmen aynı değerler dönüyor ❌
4. **Kod incelemesi:** Cache key oluşturma mantığı bulundu

### Kök Neden

`analytics-service/src/index.ts` dosyasında cache key oluşturulurken:

```javascript
// HATALI KOD
const paramHash = Buffer.from(JSON.stringify(parameters)).toString('base64').substring(0, 32);
const cacheKey = `metric:${metricId}:${rlsHash}:${paramHash}`;
```

`parameters` objesi: `{"startDate":"2025-11-01","endDate":"2025-11-07",...}`

Base64'e çevrildiğinde: `eyJzdGFydERhdGUiOiIyMDI1LTExLTAx...`

**İlk 32 karakter her iki tarih için de AYNI!** Çünkü fark `endDate` kısmında ve o kısım 32. karakterden sonra geliyor.

### Çözüm

Tarih parametrelerini cache key'e **açıkça** ekleme:

```javascript
// DOĞRU KOD
const cacheDateStart = parameters.startDate || '';
const cacheDateEnd = parameters.endDate || '';
const dateHash = cacheDateStart && cacheDateEnd ? `${cacheDateStart}_${cacheDateEnd}` : 'nodate';
const cacheKey = `metric:${metricId}:${rlsHash}:${dateHash}:${paramHash}`;
```

Yeni cache key formatı:
```
metric:abc123:all:2025-11-01_2025-11-07:default
metric:abc123:all:2025-11-01_2025-11-08:default  ← FARKLI!
```

### Uygulanan Değişiklikler

| Dosya | Değişiklik |
|-------|------------|
| `services/analytics-service/src/index.ts` | Cache key'de tarih açıkça eklendi |
| `frontend/src/pages/DashboardPage.tsx` | useEffect dependency düzeltildi |
| `.cursorrules` | Cache key kuralı dokümante edildi |

### Test Sonuçları (Düzeltme Sonrası)

```bash
# 7 gün
Visitor: 650916
Revenue: 269555057.78

# 8 gün
Visitor: 771239
Revenue: 319156199.53

# 9 gün
Visitor: 894074
Revenue: 369722384.28
```

### Deployment Adımları

```bash
# 1. Kod çek
cd /opt/clixer
sudo git pull origin master

# 2. Analytics service yeniden başlat
sudo pkill -f "analytics-service"
cd /opt/clixer/services/analytics-service
sudo nohup npm run dev > /opt/clixer/logs/analytics-out.log 2>&1 &

# 3. Redis cache temizle
sudo docker exec clixer_redis redis-cli FLUSHALL

# 4. Test
TOKEN=$(curl -s -X POST http://localhost:4001/login -H 'Content-Type: application/json' -d '{"email":"admin@clixer","password":"Admin1234!"}' | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
curl -s "http://localhost:4005/dashboard/DESIGN_ID/full?startDate=2025-11-01&endDate=2025-11-07" -H "Authorization: Bearer $TOKEN"
```

### Öğrenilen Dersler

1. **Cache key'de kritik parametreler ASLA kırpılmamalı**
2. **Hash kullanılacaksa, kırpılmayacak değerler ayrı tutulmalı**
3. **Tarih, kullanıcı ID gibi değerler AÇIKÇA cache key'e eklenmeli**

---

## 📅 7 Ocak 2026 - GitHub Push Yapılmadan "Yedek Alındı" Hatası

### Belirti
- LFL Takvim UI değişiklikleri production'da görünmüyordu
- Windows'ta test edilip onaylanmıştı
- 9 commit lokal'de bekliyor, GitHub'a push edilmemişti

### Kök Neden
"Yedek al" denildiğinde sadece `git add` ve `git commit` yapılıyordu, `git push` YAPILMIYORDU.

### Çözüm
`.cursorrules` dosyasına zorunlu kural eklendi:

```
"Yedek al" veya "GitHub'a gönder" denildiğinde:
1. git add .
2. git commit -m "..."
3. git push origin master  ← ZORUNLU!
4. Push çıktısını kullanıcıya göster
```

---

## 📅 7 Ocak 2026 - HTTPS Mixed Content Hatası

### Belirti
- HTTPS üzerinden sayfa yüklenince API çağrıları başarısız
- Console'da "Mixed Content" hatası

### Kök Neden
`.env.production` dosyasında `VITE_API_URL=http://IP:4000/api` vardı. Vite build sırasında bu değer hardcode ediliyor.

### Çözüm
```bash
# .env.production
VITE_API_URL=/api

# Build al
npm run build

# Nginx'te /api proxy'si ekle
location /api {
    proxy_pass http://localhost:4000;
}
```

---

## 📅 7 Ocak 2026 - ClickHouse Authentication Failed

### Belirti
```
Authentication failed: password is incorrect, or there is no user with such name
```

### Kök Neden
Docker Compose'da `CLICKHOUSE_USER` environment değişkeni kullanıldığında, ClickHouse `default-user.xml` oluşturup default kullanıcıyı siliyor.

### Çözüm
1. `CLICKHOUSE_USER` ve `CLICKHOUSE_PASSWORD` environment değişkenlerini KALDIR
2. `docker/clickhouse/users.xml` dosyası oluştur
3. Docker volume olarak mount et

```yaml
volumes:
  - ./clickhouse/users.xml:/etc/clickhouse-server/users.d/users.xml
```

---

## 📅 7 Ocak 2026 - Tarih Filtresi 1 Gün Kayması

### Belirti
"Geçen Ay" seçildiğinde `30.11.2025 - 30.12.2025` gösteriliyor (doğrusu `01.12.2025 - 31.12.2025`)

### Kök Neden
`filterStore.ts`'de `formatDate` fonksiyonu `toISOString()` kullanıyordu. Bu fonksiyon UTC'ye çeviriyor ve yerel saat +3 olunca 1 gün geriye kayıyor.

### Çözüm
```javascript
// ESKİ (HATALI)
const formatDate = (date: Date) => date.toISOString().split('T')[0]

// YENİ (DOĞRU)
const formatDate = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
```

---

## 🔧 Genel Sorun Giderme Komutları

### Servis Durumu
```bash
# Tüm servisleri kontrol et
ss -tlnp | grep -E "3000|4000|4001|4002|4003|4004|4005"

# Docker container'ları
sudo docker ps
```

### Cache Temizleme
```bash
# Redis tüm cache
sudo docker exec clixer_redis redis-cli FLUSHALL

# Nginx cache
sudo rm -rf /var/cache/nginx/*
sudo systemctl restart nginx
```

### Log İzleme
```bash
# Analytics service
tail -f /opt/clixer/logs/analytics-out.log

# Tüm loglar
tail -f /opt/clixer/logs/*.log
```

### Servis Yeniden Başlatma
```bash
# Tek servis
sudo pkill -f "analytics-service"
cd /opt/clixer/services/analytics-service
sudo nohup npm run dev > /opt/clixer/logs/analytics-out.log 2>&1 &

# Tüm servisler
sudo bash /opt/clixer/scripts/stop-all.sh
sudo bash /opt/clixer/scripts/start-all.sh
```

### Veritabanı Kontrolleri
```bash
# PostgreSQL
sudo docker exec clixer_postgres psql -U clixer -d clixer -c "SELECT 1"

# ClickHouse
curl -s "http://localhost:8123/?user=clixer&password=clixer_click_2025" --data "SELECT 1"

# Redis
sudo docker exec clixer_redis redis-cli ping
```

---

## 📞 İletişim

Sorun devam ederse:
1. `.cursorrules` dosyasındaki kurallara göre hareket et
2. Bu dosyaya yeni sorunu ekle
3. GitHub'a commit et

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

## 📅 7 Ocak 2026 - LFL (Like-for-Like) Karşılaştırma Sistemi Düzeltmesi

### Belirti
- Dashboard'da kartlardaki LFL trend değerleri tarih seçimine göre değişmiyor
- Ana değer (Visitor, Revenue) değişiyor ama alttaki "LFL %" sabit kalıyor
- Kullanıcı: "LFL değerleri doğru hesaplanıyor mu? Kartta değer değişiyor ama LFL sabit."

### Teşhis Süreci

1. **İlk kontrol:** LFL hesaplama fonksiyonu (`calculateLFL`) incelendi
2. **Tespit 1:** Fonksiyon her zaman YTD (Year-to-Date) tarihleri kullanıyordu, FilterBar'dan gelen tarihleri KULLANMIYORDU
3. **Tespit 2:** LFL Takvim dataset'i (UI'dan ayarlanan) backend'e ulaşıyordu ama kullanılmıyordu
4. **Tespit 3:** Mağaza bazlı LFL hesaplaması yapılmıyordu - sadece gün bazlı

### Kök Neden

**3 ayrı sorun vardı:**

1. **YTD Tarihleri:** `calculateLFL` fonksiyonu sabit YTD tarihleri oluşturuyordu:
   ```javascript
   const thisYearStart = `${currentYear}-01-01`;
   const lastYearStart = `${currentYear - 1}-01-01`;
   ```
   FilterBar'dan gelen `startDate` ve `endDate` parametreleri **yok sayılıyordu**.

2. **LFL Takvim Kullanılmıyordu:** `lflCalendarConfig` parametresi fonksiyona geçmiyordu.

3. **Mağaza Bazlı Değildi:** Her mağazanın o gün açık olup olmadığına bakılmıyordu. Eğer 1 mağaza bile o gün açıksa, tüm mağazaların verisi dahil ediliyordu.

### Çözüm

**1. `calculateLFL` Fonksiyon İmzası Güncellendi:**
```typescript
async function calculateLFL(
  tableName: string,
  dateColumn: string,
  valueColumn: string,
  aggFunc: string,
  rlsCondition: string,
  filterCondition: string,
  startDate?: string,        // YENİ: FilterBar başlangıç
  endDate?: string,          // YENİ: FilterBar bitiş
  lflCalendarConfig?: {      // YENİ: LFL Takvim ayarları
    datasetId: string;
    thisYearColumn: string;
    lastYearColumn: string;
    clickhouseTable: string;
  },
  storeColumn?: string       // YENİ: Mağaza kolonu
)
```

**2. LFL Takvim Entegrasyonu:**
```sql
-- LFL Takvim varsa, oradan tarih eşleşmeleri al
WITH lfl_dates AS (
  SELECT 
    toDate(this_year) as this_year_date,
    toDate(last_year) as last_year_date
  FROM clixer_analytics.excel_lfl_takvim
  WHERE this_year_date >= '2025-11-01' AND this_year_date <= '2025-11-07'
)
```

**3. Mağaza Bazlı LFL (Store-Based):**
```sql
-- Her mağaza için ayrı ayrı ortak günleri bul
common_store_days AS (
  SELECT 
    ty.store_id,
    ty.sale_date as this_year_date,
    lfl.last_year_date
  FROM (
    -- Bu yıl hangi mağaza hangi günlerde satış yaptı?
    SELECT DISTINCT store_id, toDate(ReportDay) as sale_date
    FROM sales_table
    WHERE toDate(ReportDay) >= '2025-11-01' AND toDate(ReportDay) <= '2025-11-07'
  ) ty
  INNER JOIN lfl_dates lfl ON ty.sale_date = lfl.this_year_date
  INNER JOIN (
    -- Geçen yıl hangi mağaza hangi günlerde satış yaptı?
    SELECT DISTINCT store_id, toDate(ReportDay) as sale_date
    FROM sales_table
    WHERE toDate(ReportDay) IN (SELECT last_year_date FROM lfl_dates)
  ) ly ON ty.store_id = ly.store_id AND lfl.last_year_date = ly.sale_date
)
```

### Beklenen Davranış

| Mağaza | Bu Yıl (1-7 Kasım) | Geçen Yıl (LFL) | Karşılaştırma |
|--------|---------------------|-----------------|---------------|
| Mağaza A | 1,2,3,4,5 gün açık | 1,2,3 gün açık | 3 mağaza-gün |
| Mağaza B | 1,2,3 gün açık | 1,2,3,4,5 gün açık | 3 mağaza-gün |
| Mağaza C | 1,2 gün açık | 6,7 gün açık | 0 (karşılaştırılamaz) |
| **TOPLAM** | | | **6 mağaza-gün** |

Sonuç: Sadece her iki dönemde de o mağazanın açık olduğu günler karşılaştırılır.

### Uygulanan Değişiklikler

| Dosya | Değişiklik |
|-------|------------|
| `services/analytics-service/src/index.ts` | `calculateLFL` fonksiyonu tamamen yeniden yazıldı |
| `services/analytics-service/src/index.ts` | Çağrı noktasında `lflStartDate`, `lflEndDate`, `lflCalendarConfig`, `storeColumn` parametreleri eklendi |
| `frontend/src/pages/MetricsPage.tsx` | LFL Takvim UI alanları eklendi (önceki commit'te) |

### Deployment Adımları

```bash
# 1. Kod çek
cd /opt/clixer
sudo git pull origin master

# 2. Analytics service yeniden başlat
sudo pkill -f "analytics-service"
cd /opt/clixer/services/analytics-service
sudo nohup npm run dev > /opt/clixer/logs/analytics-out.log 2>&1 &

# 3. Redis cache temizle (çok önemli!)
sudo docker exec clixer_redis redis-cli FLUSHALL

# 4. Test - farklı tarihlerle LFL değerlerinin değiştiğini kontrol et
```

### Test Kontrol Listesi

- [ ] Tarih değiştiğinde ana değer (Visitor, Revenue) değişiyor mu?
- [ ] Tarih değiştiğinde LFL trend (%) değişiyor mu?
- [ ] LFL label'da "X mağaza-gün" yazıyor mu? (store_column varsa)
- [ ] LFL Takvim seçili değilse dayOfYear ile fallback çalışıyor mu?

### Öğrenilen Dersler

1. **LFL hesaplaması mağaza bazlı olmalı** - Her mağazanın açık olduğu günler ayrı değerlendirilmeli
2. **FilterBar tarihleri backend'e kadar ulaşmalı** - Fonksiyon parametrelerine açıkça ekle
3. **LFL Takvim dataset'i kritik** - Farklı yılların hangi günlerinin karşılaştırılacağını belirler

---

## 📅 7 Ocak 2026 - LFL Ana Değer Düzeltmesi (v4.4)

### Belirti
- LFL kartında ana değer ile normal kartta ana değer **AYNI** gösteriliyor
- Beklenen: LFL kartında sadece ortak mağaza-günlerin toplamı gösterilmeli

### Kök Neden

`executeMetric` fonksiyonunda `calculateLFL` sonucu alındıktan sonra:
- `previousValue` güncelleniyor ✅
- `trend` güncelleniyor ✅
- **`value` GÜNCELLENMİYORDU!** ❌

```javascript
// ESKİ (HATALI) - satır 1779-1799
if (lflResult) {
  previousValue = lflResult.previousValue;
  trend = lflResult.trend;
  // value güncellenmedi!
}
```

### Çözüm

```javascript
// YENİ (DOĞRU)
if (lflResult) {
  value = lflResult.currentValue;  // ← EKLENDİ!
  previousValue = lflResult.previousValue;
  trend = lflResult.trend;
}

// Return öncesi formatted yeniden hesapla
const finalFormatted = formatMetricValue(value, metric);
```

### Uygulanan Değişiklikler

| Dosya | Satır | Değişiklik |
|-------|-------|------------|
| `analytics-service/src/index.ts` | 1782 | `value = lflResult.currentValue` eklendi |
| `analytics-service/src/index.ts` | 2122 | `finalFormatted = formatMetricValue(value, metric)` eklendi |

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
# LFL kartı artık farklı değer göstermeli!
```

### Beklenen Sonuç

| Widget | Değer | Açıklama |
|--------|-------|----------|
| VİSİTOR (LFL yok) | 2.592.120 | TÜM verinin toplamı |
| MİNİ KART (LFL var) | **~X.XXX.XXX** | Sadece LFL eşleşen mağaza-günlerin toplamı (FARKLI!) |

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

## 📅 7 Ocak 2026 - Dataset'ten Mağaza Import Özelliği

### İhtiyaç
- RLS ve LFL hesaplamaları için `stores.code` değerinin ClickHouse'daki `BranchID` ile eşleşmesi gerekiyor
- Manuel mağaza girişi yerine, mevcut dataset'ten (ClickHouse) otomatik import gerekli
- Kullanıcı hangi kolonun ne olduğunu (code, name, store_type vb.) seçebilmeli

### Yapılan Değişiklikler

#### Backend: `services/core-service/src/index.ts`

1. **`/stores/import-from-dataset/preview` endpoint'i eklendi:**
   - Dataset ID alır, ClickHouse'dan kolonları ve ilk 10 satırı döndürür
   - Toplam satır sayısını gösterir

2. **`/stores/import-from-dataset` endpoint'i eklendi:**
   - Dataset ID ve kolon mapping alır
   - ClickHouse'dan DISTINCT değerleri çeker
   - PostgreSQL `stores` tablosuna UPSERT yapar (varsa günceller, yoksa ekler)
   - Region code ile region_id eşleştirmesi yapar

#### Frontend: `frontend/src/pages/AdminPage.tsx`

1. **"Dataset'ten Import" butonu eklendi** (mavi, CSV Import yanında)

2. **Yeni state'ler eklendi:**
   - `showDatasetImportModal`
   - `availableDatasets`
   - `selectedDatasetId`
   - `datasetColumns`
   - `datasetPreview`
   - `datasetImportMapping`
   - `datasetImportResult`

3. **Modal UI eklendi:**
   - Adım 1: Dataset seçimi (dropdown)
   - Adım 2: Kolon eşleştirmesi (6 alan: code, name, store_type, ownership_group, region_code, city)
   - Adım 3: Önizleme tablosu (ilk 10 satır)
   - Import sonucu gösterimi

### Kullanım

1. **Yönetim Paneli → Master Veriler → Mağazalar**
2. **"Dataset'ten Import"** butonuna tıkla
3. Dataset seç (ör: rprSalesGroupDaily)
4. Kolon eşleştirmesi yap:
   | Clixer Alanı | Dataset Kolonu |
   |--------------|----------------|
   | Kod (Zorunlu) | BranchID |
   | Mağaza Adı | BranchName |
   | Sahiplik Grubu | BranchType |
   | Şehir | (varsa) |
5. "Import Et" tıkla

### Sonuç

```
Dataset (ClickHouse)                  stores (PostgreSQL)
─────────────────────                 ────────────────────
BranchID: 1           →               code: "1"
BranchName: "Kadıköy" →               name: "Kadıköy"
BranchType: "TDUN"    →               ownership_group: "TDUN"
```

### Artık Mümkün Olanlar

1. **RLS Çalışır:** `stores.code = BranchID` olduğu için tip uyumsuzluğu YOK
2. **LFL Mağaza Bazlı Çalışır:** `store_column = 'BranchID'` ayarlandığında mağaza-gün eşleştirmesi yapılabilir
3. **Yetki Sistemi Çalışır:** Genel Müdür = tüm mağazalar, Bölge Müdürü = kendi bölgesi, Mağaza Müdürü = kendi mağazası

### Commit
```
feat: Dataset'ten magaza import ozelliği eklendi - Kolon mapping ile ClickHouse'dan stores tablosuna veri aktarimi
```

---

## 📅 7 Ocak 2026 - LFL Mağaza Bazlı Hesaplama (uniqueStores)

### İhtiyaç
- LFL kartlarında "LFL (5 gün)" yerine "LFL (302 mağaza · 1564 mağaza-gün)" gösterilmeli
- Böylece kaç benzersiz mağazanın karşılaştırıldığı görülebilir

### Yapılan Değişiklikler

#### `services/analytics-service/src/index.ts`

1. **`calculateLFL` return tipine `uniqueStores` eklendi:**
   ```typescript
   Promise<{
     currentValue: number;
     previousValue: number;
     trend: number;
     commonDays: number;
     uniqueStores?: number; // YENİ
   } | null>
   ```

2. **Store-based LFL sorgusuna `uniq(store_id)` eklendi:**
   ```sql
   SELECT
     sum(this_year_value) as current_value,
     sum(last_year_value) as previous_value,
     count() as common_days_count,
     uniq(store_id) as unique_stores  -- YENİ
   FROM (...)
   ```

3. **`comparisonLabel` güncellendi:**
   ```typescript
   comparisonLabel = lflStoreColumn
     ? `LFL (${lflResult.uniqueStores} mağaza · ${lflResult.commonDays} mağaza-gün)`
     : `LFL (${lflResult.commonDays} gün)`;
   ```

### LFL Akış Özeti

```
1. store_column = NULL → Gün bazlı LFL → "LFL (5 gün)"
2. store_column = 'BranchID' → Mağaza-gün bazlı LFL → "LFL (302 mağaza · 1564 mağaza-gün)"
```

### Gereksinim
- `stores` tablosunda gerçek mağaza kodları olmalı (BranchID ile eşleşen)
- Dataset'te `store_column` ayarlanmalı

---

## 🔴 RLS + LFL Entegrasyonu Kontrol Listesi

### Doğru Kurulum Sırası

1. **Dataset'ten Mağaza Import Et:**
   ```
   Yönetim Paneli → Master Veriler → Mağazalar → Dataset'ten Import
   - Kod: BranchID
   - İsim: BranchName
   - Grup: BranchType
   ```

2. **Dataset'te store_column Ayarla:**
   ```sql
   UPDATE datasets 
   SET store_column = 'BranchID' 
   WHERE clickhouse_table = 'ds_xxx';
   ```

3. **Pozisyonlara filter_level Ata:**
   ```sql
   UPDATE positions SET filter_level = 'none' WHERE code = 'GENERAL_MANAGER';
   UPDATE positions SET filter_level = 'region' WHERE code = 'REGIONAL_MANAGER';
   UPDATE positions SET filter_level = 'store' WHERE code = 'STORE_MANAGER';
   ```

4. **Kullanıcılara filter_value Ata:**
   ```sql
   -- Mağaza müdürüne kendi mağazasını ata
   UPDATE users SET filter_value = '158' WHERE email = 'magaza158@sirket.com';
   ```

5. **Test Et:**
   - Admin girişi: Tüm veri görünmeli
   - Mağaza müdürü girişi: Sadece kendi mağazası görünmeli
   - LFL kartları: "LFL (X mağaza · Y mağaza-gün)" görünmeli

---

## 📞 İletişim

Sorun devam ederse:
1. `.cursorrules` dosyasındaki kurallara göre hareket et
2. Bu dosyaya yeni sorunu ekle
3. GitHub'a commit et

# ETL Validator Agent

## Görev
ETL job'larını doğrula, veri tutarlılığını kontrol et.

## Çalıştırma
```
claude "ETL durumunu kontrol et"
```

## Kontroller

### 1. ETL Worker Durumu
```bash
# Worker çalışıyor mu?
curl http://localhost:4003/admin/system/status

# Çalışan job'lar
curl http://localhost:4000/api/data/etl-jobs/running \
  -H "Authorization: Bearer <TOKEN>"
```

### 2. Son ETL Job'ları
```bash
# Son 10 job
curl "http://localhost:4000/api/data/etl-jobs?limit=10" \
  -H "Authorization: Bearer <TOKEN>"
```

**Kontrol noktaları:**
- `status` = `completed` ise başarılı
- `status` = `failed` ise hata var
- `rows_processed` > 0 olmalı
- `error_message` boş olmalı

### 3. Dataset Tutarlılık Kontrolü
```bash
# ClickHouse tablo satır sayıları
curl "http://localhost:8123/?user=clixer&password=clixer_click_2025" \
  --data "SELECT table, sum(rows) as rows FROM system.parts WHERE database='clixer_analytics' AND active=1 GROUP BY table"
```

### 4. Duplicate Kontrolü
```sql
-- ClickHouse'da duplicate var mı?
SELECT 
  count() as total,
  count(DISTINCT id) as unique_count,
  total - unique_count as duplicates
FROM clixer_analytics.dataset_xxx
```

### 5. Stuck Job Kontrolü
```bash
# 10 dakikadan uzun süredir çalışan job'lar
curl "http://localhost:4000/api/data/etl-jobs/stuck" \
  -H "Authorization: Bearer <TOKEN>"
```

**Stuck job varsa:**
```bash
# Job'ı iptal et
curl -X POST "http://localhost:4000/api/data/etl-jobs/{jobId}/cancel" \
  -H "Authorization: Bearer <TOKEN>"
```

### 6. Schedule Kontrolü
```bash
# Aktif schedule'lar
curl "http://localhost:4000/api/data/schedules" \
  -H "Authorization: Bearer <TOKEN>"
```

**Kontrol noktaları:**
- `is_active` = true
- `next_run_at` gelecekte olmalı
- `last_run_at` mantıklı olmalı

## Veri Tutarlılık Kuralları

### Tip Uyumluluğu
| Kaynak Tip | ClickHouse Tip |
|------------|----------------|
| int, bigint | Int32, Int64 |
| decimal, float | Float64 |
| varchar, text | String |
| date, datetime | Date, DateTime |

### ORDER BY Kuralları
- Unique kolon ZORUNLU (id, code, uuid)
- `_synced_at` tek başına ORDER BY olmamalı

### Partition Kuralları
- Tarih kolonu Date tipinde olmalı
- String tarih partition olmaz

## Hata Giderme

### 0 satır işlendi
1. Kaynak bağlantıyı kontrol et
2. source_query'yi kontrol et
3. Tip uyumsuzluğu var mı?

### Duplicate'lar var
```sql
OPTIMIZE TABLE clixer_analytics.dataset_xxx FINAL
```

### Job stuck kaldı
```bash
# Redis lock'ı temizle
docker exec clixer_redis redis-cli DEL "etl:lock:dataset_xxx"
```

## Rapor Formatı

```
╔══════════════════════════════════════════════════════════════╗
║                    ETL DURUM RAPORU                          ║
╠══════════════════════════════════════════════════════════════╣
║ Tarih:          [TARIH]                                      ║
║ Toplam Dataset: [X]                                          ║
║ Aktif Schedule: [X]                                          ║
╠══════════════════════════════════════════════════════════════╣
║ Son 24 Saat:                                                 ║
║   - Başarılı:   [X] job                                      ║
║   - Başarısız:  [X] job                                      ║
║   - Çalışan:    [X] job                                      ║
║   - İşlenen:    [X] satır                                    ║
╠══════════════════════════════════════════════════════════════╣
║ DURUM:          SAĞLIKLI / SORUNLAR VAR                      ║
╚══════════════════════════════════════════════════════════════╝
```


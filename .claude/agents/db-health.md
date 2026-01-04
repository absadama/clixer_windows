# Database Health Agent

## Görev
PostgreSQL, ClickHouse ve Redis veritabanlarının sağlığını kontrol et.

## Çalıştırma
```
claude "Veritabanı sağlığını kontrol et"
```

## Kontroller

### 1. Docker Container Durumu
```bash
docker ps --format "table {{.Names}}\t{{.Status}}" | grep clixer
```

**Beklenen:**
- `clixer_postgres` → `Up ... (healthy)`
- `clixer_clickhouse` → `Up ... (healthy)`
- `clixer_redis` → `Up ... (healthy)`

### 2. PostgreSQL
```bash
# Bağlantı testi
docker exec clixer_postgres pg_isready -U clixer

# Tablo sayısı
docker exec clixer_postgres psql -U clixer -d clixer -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';"

# Kullanıcı sayısı
docker exec clixer_postgres psql -U clixer -d clixer -c "SELECT count(*) FROM users;"

# Bağlantı sayısı
docker exec clixer_postgres psql -U clixer -d clixer -c "SELECT count(*) FROM pg_stat_activity;"
```

### 3. ClickHouse
```bash
# Bağlantı testi
curl "http://localhost:8123/ping"

# Veritabanları
curl "http://localhost:8123/?user=clixer&password=clixer_click_2025" \
  --data "SHOW DATABASES"

# Tablolar
curl "http://localhost:8123/?user=clixer&password=clixer_click_2025" \
  --data "SHOW TABLES FROM clixer_analytics"

# Tablo boyutları
curl "http://localhost:8123/?user=clixer&password=clixer_click_2025" \
  --data "SELECT table, formatReadableSize(sum(bytes)) as size, sum(rows) as rows FROM system.parts WHERE database = 'clixer_analytics' GROUP BY table"
```

### 4. Redis
```bash
# Ping
docker exec clixer_redis redis-cli PING

# Bellek kullanımı
docker exec clixer_redis redis-cli INFO memory | grep used_memory_human

# Key sayısı
docker exec clixer_redis redis-cli DBSIZE

# Bağlantı sayısı
docker exec clixer_redis redis-cli CLIENT LIST | wc -l
```

## Sağlık Kriterleri

| Veritabanı | Sağlıklı | Uyarı | Kritik |
|------------|----------|-------|--------|
| PostgreSQL | Bağlantı < 50 | 50-150 | > 150 |
| ClickHouse | Response < 1s | 1-5s | > 5s |
| Redis | Memory < 1GB | 1-2GB | > 2GB |

## Hata Giderme

### PostgreSQL bağlanmıyor
```bash
docker restart clixer_postgres
docker logs clixer_postgres --tail 50
```

### ClickHouse yavaş
```bash
# OPTIMIZE çalıştır
curl "http://localhost:8123/?user=clixer&password=clixer_click_2025" \
  --data "OPTIMIZE TABLE clixer_analytics.dataset_xxx FINAL"
```

### Redis bellek dolu
```bash
docker exec clixer_redis redis-cli FLUSHALL
```


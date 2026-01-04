# /full-backup - Tam Yedek Al

Tüm kontrolleri çalıştır, PostgreSQL dump al ve GitHub'a push et.

## Adımlar

```bash
# 1. Tüm servislerin çalıştığını kontrol et
curl -s http://localhost:4000/health
curl -s http://localhost:4001/health
curl -s http://localhost:4002/health
curl -s http://localhost:4003/health
curl -s http://localhost:4004/health
curl -s http://localhost:4005/health

# 2. Veritabanlarını kontrol et
docker exec clixer_postgres pg_isready -U clixer
docker exec clixer_clickhouse clickhouse-client --user clixer --password clixer_click_2025 --query "SELECT 1"
docker exec clixer_redis redis-cli ping

# 3. PostgreSQL dump al
docker exec clixer_postgres pg_dump -U clixer -d clixer --no-owner > db-backup/postgresql_full.sql

# 4. ClickHouse tablo listesi
docker exec clixer_clickhouse clickhouse-client --user clixer --password clixer_click_2025 --query "SELECT name, total_rows FROM system.tables WHERE database='clixer_analytics'" > db-backup/clickhouse_tables.txt

# 5. Git commit ve push
git add .
git commit -m "backup: Full backup $(date +%Y%m%d_%H%M%S)"
git push origin main

# 6. Tag oluştur (opsiyonel)
# git tag -a vX.X.X -m "Release vX.X.X"
# git push origin vX.X.X
```

## Kontrol Listesi

- [ ] 6 servis health check OK
- [ ] PostgreSQL bağlantısı OK
- [ ] ClickHouse bağlantısı OK
- [ ] Redis bağlantısı OK
- [ ] PostgreSQL dump alındı
- [ ] Git commit yapıldı
- [ ] GitHub'a push yapıldı


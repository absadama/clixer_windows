# /health-check - Sistem Sağlık Kontrolü

Tüm servislerin ve veritabanlarının durumunu hızlıca kontrol et.

## Hızlı Kontrol

```bash
echo "=== DOCKER CONTAINERS ==="
docker ps --format "table {{.Names}}\t{{.Status}}"

echo ""
echo "=== API SERVICES ==="
curl -sf http://localhost:4000/health && echo " Gateway OK" || echo " Gateway FAIL"
curl -sf http://localhost:4001/health && echo " Auth OK" || echo " Auth FAIL"
curl -sf http://localhost:4002/health && echo " Core OK" || echo " Core FAIL"
curl -sf http://localhost:4003/health && echo " Data OK" || echo " Data FAIL"
curl -sf http://localhost:4004/health && echo " Notification OK" || echo " Notification FAIL"
curl -sf http://localhost:4005/health && echo " Analytics OK" || echo " Analytics FAIL"

echo ""
echo "=== DATABASES ==="
docker exec clixer_postgres pg_isready -U clixer && echo " PostgreSQL OK"
docker exec clixer_redis redis-cli ping | grep -q PONG && echo " Redis OK"
docker exec clixer_clickhouse clickhouse-client --user clixer --password clixer_click_2025 --query "SELECT 1" > /dev/null && echo " ClickHouse OK"

echo ""
echo "=== FRONTEND ==="
curl -sf http://localhost:3000 > /dev/null && echo " React App OK" || echo " React App FAIL"
```

## Beklenen Sonuç

```
=== DOCKER CONTAINERS ===
clixer_postgres     Up 2 hours (healthy)
clixer_clickhouse   Up 2 hours
clixer_redis        Up 2 hours

=== API SERVICES ===
 Gateway OK
 Auth OK
 Core OK
 Data OK
 Notification OK
 Analytics OK

=== DATABASES ===
 PostgreSQL OK
 Redis OK
 ClickHouse OK

=== FRONTEND ===
 React App OK
```


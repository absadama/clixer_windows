#!/bin/bash
# ============================================
# CLIXER - TAM YEDEKLEME
# Şema + VERİ dahil!
# ============================================

set -e

BACKUP_DIR="/Users/cihanadar/Downloads/clixer/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_PATH="${BACKUP_DIR}/full_backup_${TIMESTAMP}"

mkdir -p "$BACKUP_PATH"

echo "🔄 CLIXER Tam Yedekleme başlıyor..."
echo "📁 Hedef: $BACKUP_PATH"

# ============================================
# 1. PostgreSQL - ŞEMA + VERİ
# ============================================
echo "📦 PostgreSQL yedekleniyor (şema + veri)..."
docker exec clixer_postgres pg_dump -U clixer -d clixer \
  --format=plain \
  --no-owner \
  --no-privileges \
  --inserts \
  > "$BACKUP_PATH/postgres_full.sql"

# Sadece veri (hızlı geri yükleme için)
docker exec clixer_postgres pg_dump -U clixer -d clixer \
  --data-only \
  --inserts \
  > "$BACKUP_PATH/postgres_data_only.sql"

echo "✅ PostgreSQL yedeklendi ($(du -h "$BACKUP_PATH/postgres_full.sql" | cut -f1))"

# ============================================
# 2. ClickHouse - Tablo listesi ve şema
# ============================================
echo "📦 ClickHouse yedekleniyor..."
docker exec clixer_clickhouse clickhouse-client \
  --query "SELECT name FROM system.tables WHERE database = 'default'" \
  > "$BACKUP_PATH/clickhouse_tables.txt" 2>/dev/null || echo "ClickHouse boş"

# Her tablo için şema
for table in $(cat "$BACKUP_PATH/clickhouse_tables.txt" 2>/dev/null); do
  docker exec clixer_clickhouse clickhouse-client \
    --query "SHOW CREATE TABLE $table" \
    >> "$BACKUP_PATH/clickhouse_schema.sql" 2>/dev/null || true
  echo ";" >> "$BACKUP_PATH/clickhouse_schema.sql"
done

echo "✅ ClickHouse yedeklendi"

# ============================================
# 3. Redis keys
# ============================================
echo "📦 Redis yedekleniyor..."
docker exec clixer_redis redis-cli KEYS "*" > "$BACKUP_PATH/redis_keys.txt" 2>/dev/null || echo ""
echo "✅ Redis yedeklendi"

# ============================================
# 4. .env dosyası
# ============================================
cp /Users/cihanadar/Downloads/clixer/.env "$BACKUP_PATH/.env.backup" 2>/dev/null || true

# ============================================
# TAMAMLANDI
# ============================================
echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║              YEDEKLEME TAMAMLANDI! ✅                      ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "📁 Konum: $BACKUP_PATH"
echo ""
echo "📄 Dosyalar:"
ls -lh "$BACKUP_PATH"
echo ""
echo "🔄 Geri yüklemek için:"
echo "   docker exec -i clixer_postgres psql -U clixer -d clixer < $BACKUP_PATH/postgres_full.sql"


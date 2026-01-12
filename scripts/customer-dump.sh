#!/bin/bash
# ============================================
# CLIXER - MÜŞTERİ VERİTABANI DUMP SCRİPTİ
# ============================================
# Bu script müşteri sunucusunda çalıştırılır
# PostgreSQL + ClickHouse verilerini dump alır
# ============================================

set -e

# Renk kodları
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}   CLIXER - MÜŞTERİ VERİTABANI DUMP${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# Dump klasörü
DUMP_DIR="/opt/clixer/customer_dump_$(date +%Y%m%d_%H%M%S)"
sudo mkdir -p "$DUMP_DIR"
cd "$DUMP_DIR"

echo -e "${YELLOW}📁 Dump klasörü: $DUMP_DIR${NC}"
echo ""

# ============================================
# 1. POSTGRESQL DUMP
# ============================================
echo -e "${BLUE}[1/4] PostgreSQL dump alınıyor...${NC}"

sudo docker exec clixer_postgres pg_dump -U clixer -d clixer --no-owner > postgresql_full.sql

PG_LINES=$(wc -l < postgresql_full.sql)
PG_SIZE=$(du -h postgresql_full.sql | cut -f1)
echo -e "${GREEN}✅ PostgreSQL: $PG_LINES satır ($PG_SIZE)${NC}"
echo ""

# ============================================
# 2. CLICKHOUSE TABLO LİSTESİ
# ============================================
echo -e "${BLUE}[2/4] ClickHouse tabloları listeleniyor...${NC}"

curl -s "http://localhost:8123/?user=clixer&password=clixer_click_2025" \
  --data "SELECT name FROM system.tables WHERE database='clixer_analytics'" > ch_tables.txt

CH_TABLE_COUNT=$(wc -l < ch_tables.txt)
echo -e "${GREEN}✅ $CH_TABLE_COUNT tablo bulundu${NC}"
cat ch_tables.txt | while read table; do echo "   - $table"; done
echo ""

# ============================================
# 3. CLICKHOUSE ŞEMA VE VERİ DUMP
# ============================================
echo -e "${BLUE}[3/4] ClickHouse verileri dump alınıyor...${NC}"

while read table; do
  if [ -z "$table" ]; then continue; fi
  
  echo -e "   📦 $table..."
  
  # Şema
  curl -s "http://localhost:8123/?user=clixer&password=clixer_click_2025" \
    --data "SHOW CREATE TABLE clixer_analytics.$table" > "${table}_schema.sql"
  
  # Veri (CSV)
  curl -s "http://localhost:8123/?user=clixer&password=clixer_click_2025" \
    --data "SELECT * FROM clixer_analytics.$table FORMAT CSVWithNames" > "${table}_data.csv"
  
  DATA_LINES=$(wc -l < "${table}_data.csv")
  DATA_SIZE=$(du -h "${table}_data.csv" | cut -f1)
  echo -e "      ${GREEN}✓ $DATA_LINES satır ($DATA_SIZE)${NC}"
  
done < ch_tables.txt

echo ""

# ============================================
# 4. ARŞİVLE
# ============================================
echo -e "${BLUE}[4/4] Arşivleniyor...${NC}"

tar -czvf customer_dump.tar.gz *.sql *.csv *.txt 2>/dev/null

ARCHIVE_SIZE=$(du -h customer_dump.tar.gz | cut -f1)
echo -e "${GREEN}✅ Arşiv oluşturuldu: $ARCHIVE_SIZE${NC}"
echo ""

# ============================================
# ÖZET
# ============================================
echo -e "${BLUE}============================================${NC}"
echo -e "${GREEN}   ✅ DUMP TAMAMLANDI${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""
echo -e "📁 Konum: ${YELLOW}$DUMP_DIR${NC}"
echo ""
echo -e "Dosyalar:"
ls -lh "$DUMP_DIR"
echo ""
SERVER_IP=$(hostname -I | awk '{print $1}')
CURRENT_USER=$(whoami)

echo -e "${YELLOW}📥 Windows'a indirmek için:${NC}"
echo -e "   scp ${CURRENT_USER}@${SERVER_IP}:$DUMP_DIR/customer_dump.tar.gz C:\\projeler\\clixer_windows-main\\customer_dump\\"
echo ""
echo -e "${YELLOW}Veya tek tek:${NC}"
echo -e "   scp ${CURRENT_USER}@${SERVER_IP}:$DUMP_DIR/postgresql_full.sql C:\\projeler\\clixer_windows-main\\customer_dump\\"
echo -e "   scp ${CURRENT_USER}@${SERVER_IP}:$DUMP_DIR/*.csv C:\\projeler\\clixer_windows-main\\customer_dump\\"
echo ""

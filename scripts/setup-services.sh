#!/bin/bash
# ============================================
# CLIXER - SYSTEMD SERVIS KURULUMU
# ============================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Lütfen bu scripti sudo ile çalıştırın!${NC}"
    exit 1
fi

echo -e "${YELLOW}Servis dosyaları kopyalanıyor...${NC}"

# Servis dosyalarını kopyala
cp /opt/clixer/deploy/systemd/clixer-*.service /etc/systemd/system/

# Systemd'yi yenile
systemctl daemon-reload

# Tüm servisleri aktif et ve başlat
SERVICES=("gateway" "auth" "core" "data" "notification" "analytics" "etl-worker")

for svc in "${SERVICES[@]}"; do
    echo -e "Servis ayarlanıyor: clixer-$svc"
    systemctl enable "clixer-$svc"
    systemctl restart "clixer-$svc"
done

echo -e "${GREEN}✓ Tüm servisler başarıyla systemd ünitesi olarak kuruldu ve başlatıldı!${NC}"
echo -e "${YELLOW}Artık 'sudo systemctl status clixer-*' ile durum bakabilirsin.${NC}"

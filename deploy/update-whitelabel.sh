#!/bin/bash
#
# Clixer WhiteLabel Logo Güncellemesi - v4.20
# Bu script müşteri Ubuntu sunucusunda çalıştırılmalıdır.
#
# Kullanım:
#   sudo bash /opt/clixer/deploy/update-whitelabel.sh
#
# Bu script şunları yapar:
#   1. Mevcut durumu yedekler
#   2. GitHub'dan en son kodu çeker
#   3. Core service bağımlılıklarını kurar (multer, sharp)
#   4. Uploads klasörünü oluşturur ve izinleri ayarlar
#   5. Servisleri yeniden başlatır
#   6. Frontend build alır
#   7. Nginx talimatlarını gösterir
#

set -e

# Renkli çıktı
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}  Clixer WhiteLabel Logo Güncellemesi - v4.20   ${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

# Root kontrolü
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}HATA: Bu script root olarak çalıştırılmalıdır.${NC}"
  echo "Kullanım: sudo bash $0"
  exit 1
fi

# Clixer klasörü kontrolü
CLIXER_DIR="/opt/clixer"
if [ ! -d "$CLIXER_DIR" ]; then
  echo -e "${RED}HATA: $CLIXER_DIR klasörü bulunamadı.${NC}"
  exit 1
fi

cd $CLIXER_DIR

# 1. Yedek Al
echo -e "${YELLOW}[1/7] Mevcut durum yedekleniyor...${NC}"
BACKUP_DIR="/opt/backup_whitelabel_$(date +%Y%m%d_%H%M%S)"
mkdir -p $BACKUP_DIR

# Sadece kritik dosyaları yedekle
cp -r services/core-service/package.json $BACKUP_DIR/ 2>/dev/null || true
cp -r frontend/index.html $BACKUP_DIR/ 2>/dev/null || true
cp -r frontend/src/components/Layout.tsx $BACKUP_DIR/ 2>/dev/null || true
echo -e "${GREEN}✓ Yedek alındı: $BACKUP_DIR${NC}"

# 2. Git Pull
echo -e "${YELLOW}[2/7] GitHub'dan en son kod çekiliyor...${NC}"
git fetch origin
git reset --hard origin/master
echo -e "${GREEN}✓ Kod güncellendi${NC}"

# 3. Core Service Bağımlılıkları
echo -e "${YELLOW}[3/7] Core service bağımlılıkları kuruluyor (multer, sharp)...${NC}"
echo -e "${BLUE}  Not: Sharp paketi derleniyor, bu 1-2 dakika sürebilir...${NC}"
cd $CLIXER_DIR/services/core-service
npm install --silent
echo -e "${GREEN}✓ Bağımlılıklar kuruldu${NC}"

# 4. Uploads Klasörü
echo -e "${YELLOW}[4/7] Uploads klasörü oluşturuluyor...${NC}"
UPLOADS_DIR="$CLIXER_DIR/frontend/dist/uploads"
mkdir -p $UPLOADS_DIR
chown -R www-data:www-data $UPLOADS_DIR
chmod 755 $UPLOADS_DIR
echo -e "${GREEN}✓ Uploads klasörü hazır: $UPLOADS_DIR${NC}"

# 5. Servisleri Durdur
echo -e "${YELLOW}[5/7] Servisler durduruluyor...${NC}"
cd $CLIXER_DIR
bash scripts/stop-all.sh 2>/dev/null || pkill -f "node" 2>/dev/null || true
sleep 2
echo -e "${GREEN}✓ Servisler durduruldu${NC}"

# 6. Frontend Build (MÜŞTERİ LOGOLARINI KORUYARAK!)
echo -e "${YELLOW}[6/7] Frontend build alınıyor...${NC}"
cd $CLIXER_DIR/frontend

# 🔴 KRİTİK: Mevcut uploads klasörünü yedekle (müşteri logoları!)
UPLOADS_BACKUP="/tmp/clixer_uploads_backup_$(date +%s)"
if [ -d "dist/uploads" ] && [ "$(ls -A dist/uploads 2>/dev/null)" ]; then
  echo -e "${BLUE}  Müşteri logoları yedekleniyor...${NC}"
  cp -r dist/uploads $UPLOADS_BACKUP
fi

# .env.production kontrolü
if grep -q "http://" .env.production 2>/dev/null; then
  echo -e "${YELLOW}  Uyarı: .env.production düzeltiliyor (VITE_API_URL=/api)${NC}"
  echo 'VITE_API_URL=/api' > .env.production
fi

npm run build --silent

# 🔴 KRİTİK: Müşteri logolarını geri yükle!
if [ -d "$UPLOADS_BACKUP" ]; then
  echo -e "${BLUE}  Müşteri logoları geri yükleniyor...${NC}"
  mkdir -p dist/uploads
  cp -r $UPLOADS_BACKUP/* dist/uploads/
  rm -rf $UPLOADS_BACKUP
  echo -e "${GREEN}  ✓ Müşteri logoları korundu${NC}"
fi

chown -R www-data:www-data dist
chmod -R 755 dist
echo -e "${GREEN}✓ Frontend build tamamlandı${NC}"

# 7. Servisleri Başlat
echo -e "${YELLOW}[7/7] Servisler başlatılıyor...${NC}"
cd $CLIXER_DIR
bash scripts/start-all.sh
echo -e "${GREEN}✓ Servisler başlatıldı${NC}"

# Nginx Talimatları
echo ""
echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}  MANUEL ADIM: Nginx Yapılandırması             ${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""
echo -e "${YELLOW}Aşağıdaki komutu çalıştırarak Nginx config'i düzenleyin:${NC}"
echo ""
echo "  sudo nano /etc/nginx/sites-available/default"
echo ""
echo -e "${YELLOW}Server bloğuna şu satırları ekleyin:${NC}"
echo ""
echo -e "${GREEN}    # Logo uploads - static dosya servisi"
echo "    location /uploads/ {"
echo "        alias /opt/clixer/frontend/dist/uploads/;"
echo "        expires 30d;"
echo "        add_header Cache-Control \"public, no-transform\";"
echo -e "    }${NC}"
echo ""
echo -e "${YELLOW}Sonra Nginx'i yeniden başlatın:${NC}"
echo ""
echo "  sudo nginx -t && sudo systemctl restart nginx"
echo ""
echo -e "${BLUE}================================================${NC}"
echo -e "${GREEN}  WhiteLabel güncelleme tamamlandı!             ${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""
echo -e "Şimdi yapmanız gerekenler:"
echo -e "  1. Nginx config'e uploads location ekleyin (yukarıdaki talimatlar)"
echo -e "  2. Admin Panel → Sistem Ayarları → Marka Logosu'ndan logo yükleyin"
echo ""

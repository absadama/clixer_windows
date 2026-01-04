#!/bin/bash

echo "========================================"
echo "  CLIXER - Mac/Linux Kurulum Scripti"
echo "========================================"
echo ""

# Renk tanımları
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Docker kontrolü
if ! command -v docker &> /dev/null; then
    echo -e "${RED}[HATA] Docker bulunamadı!${NC}"
    echo "Docker'ı yükleyin: https://www.docker.com/products/docker-desktop/"
    exit 1
fi
echo -e "${GREEN}[OK]${NC} Docker bulundu"

# Docker çalışıyor mu?
if ! docker info &> /dev/null; then
    echo -e "${RED}[HATA] Docker çalışmıyor!${NC}"
    echo "Lütfen Docker Desktop'ı başlatın ve tekrar deneyin."
    exit 1
fi
echo -e "${GREEN}[OK]${NC} Docker çalışıyor"

# Node.js kontrolü
if ! command -v node &> /dev/null; then
    echo -e "${RED}[HATA] Node.js bulunamadı!${NC}"
    echo "Node.js'i yükleyin: https://nodejs.org/"
    exit 1
fi
echo -e "${GREEN}[OK]${NC} Node.js bulundu: $(node --version)"

echo ""
echo "========================================"
echo "  1/4 - Docker Container'lar"
echo "========================================"

cd docker
docker-compose up -d

if [ $? -ne 0 ]; then
    echo -e "${RED}[HATA] Docker Compose hatası!${NC}"
    exit 1
fi
echo -e "${GREEN}[OK]${NC} Container'lar başladı"

echo ""
echo "========================================"
echo "  2/4 - Veritabanları Hazırlanıyor"
echo "========================================"

echo "30 saniye bekleniyor..."
sleep 30

# PostgreSQL check
if docker exec clixer_postgres pg_isready -U clixer &> /dev/null; then
    echo -e "${GREEN}[OK]${NC} PostgreSQL hazır"
else
    echo "Ek 30 saniye bekleniyor..."
    sleep 30
fi

echo ""
echo "========================================"
echo "  3/4 - Shared Modül Derleniyor"
echo "========================================"

cd ../shared
npm install
npm run build

if [ $? -ne 0 ]; then
    echo -e "${RED}[HATA] Shared modül derlenemedi!${NC}"
    exit 1
fi
echo -e "${GREEN}[OK]${NC} Shared modül hazır"

echo ""
echo "========================================"
echo "  4/4 - Bağımlılıklar Yükleniyor"
echo "========================================"

cd ..

# Tüm servislere npm install
for dir in gateway frontend services/auth-service services/core-service services/data-service services/analytics-service services/notification-service services/etl-worker; do
    echo "Installing $dir..."
    cd $dir
    npm install --silent 2>/dev/null
    cd - > /dev/null
done

echo -e "${GREEN}[OK]${NC} Tüm bağımlılıklar yüklendi"

echo ""
echo "========================================"
echo "  KURULUM TAMAMLANDI!"
echo "========================================"
echo ""
echo "Servisleri başlatmak için:"
echo "  ./scripts/start-all.sh"
echo ""
echo "Tarayıcıda açın: http://localhost:3000"
echo ""
echo "Giriş Bilgileri:"
echo "  Email: admin@clixer"
echo "  Şifre: Admin1234!"
echo ""

#!/bin/bash
# ============================================
# CLIXER - Tüm Müşterileri Güncelleme Scripti
# Bu script sizin bilgisayarınızda çalışır
# ============================================
# Kullanım: bash deploy/update-all-customers.sh v4.0.6
# veya: bash deploy/update-all-customers.sh (latest için)

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_customer() { echo -e "${CYAN}[CUSTOMER]${NC} $1"; }

VERSION=${1:-"latest"}
CUSTOMERS_FILE="deploy/customers.txt"
LOG_FILE="deploy/update_$(date +%Y%m%d_%H%M%S).log"

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "   CLIXER - Toplu Müşteri Güncellemesi"
echo "   Hedef Versiyon: $VERSION"
echo "   Log Dosyası: $LOG_FILE"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Müşteri dosyası kontrolü
if [ ! -f "$CUSTOMERS_FILE" ]; then
    log_error "Müşteri listesi bulunamadı: $CUSTOMERS_FILE"
    log_info "Örnek dosya oluşturuluyor..."
    cat > $CUSTOMERS_FILE << 'EOF'
# CLIXER Müşteri Listesi
# Format: user@hostname   # Açıklama
# Satır başına # ile yorum ekleyebilirsiniz

# Örnek:
# root@192.168.1.100     # Müşteri A - Test sunucusu
# clixer@musteri-b.com   # Müşteri B - Production
# root@10.0.0.50         # Müşteri C - Restoran zinciri

EOF
    log_warn "Lütfen $CUSTOMERS_FILE dosyasını düzenleyip müşterileri ekleyin!"
    exit 1
fi

# Müşterileri oku (yorumları ve boş satırları filtrele)
CUSTOMERS=($(grep -v '^#' $CUSTOMERS_FILE | grep -v '^$' | awk '{print $1}'))

if [ ${#CUSTOMERS[@]} -eq 0 ]; then
    log_error "Müşteri listesi boş!"
    exit 1
fi

log_info "Toplam ${#CUSTOMERS[@]} müşteri güncellenecek"
echo ""

# Onay al
read -p "Devam etmek istiyor musunuz? (y/N): " confirm
if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    log_info "Güncelleme iptal edildi."
    exit 0
fi

echo ""
echo "═══════════════════════════════════════════════════════════════" | tee -a $LOG_FILE
echo "Güncelleme Başladı: $(date)" | tee -a $LOG_FILE
echo "═══════════════════════════════════════════════════════════════" | tee -a $LOG_FILE
echo ""

# Sonuç sayaçları
SUCCESS=0
FAILED=0
FAILED_LIST=()

# Her müşteri için güncelleme
for i in "${!CUSTOMERS[@]}"; do
    CUSTOMER="${CUSTOMERS[$i]}"
    INDEX=$((i + 1))
    
    echo "" | tee -a $LOG_FILE
    echo "───────────────────────────────────────────────────────────────" | tee -a $LOG_FILE
    log_customer "[$INDEX/${#CUSTOMERS[@]}] $CUSTOMER" | tee -a $LOG_FILE
    echo "───────────────────────────────────────────────────────────────" | tee -a $LOG_FILE
    
    # SSH bağlantı testi
    if ! ssh -o ConnectTimeout=10 -o BatchMode=yes $CUSTOMER "echo 'SSH OK'" &>/dev/null; then
        log_error "SSH bağlantısı başarısız: $CUSTOMER" | tee -a $LOG_FILE
        FAILED=$((FAILED + 1))
        FAILED_LIST+=("$CUSTOMER")
        continue
    fi
    
    # Güncelleme scriptini çalıştır
    if ssh -o ConnectTimeout=60 $CUSTOMER "bash /opt/clixer/scripts/update.sh $VERSION" 2>&1 | tee -a $LOG_FILE; then
        log_info "✅ $CUSTOMER güncellendi" | tee -a $LOG_FILE
        SUCCESS=$((SUCCESS + 1))
    else
        log_error "❌ $CUSTOMER güncelleme başarısız!" | tee -a $LOG_FILE
        FAILED=$((FAILED + 1))
        FAILED_LIST+=("$CUSTOMER")
    fi
done

# Özet
echo ""
echo "═══════════════════════════════════════════════════════════════" | tee -a $LOG_FILE
echo "   GÜNCELLEME TAMAMLANDI" | tee -a $LOG_FILE
echo "   Tarih: $(date)" | tee -a $LOG_FILE
echo "═══════════════════════════════════════════════════════════════" | tee -a $LOG_FILE
echo "" | tee -a $LOG_FILE
echo -e "   ${GREEN}✅ Başarılı: $SUCCESS${NC}" | tee -a $LOG_FILE
echo -e "   ${RED}❌ Başarısız: $FAILED${NC}" | tee -a $LOG_FILE
echo "" | tee -a $LOG_FILE

if [ $FAILED -gt 0 ]; then
    echo "   Başarısız Müşteriler:" | tee -a $LOG_FILE
    for customer in "${FAILED_LIST[@]}"; do
        echo "     - $customer" | tee -a $LOG_FILE
    done
    echo "" | tee -a $LOG_FILE
fi

echo "   Log dosyası: $LOG_FILE" | tee -a $LOG_FILE
echo "" | tee -a $LOG_FILE


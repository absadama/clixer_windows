# CLİXER
## Enterprise Analytics Platform
### "Olağanüstü Veri Hızı"

---

# SLAYT 1: KAPAK

**CLİXER**
*Enterprise Analytics Platform*

> "Verilerinizi saniyeler içinde aksiyona dönüştürün"

**Power BI | Tableau | Qlik** alternatifi
On-Premise | Özelleştirilebilir | Türk Mühendisliği

---

# SLAYT 2: PROBLEM

## Kurumsal Analitik Zorlukları

| Problem | Etki |
|---------|------|
| **Yavaş raporlar** | Yöneticiler güncel veri bekliyor |
| **Yüksek lisans maliyeti** | Power BI: $10/kullanıcı/ay |
| **Veri güvenliği endişesi** | Bulutta veri = Risk |
| **Özelleştirme kısıtları** | Her şirket farklı |
| **IT bağımlılığı** | Her rapor için IT talebi |

**Sonuç:** Kararlar geç alınıyor, fırsatlar kaçıyor.

---

# SLAYT 3: ÇÖZÜM

## Clixer: Hız + Güvenlik + Esneklik

```
┌─────────────────────────────────────────┐
│                                         │
│         VERİ KAYNAKLARI                 │
│   MSSQL │ PostgreSQL │ MySQL │ API     │
│                                         │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│              CLİXER                     │
│         ClickHouse OLAP Engine          │
│         100M+ satır < 1 saniye          │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│          DASHBOARD                      │
│    Real-time │ Drag & Drop │ Mobile    │
└─────────────────────────────────────────┘
```

---

# SLAYT 4: PERFORMANS KARŞILAŞTIRMASI

## Clixer vs Rakipler - Hız Testi

| Metrik | Power BI | Tableau | Clixer |
|--------|----------|---------|--------|
| **10M satır sorgu** | 8-12 sn | 6-10 sn | **< 1 sn** |
| **Dashboard yükleme** | 3-5 sn | 2-4 sn | **< 500 ms** |
| **Veri yenileme** | 15 dk (min) | 15 dk | **Anlık** |
| **Eşzamanlı kullanıcı** | 25/kapas. | 50/kapas. | **400+** |

### Neden Bu Kadar Hızlı?

✅ **ClickHouse** - Kolon bazlı OLAP database (Yandex teknolojisi)
✅ **Pre-aggregation** - Veriler önceden hesaplanmış
✅ **Multi-layer cache** - 4 katmanlı önbellek
✅ **Streaming ETL** - Veri akışı kesintisiz

---

# SLAYT 5: ÖNE ÇIKAN ÖZELLİKLER

## 19 Widget Tipi

| Kategori | Widget'lar |
|----------|------------|
| **Özet** | KPI Kartı, Big Number |
| **Karşılaştırma** | YoY, MoM, WoW, Ranking |
| **Trend** | Sparkline, Gauge, Progress |
| **Grafik** | Bar, Line, Area, Pie, Donut |
| **Gelişmiş** | Heatmap, Treemap, Funnel, Scatter |
| **Coğrafi** | Harita (Leaflet) |

## No-Code Dashboard Tasarımı

- Sürükle & Bırak
- Canlı önizleme
- Mobil uyumlu
- 5 tema seçeneği

---

# SLAYT 6: VERİ GÜVENLİĞİ

## Kurumsal Seviye Güvenlik

| Özellik | Açıklama |
|---------|----------|
| **On-Premise** | Veri sizin sunucunuzda kalır |
| **Row-Level Security** | Kullanıcı sadece yetkili veriyi görür |
| **2FA (TOTP)** | İki faktörlü doğrulama |
| **Rol & Pozisyon** | ADMIN, MANAGER, USER, VIEWER |
| **Audit Log** | Kim, ne zaman, ne yaptı? |
| **Şifreli bağlantı** | HTTPS, JWT, bcrypt |

### Veri Hiyerarşisi

```
Genel Müdür ──────► TÜM VERİ
Bölge Müdürü ─────► Kendi Bölgesi
Mağaza Müdürü ────► Kendi Mağazası
```

---

# SLAYT 7: ETL & VERİ ENTEGRASYONU

## Desteklenen Veri Kaynakları

| Kaynak | Protokol |
|--------|----------|
| **Microsoft SQL Server** | TDS |
| **PostgreSQL** | Native |
| **MySQL / MariaDB** | Native |
| **Oracle** | OCI |
| **REST API** | HTTP/JSON |
| **Excel / CSV** | Dosya |

## Akıllı Sync Stratejileri

| Strateji | Kullanım |
|----------|----------|
| **Full Refresh** | Küçük tablolar |
| **ID-Based** | Büyük tablolar (cursor) |
| **Date Partition** | Satış verileri |
| **Timestamp** | Değişen kayıtlar |

**Streaming ETL:** 5.000'lik batch'lerle bellek dostu aktarım

---

# SLAYT 8: MALİYET KARŞILAŞTIRMASI

## Yıllık Toplam Sahip Olma Maliyeti (100 Kullanıcı)

| Çözüm | Lisans | Altyapı | Toplam/Yıl |
|-------|--------|---------|------------|
| **Power BI Premium** | $60.000 | $12.000 | **$72.000** |
| **Tableau Server** | $84.000 | $15.000 | **$99.000** |
| **Qlik Sense** | $75.000 | $12.000 | **$87.000** |
| **Clixer** | Tek seferlik | $6.000 | **%80 tasarruf** |

### Clixer Avantajı

✅ Yıllık lisans ÖDEMESİ YOK
✅ Kullanıcı başına ücret YOK
✅ Sınırsız dashboard
✅ Sınırsız veri kaynağı

---

# SLAYT 9: TEKNİK MİMARİ

## Mikroservis Mimarisi

```
┌────────────────────────────────────────────────────┐
│                   FRONTEND                         │
│              React 19 + TypeScript                 │
└────────────────────────┬───────────────────────────┘
                         │
┌────────────────────────▼───────────────────────────┐
│                  API GATEWAY                       │
│               Rate Limiting + Auth                 │
└────────────────────────┬───────────────────────────┘
                         │
     ┌───────────────────┼───────────────────┐
     ▼                   ▼                   ▼
┌─────────┐       ┌─────────────┐      ┌─────────┐
│  Auth   │       │  Analytics  │      │   ETL   │
│ Service │       │   Service   │      │ Worker  │
└────┬────┘       └──────┬──────┘      └────┬────┘
     │                   │                  │
     ▼                   ▼                  ▼
┌─────────────────────────────────────────────────────┐
│   PostgreSQL    │   ClickHouse    │    Redis       │
│     (OLTP)      │     (OLAP)      │   (Cache)      │
└─────────────────────────────────────────────────────┘
```

## Teknoloji Yığını

| Katman | Teknoloji |
|--------|-----------|
| Frontend | React 19, Vite, TailwindCSS |
| Backend | Node.js, Express, TypeScript |
| OLTP DB | PostgreSQL 15 |
| OLAP DB | ClickHouse (100M+ satır) |
| Cache | Redis 7 |
| Container | Docker, Docker Compose |

---

# SLAYT 10: KULLANIM SENARYOLARI

## Perakende Zinciri

- 500 mağaza, 10.000 SKU
- Günlük 1M+ transaction
- Anlık satış takibi
- Stok optimizasyonu
- Bölge performans karşılaştırması

## Restoran Zinciri

- 200 şube
- Saat bazlı ciro analizi
- Ürün bazlı karlılık
- Franchise vs Merkez karşılaştırması

## Üniversite

- 50.000 öğrenci
- Fakülte bazlı tahsilat
- Dönemsel analiz
- Burs dağılımı

---

# SLAYT 11: DEMO EKRAN GÖRÜNTÜLERİ

## Dashboard Örneği

```
┌─────────────────────────────────────────────────────────┐
│  📊 Satış Kokpiti                      [Bugün ▼] [🔄]  │
├─────────────────────────────────────────────────────────┤
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐        │
│ │ ₺14.3M  │ │  2.847  │ │  ₺5.024 │ │  +12.5% │        │
│ │ Toplam  │ │ İşlem   │ │ Ort.    │ │ vs Dün  │        │
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘        │
│                                                         │
│ ┌─────────────────────┐ ┌─────────────────────┐        │
│ │  [BAR CHART]        │ │  [PIE CHART]        │        │
│ │  Bölge Satışları    │ │  Kategori Dağılımı  │        │
│ └─────────────────────┘ └─────────────────────┘        │
│                                                         │
│ ┌───────────────────────────────────────────────┐      │
│ │  [TOP 10 MAĞAZA TABLOSU]                      │      │
│ │  Mağaza  │ Satış │ Hedef │ Gerçekleşme        │      │
│ └───────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────┘
```

---

# SLAYT 12: KURULUM & DESTEK

## Hızlı Kurulum

```bash
git clone https://github.com/absadama/clixer.git
cd clixer
install.bat    # Windows
start.bat      # Başlat
```

**Kurulum süresi:** < 15 dakika

## Gereksinimler

| Bileşen | Minimum |
|---------|---------|
| CPU | 4 Core |
| RAM | 16 GB |
| Disk | 100 GB SSD |
| OS | Windows Server / Linux |
| Docker | ✅ Gerekli |

## Destek

- Dokümantasyon
- Eğitim videoları
- Teknik destek
- Özelleştirme hizmeti

---

# SLAYT 13: YATIRMCI İÇİN

## Büyüme Potansiyeli

| Metrik | Değer |
|--------|-------|
| **Hedef Pazar** | Türkiye + Ortadoğu + Türki Cumhuriyetler |
| **TAM** | $2.5 Milyar (BI pazarı) |
| **Hedef Segment** | Orta-büyük ölçekli şirketler |
| **Rekabet Avantajı** | Yerel, on-premise, uygun fiyat |

## Neden Şimdi?

✅ Veri gizliliği yasaları sıkılaşıyor (KVKK, GDPR)
✅ Bulut maliyetleri artıyor
✅ Yerli yazılım teşvikleri
✅ Dijital dönüşüm hızlanıyor

---

# SLAYT 14: REFERANSLAR & METRIKLER

## Teknik Metrikler

| Metrik | Değer |
|--------|-------|
| Kod satırı | 71.000+ |
| Dosya sayısı | 116 |
| Widget tipi | 19 |
| Mikroservis | 6 |
| Test edilen veri | 10M+ satır |
| Eşzamanlı kullanıcı | 400+ |

## Geliştirme

| Bilgi | Değer |
|-------|-------|
| Başlangıç | 20 Aralık 2025 |
| Mevcut versiyon | v5.3.0 |
| Commit sayısı | 3 |
| GitHub | github.com/absadama/clixer |

---

# SLAYT 15: SONUÇ

## Neden Clixer?

| Kriter | Power BI | Tableau | Clixer |
|--------|----------|---------|--------|
| **Hız** | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Maliyet** | ⭐⭐ | ⭐ | ⭐⭐⭐⭐⭐ |
| **Güvenlik** | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Esneklik** | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Yerel Destek** | ⭐ | ⭐ | ⭐⭐⭐⭐⭐ |

## Bir Sonraki Adım

📧 demo@clixer.com
🌐 www.clixer.com
📱 +90 XXX XXX XX XX

**"Verilerinizi hızla aksiyona dönüştürün"**

---

# EK: TEKNİK DETAYLAR

## ClickHouse Performans Sırları

1. **Kolon Bazlı Depolama** - Sadece gerekli kolonlar okunur
2. **Vektörel İşlem** - SIMD ile paralel hesaplama
3. **Sıkıştırma** - LZ4/ZSTD ile 10x sıkıştırma
4. **Materialized Views** - Pre-aggregation

## Cache Katmanları

```
L1: Browser (IndexedDB) ─────► 1ms
L2: Redis (Memory) ──────────► 5ms
L3: ClickHouse MV ───────────► 50ms
L4: ClickHouse Raw ──────────► 200ms
```

## API Yanıt Süreleri

| Endpoint | Ortalama |
|----------|----------|
| Login | 150ms |
| Dashboard yükle | 300ms |
| KPI sorgula | 80ms |
| Grafik verisi | 120ms |
| ETL durumu | 50ms |

---

*Clixer - Enterprise Analytics Platform*
*© 2025 Tüm hakları saklıdır.*


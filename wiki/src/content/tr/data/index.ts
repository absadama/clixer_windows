import type { Article } from '../../../types/article'

export const articlesTr: Article[] = [
  {
    id: 'data-veri-yonetimi-nedir',
    slug: 'veri-yonetimi-nedir',
    title: 'Veri Yönetimi Nedir?',
    excerpt: 'Clixer veri yönetimi modülünün genel tanıtımı.',
    category: 'data',
    categoryLabel: 'Veri Yönetimi',
    tags: ['veri', 'yönetim', 'bağlantı', 'dataset', 'etl'],
    images: [],
    relatedArticles: ['data-baglanti-olusturma', 'data-dataset-olusturma'],
    lastUpdated: '2026-01-27',
    readingTime: 5,
    order: 1,
    content: `
# Veri Yönetimi Nedir?

Veri Yönetimi, Clixer'ın verilerinizi yönettiği modüldür. Veritabanı bağlantıları, dataset'ler ve ETL işlemleri bu modülden yönetilir.

## Veri Akışı

\`\`\`
Kaynak Veritabanı → Bağlantı → Dataset → ETL → ClickHouse → Metrik → Dashboard
\`\`\`

## Ana Bileşenler

### 1. Bağlantılar
Kaynak veritabanlarına erişim sağlar.
- SQL Server, PostgreSQL, MySQL
- REST API

### 2. Dataset'ler
Çekilecek verilerin tanımı.
- Kaynak tablo/sorgu
- Kolon seçimi
- Partition ayarları

### 3. ETL İşlemleri
Veri aktarım süreçleri.
- Manuel çalıştırma
- Zamanlanmış görevler
- Artımlı güncelleme

### 4. ClickHouse
Analitik veritabanı.
- Hızlı sorgulama
- Büyük veri desteği
- Kolon bazlı depolama

## Veri Menüsü

Sol menüden **Veri** seçtiğinizde:

| Sekme | Açıklama |
|-------|----------|
| Bağlantılar | Veritabanı bağlantıları |
| Dataset'ler | Veri kümeleri |
| ETL | Aktarım işlemleri |
| ClickHouse | Analitik tablolar |

## Sonraki Adımlar

1. [Bağlantı Oluşturma](/data/baglanti-olusturma)
2. [Dataset Oluşturma](/data/dataset-olusturma)
3. [ETL Çalıştırma](/data/etl-calistirma)
`
  },
  {
    id: 'data-baglanti-olusturma',
    slug: 'baglanti-olusturma',
    title: 'Bağlantı Oluşturma',
    excerpt: 'Kaynak veritabanına bağlantı oluşturun.',
    category: 'data',
    categoryLabel: 'Veri Yönetimi',
    tags: ['bağlantı', 'veritabanı', 'connection', 'sql server'],
    images: [],
    relatedArticles: ['data-mssql-baglantisi', 'data-dataset-olusturma'],
    lastUpdated: '2026-01-27',
    readingTime: 6,
    order: 2,
    content: `
# Bağlantı Oluşturma

Kaynak veritabanınıza bağlantı oluşturmak için bu rehberi takip edin.

## Bağlantı Sayfasını Açın

1. Sol menüden **Veri** seçin
2. **Bağlantılar** sekmesine tıklayın
3. **+ Yeni Bağlantı** butonuna tıklayın

## Bağlantı Bilgileri

### Bağlantı Adı
Anlamlı bir isim verin: "ERP Veritabanı", "Satış DB"

### Bağlantı Tipi
Desteklenen tipler:
- Microsoft SQL Server
- PostgreSQL
- MySQL
- REST API

### Sunucu Bilgileri

| Alan | Açıklama | Örnek |
|------|----------|-------|
| Host | Sunucu adresi | 192.168.1.100 |
| Port | Bağlantı portu | 1433 (MSSQL) |
| Database | Veritabanı adı | ERP_DB |
| Username | Kullanıcı adı | clixer_user |
| Password | Şifre | ******** |

## Bağlantı Testi

1. Tüm bilgileri girin
2. **Test Et** butonuna tıklayın
3. "Bağlantı başarılı" mesajını bekleyin

### Test Başarısız Olursa

| Hata | Olası Neden | Çözüm |
|------|-------------|-------|
| Connection timeout | Sunucu erişilemez | Firewall/ağ kontrolü |
| Login failed | Yanlış kimlik | Kullanıcı/şifre kontrolü |
| Database not found | Yanlış DB adı | Veritabanı adını kontrol |

## Kaydetme

Test başarılı olduktan sonra **Kaydet** butonuna tıklayın.

## Güvenlik

> ⚠️ Şifreler şifreli olarak saklanır.

> 💡 Sadece okuma yetkisi olan kullanıcı oluşturun.

> 💡 IP whitelist kullanın.

## Sonraki Adımlar

- [Dataset Oluşturma](/data/dataset-olusturma)
- [MSSQL Bağlantısı](/data/mssql-baglantisi)
`
  },
  {
    id: 'data-mssql-baglantisi',
    slug: 'mssql-baglantisi',
    title: 'SQL Server Bağlantısı',
    excerpt: 'Microsoft SQL Server veritabanına bağlanın.',
    category: 'data',
    categoryLabel: 'Veri Yönetimi',
    tags: ['mssql', 'sql server', 'microsoft', 'bağlantı'],
    images: [],
    relatedArticles: ['data-baglanti-olusturma', 'data-postgresql-baglantisi'],
    lastUpdated: '2026-01-27',
    readingTime: 5,
    order: 3,
    content: `
# SQL Server Bağlantısı

Microsoft SQL Server veritabanına bağlantı oluşturma rehberi.

## Gereksinimler

- SQL Server 2012 veya üzeri
- TCP/IP protokolü aktif
- Clixer sunucusundan erişim izni

## Bağlantı Ayarları

| Alan | Değer |
|------|-------|
| Tip | Microsoft SQL Server |
| Port | 1433 (varsayılan) |
| Şifreleme | Opsiyonel |

## SQL Server Kullanıcısı Oluşturma

\`\`\`sql
-- Kullanıcı oluştur
CREATE LOGIN clixer_reader WITH PASSWORD = 'GucluSifre123!';

-- Veritabanında kullanıcı oluştur
USE ERP_DB;
CREATE USER clixer_reader FOR LOGIN clixer_reader;

-- Okuma yetkisi ver
EXEC sp_addrolemember 'db_datareader', 'clixer_reader';
\`\`\`

## Firewall Ayarları

SQL Server'ın 1433 portunu açın:
- Windows Firewall'da kural ekleyin
- Ağ güvenlik grubunda izin verin

## Named Instance

Named instance kullanıyorsanız:
- Host: sunucu\\instance_adi
- Port: Dinamik port numarası

## Yaygın Hatalar

### Login Failed
- Kullanıcı adı/şifre yanlış
- SQL Authentication kapalı

### Connection Timeout
- Firewall engeli
- Yanlış IP/port

### Cannot Open Database
- Veritabanı adı yanlış
- Kullanıcının erişim yetkisi yok

## İpuçları

> 💡 Windows Authentication yerine SQL Authentication kullanın.

> 💡 Sadece gerekli tabloları okuma yetkisi verin.

> ⚠️ SA kullanıcısı kullanmayın!
`
  },
  {
    id: 'data-dataset-olusturma',
    slug: 'dataset-olusturma',
    title: 'Dataset Oluşturma',
    excerpt: 'Yeni bir dataset tanımlayın.',
    category: 'data',
    categoryLabel: 'Veri Yönetimi',
    tags: ['dataset', 'veri', 'tablo', 'oluşturma'],
    images: [],
    relatedArticles: ['data-dataset-ayarlari', 'data-etl-calistirma'],
    lastUpdated: '2026-01-27',
    readingTime: 7,
    order: 4,
    content: `
# Dataset Oluşturma

Dataset, kaynak veritabanından Clixer'a aktarılacak veri kümesidir.

## Dataset Sayfasını Açın

1. Sol menüden **Veri** seçin
2. **Dataset'ler** sekmesine tıklayın
3. **+ Yeni Dataset** butonuna tıklayın

## Temel Bilgiler

### Dataset Adı
Anlamlı bir isim: "Günlük Satışlar", "Mağaza Listesi"

### Bağlantı Seçimi
Hangi veritabanından veri çekileceği.

## Veri Kaynağı

### Tablo Seçimi
Mevcut bir tabloyu seçin:
1. **Tablo Seç** dropdown'ından seçin
2. Kolonlar otomatik listelenir

### Özel Sorgu
Karmaşık veri için SQL yazın:
\`\`\`sql
SELECT 
  tarih,
  magaza_id,
  SUM(tutar) as toplam_tutar,
  COUNT(*) as islem_adedi
FROM satislar
WHERE tarih >= '2025-01-01'
GROUP BY tarih, magaza_id
\`\`\`

## Kolon Seçimi

Hangi kolonların aktarılacağını seçin:

| Kolon | Tip | Seçili |
|-------|-----|--------|
| tarih | Date | ✅ |
| magaza_id | String | ✅ |
| tutar | Float | ✅ |
| aciklama | String | ❌ |

> 💡 Gereksiz kolonları seçmeyin, performansı etkiler.

## Partition Kolonu

Tarih bazlı bölümleme için partition kolonu seçin:

- Artımlı ETL için gerekli
- Genellikle tarih kolonu seçilir
- Sorgu performansını artırır

## Önizleme

**Önizleme** butonuyla ilk 100 satırı görün.

## Kaydetme

1. Tüm ayarları yapın
2. **Kaydet** butonuna tıklayın
3. ETL çalıştırmaya hazır

## Sonraki Adımlar

- [Dataset Ayarları](/data/dataset-ayarlari)
- [ETL Çalıştırma](/data/etl-calistirma)
`
  },
  {
    id: 'data-dataset-ayarlari',
    slug: 'dataset-ayarlari',
    title: 'Dataset Ayarları',
    excerpt: 'Partition, reference kolonu ve diğer ayarlar.',
    category: 'data',
    categoryLabel: 'Veri Yönetimi',
    tags: ['dataset', 'ayarlar', 'partition', 'reference'],
    images: [],
    relatedArticles: ['data-dataset-olusturma', 'data-etl-nedir'],
    lastUpdated: '2026-01-27',
    readingTime: 5,
    order: 5,
    content: `
# Dataset Ayarları

Dataset'in ileri düzey ayarlarını yapılandırın.

## Partition Kolonu

### Nedir?
Veriyi tarih bazlı bölümleyen kolon. ETL'de artımlı güncelleme için kullanılır.

### Nasıl Seçilir?
- Tarih tipinde kolon olmalı
- Genellikle "tarih", "created_at", "islem_tarihi"
- Her satırda değer olmalı (NULL olmamalı)

### Faydaları
- Artımlı ETL mümkün olur
- Sorgu performansı artar
- Depolama optimize edilir

## Reference Kolonu

### Nedir?
RLS (Row Level Security) için kullanılan kolon.

### Örnekler
- magaza_id: Mağaza bazlı filtreleme
- bolge_id: Bölge bazlı filtreleme
- kullanici_id: Kullanıcı bazlı filtreleme

## Veri Tipi Eşleştirme

Kaynak ve hedef veri tiplerini eşleştirin:

| Kaynak (SQL Server) | Hedef (ClickHouse) |
|---------------------|-------------------|
| INT | Int32 |
| BIGINT | Int64 |
| VARCHAR | String |
| DECIMAL | Float64 |
| DATETIME | DateTime |
| DATE | Date |

## Kolon Adı Düzenleme

Kolon adlarını değiştirebilirsiniz:
- Türkçe karakter kullanmayın
- Boşluk yerine alt çizgi
- Küçük harf önerilir

## Varsayılan Değerler

NULL değerler için varsayılan:
- Sayısal: 0
- Metin: ''
- Tarih: Belirtilmeli

## İpuçları

> 💡 Partition kolonu indekslenmiş olmalı.

> 💡 Reference kolonu RLS için kritiktir.

> ⚠️ Kolon tipi değişikliği ETL'i bozabilir.
`
  },
  {
    id: 'data-etl-nedir',
    slug: 'etl-nedir',
    title: 'ETL Nedir?',
    excerpt: 'Extract, Transform, Load kavramını öğrenin.',
    category: 'data',
    categoryLabel: 'Veri Yönetimi',
    tags: ['etl', 'extract', 'transform', 'load'],
    images: [],
    relatedArticles: ['data-etl-calistirma', 'data-zamanlanmis-etl'],
    lastUpdated: '2026-01-27',
    readingTime: 5,
    order: 6,
    content: `
# ETL Nedir?

ETL (Extract, Transform, Load), veri aktarım sürecinin üç aşamasıdır.

## ETL Aşamaları

### 1. Extract (Çıkarma)
Kaynak veritabanından veri çekme.

- SQL sorgusu çalıştırılır
- Veriler okunur
- Belleğe alınır

### 2. Transform (Dönüştürme)
Veriyi hedef formata dönüştürme.

- Veri tipi dönüşümü
- Temizleme
- Hesaplama

### 3. Load (Yükleme)
Hedef veritabanına yazma.

- ClickHouse'a aktarım
- Partition bazlı yazma
- İndeksleme

## ETL Türleri

### Full Load
Tüm veriyi baştan yükler.
- İlk kurulumda kullanılır
- Uzun sürer
- Tüm veriyi siler ve yeniden yazar

### Incremental Load
Sadece değişen veriyi yükler.
- Günlük/saatlik güncellemeler
- Hızlı
- Partition kolonuna göre çalışır

## ETL Akışı

\`\`\`
Kaynak DB → Extract → Transform → Load → ClickHouse
    ↓           ↓          ↓         ↓
  Sorgu     Okuma     Dönüşüm    Yazma
\`\`\`

## Clixer'da ETL

Clixer, ETL işlemlerini otomatik yönetir:
- Manuel tetikleme
- Zamanlanmış çalıştırma
- Hata yönetimi
- Log tutma

## Sonraki Adımlar

- [ETL Çalıştırma](/data/etl-calistirma)
- [Zamanlanmış ETL](/data/zamanlanmis-etl)
`
  },
  {
    id: 'data-etl-calistirma',
    slug: 'etl-calistirma',
    title: 'ETL Çalıştırma',
    excerpt: 'Manuel ETL işlemi başlatın.',
    category: 'data',
    categoryLabel: 'Veri Yönetimi',
    tags: ['etl', 'çalıştırma', 'manuel', 'senkronizasyon'],
    images: [],
    relatedArticles: ['data-etl-nedir', 'data-zamanlanmis-etl'],
    lastUpdated: '2026-01-27',
    readingTime: 5,
    order: 7,
    content: `
# ETL Çalıştırma

Manuel olarak ETL işlemi başlatmak için bu rehberi takip edin.

## ETL Sayfasını Açın

1. Sol menüden **Veri** seçin
2. **ETL** sekmesine tıklayın

## Dataset Seçimi

ETL çalıştırılacak dataset'i seçin:
1. Dataset listesinden seçin
2. Veya "Tümü" ile hepsini çalıştırın

## ETL Tipi Seçimi

### Full Sync
- Tüm veriyi siler ve yeniden yükler
- İlk kurulumda kullanın
- Uzun sürer

### Incremental Sync
- Sadece yeni/değişen veriyi yükler
- Günlük kullanım için
- Hızlı

## Tarih Aralığı

Incremental sync için tarih aralığı belirleyin:
- Başlangıç tarihi
- Bitiş tarihi

## Çalıştırma

1. **Başlat** butonuna tıklayın
2. İlerleme çubuğunu takip edin
3. Tamamlanma mesajını bekleyin

## ETL Durumları

| Durum | Açıklama |
|-------|----------|
| Bekliyor | Sırada |
| Çalışıyor | İşlem devam ediyor |
| Tamamlandı | Başarılı |
| Hatalı | Başarısız |

## Hata Durumunda

1. Hata mesajını okuyun
2. Log detaylarını inceleyin
3. Sorunu giderin
4. Tekrar çalıştırın

## İpuçları

> 💡 İlk ETL'de Full Sync kullanın.

> 💡 Günlük güncellemeler için Incremental yeterli.

> ⚠️ Full Sync sırasında dashboard'lar etkilenebilir.
`
  },
  {
    id: 'data-zamanlanmis-etl',
    slug: 'zamanlanmis-etl',
    title: 'Zamanlanmış ETL',
    excerpt: 'Otomatik ETL zamanlaması yapın.',
    category: 'data',
    categoryLabel: 'Veri Yönetimi',
    tags: ['etl', 'zamanlama', 'cron', 'otomatik'],
    images: [],
    relatedArticles: ['data-etl-calistirma', 'data-etl-nedir'],
    lastUpdated: '2026-01-27',
    readingTime: 5,
    order: 8,
    content: `
# Zamanlanmış ETL

ETL işlemlerini otomatik olarak çalıştırmak için zamanlama yapın.

## Zamanlama Ayarları

Dataset düzenleme ekranında **Zamanlama** bölümünü bulun.

### Zamanlama Tipi

| Tip | Açıklama | Örnek |
|-----|----------|-------|
| Saatlik | Her saat | Her saat başı |
| Günlük | Her gün | Her gece 02:00 |
| Haftalık | Haftada bir | Her Pazartesi |
| Özel | Cron ifadesi | */30 * * * * |

### Cron İfadesi

Özel zamanlama için cron formatı:
\`\`\`
* * * * *
│ │ │ │ │
│ │ │ │ └── Haftanın günü (0-7)
│ │ │ └──── Ay (1-12)
│ │ └────── Ayın günü (1-31)
│ └──────── Saat (0-23)
└────────── Dakika (0-59)
\`\`\`

### Örnekler

| İfade | Açıklama |
|-------|----------|
| 0 2 * * * | Her gün 02:00 |
| 0 */4 * * * | Her 4 saatte |
| 0 0 * * 1 | Her Pazartesi gece yarısı |
| */30 * * * * | Her 30 dakikada |

## Zamanlama Aktifleştirme

1. Zamanlama tipini seçin
2. Saati/cron ifadesini girin
3. **Zamanlamayı Aktifleştir** toggle'ını açın
4. Kaydedin

## Zamanlama İzleme

ETL sekmesinde zamanlanmış görevleri görün:
- Son çalışma zamanı
- Sonraki çalışma zamanı
- Durum

## İpuçları

> 💡 Yoğun olmayan saatleri seçin (gece).

> 💡 Kaynak veritabanı yükünü düşünün.

> ⚠️ Çok sık zamanlama performansı etkileyebilir.
`
  },
  {
    id: 'data-clickhouse-yonetimi',
    slug: 'clickhouse-yonetimi',
    title: 'ClickHouse Yönetimi',
    excerpt: 'Analitik veritabanı tablolarını yönetin.',
    category: 'data',
    categoryLabel: 'Veri Yönetimi',
    tags: ['clickhouse', 'analitik', 'tablo', 'veritabanı'],
    images: [],
    relatedArticles: ['data-etl-nedir', 'advanced-performans-ipuclari'],
    lastUpdated: '2026-01-27',
    readingTime: 6,
    order: 9,
    content: `
# ClickHouse Yönetimi

ClickHouse, Clixer'ın analitik veritabanıdır. Hızlı sorgulama için optimize edilmiştir.

## ClickHouse Nedir?

- Kolon bazlı (columnar) veritabanı
- Büyük veri için optimize
- Gerçek zamanlı analitik
- Yüksek sıkıştırma oranı

## ClickHouse Sayfası

1. Sol menüden **Veri** seçin
2. **ClickHouse** sekmesine tıklayın

## Tablo Listesi

Mevcut tabloları görün:
- Tablo adı
- Satır sayısı
- Disk boyutu
- Son güncelleme

## Tablo Detayları

Tabloya tıklayarak detayları görün:
- Kolon listesi
- Veri tipleri
- Partition bilgisi
- İndeksler

## Sorgu Çalıştırma

Admin kullanıcıları SQL sorgusu çalıştırabilir:

\`\`\`sql
SELECT 
  toStartOfMonth(tarih) as ay,
  SUM(tutar) as toplam
FROM satis_gunluk
WHERE tarih >= '2025-01-01'
GROUP BY ay
ORDER BY ay
\`\`\`

> ⚠️ Sadece SELECT sorguları çalıştırılabilir.

## Tablo Temizleme

Eski verileri temizlemek için:
1. Tabloyu seçin
2. **Temizle** butonuna tıklayın
3. Tarih aralığı belirleyin
4. Onaylayın

## Performans İpuçları

> 💡 Partition kolonunu WHERE'de kullanın.

> 💡 Gereksiz kolonları SELECT'e eklemeyin.

> 💡 LIMIT kullanarak sonuç sayısını sınırlayın.

## Disk Kullanımı

Tablo boyutlarını izleyin:
- Büyük tablolar performansı etkileyebilir
- Eski verileri arşivleyin
- Gereksiz tabloları silin
`
  }
]

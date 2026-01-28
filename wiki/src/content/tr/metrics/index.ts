import type { Article } from '../../../types/article'

export const articlesTr: Article[] = [
  {
    id: 'metrics-metrik-nedir',
    slug: 'metrik-nedir',
    title: 'Metrik Nedir?',
    excerpt: 'Clixer\'da metrik kavramını ve ne işe yaradığını öğrenin.',
    category: 'metrics',
    categoryLabel: 'Metrikler',
    tags: ['metrik', 'kpi', 'temel', 'kavram'],
    images: [],
    relatedArticles: ['metrics-yeni-metrik-olusturma', 'getting-started-temel-kavramlar'],
    lastUpdated: '2026-01-27',
    readingTime: 5,
    order: 1,
    content: `
# Metrik Nedir?

Metrik, veriden hesaplanan anlamlı bir değerdir. Dashboard'larda gösterilen her sayı, grafik veya tablo bir metriğe bağlıdır.

## Metrik Bileşenleri

Bir metrik şu bileşenlerden oluşur:

| Bileşen | Açıklama | Örnek |
|---------|----------|-------|
| Dataset | Verinin kaynağı | Günlük Satışlar |
| Kolon | Hesaplanacak alan | tutar, adet |
| Hesaplama | İşlem tipi | SUM, AVG, COUNT |
| Görselleştirme | Gösterim şekli | Kart, Grafik, Tablo |

## Metrik Türleri

### 1. Özet Metrikler
Tek bir değer döndürür: Toplam, Ortalama, Sayım

**Örnek:** Toplam Ciro = SUM(tutar)

### 2. Trend Metrikler
Zaman bazlı değerler döndürür.

**Örnek:** Günlük Satış Trendi = SUM(tutar) GROUP BY tarih

### 3. Liste Metrikler
Çoklu satır döndürür.

**Örnek:** Mağaza Listesi = SELECT magaza, SUM(tutar) GROUP BY magaza

## Metrik vs Widget

| Metrik | Widget |
|--------|--------|
| Ne hesaplanacak | Nasıl gösterilecek |
| Veri tanımı | Görsel bileşen |
| Tekrar kullanılabilir | Tasarıma özgü |

Bir metrik birden fazla widget'ta kullanılabilir.

## Metrik Oluşturma Modları

### Kolon Seçimi Modu
Basit metrikler için. Dataset'ten kolon seçip hesaplama tipi belirlersiniz.

### SQL Modu
Karmaşık metrikler için. Özel SQL sorgusu yazarsınız.

## Sonraki Adımlar

- [Yeni Metrik Oluşturma](/metrics/yeni-metrik-olusturma)
- [Kolon Seçimi Modu](/metrics/kolon-secimi-modu)
- [SQL Modu](/metrics/sql-modu)
`
  },
  {
    id: 'metrics-yeni-metrik-olusturma',
    slug: 'yeni-metrik-olusturma',
    title: 'Yeni Metrik Oluşturma',
    excerpt: 'Adım adım yeni bir metrik oluşturun.',
    category: 'metrics',
    categoryLabel: 'Metrikler',
    tags: ['metrik', 'oluşturma', 'yeni', 'adım adım'],
    images: [],
    relatedArticles: ['metrics-kolon-secimi-modu', 'metrics-sql-modu'],
    lastUpdated: '2026-01-27',
    readingTime: 6,
    order: 2,
    content: `
# Yeni Metrik Oluşturma

Bu rehberde adım adım yeni bir metrik oluşturacaksınız.

## Metrik Sayfasını Açın

1. Sol menüden **Designer** seçin
2. **Metrikler** sekmesine tıklayın
3. **+ Yeni Metrik** butonuna tıklayın

## Temel Bilgiler

### Metrik Adı
Anlamlı bir isim verin:
- ✅ "Toplam Ciro"
- ✅ "Günlük Ziyaretçi Sayısı"
- ❌ "Metrik1"

### Metrik Kodu
Sistem tarafından otomatik oluşturulur. Değiştirmeniz gerekmez.

## Dataset Seçimi

1. **Dataset** dropdown'ından veri kaynağını seçin
2. Dataset kolonları otomatik yüklenir

> 💡 Dataset yoksa önce [Dataset Oluşturma](/data/dataset-olusturma) rehberine bakın.

## Hesaplama Modu Seçimi

### Kolon Seçimi
Basit metrikler için:
- Kolon seçin
- Hesaplama tipi belirleyin (SUM, AVG, COUNT)

### SQL Modu
Karmaşık metrikler için:
- Özel SQL sorgusu yazın
- UNION, JOIN gibi işlemler yapın

## Görselleştirme Tipi

Metriğin nasıl gösterileceğini seçin:

| Tip | Kullanım |
|-----|----------|
| Kart | Tek değer |
| Grafik | Trend |
| Tablo | Liste |
| Gösterge | Hedef takibi |

## Kaydetme

1. Tüm alanları doldurun
2. **Önizleme** ile test edin
3. **Kaydet** butonuna tıklayın

## Sonraki Adımlar

- [Hesaplama Tipleri](/metrics/hesaplama-tipleri)
- [Format Ayarları](/metrics/format-ayarlari)
- [Karşılaştırma Ayarları](/metrics/karsilastirma-ayarlari)
`
  },
  {
    id: 'metrics-kolon-secimi-modu',
    slug: 'kolon-secimi-modu',
    title: 'Kolon Seçimi Modu',
    excerpt: 'Dataset kolonundan basit metrik oluşturun.',
    category: 'metrics',
    categoryLabel: 'Metrikler',
    tags: ['kolon', 'seçim', 'basit', 'metrik'],
    images: [],
    relatedArticles: ['metrics-sql-modu', 'metrics-hesaplama-tipleri'],
    lastUpdated: '2026-01-27',
    readingTime: 5,
    order: 3,
    content: `
# Kolon Seçimi Modu

Kolon seçimi modu, SQL bilgisi gerektirmeden basit metrikler oluşturmanızı sağlar.

## Ne Zaman Kullanılır?

- Tek bir kolondan hesaplama yapılacaksa
- Basit toplam, ortalama, sayım işlemleri için
- Hızlıca metrik oluşturmak istediğinizde

## Adım Adım

### 1. Dataset Seçin
Dropdown'dan veri kaynağını seçin.

### 2. Kolon Seçin
Dataset kolonları listelenir. Hesaplanacak kolonu seçin.

### 3. Hesaplama Tipi Belirleyin

| Tip | Açıklama | Örnek |
|-----|----------|-------|
| SUM | Toplam | Toplam satış tutarı |
| AVG | Ortalama | Ortalama sepet tutarı |
| COUNT | Sayım | İşlem adedi |
| MIN | Minimum | En düşük fiyat |
| MAX | Maksimum | En yüksek satış |
| COUNT DISTINCT | Tekil sayım | Tekil müşteri sayısı |

### 4. Gruplama (Opsiyonel)
Trend veya liste metrikleri için gruplama kolonu seçin:
- Tarih: Günlük/Haftalık/Aylık trend
- Kategori: Kategori bazlı dağılım
- Mağaza: Mağaza bazlı liste

## Örnek: Toplam Ciro Metriği

1. Dataset: "Günlük Satışlar"
2. Kolon: "tutar"
3. Hesaplama: SUM
4. Gruplama: Yok (tek değer)

Sonuç: Seçili tarih aralığındaki toplam ciro

## Örnek: Günlük Satış Trendi

1. Dataset: "Günlük Satışlar"
2. Kolon: "tutar"
3. Hesaplama: SUM
4. Gruplama: "tarih" (günlük)

Sonuç: Her gün için ayrı toplam

## Sınırlamalar

Kolon seçimi modu şunları yapamaz:
- Birden fazla tabloyu birleştirme
- Karmaşık WHERE koşulları
- Alt sorgular

Bu durumlar için [SQL Modu](/metrics/sql-modu) kullanın.
`
  },
  {
    id: 'metrics-sql-modu',
    slug: 'sql-modu',
    title: 'SQL Modu',
    excerpt: 'Özel SQL sorgusu ile karmaşık metrikler oluşturun.',
    category: 'metrics',
    categoryLabel: 'Metrikler',
    tags: ['sql', 'sorgu', 'karmaşık', 'ileri düzey'],
    images: [],
    relatedArticles: ['metrics-kolon-secimi-modu', 'metrics-filtre-kosullari'],
    lastUpdated: '2026-01-27',
    readingTime: 8,
    order: 4,
    content: `
# SQL Modu

SQL modu, karmaşık hesaplamalar ve özel sorgular için kullanılır.

## Ne Zaman Kullanılır?

- Birden fazla tabloyu birleştirirken (UNION, JOIN)
- Karmaşık WHERE koşulları gerektiğinde
- Alt sorgular kullanılacaksa
- Özel hesaplamalar yapılacaksa

## SQL Modu Aktifleştirme

1. Metrik düzenleme ekranında **SQL Modu** toggle'ını açın
2. SQL editörü görünür

## Temel Kurallar

### 1. SELECT ile Başlayın
\`\`\`sql
SELECT SUM(tutar) as deger
FROM satis_gunluk
\`\`\`

### 2. Alias Kullanın
Sonuç kolonlarına alias verin:
\`\`\`sql
SELECT 
  SUM(tutar) as deger,
  tarih as tarih
\`\`\`

### 3. Tarih Filtresi Placeholder
Tarih filtreleri için placeholder kullanın:
\`\`\`sql
WHERE tarih BETWEEN {start_date} AND {end_date}
\`\`\`

## Örnek Sorgular

### Basit Toplam
\`\`\`sql
SELECT SUM(tutar) as deger
FROM satis_gunluk
WHERE tarih BETWEEN {start_date} AND {end_date}
\`\`\`

### Trend Sorgusu
\`\`\`sql
SELECT 
  tarih,
  SUM(tutar) as deger
FROM satis_gunluk
WHERE tarih BETWEEN {start_date} AND {end_date}
GROUP BY tarih
ORDER BY tarih
\`\`\`

### UNION ile Birleştirme
\`\`\`sql
SELECT 'Online' as kanal, SUM(tutar) as deger
FROM online_satis
WHERE tarih BETWEEN {start_date} AND {end_date}

UNION ALL

SELECT 'Mağaza' as kanal, SUM(tutar) as deger
FROM magaza_satis
WHERE tarih BETWEEN {start_date} AND {end_date}
\`\`\`

### Karşılaştırmalı Hesaplama
\`\`\`sql
SELECT 
  SUM(CASE WHEN tarih BETWEEN {start_date} AND {end_date} THEN tutar ELSE 0 END) as bu_donem,
  SUM(CASE WHEN tarih BETWEEN {prev_start_date} AND {prev_end_date} THEN tutar ELSE 0 END) as onceki_donem
FROM satis_gunluk
\`\`\`

## Placeholder'lar

| Placeholder | Açıklama |
|-------------|----------|
| {start_date} | Seçili başlangıç tarihi |
| {end_date} | Seçili bitiş tarihi |
| {prev_start_date} | Karşılaştırma başlangıç |
| {prev_end_date} | Karşılaştırma bitiş |
| {store_id} | Seçili mağaza ID |
| {region_id} | Seçili bölge ID |

## Önizleme ve Test

1. SQL'i yazın
2. **Önizleme** butonuna tıklayın
3. Sonuçları kontrol edin
4. Hata varsa düzeltin

> ⚠️ **Uyarı:** Sadece SELECT sorguları çalıştırılabilir. INSERT, UPDATE, DELETE yasaktır.

## İpuçları

> 💡 Karmaşık sorguları önce veritabanı aracında test edin.

> 💡 LIMIT kullanarak önizleme performansını artırın.

> 💡 Alias'ları Türkçe karaktersiz yazın.
`
  },
  {
    id: 'metrics-hesaplama-tipleri',
    slug: 'hesaplama-tipleri',
    title: 'Hesaplama Tipleri',
    excerpt: 'SUM, AVG, COUNT ve diğer hesaplama tiplerini öğrenin.',
    category: 'metrics',
    categoryLabel: 'Metrikler',
    tags: ['hesaplama', 'sum', 'avg', 'count', 'aggregation'],
    images: [],
    relatedArticles: ['metrics-kolon-secimi-modu', 'metrics-format-ayarlari'],
    lastUpdated: '2026-01-27',
    readingTime: 5,
    order: 5,
    content: `
# Hesaplama Tipleri

Metrik oluştururken kullanabileceğiniz hesaplama tiplerini öğrenin.

## Temel Hesaplama Tipleri

### SUM (Toplam)
Seçili kolondaki tüm değerlerin toplamı.

**Kullanım:** Toplam ciro, toplam adet
\`\`\`sql
SUM(tutar) -- Örnek: 150.000
\`\`\`

### AVG (Ortalama)
Seçili kolondaki değerlerin ortalaması.

**Kullanım:** Ortalama sepet tutarı, ortalama fiyat
\`\`\`sql
AVG(tutar) -- Örnek: 250.50
\`\`\`

### COUNT (Sayım)
Satır sayısı.

**Kullanım:** İşlem adedi, sipariş sayısı
\`\`\`sql
COUNT(*) -- Örnek: 1.250
\`\`\`

### COUNT DISTINCT (Tekil Sayım)
Tekil değer sayısı.

**Kullanım:** Tekil müşteri, tekil ürün
\`\`\`sql
COUNT(DISTINCT musteri_id) -- Örnek: 850
\`\`\`

### MIN (Minimum)
En küçük değer.

**Kullanım:** En düşük fiyat, ilk tarih
\`\`\`sql
MIN(fiyat) -- Örnek: 9.90
\`\`\`

### MAX (Maksimum)
En büyük değer.

**Kullanım:** En yüksek satış, son tarih
\`\`\`sql
MAX(tutar) -- Örnek: 25.000
\`\`\`

## Hesaplama Tipi Seçim Rehberi

| İhtiyaç | Hesaplama Tipi |
|---------|----------------|
| Toplam değer | SUM |
| Ortalama değer | AVG |
| Kaç adet | COUNT |
| Kaç farklı | COUNT DISTINCT |
| En düşük | MIN |
| En yüksek | MAX |

## Örnekler

| Metrik | Hesaplama |
|--------|-----------|
| Toplam Ciro | SUM(tutar) |
| Ortalama Sepet | AVG(tutar) |
| İşlem Adedi | COUNT(*) |
| Tekil Müşteri | COUNT(DISTINCT musteri_id) |
| Min. Fiyat | MIN(fiyat) |
| Max. Satış | MAX(tutar) |

## İpuçları

> 💡 NULL değerler hesaplamalarda otomatik olarak atlanır.

> 💡 COUNT(*) NULL dahil sayar, COUNT(kolon) NULL hariç sayar.

> 💡 AVG kullanırken 0 değerlerin etkisine dikkat edin.
`
  },
  {
    id: 'metrics-gorsellestime-tipleri',
    slug: 'gorsellestime-tipleri',
    title: 'Görselleştirme Tipleri',
    excerpt: 'Metriği kart, grafik veya tablo olarak gösterin.',
    category: 'metrics',
    categoryLabel: 'Metrikler',
    tags: ['görselleştirme', 'kart', 'grafik', 'tablo', 'widget'],
    images: [],
    relatedArticles: ['designer-widget-turleri', 'metrics-format-ayarlari'],
    lastUpdated: '2026-01-27',
    readingTime: 5,
    order: 6,
    content: `
# Görselleştirme Tipleri

Metriğin dashboard'da nasıl görüneceğini belirleyin.

## Görselleştirme Tipi Nedir?

Metrik tanımlarken seçtiğiniz görselleştirme tipi, bu metriğin hangi widget türlerinde kullanılabileceğini belirler.

## Tipler

### CARD (Kart)
Tek bir değer gösterir.

**Uygun Widget'lar:** Büyük Kart, Mini Kart, Büyük Sayı

**Sorgu Yapısı:**
\`\`\`sql
SELECT SUM(tutar) as deger
\`\`\`

### CHART (Grafik)
Zaman serisi veya kategorik veriler.

**Uygun Widget'lar:** Çizgi, Çubuk, Alan, Pasta Grafik

**Sorgu Yapısı:**
\`\`\`sql
SELECT tarih, SUM(tutar) as deger
GROUP BY tarih
\`\`\`

### LIST (Liste)
Çoklu satır, sıralama listesi.

**Uygun Widget'lar:** Sıralama Listesi

**Sorgu Yapısı:**
\`\`\`sql
SELECT magaza, SUM(tutar) as deger
GROUP BY magaza
ORDER BY deger DESC
LIMIT 10
\`\`\`

### DATA_GRID (Veri Tablosu)
Detaylı tablo görünümü.

**Uygun Widget'lar:** Veri Tablosu

**Sorgu Yapısı:**
\`\`\`sql
SELECT magaza, kategori, SUM(tutar) as tutar, COUNT(*) as adet
GROUP BY magaza, kategori
\`\`\`

### GAUGE (Gösterge)
Hedef takibi için.

**Uygun Widget'lar:** Gösterge, İlerleme Halkası

**Sorgu Yapısı:**
\`\`\`sql
SELECT SUM(tutar) as deger, hedef as hedef
\`\`\`

## Tip Seçim Rehberi

| İhtiyaç | Görselleştirme Tipi |
|---------|---------------------|
| Tek KPI | CARD |
| Trend görmek | CHART |
| TOP 10 listesi | LIST |
| Detaylı tablo | DATA_GRID |
| Hedef takibi | GAUGE |

## İpuçları

> 💡 Yanlış tip seçerseniz widget'ta veri görünmez.

> 💡 CHART tipi için mutlaka gruplama kolonu gerekir.

> 💡 LIST tipi için sıralama ve LIMIT önerilir.
`
  },
  {
    id: 'metrics-karsilastirma-ayarlari',
    slug: 'karsilastirma-ayarlari',
    title: 'Karşılaştırma Ayarları',
    excerpt: 'YoY, MoM, WoW gibi dönemsel karşılaştırmalar yapın.',
    category: 'metrics',
    categoryLabel: 'Metrikler',
    tags: ['karşılaştırma', 'yoy', 'mom', 'wow', 'trend'],
    images: [],
    relatedArticles: ['metrics-lfl-karsilastirma', 'metrics-format-ayarlari'],
    lastUpdated: '2026-01-27',
    readingTime: 6,
    order: 7,
    content: `
# Karşılaştırma Ayarları

Metriklerinizi önceki dönemlerle karşılaştırın.

## Karşılaştırma Nedir?

Karşılaştırma, seçili dönemdeki değeri önceki bir dönemle kıyaslamanızı sağlar. Böylece performansın artıp artmadığını görebilirsiniz.

## Karşılaştırma Türleri

### YoY (Year over Year)
Geçen yılın aynı dönemiyle karşılaştırma.

**Örnek:** Ocak 2026 vs Ocak 2025

**Kullanım:** Yıllık büyüme analizi

### MoM (Month over Month)
Önceki ayla karşılaştırma.

**Örnek:** Ocak 2026 vs Aralık 2025

**Kullanım:** Aylık performans takibi

### WoW (Week over Week)
Önceki haftayla karşılaştırma.

**Örnek:** Bu hafta vs geçen hafta

**Kullanım:** Haftalık trend analizi

### DoD (Day over Day)
Önceki günle karşılaştırma.

**Örnek:** Bugün vs dün

**Kullanım:** Günlük operasyon takibi

### Özel Dönem
Manuel tarih aralığı belirleme.

## Karşılaştırma Aktifleştirme

1. Metrik düzenleme ekranında **Karşılaştırma** bölümünü bulun
2. **Karşılaştırma Tipi** seçin (YoY, MoM, vb.)
3. Kaydedin

## Widget'ta Görünüm

Karşılaştırma aktif metrikler widget'ta şu şekilde görünür:

\`\`\`
Toplam Ciro
₺1.250.000
▲ +12.5% vs geçen yıl
\`\`\`

- ▲ Yeşil: Artış
- ▼ Kırmızı: Azalış

## Ters Mantık

Bazı metrikler için azalış iyidir (örn: maliyet, iade). Bu durumda:

1. **Ters Mantık** seçeneğini işaretleyin
2. Azalış yeşil, artış kırmızı gösterilir

## İpuçları

> 💡 YoY mevsimsellikten etkilenmez, daha güvenilirdir.

> 💡 MoM kısa vadeli trendler için uygundur.

> ⚠️ Karşılaştırma dönemi için veri yoksa "N/A" görünür.
`
  },
  {
    id: 'metrics-lfl-karsilastirma',
    slug: 'lfl-karsilastirma',
    title: 'LFL (Like-for-Like) Karşılaştırma',
    excerpt: 'Karşılaştırılabilir mağaza analizi yapın.',
    category: 'metrics',
    categoryLabel: 'Metrikler',
    tags: ['lfl', 'like-for-like', 'karşılaştırma', 'mağaza'],
    images: [],
    relatedArticles: ['metrics-lfl-takvim-ayarlari', 'metrics-karsilastirma-ayarlari'],
    lastUpdated: '2026-01-27',
    readingTime: 7,
    order: 8,
    content: `
# LFL (Like-for-Like) Karşılaştırma

LFL, sadece her iki dönemde de açık olan mağazaları karşılaştırır.

## LFL Nedir?

Like-for-Like (LFL), karşılaştırılabilir dönem analizidir. Yeni açılan veya kapanan mağazaları hariç tutarak gerçek performans değişimini ölçer.

## Neden LFL?

### Standart Karşılaştırma Sorunu

| Dönem | Mağaza Sayısı | Ciro |
|-------|---------------|------|
| 2025 | 100 | ₺10M |
| 2026 | 120 | ₺13M |

Görünürde %30 büyüme var, ama 20 yeni mağaza açıldı!

### LFL ile Gerçek Durum

| Dönem | Karşılaştırılabilir Mağaza | Ciro |
|-------|---------------------------|------|
| 2025 | 100 | ₺10M |
| 2026 | 100 (aynı mağazalar) | ₺10.5M |

Gerçek büyüme sadece %5.

## LFL Nasıl Çalışır?

1. Her iki dönemde de açık olan mağazalar belirlenir
2. Sadece bu mağazaların verileri karşılaştırılır
3. Yeni/kapanan mağazalar hariç tutulur

## LFL Kurulumu

### 1. LFL Takvim Dataset'i
Mağaza açılış/kapanış tarihlerini içeren dataset gerekir.

### 2. Metrik Ayarları
1. Metrik düzenleme ekranında **LFL** seçeneğini aktifleştirin
2. LFL takvim dataset'ini seçin
3. Mağaza ID eşleştirmesini yapın

## LFL Hesaplama Örneği

\`\`\`sql
-- LFL mağazaları bul
WITH lfl_stores AS (
  SELECT store_id
  FROM store_calendar
  WHERE open_date < {prev_start_date}
    AND (close_date IS NULL OR close_date > {end_date})
)
-- Sadece LFL mağazaların verisi
SELECT SUM(tutar) as deger
FROM satis
WHERE store_id IN (SELECT store_id FROM lfl_stores)
  AND tarih BETWEEN {start_date} AND {end_date}
\`\`\`

## LFL Metrikleri

| Metrik | Açıklama |
|--------|----------|
| LFL Ciro | Karşılaştırılabilir mağaza cirosu |
| LFL Büyüme % | LFL ciro değişim yüzdesi |
| LFL Mağaza Sayısı | Karşılaştırılabilir mağaza adedi |

## İpuçları

> 💡 LFL, perakende sektöründe standart bir metriktir.

> 💡 Yatırımcı raporlarında LFL büyüme önemlidir.

> ⚠️ LFL takvim verisi güncel tutulmalıdır.
`
  },
  {
    id: 'metrics-format-ayarlari',
    slug: 'format-ayarlari',
    title: 'Format Ayarları',
    excerpt: 'Sayı formatı, ön ek, son ek ve diğer format ayarları.',
    category: 'metrics',
    categoryLabel: 'Metrikler',
    tags: ['format', 'sayı', 'para', 'yüzde', 'görünüm'],
    images: [],
    relatedArticles: ['metrics-gorsellestime-tipleri', 'metrics-hesaplama-tipleri'],
    lastUpdated: '2026-01-27',
    readingTime: 5,
    order: 9,
    content: `
# Format Ayarları

Metrik değerlerinin nasıl görüneceğini özelleştirin.

## Sayı Formatı

### Ondalık Basamak
Kaç ondalık basamak gösterileceği.

| Ayar | Örnek |
|------|-------|
| 0 | 1.250 |
| 1 | 1.250,5 |
| 2 | 1.250,50 |

### Binlik Ayracı
Büyük sayıları okunabilir yapar.

| Ayar | Örnek |
|------|-------|
| Kapalı | 1250000 |
| Açık | 1.250.000 |

## Ön Ek (Prefix)

Değerin önüne eklenen metin.

| Ön Ek | Örnek |
|-------|-------|
| ₺ | ₺1.250.000 |
| $ | $1,250,000 |
| € | €1.250.000 |

## Son Ek (Suffix)

Değerin sonuna eklenen metin.

| Son Ek | Örnek |
|--------|-------|
| % | 85% |
| adet | 1.250 adet |
| kişi | 500 kişi |

## Kısaltma

Büyük sayıları kısaltır.

| Değer | Kısaltma |
|-------|----------|
| 1.000 | 1K |
| 1.000.000 | 1M |
| 1.000.000.000 | 1B |

## Yüzde Formatı

Yüzde değerleri için:
1. Son ek olarak "%" ekleyin
2. Ondalık basamağı ayarlayın

## Negatif Değerler

| Ayar | Örnek |
|------|-------|
| Eksi işareti | -1.250 |
| Parantez | (1.250) |
| Kırmızı renk | Otomatik |

## Örnek Konfigürasyonlar

### Para Birimi
- Ön ek: ₺
- Ondalık: 0
- Binlik ayracı: Açık
- Sonuç: ₺1.250.000

### Yüzde
- Son ek: %
- Ondalık: 1
- Sonuç: 85,5%

### Adet
- Son ek: adet
- Ondalık: 0
- Sonuç: 1.250 adet

## İpuçları

> 💡 Tutarlı format kullanın, dashboard genelinde aynı para birimi.

> 💡 Mobilde kısaltma kullanmak okunabilirliği artırır.

> 💡 Yüzde metriklerde 100 ile çarpmayı unutmayın.
`
  },
  {
    id: 'metrics-filtre-kosullari',
    slug: 'filtre-kosullari',
    title: 'Filtre Koşulları',
    excerpt: 'Metriğe WHERE koşulu ekleyin.',
    category: 'metrics',
    categoryLabel: 'Metrikler',
    tags: ['filtre', 'where', 'koşul', 'sql'],
    images: [],
    relatedArticles: ['metrics-sql-modu', 'metrics-group-by-kullanimi'],
    lastUpdated: '2026-01-27',
    readingTime: 5,
    order: 10,
    content: `
# Filtre Koşulları

Metriğe sabit filtre koşulları ekleyin.

## Filtre Koşulu Nedir?

Metrik hesaplanırken uygulanacak sabit WHERE koşuludur. Dashboard filtreleri dışında, metriğe özgü filtreleme yapar.

## Ne Zaman Kullanılır?

- Belirli bir kategoriyi filtrelemek için
- İptal edilmiş kayıtları hariç tutmak için
- Belirli bir durumu filtrelemek için

## Kolon Seçimi Modunda

1. **Filtre Koşulları** bölümünü açın
2. **+ Koşul Ekle** tıklayın
3. Kolon, operatör ve değer seçin

### Operatörler

| Operatör | Açıklama | Örnek |
|----------|----------|-------|
| = | Eşit | kategori = 'Gıda' |
| != | Eşit değil | durum != 'İptal' |
| > | Büyük | tutar > 100 |
| < | Küçük | tutar < 1000 |
| >= | Büyük eşit | adet >= 5 |
| <= | Küçük eşit | adet <= 10 |
| IN | İçinde | kategori IN ('A', 'B') |
| LIKE | Benzer | isim LIKE '%market%' |

## SQL Modunda

WHERE koşulunu doğrudan yazın:

\`\`\`sql
SELECT SUM(tutar) as deger
FROM satis
WHERE tarih BETWEEN {start_date} AND {end_date}
  AND kategori = 'Gıda'
  AND durum != 'İptal'
\`\`\`

## Örnek Senaryolar

### Sadece Aktif Satışlar
\`\`\`sql
WHERE durum = 'Tamamlandı'
\`\`\`

### Belirli Kategoriler
\`\`\`sql
WHERE kategori IN ('Gıda', 'İçecek', 'Temizlik')
\`\`\`

### Minimum Tutar
\`\`\`sql
WHERE tutar >= 50
\`\`\`

## Çoklu Koşullar

Birden fazla koşul AND ile birleştirilir:

\`\`\`sql
WHERE kategori = 'Gıda'
  AND durum = 'Tamamlandı'
  AND tutar >= 50
\`\`\`

## İpuçları

> 💡 Filtre koşulları dashboard filtrelerinden bağımsızdır.

> 💡 Performans için indeksli kolonları filtreleyin.

> ⚠️ Çok fazla koşul sorgu performansını etkileyebilir.
`
  },
  {
    id: 'metrics-group-by-kullanimi',
    slug: 'group-by-kullanimi',
    title: 'GROUP BY Kullanımı',
    excerpt: 'Verileri gruplama ve kategorize etme.',
    category: 'metrics',
    categoryLabel: 'Metrikler',
    tags: ['group by', 'gruplama', 'kategori', 'sql'],
    images: [],
    relatedArticles: ['metrics-sql-modu', 'metrics-siralama-listesi'],
    lastUpdated: '2026-01-27',
    readingTime: 5,
    order: 11,
    content: `
# GROUP BY Kullanımı

Verileri gruplama ve kategorize etme işlemlerini öğrenin.

## GROUP BY Nedir?

GROUP BY, verileri belirli bir kolona göre gruplar ve her grup için ayrı hesaplama yapar.

## Ne Zaman Kullanılır?

- Trend grafikleri için (tarih bazlı)
- Kategori bazlı dağılımlar için
- Mağaza/bölge bazlı listeler için

## Temel Kullanım

\`\`\`sql
SELECT 
  kategori,
  SUM(tutar) as toplam
FROM satis
GROUP BY kategori
\`\`\`

Sonuç:
| kategori | toplam |
|----------|--------|
| Gıda | 500.000 |
| İçecek | 250.000 |
| Temizlik | 150.000 |

## Tarih Bazlı Gruplama

### Günlük
\`\`\`sql
GROUP BY tarih
\`\`\`

### Haftalık
\`\`\`sql
GROUP BY toStartOfWeek(tarih)
\`\`\`

### Aylık
\`\`\`sql
GROUP BY toStartOfMonth(tarih)
\`\`\`

## Çoklu Gruplama

\`\`\`sql
SELECT 
  bolge,
  kategori,
  SUM(tutar) as toplam
FROM satis
GROUP BY bolge, kategori
\`\`\`

## Kolon Seçimi Modunda

1. **Gruplama** bölümünü açın
2. Gruplama kolonunu seçin
3. Birden fazla kolon ekleyebilirsiniz

## Sıralama ile Birlikte

\`\`\`sql
SELECT 
  magaza,
  SUM(tutar) as toplam
FROM satis
GROUP BY magaza
ORDER BY toplam DESC
LIMIT 10
\`\`\`

## İpuçları

> 💡 SELECT'teki her non-aggregated kolon GROUP BY'da olmalı.

> 💡 Çok fazla gruplama performansı etkileyebilir.

> 💡 CHART tipi için tek gruplama kolonu önerilir.
`
  },
  {
    id: 'metrics-siralama-listesi',
    slug: 'siralama-listesi',
    title: 'Sıralama Listesi (TOP N)',
    excerpt: 'En çok satan ürünler, en iyi mağazalar gibi listeler oluşturun.',
    category: 'metrics',
    categoryLabel: 'Metrikler',
    tags: ['sıralama', 'top', 'ranking', 'liste'],
    images: [],
    relatedArticles: ['metrics-group-by-kullanimi', 'designer-tablo-widget'],
    lastUpdated: '2026-01-27',
    readingTime: 5,
    order: 12,
    content: `
# Sıralama Listesi (TOP N)

En iyi/en kötü performans gösteren öğeleri listeleyin.

## Sıralama Listesi Nedir?

TOP N listesi, belirli bir kritere göre sıralanmış ilk N öğeyi gösterir.

## Kullanım Alanları

- En çok satan 10 ürün
- En yüksek cirolu 5 mağaza
- En düşük performanslı bölgeler

## SQL Yapısı

\`\`\`sql
SELECT 
  urun_adi,
  SUM(adet) as toplam_satis
FROM satis
WHERE tarih BETWEEN {start_date} AND {end_date}
GROUP BY urun_adi
ORDER BY toplam_satis DESC
LIMIT 10
\`\`\`

## Görselleştirme

Sıralama listesi için **LIST** görselleştirme tipi seçin.

Widget olarak **Sıralama Listesi** kullanın.

## Sıralama Yönü

### Azalan (DESC)
En yüksekten en düşüğe. "En iyi" listeler için.

\`\`\`sql
ORDER BY toplam DESC
\`\`\`

### Artan (ASC)
En düşükten en yükseğe. "En kötü" listeler için.

\`\`\`sql
ORDER BY toplam ASC
\`\`\`

## LIMIT Ayarı

| LIMIT | Kullanım |
|-------|----------|
| 5 | Kompakt liste |
| 10 | Standart TOP 10 |
| 20 | Detaylı liste |

## Örnek Listeler

### En Çok Satan Ürünler
\`\`\`sql
SELECT urun, SUM(adet) as satis
FROM satis
GROUP BY urun
ORDER BY satis DESC
LIMIT 10
\`\`\`

### En Yüksek Cirolu Mağazalar
\`\`\`sql
SELECT magaza, SUM(tutar) as ciro
FROM satis
GROUP BY magaza
ORDER BY ciro DESC
LIMIT 5
\`\`\`

### En Düşük Performanslı Bölgeler
\`\`\`sql
SELECT bolge, SUM(tutar) as ciro
FROM satis
GROUP BY bolge
ORDER BY ciro ASC
LIMIT 5
\`\`\`

## İpuçları

> 💡 Widget'ta sıra numarası otomatik gösterilir.

> 💡 Yüzde veya değişim kolonu ekleyerek zenginleştirebilirsiniz.

> ⚠️ Çok uzun listeler okunabilirliği azaltır.
`
  },
  {
    id: 'metrics-veri-tablosu-metrigi',
    slug: 'veri-tablosu-metrigi',
    title: 'Veri Tablosu Metriği',
    excerpt: 'Detaylı veri tabloları için metrik oluşturun.',
    category: 'metrics',
    categoryLabel: 'Metrikler',
    tags: ['tablo', 'data grid', 'detay', 'liste'],
    images: [],
    relatedArticles: ['designer-tablo-widget', 'metrics-group-by-kullanimi'],
    lastUpdated: '2026-01-27',
    readingTime: 5,
    order: 13,
    content: `
# Veri Tablosu Metriği

Detaylı veri tabloları için DATA_GRID tipinde metrik oluşturun.

## Veri Tablosu Nedir?

Veri tablosu, çoklu kolon ve satır içeren detaylı liste görünümüdür. Mağaza listesi, ürün detayları gibi veriler için kullanılır.

## Görselleştirme Tipi

**DATA_GRID** seçin. Bu tip:
- Çoklu kolon destekler
- Sayfalama yapar
- Sıralama ve filtreleme sağlar

## SQL Yapısı

\`\`\`sql
SELECT 
  magaza_kodu,
  magaza_adi,
  bolge,
  SUM(tutar) as ciro,
  COUNT(*) as islem_adedi,
  AVG(tutar) as ortalama_sepet
FROM satis
WHERE tarih BETWEEN {start_date} AND {end_date}
GROUP BY magaza_kodu, magaza_adi, bolge
ORDER BY ciro DESC
\`\`\`

## Kolon Tanımları

Her SELECT kolonu tabloda bir sütun olur:

| Kolon | Açıklama |
|-------|----------|
| magaza_kodu | Mağaza kodu |
| magaza_adi | Mağaza adı |
| bolge | Bölge |
| ciro | Toplam ciro |
| islem_adedi | İşlem sayısı |
| ortalama_sepet | Ortalama sepet |

## Format Ayarları

Her kolon için ayrı format belirleyebilirsiniz:

- **ciro**: Para formatı (₺)
- **islem_adedi**: Sayı formatı
- **ortalama_sepet**: Para formatı (₺)

## Widget'ta Kullanım

1. **Veri Tablosu** widget'ı ekleyin
2. DATA_GRID tipinde metriği bağlayın
3. Kolon genişliklerini ayarlayın

## Performans İpuçları

> 💡 Çok fazla satır için sayfalama kullanın.

> 💡 Gereksiz kolonları eklemeyin.

> 💡 İndeksli kolonlara göre sıralayın.

## Örnek: Mağaza Performans Tablosu

\`\`\`sql
SELECT 
  m.magaza_adi as "Mağaza",
  m.bolge as "Bölge",
  SUM(s.tutar) as "Ciro",
  COUNT(DISTINCT s.tarih) as "Aktif Gün",
  SUM(s.tutar) / COUNT(DISTINCT s.tarih) as "Günlük Ort."
FROM satis s
JOIN magaza m ON s.magaza_id = m.id
WHERE s.tarih BETWEEN {start_date} AND {end_date}
GROUP BY m.magaza_adi, m.bolge
ORDER BY "Ciro" DESC
\`\`\`
`
  },
  {
    id: 'metrics-gorsel-ornekleri',
    slug: 'gorsel-ornekleri',
    title: 'Görselleştirme Örnekleri (SQL)',
    excerpt: 'Her görselleştirme tipi için örnek SQL sorguları ve kullanım rehberi.',
    category: 'metrics',
    categoryLabel: 'Metrikler',
    tags: ['sql', 'örnek', 'grafik', 'harita', 'pie', 'ranking', 'trend'],
    images: [],
    relatedArticles: ['metrics-sql-modu', 'metrics-gorsellestime-tipleri', 'metrics-siralama-listesi'],
    lastUpdated: '2026-01-28',
    readingTime: 15,
    order: 14,
    content: `
# Görselleştirme Örnekleri (SQL)

Her görselleştirme tipi için örnek SQL sorguları ve ayarları.

> 💡 Aşağıdaki örneklerde \`satis_gunluk\` (satış verisi) ve \`magaza_master\` (mağaza bilgileri) örnek tablo isimleri kullanılmıştır. Kendi tablolarınızla değiştirin.

---

## 1. Sıralama Listesi (Ranking List)

Sıralama listesi, en iyi/en kötü performansı gösteren öğeleri listeler.

![Sıralama Listesi Örneği - Top 10 Mağaza](/edu/images/examples/ranking-list-example.png)

### Temel SQL

\`\`\`sql
SELECT 
  magaza_adi as label,
  SUM(ciro) as value
FROM satis_gunluk
WHERE tarih >= today() - 30
GROUP BY magaza_adi
ORDER BY value DESC
LIMIT 10
\`\`\`

**Sonuç kolonları:**
- \`label\` → Gösterilecek isim
- \`value\` → Sıralama değeri

### Trend Hesaplamalı Sıralama Listesi

Önceki dönemle karşılaştırma yüzdesi göstermek için:

\`\`\`sql
SELECT 
  magaza_adi as label,
  SUM(ciro) as value,
  -- Geçen haftaya göre trend (%)
  round(
    (SUM(CASE WHEN tarih >= today() - 7 THEN ciro ELSE 0 END) -
     SUM(CASE WHEN tarih >= today() - 14 AND tarih < today() - 7 THEN ciro ELSE 0 END)) /
    nullIf(SUM(CASE WHEN tarih >= today() - 14 AND tarih < today() - 7 THEN ciro ELSE 0 END), 0) * 100
  , 1) as trend
FROM satis_gunluk
WHERE tarih >= today() - 14
GROUP BY magaza_adi
ORDER BY value DESC
LIMIT 10
\`\`\`

**Sonuç kolonları:**
- \`label\` → Mağaza adı
- \`value\` → Toplam değer
- \`trend\` → Değişim yüzdesi (▲ +5.2% veya ▼ -3.1%)

### Alt Bilgili Sıralama Listesi

İkinci satırda ek bilgi göstermek için:

\`\`\`sql
SELECT 
  magaza_adi as label,
  SUM(ciro) as value,
  concat(toString(SUM(adet)), ' adet') as subtitle,
  round(
    (SUM(CASE WHEN tarih >= today() - 7 THEN ciro ELSE 0 END) -
     SUM(CASE WHEN tarih >= today() - 14 AND tarih < today() - 7 THEN ciro ELSE 0 END)) /
    nullIf(SUM(CASE WHEN tarih >= today() - 14 AND tarih < today() - 7 THEN ciro ELSE 0 END), 0) * 100
  , 1) as trend
FROM satis_gunluk
WHERE tarih >= today() - 14
GROUP BY magaza_adi
ORDER BY value DESC
LIMIT 10
\`\`\`

**Sonuç kolonları:**
- \`label\` → Ana başlık
- \`value\` → Değer
- \`subtitle\` → Alt bilgi (opsiyonel)
- \`trend\` → Yüzde değişim (opsiyonel)

### Görselleştirme Ayarları

| Ayar | Değer |
|------|-------|
| Visualization Type | ranking_list |
| Trend Otomatik Hesaplansın | Kapalı (SQL'de hesapladık) |
| Format | Sayı + ₺ ön ek |

---

## 2. Harita (Map Chart)

Harita görselleştirmesi için şehir isimleri veya koordinatlar gerekir.

![Harita Örneği - Şehir Bazlı Ciro Dağılımı](/edu/images/examples/map-chart-example.png)

### Şehir Bazlı Toplam (Otomatik Koordinat)

\`\`\`sql
SELECT 
  m.sehir as name,
  SUM(s.ciro) as value
FROM satis_gunluk s
INNER JOIN magaza_master m ON s.magaza_id = m.id
WHERE s.tarih >= today() - 30
GROUP BY m.sehir
ORDER BY value DESC
\`\`\`

**Sonuç kolonları:**
- \`name\` → Şehir adı (İstanbul, Ankara, İzmir vb.)
- \`value\` → Daire büyüklüğü

> 💡 \`name\` kolonu şehir ismi içerdiğinde sistem **otomatik koordinat** atar.

### Manuel Koordinatlı Harita

Mağaza bazında gerçek koordinatlarla:

\`\`\`sql
SELECT 
  m.magaza_adi as name,
  m.latitude as lat,
  m.longitude as lng,
  SUM(s.ciro) as value
FROM satis_gunluk s
INNER JOIN magaza_master m ON s.magaza_id = m.id
WHERE s.tarih >= today() - 30
  AND m.latitude IS NOT NULL
GROUP BY m.magaza_adi, m.latitude, m.longitude
ORDER BY value DESC
\`\`\`

**Sonuç kolonları:**
- \`name\` → Tooltip'te görünecek isim
- \`lat\` → Enlem
- \`lng\` → Boylam
- \`value\` → Daire büyüklüğü

### Bölge Bazlı Harita

\`\`\`sql
SELECT 
  m.bolge as name,
  SUM(s.ciro) as value,
  COUNT(DISTINCT s.magaza_id) as magaza_sayisi
FROM satis_gunluk s
INNER JOIN magaza_master m ON s.magaza_id = m.id
WHERE s.tarih >= today() - 30
GROUP BY m.bolge
ORDER BY value DESC
\`\`\`

### Görselleştirme Ayarları

| Ayar | Değer |
|------|-------|
| Visualization Type | map_chart |
| Show Circles | Açık |
| Show Markers | Kapalı |

### Tanınan Şehir İsimleri

Otomatik koordinat için \`name\` kolonu şunları içerebilir:
- İl adları: İstanbul, Ankara, İzmir, Bursa...
- Plaka kodları: 34, 06, 35, 16...
- ASCII versiyonlar: Istanbul, Izmir, Diyarbakir...

---

## 3. Pasta Grafik (Pie Chart)

Kategori bazlı dağılım göstermek için.

![Pasta Grafik Örneği - Kategori Dağılımı](/edu/images/examples/pie-chart-example.png)

### Temel Pasta Grafik

\`\`\`sql
SELECT 
  kategori as label,
  SUM(ciro) as value
FROM satis_gunluk
WHERE tarih >= today() - 30
GROUP BY kategori
ORDER BY value DESC
\`\`\`

**Sonuç kolonları:**
- \`label\` → Dilim etiketi
- \`value\` → Dilim büyüklüğü

### Yüzdeli Pasta Grafik

\`\`\`sql
SELECT 
  kategori as label,
  SUM(ciro) as value,
  round(SUM(ciro) * 100.0 / (SELECT SUM(ciro) FROM satis_gunluk WHERE tarih >= today() - 30), 1) as yuzde
FROM satis_gunluk
WHERE tarih >= today() - 30
GROUP BY kategori
ORDER BY value DESC
\`\`\`

### Üst N + Diğer Pasta Grafik

Çok fazla kategori varsa "Diğer" olarak birleştir:

\`\`\`sql
WITH ranked AS (
  SELECT 
    kategori,
    SUM(ciro) as ciro,
    ROW_NUMBER() OVER (ORDER BY SUM(ciro) DESC) as sira
  FROM satis_gunluk
  WHERE tarih >= today() - 30
  GROUP BY kategori
)
SELECT 
  CASE WHEN sira <= 5 THEN kategori ELSE 'Diğer' END as label,
  SUM(ciro) as value
FROM ranked
GROUP BY CASE WHEN sira <= 5 THEN kategori ELSE 'Diğer' END
ORDER BY value DESC
\`\`\`

### Görselleştirme Ayarları

| Ayar | Değer |
|------|-------|
| Visualization Type | pie_chart veya donut_chart |
| Show Legend | Açık |
| Show Labels | Açık (% gösterir) |

---

## 4. Çizgi Grafik (Line Chart)

Zaman bazlı trend göstermek için.

![Çizgi Grafik Örneği - Ciro Trendi](/edu/images/examples/line-chart-example.png)

### Günlük Trend

\`\`\`sql
SELECT 
  tarih as label,
  SUM(ciro) as value
FROM satis_gunluk
WHERE tarih >= today() - 30
GROUP BY tarih
ORDER BY tarih ASC
\`\`\`

**Sonuç kolonları:**
- \`label\` → X ekseni (tarih)
- \`value\` → Y ekseni (değer)

### Haftalık Trend

\`\`\`sql
SELECT 
  toStartOfWeek(tarih) as label,
  SUM(ciro) as value
FROM satis_gunluk
WHERE tarih >= today() - 90
GROUP BY toStartOfWeek(tarih)
ORDER BY label ASC
\`\`\`

### Aylık Trend

\`\`\`sql
SELECT 
  toStartOfMonth(tarih) as label,
  SUM(ciro) as value
FROM satis_gunluk
WHERE tarih >= today() - 365
GROUP BY toStartOfMonth(tarih)
ORDER BY label ASC
\`\`\`

### Çoklu Seri (Karşılaştırmalı)

Bu yıl vs geçen yıl:

\`\`\`sql
SELECT 
  toDayOfMonth(tarih) as gun,
  SUM(CASE WHEN toYear(tarih) = 2026 THEN ciro ELSE 0 END) as bu_yil,
  SUM(CASE WHEN toYear(tarih) = 2025 THEN ciro ELSE 0 END) as gecen_yil
FROM satis_gunluk
WHERE toMonth(tarih) = toMonth(today())
  AND toYear(tarih) IN (2025, 2026)
GROUP BY toDayOfMonth(tarih)
ORDER BY gun ASC
\`\`\`

### Görselleştirme Ayarları

| Ayar | Değer |
|------|-------|
| Visualization Type | line_chart veya area_chart |
| Show Grid | Açık |
| Smooth Line | Opsiyonel |

---

## 5. Çubuk Grafik (Bar Chart)

Kategori karşılaştırması için.

### Yatay Çubuk (Kategori Bazlı)

\`\`\`sql
SELECT 
  kategori as label,
  SUM(ciro) as value
FROM satis_gunluk
WHERE tarih >= today() - 30
GROUP BY kategori
ORDER BY value DESC
LIMIT 10
\`\`\`

### Dikey Çubuk (Tarih Bazlı)

\`\`\`sql
SELECT 
  tarih as label,
  SUM(ciro) as value
FROM satis_gunluk
WHERE tarih >= today() - 7
GROUP BY tarih
ORDER BY tarih ASC
\`\`\`

### Yığılmış Çubuk (Stacked)

\`\`\`sql
SELECT 
  tarih as label,
  SUM(CASE WHEN kanal = 'Online' THEN ciro ELSE 0 END) as online,
  SUM(CASE WHEN kanal = 'Mağaza' THEN ciro ELSE 0 END) as magaza
FROM satis_gunluk
WHERE tarih >= today() - 7
GROUP BY tarih
ORDER BY tarih ASC
\`\`\`

### Görselleştirme Ayarları

| Ayar | Değer |
|------|-------|
| Visualization Type | bar_chart |
| Orientation | Horizontal veya Vertical |
| Show Values | Opsiyonel |

---

## 6. KPI Kartı

Tek değer göstermek için.

### Basit KPI

\`\`\`sql
SELECT SUM(ciro) as value
FROM satis_gunluk
WHERE tarih >= today() - 30
\`\`\`

### Karşılaştırmalı KPI

\`\`\`sql
SELECT 
  SUM(CASE WHEN tarih >= today() - 30 THEN ciro ELSE 0 END) as value,
  SUM(CASE WHEN tarih >= today() - 60 AND tarih < today() - 30 THEN ciro ELSE 0 END) as prev_value
FROM satis_gunluk
WHERE tarih >= today() - 60
\`\`\`

### Hedefli KPI

\`\`\`sql
SELECT 
  SUM(ciro) as value,
  1000000 as target
FROM satis_gunluk
WHERE tarih >= today() - 30
\`\`\`

### Görselleştirme Ayarları

| Ayar | Değer |
|------|-------|
| Visualization Type | kpi_card |
| Comparison Enabled | Açık/Kapalı |
| Format | Sayı/Para |

---

## 7. Veri Tablosu (Data Grid)

Detaylı tablo görünümü.

### Özet Tablo

\`\`\`sql
SELECT 
  m.bolge as "Bölge",
  m.sehir as "Şehir",
  m.magaza_adi as "Mağaza",
  SUM(s.ciro) as "Ciro",
  SUM(s.adet) as "Adet",
  round(AVG(s.ciro), 2) as "Ort. Sepet"
FROM satis_gunluk s
INNER JOIN magaza_master m ON s.magaza_id = m.id
WHERE s.tarih >= today() - 30
GROUP BY m.bolge, m.sehir, m.magaza_adi
ORDER BY "Ciro" DESC
\`\`\`

### Görselleştirme Ayarları

| Ayar | Değer |
|------|-------|
| Visualization Type | data_grid |
| Pagination | Açık |
| Row Count | 10-50 |

---

## Özet Tablo

| Görselleştirme | Visualization Type | Gerekli Kolonlar |
|----------------|--------------------|------------------|
| Sıralama Listesi | ranking_list | label, value, [subtitle], [trend] |
| Harita | map_chart | name, value, [lat], [lng] |
| Pasta | pie_chart / donut_chart | label, value |
| Çizgi | line_chart / area_chart | label (tarih), value |
| Çubuk | bar_chart | label, value |
| KPI | kpi_card | value, [prev_value], [target] |
| Tablo | data_grid | İstediğiniz kolonlar |

---

## İpuçları

> 💡 SQL sorgularını önce ClickHouse arayüzünde test edin.

> 💡 \`nullIf(x, 0)\` kullanarak sıfıra bölme hatasını önleyin.

> 💡 \`today()\` dinamik tarih için, sabit tarihler için \`'2026-01-01'\` formatı kullanın.

> ⚠️ Çok büyük veri setlerinde LIMIT kullanmayı unutmayın.
`
  },
  {
    id: 'metrics-onizleme-ve-test',
    slug: 'onizleme-ve-test',
    title: 'Önizleme ve Test',
    excerpt: 'Metriği kaydetmeden önce test edin.',
    category: 'metrics',
    categoryLabel: 'Metrikler',
    tags: ['önizleme', 'test', 'debug', 'kontrol'],
    images: [],
    relatedArticles: ['metrics-sql-modu', 'advanced-sorun-giderme'],
    lastUpdated: '2026-01-27',
    readingTime: 4,
    order: 15,
    content: `
# Önizleme ve Test

Metriği kaydetmeden önce doğru çalıştığını test edin.

## Önizleme Nedir?

Önizleme, metrik sorgusunu çalıştırıp sonucu gösterir. Kaydetmeden önce doğruluğunu kontrol edebilirsiniz.

## Önizleme Yapma

1. Metrik ayarlarını tamamlayın
2. **Önizleme** butonuna tıklayın
3. Sonuç panelinde veriyi görün

## Önizleme Sonuçları

### Başarılı Önizleme
- Değer görüntülenir
- Satır sayısı gösterilir
- Sorgu süresi bildirilir

### Hatalı Önizleme
- Hata mesajı görüntülenir
- SQL hatası detayı verilir
- Düzeltme önerileri sunulur

## Yaygın Hatalar

### Syntax Hatası
\`\`\`
Error: Syntax error near 'FORM'
\`\`\`
**Çözüm:** SQL yazımını kontrol edin (FROM, not FORM)

### Kolon Bulunamadı
\`\`\`
Error: Column 'tutar' not found
\`\`\`
**Çözüm:** Kolon adını ve dataset'i kontrol edin

### Tip Uyumsuzluğu
\`\`\`
Error: Cannot compare String with Int
\`\`\`
**Çözüm:** Veri tiplerini kontrol edin, gerekirse CAST kullanın

## Test Senaryoları

1. **Farklı tarih aralıkları** ile test edin
2. **Filtre kombinasyonları** deneyin
3. **Boş veri durumunu** kontrol edin

## Performans Kontrolü

Önizlemede sorgu süresine dikkat edin:

| Süre | Değerlendirme |
|------|---------------|
| < 1 sn | İyi |
| 1-5 sn | Kabul edilebilir |
| > 5 sn | Optimizasyon gerekli |

## İpuçları

> 💡 Önizleme LIMIT 100 ile çalışır, tam veri için kaydedin.

> 💡 SQL modunda sorguyu önce veritabanı aracında test edin.

> ⚠️ Önizleme başarılı olsa da production'da farklı sonuç olabilir.
`
  }
]

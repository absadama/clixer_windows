import type { Article } from '../../../types/article'

export const articlesTr: Article[] = [
  {
    id: 'designer-tasarim-studyosu-nedir',
    slug: 'tasarim-studyosu-nedir',
    title: 'Tasarım Stüdyosu Nedir?',
    excerpt: 'Clixer Tasarım Stüdyosu ile dashboard ve widget tasarımı yapın.',
    category: 'designer',
    categoryLabel: 'Tasarım Stüdyosu',
    tags: ['tasarım', 'stüdyo', 'dashboard', 'widget'],
    images: [],
    relatedArticles: ['designer-yeni-tasarim-olusturma', 'designer-widget-ekleme'],
    lastUpdated: '2026-01-27',
    readingTime: 4,
    order: 1,
    content: `
# Tasarım Stüdyosu Nedir?

Tasarım Stüdyosu, Clixer'ın görsel dashboard tasarım aracıdır. Kod yazmadan, sürükle-bırak yöntemiyle profesyonel dashboardlar oluşturabilirsiniz.

## Özellikler

### 1. Sürükle-Bırak Arayüzü
Widget'ları sol panelden sürükleyip grid üzerine bırakın. Köşelerinden tutarak boyutlandırın.

### 2. 24 Kolonlu Grid Sistemi
Grafana tarzı esnek grid sistemi. Widget'ları istediğiniz boyutta ve konumda yerleştirin.

### 3. Responsive Tasarım
Tasarımlarınız otomatik olarak mobil uyumlu hale gelir. Farklı ekran boyutlarında önizleme yapabilirsiniz.

### 4. 17 Farklı Widget Türü
- Kartlar (Büyük, Mini, İstatistik)
- Grafikler (Çizgi, Çubuk, Pasta, Alan)
- Tablolar ve Listeler
- Göstergeler ve İlerleme Halkaları
- Özel Widget'lar (Huni, Isı Haritası, Treemap)

## Stüdyo Arayüzü

| Bölüm | Açıklama |
|-------|----------|
| Sol Panel | Widget listesi ve ekleme |
| Orta Alan | Grid tasarım alanı |
| Sağ Panel | Tasarım ve widget ayarları |
| Üst Menü | Kaydet, Aç, Önizleme |

## Görüntüleme Yerleri

Tasarımlarınızı iki farklı yerde gösterebilirsiniz:

- **Kokpit (Ana Sayfa)**: Genel özet dashboardlar
- **Analiz**: Detaylı analiz sayfaları

## Sonraki Adımlar

- [Yeni Tasarım Oluşturma](/designer/yeni-tasarim-olusturma)
- [Widget Ekleme](/designer/widget-ekleme)
- [Widget Türleri](/designer/widget-turleri)
`
  },
  {
    id: 'designer-yeni-tasarim-olusturma',
    slug: 'yeni-tasarim-olusturma',
    title: 'Yeni Tasarım Oluşturma',
    excerpt: 'Adım adım yeni bir dashboard tasarımı oluşturun.',
    category: 'designer',
    categoryLabel: 'Tasarım Stüdyosu',
    tags: ['tasarım', 'yeni', 'oluşturma', 'dashboard'],
    images: [],
    relatedArticles: ['designer-widget-ekleme', 'designer-tasarim-kaydetme'],
    lastUpdated: '2026-01-27',
    readingTime: 5,
    order: 2,
    content: `
# Yeni Tasarım Oluşturma

Bu rehberde sıfırdan yeni bir dashboard tasarımı oluşturacaksınız.

## Adım 1: Stüdyoyu Açın

1. Sol menüden **Designer** seçin
2. **Stüdyo** sekmesine tıklayın

## Adım 2: Tasarım Bilgilerini Girin

Sağ paneldeki **Tasarım Ayarları** bölümünde:

1. **Tasarım Adı**: Anlamlı bir isim verin (örn: "Günlük Satış Özeti")
2. **Görüntüleme Yeri**: 
   - **Kokpit**: Ana sayfa dashboard'u
   - **Analiz**: Detaylı analiz sayfası

## Adım 3: Rapor Yetkilerini Ayarlayın

Hangi pozisyonların bu raporu görebileceğini seçin:

- ✅ Genel Müdür
- ✅ Direktör
- ✅ Bölge Müdürü
- ✅ Mağaza Müdürü
- ⬜ Analist
- ⬜ İzleyici

> 💡 **İpucu:** "Tümü" butonuyla hepsini seçebilir, "Temizle" ile sıfırlayabilirsiniz.

## Adım 4: Rapor Kategorisi (Opsiyonel)

Güçler ayrılığı için rapor kategorisi seçebilirsiniz. Bu, sadece belirli kategorilere yetkili kullanıcıların raporu görmesini sağlar.

## Adım 5: Kaydedin

**Kaydet** butonuna tıklayın. Artık widget eklemeye başlayabilirsiniz.

## İpuçları

> 💡 Tasarım adını değiştirmek için sağ panelden düzenleyebilirsiniz.

> ⚠️ Kaydetmeden sayfadan çıkarsanız değişiklikler kaybolur.

## Sonraki Adımlar

- [Widget Ekleme](/designer/widget-ekleme) - Tasarıma widget ekleyin
- [Tasarım Kaydetme](/designer/tasarim-kaydetme) - Kaydetme ve yükleme işlemleri
`
  },
  {
    id: 'designer-widget-ekleme',
    slug: 'widget-ekleme',
    title: 'Widget Ekleme',
    excerpt: 'Dashboard\'a widget ekleme ve düzenleme.',
    category: 'designer',
    categoryLabel: 'Tasarım Stüdyosu',
    tags: ['widget', 'ekleme', 'düzenleme', 'metrik'],
    images: [],
    relatedArticles: ['designer-widget-turleri', 'metrics-yeni-metrik-olusturma'],
    lastUpdated: '2026-01-27',
    readingTime: 6,
    order: 3,
    content: `
# Widget Ekleme

Dashboard'unuza widget eklemek ve düzenlemek için bu rehberi takip edin.

## Widget Ekleme Yöntemleri

### Yöntem 1: Sürükle-Bırak

1. Sol paneldeki **Widget Ekle** bölümünden widget seçin
2. Widget'ı tutup grid üzerine sürükleyin
3. İstediğiniz konuma bırakın

### Yöntem 2: Tıklama

1. Sol paneldeki widget'a tıklayın
2. Widget otomatik olarak boş bir alana eklenir

## Widget Boyutlandırma

Widget'ın köşelerinden tutarak boyutunu ayarlayın:

- **Sağ alt köşe**: Genişlik ve yükseklik birlikte
- **Sağ kenar**: Sadece genişlik
- **Alt kenar**: Sadece yükseklik

Her widget'ın minimum boyutu vardır. Bunun altına küçültemezsiniz.

## Widget Taşıma

Widget'ın üst kısmından (başlık alanı) tutup sürükleyerek taşıyın.

## Metrik Bağlama

Widget ekledikten sonra metrik bağlamanız gerekir:

1. Widget'a tıklayın
2. Sağ panelde **Metrik Seç** dropdown'ı açılır
3. Listeden uygun metriği seçin
4. Widget veriyi göstermeye başlar

## Widget Silme

1. Widget'a tıklayın
2. Sağ üst köşedeki **çöp kutusu** ikonuna tıklayın
3. Onaylayın

## Widget Kopyalama

1. Widget'a tıklayın
2. **Kopyala** ikonuna tıklayın
3. Yeni widget aynı ayarlarla eklenir

## İpuçları

> 💡 Widget'lar birbirinin üzerine binmez, otomatik olarak kaydırılır.

> 💡 Grid çizgilerini görmek için sol panelden "Grid Çizgileri" seçeneğini açın.

> ⚠️ Metrik bağlamadan widget boş görünür.

## Sonraki Adımlar

- [Widget Türleri](/designer/widget-turleri) - Tüm widget seçenekleri
- [Grafik Türleri](/designer/grafik-turleri) - Grafik widget'ları
`
  },
  {
    id: 'designer-widget-turleri',
    slug: 'widget-turleri',
    title: 'Widget Türleri',
    excerpt: 'Clixer\'da kullanabileceğiniz tüm widget türleri.',
    category: 'designer',
    categoryLabel: 'Tasarım Stüdyosu',
    tags: ['widget', 'türler', 'kart', 'grafik', 'tablo'],
    images: [],
    relatedArticles: ['designer-grafik-turleri', 'designer-tablo-widget'],
    lastUpdated: '2026-01-27',
    readingTime: 8,
    order: 4,
    content: `
# Widget Türleri

Clixer'da 17 farklı widget türü bulunur. Her biri farklı veri görselleştirme ihtiyaçlarına yöneliktir.

## Özet Widget'ları

### Büyük Kart
Ana KPI değerini büyük fontla gösterir. Trend yüzdesi ve karşılaştırma içerir.

**Kullanım:** Toplam ciro, ziyaretçi sayısı gibi ana metrikler.

### Mini Kart
Kompakt KPI gösterimi. Yan yana birden fazla metrik göstermek için idealdir.

**Kullanım:** Özet panellerde çoklu KPI.

### Büyük Sayı
Sadece sayısal değer, minimal tasarım.

**Kullanım:** Basit sayaçlar.

### Gösterge (Gauge)
Hedef takibi için dairesel gösterge.

**Kullanım:** Hedef vs gerçekleşen karşılaştırması.

## Trend Widget'ları

### Mini Grafik (Sparkline)
Küçük boyutlu trend çizgisi.

**Kullanım:** Kart içinde trend gösterimi.

### Trend Kartı
Değer + trend grafiği birlikte.

**Kullanım:** KPI ve trendi tek widget'ta.

## Grafik Widget'ları

### Çubuk Grafik
Kategorik karşılaştırma.

**Kullanım:** Mağaza bazlı satışlar.

### Çizgi Grafik
Zaman serisi verileri.

**Kullanım:** Günlük/haftalık trendler.

### Alan Grafik
Çizgi grafiğin dolgulu versiyonu.

**Kullanım:** Kümülatif değerler.

### Pasta Grafik
Yüzdesel dağılım.

**Kullanım:** Kategori payları.

### Halka Grafik
Pasta grafiğin ortası boş versiyonu.

**Kullanım:** Modern yüzde gösterimi.

### Combo Grafik
Çubuk + çizgi birlikte.

**Kullanım:** Satış + trend birlikte.

## Tablo Widget'ları

### Veri Tablosu
Detaylı veri listesi.

**Kullanım:** Mağaza listesi, ürün detayları.

### Sıralama Listesi
TOP 10 / Ranking gösterimi.

**Kullanım:** En çok satan ürünler.

## Özel Widget'lar

### Huni Grafik
Aşamalı süreç gösterimi.

**Kullanım:** Satış hunisi, müşteri yolculuğu.

### Isı Haritası
Yoğunluk matrisi.

**Kullanım:** Saat/gün bazlı yoğunluk.

### Ağaç Haritası (Treemap)
Hiyerarşik veri gösterimi.

**Kullanım:** Kategori bazlı dağılım.

## Widget Seçim Rehberi

| İhtiyaç | Önerilen Widget |
|---------|-----------------|
| Tek KPI gösterimi | Büyük Kart |
| Çoklu KPI | Mini Kart |
| Zaman trendi | Çizgi Grafik |
| Karşılaştırma | Çubuk Grafik |
| Yüzde dağılımı | Pasta/Halka |
| Detaylı liste | Veri Tablosu |
| Sıralama | Sıralama Listesi |
| Hedef takibi | Gösterge |
`
  },
  {
    id: 'designer-grafik-turleri',
    slug: 'grafik-turleri',
    title: 'Grafik Türleri',
    excerpt: 'Çizgi, çubuk, pasta ve diğer grafik türlerini kullanın.',
    category: 'designer',
    categoryLabel: 'Tasarım Stüdyosu',
    tags: ['grafik', 'çizgi', 'çubuk', 'pasta', 'chart'],
    images: [],
    relatedArticles: ['designer-widget-turleri', 'metrics-gorsellestime-tipleri'],
    lastUpdated: '2026-01-27',
    readingTime: 7,
    order: 5,
    content: `
# Grafik Türleri

Clixer'da kullanabileceğiniz grafik türlerini ve ne zaman kullanılacaklarını öğrenin.

## Çizgi Grafik (Line Chart)

**Ne zaman kullanılır:**
- Zaman serisi verileri
- Trend analizi
- Sürekli değişim gösteren veriler

**Örnek:** Günlük satış trendi, aylık ziyaretçi sayısı

**Ayarlar:**
- Çizgi kalınlığı
- Nokta gösterimi
- Dolgulu alan

## Çubuk Grafik (Bar Chart)

**Ne zaman kullanılır:**
- Kategorik karşılaştırma
- Kesikli veriler
- Sıralama gösterimi

**Örnek:** Mağaza bazlı satışlar, ürün kategorileri

**Ayarlar:**
- Yatay/Dikey yönelim
- Çubuk genişliği
- Gruplama

## Alan Grafik (Area Chart)

**Ne zaman kullanılır:**
- Kümülatif değerler
- Hacim gösterimi
- Trend + büyüklük birlikte

**Örnek:** Toplam satış birikimi, stok değişimi

## Pasta Grafik (Pie Chart)

**Ne zaman kullanılır:**
- Yüzdesel dağılım
- Parça-bütün ilişkisi
- Az sayıda kategori (max 7-8)

**Örnek:** Satış kanalı dağılımı, kategori payları

> ⚠️ **Uyarı:** 8'den fazla dilim okunabilirliği azaltır.

## Halka Grafik (Donut Chart)

Pasta grafiğin modern versiyonu. Ortadaki boşluk toplam değeri göstermek için kullanılabilir.

## Combo Grafik

**Ne zaman kullanılır:**
- İki farklı ölçek
- Değer + trend birlikte
- Karşılaştırmalı analiz

**Örnek:** Satış tutarı (çubuk) + kar marjı (çizgi)

## Huni Grafik (Funnel)

**Ne zaman kullanılır:**
- Aşamalı süreçler
- Dönüşüm oranları
- Kayıp analizi

**Örnek:** Satış hunisi (Ziyaret → Sepet → Satın Alma)

## Isı Haritası (Heatmap)

**Ne zaman kullanılır:**
- İki boyutlu yoğunluk
- Zaman-kategori matrisi
- Pattern keşfi

**Örnek:** Saat-gün bazlı satış yoğunluğu

## Grafik Seçim Rehberi

| Veri Tipi | Önerilen Grafik |
|-----------|-----------------|
| Zaman serisi | Çizgi, Alan |
| Kategorik | Çubuk |
| Yüzde | Pasta, Halka |
| İki ölçek | Combo |
| Süreç | Huni |
| Matris | Isı Haritası |
`
  },
  {
    id: 'designer-tablo-widget',
    slug: 'tablo-widget',
    title: 'Tablo Widget',
    excerpt: 'Veri tablosu widget\'ı ile detaylı listeler oluşturun.',
    category: 'designer',
    categoryLabel: 'Tasarım Stüdyosu',
    tags: ['tablo', 'liste', 'data grid', 'widget'],
    images: [],
    relatedArticles: ['designer-widget-turleri', 'metrics-veri-tablosu-metrigi'],
    lastUpdated: '2026-01-27',
    readingTime: 5,
    order: 6,
    content: `
# Tablo Widget

Veri tablosu widget'ı ile detaylı veri listeleri oluşturun.

## Tablo Widget Nedir?

Tablo widget'ı, verileri satır ve sütun formatında gösteren widget türüdür. Mağaza listesi, ürün detayları, satış raporları gibi detaylı veriler için idealdir.

## Tablo Oluşturma

1. **Widget Ekle** > **Tablo** seçin
2. Grid'e sürükleyin
3. Metrik bağlayın (LIST veya data_grid tipinde)

## Kolon Ayarları

Metrik tanımlarken seçtiğiniz kolonlar tabloda görünür:

- **Kolon Adı**: Başlık metni
- **Kolon Genişliği**: Otomatik veya sabit
- **Hizalama**: Sol, orta, sağ
- **Format**: Sayı, tarih, para birimi

## Sıralama

- Kolon başlığına tıklayarak sıralama yapın
- Varsayılan sıralama metrikte tanımlanır

## Filtreleme

Tablo widget'ı dashboard filtrelerinden etkilenir:
- Tarih filtresi
- Bölge/Mağaza filtresi
- RLS filtreleri

## Sayfalama

Çok satırlı veriler için otomatik sayfalama:
- Sayfa başına satır sayısı
- Sayfa navigasyonu

## İpuçları

> 💡 Geniş tablolar için yatay kaydırma aktif olur.

> 💡 Kolon genişliklerini sürükleyerek ayarlayabilirsiniz.

> ⚠️ Çok fazla kolon performansı etkileyebilir.

## Sıralama Listesi vs Tablo

| Özellik | Sıralama Listesi | Tablo |
|---------|------------------|-------|
| Kullanım | TOP N | Tüm veriler |
| Sıralama | Zorunlu | Opsiyonel |
| Görünüm | Kompakt | Detaylı |
`
  },
  {
    id: 'designer-tasarim-kaydetme',
    slug: 'tasarim-kaydetme',
    title: 'Tasarım Kaydetme ve Yükleme',
    excerpt: 'Dashboard tasarımlarını kaydedin ve yönetin.',
    category: 'designer',
    categoryLabel: 'Tasarım Stüdyosu',
    tags: ['kaydetme', 'yükleme', 'tasarım', 'yönetim'],
    images: [],
    relatedArticles: ['designer-yeni-tasarim-olusturma', 'designer-rapor-yetkileri'],
    lastUpdated: '2026-01-27',
    readingTime: 4,
    order: 7,
    content: `
# Tasarım Kaydetme ve Yükleme

Dashboard tasarımlarınızı nasıl kaydedeceğinizi ve yöneteceğinizi öğrenin.

## Kaydetme

### İlk Kaydetme

1. Tasarım adını girin
2. Görüntüleme yerini seçin
3. **Kaydet** butonuna tıklayın

### Değişiklikleri Kaydetme

Mevcut tasarımda değişiklik yaptıktan sonra:
- **Kaydet** butonuna tıklayın
- Değişiklikler otomatik olarak aynı tasarıma kaydedilir

## Tasarım Açma

1. Sol paneldeki **Tasarımlar** bölümüne gidin
2. Dropdown'dan tasarım seçin
3. Tasarım grid'e yüklenir

## Tasarım Silme

1. Tasarımı açın
2. Sağ panelde **Sil** butonuna tıklayın
3. Onaylayın

> ⚠️ **Uyarı:** Silinen tasarım geri alınamaz!

## Tasarım Kopyalama

Mevcut tasarımı kopyalamak için:
1. Tasarımı açın
2. Tasarım adını değiştirin
3. **Kaydet** tıklayın (yeni tasarım olarak kaydedilir)

## İpuçları

> 💡 Düzenli olarak kaydedin, beklenmedik durumlar için.

> 💡 Anlamlı isimler kullanın: "Satış Özeti - v2" gibi.

> 💡 Test tasarımlarını ayrı tutun, production'a karıştırmayın.
`
  },
  {
    id: 'designer-rapor-yetkileri',
    slug: 'rapor-yetkileri',
    title: 'Rapor Yetkileri',
    excerpt: 'Dashboard\'lara pozisyon bazlı erişim yetkisi tanımlayın.',
    category: 'designer',
    categoryLabel: 'Tasarım Stüdyosu',
    tags: ['yetki', 'pozisyon', 'erişim', 'güvenlik'],
    images: [],
    relatedArticles: ['admin-pozisyon-yetkileri', 'admin-rls-nedir'],
    lastUpdated: '2026-01-27',
    readingTime: 5,
    order: 8,
    content: `
# Rapor Yetkileri

Dashboard'lara kimlerin erişebileceğini pozisyon bazlı olarak belirleyin.

## Yetki Sistemi

Clixer'da iki seviyeli yetki sistemi vardır:

1. **Rapor Yetkisi**: Dashboard'u kim görebilir?
2. **Veri Yetkisi (RLS)**: Dashboard'daki hangi verileri görebilir?

Bu bölüm rapor yetkisini kapsar.

## Pozisyon Bazlı Erişim

Tasarım oluştururken veya düzenlerken:

1. Sağ panelde **Rapor Yetkileri** bölümünü bulun
2. Görebilecek pozisyonları işaretleyin:
   - ☑️ Genel Müdür
   - ☑️ Direktör
   - ☑️ Bölge Müdürü
   - ☑️ Mağaza Müdürü
   - ☐ Analist
   - ☐ İzleyici

## Hızlı Seçim

- **Tümü**: Tüm pozisyonları seçer
- **Yönetim**: Sadece yönetici pozisyonları
- **Temizle**: Tüm seçimleri kaldırır

## Rapor Kategorileri

Güçler ayrılığı için rapor kategorileri kullanılabilir:

1. Tasarıma kategori atayın
2. Kullanıcılara kategori yetkisi verin
3. Sadece yetkili kullanıcılar raporu görür

## Örnek Senaryo

| Dashboard | Yetkili Pozisyonlar |
|-----------|---------------------|
| Genel Özet | Tüm pozisyonlar |
| Finansal Rapor | Genel Müdür, Direktör |
| Mağaza Detay | Bölge Müdürü, Mağaza Müdürü |
| Operasyon | Analist |

## İpuçları

> 💡 En az kısıtlayıcı yetki prensibini uygulayın.

> ⚠️ Yetki değişiklikleri anında geçerli olur.

> ℹ️ RLS ile birlikte kullanıldığında çift katmanlı güvenlik sağlanır.
`
  }
]

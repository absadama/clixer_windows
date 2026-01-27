import type { Article } from '../../../types/article'

export const articlesTr: Article[] = [
  {
    id: 'getting-started-clixer-nedir',
    slug: 'clixer-nedir',
    title: 'Clixer Nedir?',
    excerpt: 'Clixer kurumsal analitik platformunun temel özellikleri ve ne işe yaradığını öğrenin.',
    category: 'getting-started',
    categoryLabel: 'Başlangıç',
    tags: ['giriş', 'temel', 'analitik', 'dashboard'],
    images: [],
    relatedArticles: ['getting-started-ilk-giris', 'getting-started-temel-kavramlar'],
    lastUpdated: '2026-01-27',
    readingTime: 5,
    order: 1,
    content: `
# Clixer Nedir?

Clixer, kurumsal düzeyde bir **iş zekası (BI) ve analitik platformudur**. Verilerinizi görselleştirmenize, analiz etmenize ve raporlamanıza olanak tanır.

## Clixer Ne İşe Yarar?

Clixer ile şunları yapabilirsiniz:

- **Dashboard Oluşturma**: Sürükle-bırak arayüzü ile interaktif dashboardlar tasarlayın
- **KPI Takibi**: Önemli performans göstergelerinizi gerçek zamanlı izleyin
- **Veri Entegrasyonu**: Farklı veritabanlarından (SQL Server, PostgreSQL, MySQL) veri çekin
- **Otomatik Raporlama**: Zamanlanmış raporları e-posta ile gönderin
- **Mobil Erişim**: Telefonunuzdan veya tabletinizden dashboardlarınıza erişin

## Kimler Kullanabilir?

Clixer, yazılım bilgisi gerektirmeden kullanılabilir:

| Rol | Kullanım Alanı |
|-----|----------------|
| Genel Müdür | Şirket geneli KPI takibi |
| Bölge Müdürü | Bölge performans analizi |
| Mağaza Müdürü | Mağaza satış raporları |
| Analist | Detaylı veri analizi |

## Temel Özellikler

### 1. Tasarım Stüdyosu
Kod yazmadan dashboard tasarlayın. Widget'ları sürükleyip bırakın, boyutlandırın.

### 2. Metrik Yönetimi
KPI'larınızı tanımlayın. Toplam, ortalama, sayım gibi hesaplamalar yapın.

### 3. Veri Yönetimi
Veritabanlarınızı bağlayın, dataset'ler oluşturun, ETL işlemlerini zamanlayın.

### 4. Yetki Yönetimi
Kullanıcıların sadece yetkili oldukları verileri görmesini sağlayın (RLS).

## Sonraki Adımlar

Clixer'ı kullanmaya başlamak için:

1. [İlk Giriş](/getting-started/ilk-giris) - Arayüzü tanıyın
2. [Temel Kavramlar](/getting-started/temel-kavramlar) - Terminolojiyi öğrenin
3. [Hızlı Başlangıç](/getting-started/hizli-baslangic) - 5 dakikada ilk dashboard

> 💡 **İpucu:** Sol menüden istediğiniz konuya hızlıca ulaşabilirsiniz.
`
  },
  {
    id: 'getting-started-ilk-giris',
    slug: 'ilk-giris',
    title: 'İlk Giriş ve Arayüz Tanıtımı',
    excerpt: 'Clixer\'a ilk girişinizi yapın ve arayüzü tanıyın.',
    category: 'getting-started',
    categoryLabel: 'Başlangıç',
    tags: ['giriş', 'login', 'arayüz', 'menü'],
    images: [],
    relatedArticles: ['getting-started-clixer-nedir', 'getting-started-temel-kavramlar'],
    lastUpdated: '2026-01-27',
    readingTime: 4,
    order: 2,
    content: `
# İlk Giriş ve Arayüz Tanıtımı

Bu rehberde Clixer'a nasıl giriş yapacağınızı ve arayüzü tanıyacaksınız.

## Giriş Yapma

1. Tarayıcınızda Clixer adresini açın
2. **E-posta** ve **Şifre** bilgilerinizi girin
3. **Giriş Yap** butonuna tıklayın

> ℹ️ **Not:** İlk girişte sistem yöneticinizden aldığınız bilgileri kullanın.

## 2FA (İki Faktörlü Doğrulama)

Sisteminizde 2FA aktifse:

1. Google Authenticator veya benzeri bir uygulama açın
2. QR kodu tarayın
3. 6 haneli kodu girin

## Ana Arayüz

Giriş yaptıktan sonra karşınıza çıkan ekran:

### Sol Menü (Sidebar)

| Menü | Açıklama |
|------|----------|
| 🏠 Ana Sayfa | Dashboard listesi |
| 📊 Dashboard | Seçili dashboard görünümü |
| 📈 Analiz | Detaylı analiz sayfası |
| 🎨 Designer | Tasarım stüdyosu |
| 📁 Veri | Bağlantı ve dataset yönetimi |
| ⚙️ Yönetim | Admin paneli (yetkililere) |

### Üst Menü

- **Tarih Seçici**: Raporların tarih aralığını belirleyin
- **Filtreler**: Bölge, mağaza gibi filtreleri uygulayın
- **Profil**: Hesap ayarları ve çıkış

### Filtre Çubuğu

Dashboard'larda görünen filtre çubuğu ile:

- **Tarih aralığı** seçin (Bugün, Bu Hafta, Bu Ay, Özel)
- **Bölge** filtreleyin
- **Mağaza** seçin

## Tema Değiştirme

Clixer koyu (dark) tema ile gelir. Tema değiştirmek için:

1. Sağ üstteki profil ikonuna tıklayın
2. **Ayarlar** seçin
3. **Tema** bölümünden tercih yapın

## Sonraki Adımlar

- [Temel Kavramlar](/getting-started/temel-kavramlar) - Dataset, Metrik, Widget kavramlarını öğrenin
- [Hızlı Başlangıç](/getting-started/hizli-baslangic) - İlk dashboard'unuzu oluşturun
`
  },
  {
    id: 'getting-started-temel-kavramlar',
    slug: 'temel-kavramlar',
    title: 'Temel Kavramlar',
    excerpt: 'Dataset, Metrik, Widget ve RLS kavramlarını öğrenin.',
    category: 'getting-started',
    categoryLabel: 'Başlangıç',
    tags: ['kavram', 'dataset', 'metrik', 'widget', 'rls'],
    images: [],
    relatedArticles: ['getting-started-hizli-baslangic', 'metrics-metrik-nedir'],
    lastUpdated: '2026-01-27',
    readingTime: 6,
    order: 3,
    content: `
# Temel Kavramlar

Clixer'ı etkili kullanabilmek için bu temel kavramları anlamanız önemlidir.

## 1. Bağlantı (Connection)

**Bağlantı**, Clixer'ın verilerinize erişmek için kullandığı veritabanı bağlantısıdır.

Desteklenen veritabanları:
- Microsoft SQL Server
- PostgreSQL
- MySQL
- REST API

> 💡 **Örnek:** Şirketinizin ERP sisteminin veritabanına bağlantı oluşturursunuz.

## 2. Dataset

**Dataset**, bağlantıdan çekilen ve Clixer'da kullanıma hazır hale getirilen veri kümesidir.

Bir dataset şunları içerir:
- Kaynak tablo veya sorgu
- Kolonlar (tarih, sayı, metin)
- Partition kolonu (tarih bazlı bölümleme)

> 💡 **Örnek:** "Günlük Satışlar" dataset'i, satış tablosundan günlük verileri çeker.

## 3. ETL (Extract, Transform, Load)

**ETL**, kaynak veritabanından Clixer'a veri aktarım sürecidir.

| Aşama | Açıklama |
|-------|----------|
| Extract | Kaynak veritabanından veri çekme |
| Transform | Veriyi dönüştürme (format, hesaplama) |
| Load | Clixer'a (ClickHouse) yükleme |

ETL işlemleri:
- Manuel çalıştırılabilir
- Zamanlanabilir (her gece, her saat)

## 4. Metrik

**Metrik**, veriden hesaplanan anlamlı bir değerdir.

Metrik bileşenleri:
- **Dataset**: Verinin kaynağı
- **Kolon**: Hesaplanacak alan
- **Hesaplama Tipi**: Toplam, Ortalama, Sayım
- **Görselleştirme**: Kart, grafik, tablo

> 💡 **Örnek:** "Toplam Ciro" metriği, satış tablosundaki tutar kolonunun toplamıdır.

## 5. Widget

**Widget**, dashboard üzerinde görünen görsel bileşendir.

Widget türleri:
- **Kart**: Tek bir KPI değeri
- **Grafik**: Çizgi, çubuk, pasta grafikleri
- **Tablo**: Veri listesi
- **Gösterge**: Hedef takibi

## 6. Dashboard (Tasarım)

**Dashboard**, widget'ların bir araya geldiği görsel rapor sayfasıdır.

Dashboard özellikleri:
- Sürükle-bırak düzenleme
- Responsive tasarım (mobil uyumlu)
- Yetki bazlı erişim

## 7. RLS (Row Level Security)

**RLS**, kullanıcıların sadece yetkili oldukları verileri görmesini sağlar.

| Kullanıcı | Görebildiği Veri |
|-----------|------------------|
| Genel Müdür | Tüm mağazalar |
| Bölge Müdürü | Kendi bölgesindeki mağazalar |
| Mağaza Müdürü | Sadece kendi mağazası |

## Kavramlar Arası İlişki

\`\`\`
Bağlantı → Dataset → Metrik → Widget → Dashboard
                        ↓
                       RLS (Filtreleme)
\`\`\`

## Sonraki Adımlar

- [Hızlı Başlangıç](/getting-started/hizli-baslangic) - Bu kavramları pratikte uygulayın
- [Dataset Oluşturma](/data/dataset-olusturma) - İlk dataset'inizi oluşturun
- [Metrik Oluşturma](/metrics/yeni-metrik-olusturma) - İlk metriğinizi tanımlayın
`
  },
  {
    id: 'getting-started-hizli-baslangic',
    slug: 'hizli-baslangic',
    title: '5 Dakikada İlk Dashboard',
    excerpt: 'Adım adım ilk dashboard\'unuzu oluşturun.',
    category: 'getting-started',
    categoryLabel: 'Başlangıç',
    tags: ['hızlı başlangıç', 'dashboard', 'ilk adım'],
    images: [],
    relatedArticles: ['designer-yeni-tasarim-olusturma', 'metrics-yeni-metrik-olusturma'],
    lastUpdated: '2026-01-27',
    readingTime: 5,
    order: 4,
    content: `
# 5 Dakikada İlk Dashboard

Bu rehberde adım adım ilk dashboard'unuzu oluşturacaksınız.

## Ön Gereksinimler

Başlamadan önce şunların hazır olduğundan emin olun:
- ✅ Clixer'a giriş yapılmış
- ✅ En az bir dataset oluşturulmuş
- ✅ En az bir metrik tanımlanmış

> ℹ️ **Not:** Dataset ve metrik yoksa önce [Veri Yönetimi](/data/veri-yonetimi-nedir) bölümüne bakın.

## Adım 1: Tasarım Stüdyosunu Açın

1. Sol menüden **Designer** (🎨) seçin
2. **Stüdyo** sekmesine tıklayın

## Adım 2: Yeni Tasarım Oluşturun

1. Sağ panelde **Tasarım Adı** girin (örn: "Satış Özeti")
2. **Görüntüleme Yeri** seçin:
   - **Kokpit**: Ana sayfa dashboard'u
   - **Analiz**: Detaylı analiz sayfası
3. **Kaydet** butonuna tıklayın

## Adım 3: Widget Ekleyin

1. Sol panelden **Widget Ekle** bölümüne gidin
2. **Büyük Kart** widget'ını sürükleyip grid'e bırakın
3. Widget'a tıklayın, sağ panelde ayarlar açılır

## Adım 4: Metrik Bağlayın

1. Widget ayarlarında **Metrik Seç** dropdown'ına tıklayın
2. Listeden bir metrik seçin (örn: "Toplam Ciro")
3. Widget otomatik olarak veriyi gösterecektir

## Adım 5: Boyutlandırın

Widget'ın köşelerinden tutup boyutunu ayarlayın:
- **Genişlik**: Sağa-sola sürükleyin
- **Yükseklik**: Aşağı-yukarı sürükleyin

## Adım 6: Daha Fazla Widget Ekleyin

Aynı adımları tekrarlayarak ekleyin:
- **Mini Kart**: Kompakt KPI'lar için
- **Grafik**: Trend görmek için
- **Tablo**: Detaylı liste için

## Adım 7: Kaydedin

1. Sağ üstteki **Kaydet** butonuna tıklayın
2. Dashboard'unuz kaydedildi!

## Sonuç

Tebrikler! İlk dashboard'unuzu oluşturdunuz. 🎉

Şimdi:
- **Dashboard** menüsünden görüntüleyin
- Tarih filtrelerini deneyin
- Mobil görünümü kontrol edin

## Sonraki Adımlar

- [Widget Türleri](/designer/widget-turleri) - Tüm widget seçeneklerini keşfedin
- [Grafik Oluşturma](/designer/grafik-turleri) - Görsel grafikler ekleyin
- [Metrik Düzenleme](/metrics/yeni-metrik-olusturma) - Özel metrikler tanımlayın

> 💡 **İpucu:** Dashboard'unuzu düzenli olarak güncelleyin ve ihtiyaçlarınıza göre özelleştirin.
`
  },
  {
    id: 'getting-started-sss',
    slug: 'sss',
    title: 'Sıkça Sorulan Sorular',
    excerpt: 'En çok sorulan sorular ve cevapları.',
    category: 'getting-started',
    categoryLabel: 'Başlangıç',
    tags: ['sss', 'faq', 'soru', 'cevap', 'yardım'],
    images: [],
    relatedArticles: ['getting-started-clixer-nedir', 'advanced-sorun-giderme'],
    lastUpdated: '2026-01-27',
    readingTime: 8,
    order: 5,
    content: `
# Sıkça Sorulan Sorular

## Genel Sorular

### Clixer'a nasıl giriş yaparım?
Sistem yöneticinizden aldığınız e-posta ve şifre ile giriş yapabilirsiniz. 2FA aktifse, Google Authenticator gibi bir uygulama ile doğrulama kodu girmeniz gerekir.

### Şifremi unuttum, ne yapmalıyım?
Giriş ekranında "Şifremi Unuttum" linkine tıklayın. E-posta adresinize şifre sıfırlama linki gönderilecektir.

### Mobil cihazdan erişebilir miyim?
Evet! Clixer responsive tasarıma sahiptir. Tarayıcınızdan erişebilir veya ana ekrana ekleyerek uygulama gibi kullanabilirsiniz (PWA).

---

## Dashboard Soruları

### Dashboard'um neden boş görünüyor?
Olası nedenler:
1. Seçili tarih aralığında veri yok
2. Filtreler çok kısıtlayıcı
3. Yetkisiz veri alanı

**Çözüm:** Tarih aralığını genişletin ve filtreleri kontrol edin.

### Widget'lar neden yüklenmiyor?
1. İnternet bağlantınızı kontrol edin
2. Sayfayı yenileyin (F5)
3. Tarayıcı cache'ini temizleyin

### Veriler ne sıklıkla güncellenir?
ETL zamanlamasına bağlıdır. Genellikle:
- **Günlük veriler**: Her gece
- **Anlık veriler**: Saatlik veya daha sık

---

## Metrik Soruları

### Metrik ile Widget arasındaki fark nedir?
- **Metrik**: Hesaplama tanımı (ne hesaplanacak)
- **Widget**: Görsel gösterim (nasıl gösterilecek)

Bir metrik birden fazla widget'ta kullanılabilir.

### SQL modu ne zaman kullanılmalı?
- Karmaşık hesaplamalar gerektiğinde
- Birden fazla tabloyu birleştirirken (UNION)
- Özel filtreleme mantığı gerektiğinde

### LFL (Like-for-Like) nedir?
Karşılaştırılabilir dönem analizi. Sadece her iki dönemde de açık olan mağazaları karşılaştırır.

---

## Veri Soruları

### Verilerim neden güncel değil?
1. ETL işleminin çalışıp çalışmadığını kontrol edin
2. Son ETL zamanına bakın
3. Kaynak veritabanında veri var mı kontrol edin

### Yeni bir veritabanı nasıl bağlarım?
1. **Veri** > **Bağlantılar** menüsüne gidin
2. **+ Yeni Bağlantı** tıklayın
3. Veritabanı bilgilerini girin
4. **Test Et** ile bağlantıyı doğrulayın

### Dataset ile tablo arasındaki fark nedir?
- **Tablo**: Kaynak veritabanındaki ham veri
- **Dataset**: Clixer'a aktarılmış, optimize edilmiş veri

---

## Yetki Soruları

### Neden bazı verileri göremiyorum?
RLS (Row Level Security) nedeniyle. Sadece yetkiniz olan verileri görürsünüz. Daha fazla erişim için sistem yöneticinize başvurun.

### Yeni kullanıcı nasıl eklenir?
**Yönetim** > **Kullanıcılar** > **+ Yeni Kullanıcı** yolunu izleyin. (Admin yetkisi gerektirir)

---

## Performans Soruları

### Dashboard neden yavaş yükleniyor?
Olası nedenler:
1. Çok fazla widget
2. Geniş tarih aralığı
3. Karmaşık hesaplamalar

**Çözüm:** Tarih aralığını daraltın, gereksiz widget'ları kaldırın.

### Veriler neden gecikmeli?
ETL işlem süresi ve cache TTL'e bağlıdır. Anlık veri için sistem yöneticinizle görüşün.

---

## Daha Fazla Yardım

Sorununuzu bulamadıysanız:
- [Sorun Giderme](/advanced/sorun-giderme) rehberine bakın
- Sistem yöneticinize başvurun
- support@clixer.io adresine e-posta gönderin
`
  }
]

import type { Article } from '../../../types/article'

export const articlesTr: Article[] = [
  {
    id: 'admin-yonetim-paneli-nedir',
    slug: 'yonetim-paneli-nedir',
    title: 'Yönetim Paneli Nedir?',
    excerpt: 'Clixer yönetim panelinin genel tanıtımı.',
    category: 'admin',
    categoryLabel: 'Yönetim Paneli',
    tags: ['yönetim', 'admin', 'panel', 'ayarlar'],
    images: [],
    relatedArticles: ['admin-kullanici-yonetimi', 'admin-pozisyon-yetkileri'],
    lastUpdated: '2026-01-27',
    readingTime: 4,
    order: 1,
    content: `
# Yönetim Paneli Nedir?

Yönetim Paneli, Clixer'ın sistem yönetimi arayüzüdür. Kullanıcılar, yetkiler ve sistem ayarları buradan yönetilir.

## Erişim

Sol menüden **Yönetim** (⚙️) seçin.

> ⚠️ Yönetim paneline sadece Admin yetkili kullanıcılar erişebilir.

## Ana Bölümler

### Kullanıcılar
- Kullanıcı ekleme/düzenleme
- Şifre sıfırlama
- 2FA yönetimi
- Aktif/Pasif durumu

### Pozisyonlar
- Pozisyon tanımlama
- İzin yönetimi
- Rol atamaları

### Master Data
- Bölge tanımları
- Mağaza tanımları
- Organizasyon yapısı

### RLS (Row Level Security)
- Veri erişim kuralları
- Kullanıcı-mağaza eşleştirme

### Sistem Ayarları
- Genel ayarlar
- Güvenlik ayarları
- Tema ayarları

## Yetki Seviyeleri

| Rol | Yetkiler |
|-----|----------|
| SUPER_ADMIN | Tüm yetkiler |
| ADMIN | Kullanıcı ve ayar yönetimi |
| USER | Sadece görüntüleme |

## Sonraki Adımlar

- [Kullanıcı Yönetimi](/admin/kullanici-yonetimi)
- [Pozisyon Yetkileri](/admin/pozisyon-yetkileri)
- [RLS Kurulumu](/admin/rls-kurulumu)
`
  },
  {
    id: 'admin-kullanici-yonetimi',
    slug: 'kullanici-yonetimi',
    title: 'Kullanıcı Yönetimi',
    excerpt: 'Kullanıcı ekleme, düzenleme ve yönetme.',
    category: 'admin',
    categoryLabel: 'Yönetim Paneli',
    tags: ['kullanıcı', 'ekleme', 'düzenleme', 'yönetim'],
    images: [],
    relatedArticles: ['admin-pozisyon-yetkileri', 'admin-rls-kurulumu'],
    lastUpdated: '2026-01-27',
    readingTime: 6,
    order: 2,
    content: `
# Kullanıcı Yönetimi

Sistem kullanıcılarını ekleme, düzenleme ve yönetme işlemleri.

## Kullanıcı Listesi

1. **Yönetim** > **Kullanıcılar** sekmesine gidin
2. Mevcut kullanıcıları görün

Liste bilgileri:
- Ad Soyad
- E-posta
- Pozisyon
- Durum (Aktif/Pasif)
- Son giriş

## Yeni Kullanıcı Ekleme

1. **+ Yeni Kullanıcı** butonuna tıklayın
2. Bilgileri doldurun:

| Alan | Açıklama |
|------|----------|
| Ad | Kullanıcı adı |
| Soyad | Kullanıcı soyadı |
| E-posta | Giriş e-postası |
| Şifre | İlk şifre |
| Pozisyon | Rol/pozisyon |
| Telefon | Opsiyonel |

3. **Kaydet** butonuna tıklayın

## Kullanıcı Düzenleme

1. Kullanıcı satırındaki **Düzenle** ikonuna tıklayın
2. Bilgileri güncelleyin
3. **Kaydet** butonuna tıklayın

## Şifre Sıfırlama

1. Kullanıcıyı düzenleme moduna alın
2. **Şifre Sıfırla** butonuna tıklayın
3. Yeni şifre girin
4. Kaydedin

## 2FA Sıfırlama

Kullanıcı 2FA cihazını kaybettiyse:
1. Kullanıcı satırındaki 🔑 ikonuna tıklayın
2. Onaylayın
3. Kullanıcı yeni QR kod ile kurulum yapabilir

## Kullanıcı Deaktif Etme

1. Kullanıcıyı düzenleyin
2. **Aktif** toggle'ını kapatın
3. Kaydedin

> ⚠️ Deaktif kullanıcı giriş yapamaz.

## Toplu İşlemler

- Çoklu seçim yapın
- Toplu aktif/pasif yapın
- Toplu pozisyon değiştirin

## İpuçları

> 💡 Güçlü şifre politikası uygulayın.

> 💡 Ayrılan personeli hemen deaktif edin.

> 💡 Düzenli olarak kullanıcı listesini gözden geçirin.
`
  },
  {
    id: 'admin-pozisyon-yetkileri',
    slug: 'pozisyon-yetkileri',
    title: 'Pozisyon Yetkileri',
    excerpt: 'Rol ve izin yönetimi.',
    category: 'admin',
    categoryLabel: 'Yönetim Paneli',
    tags: ['pozisyon', 'yetki', 'rol', 'izin'],
    images: [],
    relatedArticles: ['admin-kullanici-yonetimi', 'admin-rls-nedir'],
    lastUpdated: '2026-01-27',
    readingTime: 6,
    order: 3,
    content: `
# Pozisyon Yetkileri

Pozisyonlara izin atama ve rol yönetimi.

## Pozisyon Nedir?

Pozisyon, kullanıcıların organizasyondaki rolünü tanımlar. Her pozisyonun farklı yetkileri olabilir.

## Varsayılan Pozisyonlar

| Pozisyon | Açıklama |
|----------|----------|
| Genel Müdür | Tüm verilere erişim |
| Direktör | Departman bazlı erişim |
| Bölge Müdürü | Bölge bazlı erişim |
| Mağaza Müdürü | Mağaza bazlı erişim |
| Analist | Analiz yetkisi |
| İzleyici | Sadece görüntüleme |

## Pozisyon Oluşturma

1. **Yönetim** > **Pozisyonlar** sekmesine gidin
2. **+ Yeni Pozisyon** tıklayın
3. Pozisyon adı ve kodu girin
4. Kaydedin

## İzin Atama

Her pozisyon için izinleri belirleyin:

### Modül İzinleri
- ✅ Dashboard görüntüleme
- ✅ Analiz sayfası
- ❌ Designer erişimi
- ❌ Veri yönetimi
- ❌ Yönetim paneli

### Veri İzinleri
- Tüm veriler
- Bölge bazlı
- Mağaza bazlı
- Kendi verileri

## İzin Matrisi

| İzin | GM | Dir | BM | MM |
|------|----|----|----|----|
| Dashboard | ✅ | ✅ | ✅ | ✅ |
| Designer | ✅ | ✅ | ❌ | ❌ |
| Veri | ✅ | ❌ | ❌ | ❌ |
| Yönetim | ✅ | ❌ | ❌ | ❌ |

## Pozisyon Hiyerarşisi

Üst pozisyonlar alt pozisyonların verilerini görebilir:

\`\`\`
Genel Müdür
    └── Direktör
        └── Bölge Müdürü
            └── Mağaza Müdürü
\`\`\`

## İpuçları

> 💡 En az yetki prensibini uygulayın.

> 💡 Pozisyon değişikliklerini dokümante edin.

> ⚠️ Pozisyon silme kullanıcıları etkiler.
`
  },
  {
    id: 'admin-rls-nedir',
    slug: 'rls-nedir',
    title: 'RLS (Row Level Security) Nedir?',
    excerpt: 'Satır seviyesinde güvenlik kavramını öğrenin.',
    category: 'admin',
    categoryLabel: 'Yönetim Paneli',
    tags: ['rls', 'güvenlik', 'veri', 'erişim'],
    images: [],
    relatedArticles: ['admin-rls-kurulumu', 'admin-pozisyon-yetkileri'],
    lastUpdated: '2026-01-27',
    readingTime: 5,
    order: 4,
    content: `
# RLS (Row Level Security) Nedir?

RLS, kullanıcıların sadece yetkili oldukları verileri görmesini sağlayan güvenlik mekanizmasıdır.

## RLS Nasıl Çalışır?

1. Kullanıcıya mağaza/bölge ataması yapılır
2. Sorgular otomatik filtrelenir
3. Kullanıcı sadece yetkili verileri görür

## Örnek Senaryo

### RLS Olmadan
Tüm kullanıcılar tüm mağazaların verilerini görür.

### RLS ile
| Kullanıcı | Görebildiği |
|-----------|-------------|
| Ahmet (Bölge Müdürü) | Marmara bölgesi mağazaları |
| Mehmet (Mağaza Müdürü) | Sadece kendi mağazası |
| Ayşe (Genel Müdür) | Tüm mağazalar |

## RLS Bileşenleri

### 1. Reference Kolonu
Dataset'teki filtreleme kolonu (magaza_id, bolge_id)

### 2. Master Data
Mağaza ve bölge tanımları

### 3. Kullanıcı Ataması
Kullanıcı-mağaza eşleştirmesi

## RLS Akışı

\`\`\`
Kullanıcı Girişi → Yetki Kontrolü → Sorgu Filtreleme → Sonuç
       ↓                ↓                  ↓
   Mehmet          Mağaza: M001      WHERE magaza_id = 'M001'
\`\`\`

## Avantajları

- Veri güvenliği
- Otomatik filtreleme
- Merkezi yönetim
- Denetlenebilirlik

## Sonraki Adımlar

- [RLS Kurulumu](/admin/rls-kurulumu)
- [Master Data Yönetimi](/admin/bolge-ekleme)
`
  },
  {
    id: 'admin-rls-kurulumu',
    slug: 'rls-kurulumu',
    title: 'RLS Kurulumu',
    excerpt: 'Adım adım RLS yapılandırması.',
    category: 'admin',
    categoryLabel: 'Yönetim Paneli',
    tags: ['rls', 'kurulum', 'yapılandırma', 'güvenlik'],
    images: [],
    relatedArticles: ['admin-rls-nedir', 'admin-magaza-ekleme'],
    lastUpdated: '2026-01-27',
    readingTime: 7,
    order: 5,
    content: `
# RLS Kurulumu

Row Level Security'yi adım adım yapılandırın.

## Ön Gereksinimler

1. Master data tanımlı (bölgeler, mağazalar)
2. Dataset'lerde reference kolonu var
3. Kullanıcılar oluşturulmuş

## Adım 1: Master Data Kontrolü

**Yönetim** > **Master Data** bölümünde:
- Bölgeler tanımlı mı?
- Mağazalar tanımlı mı?
- Hiyerarşi doğru mu?

## Adım 2: Dataset Reference Kolonu

Dataset ayarlarında reference kolonu seçin:
- magaza_id
- bolge_id
- veya özel kolon

## Adım 3: Kullanıcı Ataması

1. **Yönetim** > **Kullanıcılar** gidin
2. Kullanıcıyı düzenleyin
3. **RLS Atamaları** bölümünü açın
4. Mağaza/bölge seçin

### Atama Türleri

| Tür | Açıklama |
|-----|----------|
| Mağaza | Tek mağaza erişimi |
| Bölge | Bölgedeki tüm mağazalar |
| Tümü | Tüm verilere erişim |

## Adım 4: Test

1. Test kullanıcısı ile giriş yapın
2. Dashboard'ları kontrol edin
3. Sadece yetkili veriler görünmeli

## Çoklu Atama

Bir kullanıcıya birden fazla mağaza atayabilirsiniz:
- Mağaza 1 ✅
- Mağaza 2 ✅
- Mağaza 3 ❌

## Hiyerarşik Erişim

Bölge müdürü atandığında:
- Bölgedeki tüm mağazaları görür
- Alt bölgeleri de görür

## Sorun Giderme

### Veri Görünmüyor
- RLS ataması yapılmış mı?
- Reference kolonu doğru mu?
- Dataset'te veri var mı?

### Fazla Veri Görünüyor
- Atama çok geniş mi?
- "Tümü" seçili mi?
- Pozisyon yetkisi kontrol

## İpuçları

> 💡 Test kullanıcısı ile doğrulayın.

> 💡 Değişiklikleri dokümante edin.

> ⚠️ Yanlış atama veri sızıntısına neden olabilir.
`
  },
  {
    id: 'admin-bolge-ekleme',
    slug: 'bolge-ekleme',
    title: 'Bölge Ekleme',
    excerpt: 'Master data\'ya bölge tanımlayın.',
    category: 'admin',
    categoryLabel: 'Yönetim Paneli',
    tags: ['bölge', 'master data', 'tanımlama'],
    images: [],
    relatedArticles: ['admin-magaza-ekleme', 'admin-rls-kurulumu'],
    lastUpdated: '2026-01-27',
    readingTime: 4,
    order: 6,
    content: `
# Bölge Ekleme

Organizasyonunuzun bölge yapısını tanımlayın.

## Bölge Sayfası

1. **Yönetim** > **Master Data** > **Bölgeler** gidin
2. Mevcut bölgeleri görün

## Yeni Bölge Ekleme

1. **+ Yeni Bölge** butonuna tıklayın
2. Bilgileri doldurun:

| Alan | Açıklama | Örnek |
|------|----------|-------|
| Bölge Kodu | Tekil kod | MAR |
| Bölge Adı | Görünen isim | Marmara |
| Üst Bölge | Hiyerarşi | Türkiye |

3. **Kaydet** tıklayın

## Bölge Hiyerarşisi

\`\`\`
Türkiye
├── Marmara
│   ├── İstanbul Avrupa
│   └── İstanbul Anadolu
├── Ege
│   └── İzmir
└── İç Anadolu
    └── Ankara
\`\`\`

## Bölge Düzenleme

1. Bölge satırındaki **Düzenle** ikonuna tıklayın
2. Bilgileri güncelleyin
3. Kaydedin

## Bölge Silme

> ⚠️ Bölge silmeden önce:
> - Altındaki mağazaları taşıyın
> - RLS atamalarını güncelleyin

## Toplu Import

CSV dosyasından toplu bölge ekleyin:
1. **Import** butonuna tıklayın
2. CSV dosyası seçin
3. Kolon eşleştirmesi yapın
4. Import edin

## İpuçları

> 💡 Tutarlı kodlama kullanın (3 harf).

> 💡 Hiyerarşiyi basit tutun.

> 💡 Değişiklikleri planlayın.
`
  },
  {
    id: 'admin-magaza-ekleme',
    slug: 'magaza-ekleme',
    title: 'Mağaza Ekleme',
    excerpt: 'Master data\'ya mağaza tanımlayın.',
    category: 'admin',
    categoryLabel: 'Yönetim Paneli',
    tags: ['mağaza', 'master data', 'tanımlama'],
    images: [],
    relatedArticles: ['admin-bolge-ekleme', 'admin-rls-kurulumu'],
    lastUpdated: '2026-01-27',
    readingTime: 5,
    order: 7,
    content: `
# Mağaza Ekleme

Organizasyonunuzun mağaza/şube yapısını tanımlayın.

## Mağaza Sayfası

1. **Yönetim** > **Master Data** > **Mağazalar** gidin
2. Mevcut mağazaları görün

## Yeni Mağaza Ekleme

1. **+ Yeni Mağaza** butonuna tıklayın
2. Bilgileri doldurun:

| Alan | Açıklama | Örnek |
|------|----------|-------|
| Mağaza Kodu | Tekil kod | M001 |
| Mağaza Adı | Görünen isim | Kadıköy |
| Bölge | Ait olduğu bölge | İstanbul Anadolu |
| Açılış Tarihi | LFL için | 2020-01-15 |
| Durum | Aktif/Pasif | Aktif |

3. **Kaydet** tıklayın

## Mağaza Bilgileri

### Zorunlu Alanlar
- Mağaza Kodu
- Mağaza Adı
- Bölge

### Opsiyonel Alanlar
- Adres
- Telefon
- Açılış tarihi
- Kapanış tarihi
- Metrekare
- Çalışan sayısı

## LFL için Tarihler

Like-for-Like karşılaştırması için:
- **Açılış Tarihi**: Mağazanın açıldığı tarih
- **Kapanış Tarihi**: Kapandıysa (NULL = aktif)

## Mağaza Durumu

| Durum | Açıklama |
|-------|----------|
| Aktif | Normal operasyon |
| Pasif | Geçici kapalı |
| Kapalı | Kalıcı kapalı |

## Toplu Import

Dataset'ten mağaza import edin:
1. **Dataset'ten Import** butonuna tıklayın
2. Dataset seçin
3. Kolon eşleştirmesi yapın
4. Import edin

## İpuçları

> 💡 Mağaza kodlarını tutarlı tutun.

> 💡 Açılış tarihlerini doğru girin (LFL için kritik).

> 💡 Kapanan mağazaları "Kapalı" yapın, silmeyin.
`
  },
  {
    id: 'admin-sistem-ayarlari',
    slug: 'sistem-ayarlari',
    title: 'Sistem Ayarları',
    excerpt: 'Genel sistem ayarlarını yapılandırın.',
    category: 'admin',
    categoryLabel: 'Yönetim Paneli',
    tags: ['sistem', 'ayarlar', 'yapılandırma', 'güvenlik'],
    images: [],
    relatedArticles: ['admin-yonetim-paneli-nedir', 'advanced-2fa-kurulumu'],
    lastUpdated: '2026-01-27',
    readingTime: 5,
    order: 8,
    content: `
# Sistem Ayarları

Clixer'ın genel sistem ayarlarını yapılandırın.

## Ayarlar Sayfası

**Yönetim** > **Sistem Ayarları** gidin.

## Genel Ayarlar

### Uygulama Adı
Dashboard'larda görünen isim.

### Logo
Özel logo yükleyin (PNG, max 500KB).

### Tema
- Koyu tema (varsayılan)
- Açık tema

### Dil
- Türkçe
- İngilizce

## Güvenlik Ayarları

### 2FA Zorunluluğu
Tüm kullanıcılar için 2FA zorunlu yapın.

### Oturum Süresi
Otomatik çıkış süresi (dakika).

### Şifre Politikası
- Minimum uzunluk
- Büyük/küçük harf
- Rakam zorunluluğu
- Özel karakter

### IP Whitelist
Sadece belirli IP'lerden erişim.

## E-posta Ayarları

Rapor abonelikleri için SMTP ayarları:

| Alan | Açıklama |
|------|----------|
| SMTP Host | Mail sunucusu |
| Port | 587 veya 465 |
| Kullanıcı | SMTP kullanıcısı |
| Şifre | SMTP şifresi |
| Gönderen | noreply@sirket.com |

## Cache Ayarları

### Cache TTL
Veri önbellek süresi (saniye).

### Cache Temizleme
Manuel cache temizleme butonu.

## İpuçları

> 💡 2FA'yı production'da zorunlu yapın.

> 💡 Oturum süresini makul tutun (30-60 dk).

> ⚠️ Ayar değişiklikleri tüm kullanıcıları etkiler.
`
  },
  {
    id: 'admin-rapor-kategorileri',
    slug: 'rapor-kategorileri',
    title: 'Rapor Kategorileri',
    excerpt: 'Güçler ayrılığı için rapor kategorileri.',
    category: 'admin',
    categoryLabel: 'Yönetim Paneli',
    tags: ['rapor', 'kategori', 'yetki', 'güçler ayrılığı'],
    images: [],
    relatedArticles: ['designer-rapor-yetkileri', 'admin-pozisyon-yetkileri'],
    lastUpdated: '2026-01-27',
    readingTime: 5,
    order: 9,
    content: `
# Rapor Kategorileri

Güçler ayrılığı için rapor kategorileri tanımlayın.

## Rapor Kategorisi Nedir?

Rapor kategorileri, dashboard'ları gruplandırır ve erişimi kontrol eder. Pozisyon yetkisinin üzerine ek bir güvenlik katmanı ekler.

## Neden Kullanılır?

- Departman bazlı erişim
- Gizli raporların korunması
- Düzenleyici uyumluluk

## Kategori Oluşturma

1. **Yönetim** > **Rapor Kategorileri** gidin
2. **+ Yeni Kategori** tıklayın
3. Bilgileri girin:

| Alan | Örnek |
|------|-------|
| Kategori Adı | Finansal Raporlar |
| Açıklama | Sadece finans ekibi |
| Renk | Kırmızı |

4. Kaydedin

## Kategoriye Rapor Atama

Designer'da tasarım oluştururken:
1. **Rapor Kategorisi** dropdown'ından seçin
2. Kaydedin

## Kullanıcıya Kategori Yetkisi

1. Kullanıcıyı düzenleyin
2. **Rapor Kategorileri** bölümünü açın
3. Erişebileceği kategorileri seçin

## Örnek Senaryo

| Kategori | Erişebilen |
|----------|------------|
| Genel Raporlar | Tüm kullanıcılar |
| Finansal | Finans ekibi |
| İK Raporları | İK ekibi |
| Yönetim | Sadece üst yönetim |

## Kategori + Pozisyon

İki katmanlı yetki kontrolü:

1. **Pozisyon yetkisi**: Raporu görebilir mi?
2. **Kategori yetkisi**: Bu kategoriye erişimi var mı?

Her iki koşul da sağlanmalı.

## İpuçları

> 💡 Çok fazla kategori karmaşıklık yaratır.

> 💡 Varsayılan kategori tanımlayın.

> 💡 Kategori değişikliklerini duyurun.
`
  }
]

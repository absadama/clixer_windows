import type { Article } from '../../../types/article'

export const articlesTr: Article[] = [
  {
    id: 'advanced-performans-ipuclari',
    slug: 'performans-ipuclari',
    title: 'Performans İpuçları',
    excerpt: 'Dashboard ve sorgu performansını optimize edin.',
    category: 'advanced',
    categoryLabel: 'İleri Düzey',
    tags: ['performans', 'optimizasyon', 'hız', 'cache'],
    images: [],
    relatedArticles: ['advanced-cache-yonetimi', 'data-clickhouse-yonetimi'],
    lastUpdated: '2026-01-27',
    readingTime: 7,
    order: 1,
    content: `
# Performans İpuçları

Dashboard ve sorgu performansını optimize etmek için ipuçları.

## Dashboard Performansı

### Widget Sayısı
- Maksimum 15-20 widget önerilir
- Çok fazla widget yükleme süresini artırır

### Tarih Aralığı
- Dar tarih aralıkları daha hızlı
- 1 yıldan uzun aralıklardan kaçının

### Karmaşık Metrikler
- UNION ve JOIN sorgularını minimize edin
- Önceden hesaplanmış veriler kullanın

## Sorgu Performansı

### Partition Kullanımı
\`\`\`sql
-- İYİ: Partition kolonu WHERE'de
WHERE tarih BETWEEN '2025-01-01' AND '2025-01-31'

-- KÖTÜ: Partition kolonu yok
WHERE magaza_id = 'M001'
\`\`\`

### LIMIT Kullanımı
\`\`\`sql
-- İYİ: Sonuç sınırlı
SELECT * FROM satis LIMIT 1000

-- KÖTÜ: Tüm veriler
SELECT * FROM satis
\`\`\`

### Gereksiz Kolonlar
\`\`\`sql
-- İYİ: Sadece gerekli kolonlar
SELECT tarih, SUM(tutar) FROM satis

-- KÖTÜ: Tüm kolonlar
SELECT * FROM satis
\`\`\`

## ETL Performansı

### Incremental ETL
- Full sync yerine incremental kullanın
- Sadece değişen veriyi aktarın

### Zamanlama
- Yoğun olmayan saatlerde çalıştırın
- Paralel ETL'den kaçının

## Cache Kullanımı

### Cache TTL
- Sık değişen veriler: Kısa TTL (5-15 dk)
- Nadir değişen veriler: Uzun TTL (1-24 saat)

### Cache Temizleme
- ETL sonrası otomatik temizleme
- Manuel temizleme gerektiğinde

## İzleme

### Yavaş Sorgular
- Sorgu sürelerini izleyin
- 5 saniyeden uzun sorguları optimize edin

### Kaynak Kullanımı
- CPU ve bellek kullanımını takip edin
- Disk I/O'yu izleyin

## Checklist

- [ ] Widget sayısı < 20
- [ ] Tarih aralığı makul
- [ ] Partition kolonu kullanılıyor
- [ ] LIMIT var
- [ ] Cache aktif
- [ ] Incremental ETL
`
  },
  {
    id: 'advanced-cache-yonetimi',
    slug: 'cache-yonetimi',
    title: 'Cache Yönetimi',
    excerpt: 'Redis cache yapılandırması ve yönetimi.',
    category: 'advanced',
    categoryLabel: 'İleri Düzey',
    tags: ['cache', 'redis', 'performans', 'ttl'],
    images: [],
    relatedArticles: ['advanced-performans-ipuclari', 'admin-sistem-ayarlari'],
    lastUpdated: '2026-01-27',
    readingTime: 5,
    order: 2,
    content: `
# Cache Yönetimi

Clixer, performans için Redis cache kullanır.

## Cache Nedir?

Cache, sık kullanılan verileri bellekte tutarak sorgu süresini azaltır.

## Cache Akışı

\`\`\`
İstek → Cache Kontrol → Cache'de var mı?
                            ↓
                    Evet: Cache'den döndür
                    Hayır: DB'den çek → Cache'e yaz → Döndür
\`\`\`

## Cache TTL (Time To Live)

Verinin cache'de kalma süresi:

| Veri Tipi | Önerilen TTL |
|-----------|--------------|
| Dashboard verisi | 5-15 dakika |
| Metrik sonucu | 5-30 dakika |
| Master data | 1-24 saat |
| Kullanıcı oturumu | 30-60 dakika |

## Cache Ayarları

**Yönetim** > **Sistem Ayarları** > **Cache**:

- **Varsayılan TTL**: Genel cache süresi
- **Metrik TTL**: Metrik sonuçları için
- **Dashboard TTL**: Dashboard verisi için

## Manuel Cache Temizleme

1. **Sistem Ayarları** > **Cache** gidin
2. **Cache Temizle** butonuna tıklayın
3. Temizlenecek türü seçin:
   - Tüm cache
   - Metrik cache
   - Dashboard cache

## Otomatik Temizleme

Cache otomatik temizlenir:
- ETL tamamlandığında
- Metrik güncellendiğinde
- TTL süresi dolduğunda

## Cache Sorunları

### Eski Veri Görünüyor
- Cache temizleyin
- TTL'i kısaltın

### Performans Düşük
- Cache aktif mi kontrol edin
- Redis bağlantısını kontrol edin

## İpuçları

> 💡 Kritik dashboard'lar için kısa TTL kullanın.

> 💡 ETL sonrası cache temizlemeyi otomatikleştirin.

> ⚠️ Çok kısa TTL performansı düşürür.
`
  },
  {
    id: 'advanced-2fa-kurulumu',
    slug: '2fa-kurulumu',
    title: '2FA Kurulumu',
    excerpt: 'İki faktörlü doğrulama yapılandırması.',
    category: 'advanced',
    categoryLabel: 'İleri Düzey',
    tags: ['2fa', 'güvenlik', 'authenticator', 'doğrulama'],
    images: [],
    relatedArticles: ['admin-sistem-ayarlari', 'admin-kullanici-yonetimi'],
    lastUpdated: '2026-01-27',
    readingTime: 6,
    order: 3,
    content: `
# 2FA Kurulumu

İki faktörlü doğrulama (2FA) ile güvenliği artırın.

## 2FA Nedir?

2FA, şifreye ek olarak ikinci bir doğrulama faktörü gerektirir:
1. Bildiğiniz bir şey (şifre)
2. Sahip olduğunuz bir şey (telefon)

## Desteklenen Uygulamalar

- Google Authenticator
- Microsoft Authenticator
- Authy
- 1Password

## Sistem Geneli 2FA

Admin olarak tüm kullanıcılar için 2FA zorunlu yapın:

1. **Yönetim** > **Sistem Ayarları** gidin
2. **Güvenlik** bölümünü açın
3. **2FA Zorunlu** toggle'ını açın
4. Kaydedin

## Kullanıcı 2FA Kurulumu

### İlk Kurulum
1. Kullanıcı giriş yapar
2. QR kod ekranı gösterilir
3. Authenticator uygulamasıyla tarar
4. 6 haneli kodu girer
5. Backup kodları kaydeder

### Backup Kodları
- 10 adet tek kullanımlık kod
- Telefon kaybolursa kullanılır
- Güvenli yerde saklayın

## 2FA Sıfırlama

Kullanıcı telefonunu kaybettiyse:

1. Admin olarak **Kullanıcılar** gidin
2. Kullanıcı satırındaki 🔑 ikonuna tıklayın
3. Onaylayın
4. Kullanıcı yeni kurulum yapabilir

## Cihazı Hatırla

"Bu cihazı hatırla" seçeneği:
- 30 gün boyunca 2FA atlanır
- Sadece güvenilir cihazlarda kullanın
- IP ve tarayıcı değişirse geçersiz olur

## Güvenlik Önerileri

> 💡 Production'da 2FA zorunlu yapın.

> 💡 Backup kodları güvenli saklayın.

> ⚠️ "Cihazı hatırla"yı halka açık cihazlarda kullanmayın.

> ⚠️ 2FA sıfırlama yetkisini sınırlı tutun.
`
  },
  {
    id: 'advanced-rapor-abonelikleri',
    slug: 'rapor-abonelikleri',
    title: 'Rapor Abonelikleri',
    excerpt: 'Otomatik e-posta rapor gönderimi.',
    category: 'advanced',
    categoryLabel: 'İleri Düzey',
    tags: ['rapor', 'abonelik', 'email', 'zamanlama'],
    images: [],
    relatedArticles: ['admin-sistem-ayarlari', 'designer-tasarim-kaydetme'],
    lastUpdated: '2026-01-27',
    readingTime: 6,
    order: 4,
    content: `
# Rapor Abonelikleri

Dashboard'ları otomatik olarak e-posta ile gönderin.

## Abonelik Nedir?

Rapor aboneliği, belirli aralıklarla dashboard ekran görüntüsünü e-posta olarak gönderir.

## Ön Gereksinimler

1. SMTP ayarları yapılmış
2. Dashboard oluşturulmuş
3. Alıcı e-postaları tanımlı

## SMTP Ayarları

**Yönetim** > **Sistem Ayarları** > **E-posta**:

| Alan | Örnek |
|------|-------|
| SMTP Host | smtp.gmail.com |
| Port | 587 |
| Kullanıcı | rapor@sirket.com |
| Şifre | ******** |
| Gönderen | noreply@sirket.com |

## Abonelik Oluşturma

1. Dashboard'u açın
2. **Abonelik** butonuna tıklayın
3. Bilgileri doldurun:

| Alan | Açıklama |
|------|----------|
| Abonelik Adı | "Günlük Satış Raporu" |
| Alıcılar | E-posta adresleri |
| Zamanlama | Günlük, Haftalık, Aylık |
| Saat | 08:00 |

4. **Kaydet** tıklayın

## Zamanlama Seçenekleri

| Zamanlama | Açıklama |
|-----------|----------|
| Günlük | Her gün belirli saatte |
| Haftalık | Haftanın belirli günü |
| Aylık | Ayın belirli günü |
| Özel | Cron ifadesi |

## Alıcı Türleri

### Sistem Kullanıcıları
Clixer kullanıcılarını seçin.

### Harici E-postalar
Sistem dışı e-posta adresleri ekleyin.

## Abonelik Yönetimi

**Yönetim** > **Rapor Abonelikleri**:
- Aktif abonelikleri görün
- Düzenleyin veya silin
- Gönderim loglarını inceleyin

## Sorun Giderme

### E-posta Gitmiyor
- SMTP ayarlarını kontrol edin
- Spam klasörünü kontrol edin
- Gönderim loglarını inceleyin

### Görüntü Bozuk
- Dashboard'un düzgün yüklendiğinden emin olun
- Widget'ların veri gösterdiğini kontrol edin

## İpuçları

> 💡 Sabah erken saatleri tercih edin.

> 💡 Çok fazla alıcı performansı etkileyebilir.

> ⚠️ Hassas verileri harici e-postalara göndermeyin.
`
  },
  {
    id: 'advanced-white-label',
    slug: 'white-label',
    title: 'White Label (Marka Özelleştirme)',
    excerpt: 'Logo ve tema özelleştirmesi.',
    category: 'advanced',
    categoryLabel: 'İleri Düzey',
    tags: ['white label', 'logo', 'tema', 'marka'],
    images: [],
    relatedArticles: ['admin-sistem-ayarlari'],
    lastUpdated: '2026-01-27',
    readingTime: 4,
    order: 5,
    content: `
# White Label (Marka Özelleştirme)

Clixer'ı kendi markanızla özelleştirin.

## Logo Değiştirme

1. **Yönetim** > **Sistem Ayarları** gidin
2. **Görünüm** bölümünü açın
3. **Logo Yükle** butonuna tıklayın
4. Logo dosyasını seçin

### Logo Gereksinimleri
- Format: PNG (şeffaf arka plan önerilir)
- Boyut: Maksimum 500KB
- Çözünürlük: 200x50 piksel önerilir

## Uygulama Adı

Başlıkta görünen ismi değiştirin:
1. **Uygulama Adı** alanına yazın
2. Kaydedin

## Tema Renkleri

### Ana Renk
Butonlar, linkler ve vurgular için.

### Arka Plan
Dashboard arka plan rengi.

### Kart Rengi
Widget kartlarının rengi.

## Favicon

Tarayıcı sekmesinde görünen ikon:
1. **Favicon Yükle** butonuna tıklayın
2. ICO veya PNG dosyası seçin
3. Kaydedin

## PWA İkonu

Mobil ana ekran ikonu:
1. **PWA İkonu Yükle** butonuna tıklayın
2. 512x512 PNG dosyası seçin
3. Kaydedin

## Özelleştirme Önizleme

Değişiklikleri kaydetmeden önce önizleyin:
1. **Önizle** butonuna tıklayın
2. Yeni görünümü kontrol edin
3. Beğendiyseniz kaydedin

## İpuçları

> 💡 Koyu tema için açık renkli logo kullanın.

> 💡 Tutarlı marka renkleri kullanın.

> 💡 Yüksek çözünürlüklü görseller kullanın.
`
  },
  {
    id: 'advanced-mobil-kullanim',
    slug: 'mobil-kullanim',
    title: 'Mobil Kullanım (PWA)',
    excerpt: 'Clixer\'ı mobil cihazlarda kullanın.',
    category: 'advanced',
    categoryLabel: 'İleri Düzey',
    tags: ['mobil', 'pwa', 'telefon', 'tablet'],
    images: [],
    relatedArticles: ['getting-started-ilk-giris'],
    lastUpdated: '2026-01-27',
    readingTime: 5,
    order: 6,
    content: `
# Mobil Kullanım (PWA)

Clixer, Progressive Web App (PWA) olarak mobil cihazlarda kullanılabilir.

## PWA Nedir?

PWA, web uygulamasını mobil uygulama gibi kullanmanızı sağlar:
- Ana ekrana eklenebilir
- Çevrimdışı çalışabilir
- Bildirim alabilir

## Ana Ekrana Ekleme

### iOS (Safari)
1. Clixer'ı Safari'de açın
2. **Paylaş** ikonuna dokunun
3. **Ana Ekrana Ekle** seçin
4. **Ekle** onaylayın

### Android (Chrome)
1. Clixer'ı Chrome'da açın
2. **Menü** (⋮) ikonuna dokunun
3. **Ana ekrana ekle** seçin
4. **Ekle** onaylayın

## Mobil Arayüz

Mobil cihazlarda arayüz otomatik uyarlanır:
- Sidebar gizlenir (hamburger menü)
- Widget'lar tek sütun
- Dokunmatik optimizasyon

## Mobil Özellikler

### Dashboard Görüntüleme
- Kaydırarak widget'lar arası geçiş
- Pinch-to-zoom ile yakınlaştırma
- Yatay/dikey mod desteği

### Filtreler
- Tarih seçici mobil uyumlu
- Dropdown'lar dokunmatik

### Grafikler
- Dokunarak detay görüntüleme
- Kaydırarak zaman aralığı değiştirme

## Performans İpuçları

> 💡 WiFi bağlantısı önerilir.

> 💡 Çok fazla widget mobilde yavaşlatır.

> 💡 Basit dashboard'lar mobil için idealdir.

## Sınırlamalar

Mobilde bazı özellikler kısıtlıdır:
- Designer (tasarım) kullanılamaz
- Veri yönetimi sınırlı
- Dosya yükleme kısıtlı

## Sorun Giderme

### Uygulama Açılmıyor
- Tarayıcı cache'ini temizleyin
- Uygulamayı kaldırıp tekrar ekleyin

### Yavaş Yükleme
- İnternet bağlantısını kontrol edin
- Daha az widget içeren dashboard kullanın
`
  },
  {
    id: 'advanced-sorun-giderme',
    slug: 'sorun-giderme',
    title: 'Sorun Giderme',
    excerpt: 'Yaygın sorunlar ve çözümleri.',
    category: 'advanced',
    categoryLabel: 'İleri Düzey',
    tags: ['sorun', 'hata', 'çözüm', 'debug'],
    images: [],
    relatedArticles: ['getting-started-sss', 'advanced-performans-ipuclari'],
    lastUpdated: '2026-01-27',
    readingTime: 8,
    order: 7,
    content: `
# Sorun Giderme

Yaygın sorunlar ve çözüm yolları.

## Giriş Sorunları

### "Yanlış şifre" hatası
- Caps Lock kapalı mı?
- Doğru e-posta mı?
- Şifre sıfırlama deneyin

### 2FA kodu çalışmıyor
- Telefon saati doğru mu?
- Doğru hesap mı?
- Admin'den 2FA sıfırlama isteyin

### Hesap kilitli
- Admin'e başvurun
- Hesap aktif mi kontrol edin

## Dashboard Sorunları

### Widget yüklenmiyor
1. Sayfayı yenileyin (F5)
2. Tarayıcı cache temizleyin
3. Farklı tarayıcı deneyin

### Veri görünmüyor
1. Tarih aralığını kontrol edin
2. Filtreleri kontrol edin
3. RLS atamasını kontrol edin

### Yanlış veri görünüyor
1. Metrik tanımını kontrol edin
2. Dataset'i kontrol edin
3. ETL durumunu kontrol edin

## Performans Sorunları

### Dashboard yavaş
1. Widget sayısını azaltın
2. Tarih aralığını daraltın
3. Cache'i kontrol edin

### Sorgu zaman aşımı
1. Sorguyu optimize edin
2. Partition kullanın
3. LIMIT ekleyin

## ETL Sorunları

### ETL başarısız
1. Bağlantıyı test edin
2. Kaynak veritabanını kontrol edin
3. Hata loglarını inceleyin

### Veri eksik
1. Tarih aralığını kontrol edin
2. Kaynak veride veri var mı?
3. Filtre koşullarını kontrol edin

## Tarayıcı Sorunları

### Sayfa düzgün görünmüyor
- Desteklenen tarayıcı kullanın
- Tarayıcıyı güncelleyin
- Cache temizleyin

### JavaScript hatası
- Tarayıcı konsolunu kontrol edin
- Eklentileri devre dışı bırakın
- Gizli modda deneyin

## Destek Alma

Sorununuz çözülmediyse:
1. Hata mesajını not edin
2. Ekran görüntüsü alın
3. Sistem yöneticinize başvurun
4. support@clixer.io adresine yazın

## Hata Kodları

| Kod | Anlam | Çözüm |
|-----|-------|-------|
| 401 | Yetkisiz | Tekrar giriş yapın |
| 403 | Erişim engeli | Yetki kontrolü |
| 404 | Bulunamadı | URL kontrolü |
| 500 | Sunucu hatası | Admin'e bildirin |
| 503 | Servis dışı | Bekleyin, tekrar deneyin |
`
  },
  {
    id: 'advanced-ldap-entegrasyonu',
    slug: 'ldap-entegrasyonu',
    title: 'LDAP Entegrasyonu',
    excerpt: 'Active Directory ile kurumsal giriş.',
    category: 'advanced',
    categoryLabel: 'İleri Düzey',
    tags: ['ldap', 'active directory', 'sso', 'kurumsal'],
    images: [],
    relatedArticles: ['admin-kullanici-yonetimi', 'advanced-2fa-kurulumu'],
    lastUpdated: '2026-01-27',
    readingTime: 6,
    order: 8,
    content: `
# LDAP Entegrasyonu

Active Directory ile kurumsal kimlik doğrulama.

## LDAP Nedir?

LDAP (Lightweight Directory Access Protocol), kurumsal kullanıcı yönetimi için kullanılır. Active Directory ile entegrasyon sağlar.

## Avantajları

- Merkezi kullanıcı yönetimi
- Tek şifre (SSO benzeri)
- Otomatik kullanıcı senkronizasyonu
- Grup bazlı yetkilendirme

## LDAP Yapılandırması

**Yönetim** > **Sistem Ayarları** > **LDAP**:

| Alan | Örnek |
|------|-------|
| LDAP URL | ldap://dc.sirket.local:389 |
| Base DN | DC=sirket,DC=local |
| Bind DN | CN=clixer,OU=Services,DC=sirket,DC=local |
| Bind Password | ******** |
| User Filter | (sAMAccountName={username}) |

## Bağlantı Testi

1. Ayarları girin
2. **Test Et** butonuna tıklayın
3. "Bağlantı başarılı" mesajını bekleyin

## Kullanıcı Eşleştirme

LDAP alanlarını Clixer alanlarıyla eşleştirin:

| LDAP Alanı | Clixer Alanı |
|------------|--------------|
| sAMAccountName | username |
| mail | email |
| givenName | firstName |
| sn | lastName |
| memberOf | groups |

## Grup Eşleştirme

LDAP gruplarını Clixer pozisyonlarıyla eşleştirin:

| LDAP Grubu | Clixer Pozisyonu |
|------------|------------------|
| CN=Managers | Genel Müdür |
| CN=Analysts | Analist |
| CN=Viewers | İzleyici |

## Otomatik Senkronizasyon

LDAP kullanıcılarını otomatik senkronize edin:
- Yeni kullanıcılar otomatik oluşturulur
- Silinen kullanıcılar deaktif edilir
- Grup değişiklikleri yansıtılır

## Güvenlik Notları

> ⚠️ LDAP kullanıcısı sadece LDAP ile giriş yapabilir.

> ⚠️ LDAPS (SSL) kullanmanız önerilir.

> 💡 Service account için minimum yetki verin.

## Sorun Giderme

### Bağlantı hatası
- Firewall kurallarını kontrol edin
- LDAP URL'ini doğrulayın
- Bind credentials'ı kontrol edin

### Kullanıcı bulunamıyor
- User filter'ı kontrol edin
- Base DN'i kontrol edin
- Kullanıcının AD'de olduğunu doğrulayın
`
  }
]

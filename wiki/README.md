# Clixer Wiki - Eğitim Merkezi

Clixer kullanıcı dokümantasyonu ve eğitim merkezi.

## Özellikler

- 📚 60+ makale (TR/EN)
- 🔍 FlexSearch ile hızlı arama
- 🌙 Koyu tema (Clixer uyumlu)
- 📱 Mobil uyumlu (responsive)
- 🌐 Çoklu dil desteği (TR/EN)

## Teknolojiler

- React 19
- Vite 6
- TypeScript 5
- TailwindCSS 3
- FlexSearch
- React Router 7

## Kurulum

```bash
# Bağımlılıkları yükle
npm install

# Geliştirme sunucusu
npm run dev

# Production build
npm run build

# Build önizleme
npm run preview
```

## Proje Yapısı

```
clixer-wiki/
├── public/
│   └── images/
│       └── screenshots/
├── src/
│   ├── components/     # React bileşenleri
│   ├── content/        # Makale içerikleri
│   │   ├── tr/         # Türkçe
│   │   └── en/         # İngilizce
│   ├── hooks/          # Custom hooks
│   ├── pages/          # Sayfa bileşenleri
│   ├── types/          # TypeScript tipleri
│   └── utils/          # Yardımcı fonksiyonlar
├── nginx.conf          # Nginx konfigürasyonu
└── deploy.sh           # Deploy scripti
```

## Makale Kategorileri

| Kategori | Makale Sayısı |
|----------|---------------|
| Başlangıç | 5 |
| Tasarım Stüdyosu | 8 |
| Metrikler | 14 |
| Veri Yönetimi | 9 |
| Yönetim Paneli | 9 |
| İleri Düzey | 8 |

## Deployment

### Manuel Deploy

```bash
# Sunucuya bağlan
ssh user@server

# Deploy scriptini çalıştır
cd /opt/clixer-wiki
sudo ./deploy.sh
```

### Nginx Kurulumu

```bash
# Nginx config'i kopyala
sudo cp nginx.conf /etc/nginx/sites-available/clixer-wiki

# Site'ı aktifleştir
sudo ln -s /etc/nginx/sites-available/clixer-wiki /etc/nginx/sites-enabled/

# Nginx'i yeniden yükle
sudo nginx -t && sudo systemctl reload nginx
```

## Yeni Makale Ekleme

1. `src/content/tr/<kategori>/index.ts` dosyasını aç
2. `articlesTr` dizisine yeni makale ekle
3. Aynı makaleyi `src/content/en/<kategori>/index.ts` dosyasına İngilizce olarak ekle

### Makale Formatı

```typescript
{
  id: 'kategori-slug',
  slug: 'slug',
  title: 'Başlık',
  excerpt: 'Kısa açıklama',
  category: 'kategori',
  categoryLabel: 'Kategori Adı',
  tags: ['etiket1', 'etiket2'],
  images: [],
  relatedArticles: ['ilgili-makale-id'],
  lastUpdated: '2026-01-27',
  readingTime: 5,
  order: 1,
  content: `
# Başlık

Markdown içerik...
`
}
```

## Lisans

© 2026 Clixer. Tüm hakları saklıdır.

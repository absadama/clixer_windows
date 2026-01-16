# CLİXER - Versiyon Geçmişi

Bu dosya tüm versiyon geçmişini içerir. Detaylı bilgi için `docs/cursorrules_backup_20260115.md` dosyasına bakılabilir.

---

## Güncel Versiyon: v4.31 (15 Ocak 2026)

### Son Değişiklikler
- NPM yolu standardizasyonu (symlink)
- Restart sistemi stabilizasyonu
- Müşteri senkronizasyonu (TD, Nişantaşı)

---

## Versiyon Özeti

| Versiyon | Tarih | Önemli Değişiklikler |
|----------|-------|---------------------|
| v4.31 | 15 Ocak 2026 | NPM standardizasyonu, Restart sistemi |
| v4.30 | 15 Ocak 2026 | Restart butonu, Systemd entegrasyonu |
| v4.29 | 14 Ocak 2026 | Yeni müşteri kurulum kontrol listesi |
| v4.28 | 13 Ocak 2026 | RLS kurulum kılavuzu, TD stabilizasyonu |
| v4.27 | 12 Ocak 2026 | Filtre sistemi stabilizasyonu |
| v4.26 | 11 Ocak 2026 | Mağaza filtresi STABLE (v4.26-stable-magaza) |
| v4.25 | 11 Ocak 2026 | LFL takvim entegrasyonu |
| v4.24 | 11 Ocak 2026 | Karşılaştırma metrikleri |
| v4.23 | 10 Ocak 2026 | WhiteLabel logo yönetimi |
| v4.22 | 10 Ocak 2026 | ETL schedule kontrolleri |
| v4.21 | 9 Ocak 2026 | Systemd service entegrasyonu |
| v4.20 | 9 Ocak 2026 | ClickHouse optimize kuralları |
| v4.19 | 8 Ocak 2026 | Dashboard performans |
| v4.18 | 8 Ocak 2026 | Metrik tarih kolonu kuralı |
| v4.17 | 8 Ocak 2026 | ETL worker tek instance kuralı |
| v4.16 | 8 Ocak 2026 | LDAP sync güvenli güncelleme |
| v4.15 | 8 Ocak 2026 | ClickHouse part sayısı optimizasyonu |
| v4.14 | 8 Ocak 2026 | Ranking list kuralları |
| v4.13 | 8 Ocak 2026 | Mağaza atama yapısı |
| v4.12 | 7 Ocak 2026 | Dashboard açılış veri görünümü |
| v4.11 | 7 Ocak 2026 | LFL mimarisi |
| v4.10 | 7 Ocak 2026 | Mağaza filtresi mimarisi |
| v4.9 | 7 Ocak 2026 | Cache key hash kuralı |
| v4.8 | 7 Ocak 2026 | Mağaza kod eşleşmesi |
| v4.7 | 7 Ocak 2026 | Cache key tarih parametresi |
| v4.6 | 7 Ocak 2026 | ETL ORDER BY düzeltmesi |
| v4.5 | 7 Ocak 2026 | HTTPS/SSL production kurulumu |
| v4.4 | 7 Ocak 2026 | Müşteri kurulum hataları çözümleri |
| v4.3 | 6 Ocak 2026 | LDAP entegrasyonu |
| v4.2 | 6 Ocak 2026 | Servis yönetimi |
| v4.1 | 7 Ocak 2026 | SSL kurulum dokümantasyonu |
| v4.0 | 6 Ocak 2026 | Müşteri kurulum kontrol listesi |
| v3.6 | 5 Ocak 2026 | Enterprise DataGrid |
| v3.5 | 5 Ocak 2026 | WhiteLabel & NoCode prensibi |
| v3.4 | 4 Ocak 2026 | Sidebar rol senkronizasyonu |
| v3.3 | 4 Ocak 2026 | ClickHouse kullanıcı yönetimi |
| v3.2 | 4 Ocak 2026 | Varsayılan tema |
| v3.1 | 4 Ocak 2026 | Route sıralama kuralı |
| v3.0 | 27 Aralık 2025 | Stable release |
| v2.1 | 26 Aralık 2025 | Metrik veri formatları |
| v2.0 | 25 Aralık 2025 | Enterprise ready |

---

## Kritik Milestone'lar

### v4.26-stable-magaza (12 Ocak 2026)
Bölge/Grup/Mağaza filtre sistemi stabilize edildi. Bu versiyondan sonra filtre dosyalarına dokunulmadan önce kullanıcı onayı gerekli.

### v4.21 - Systemd Entegrasyonu (9 Ocak 2026)
Production'da nohup yerine systemd kullanımına geçildi. Servisler artık sunucu restart'ında otomatik başlıyor.

### v4.0 - Müşteri Kurulum Sistemi (6 Ocak 2026)
`install-ubuntu.sh` ve detaylı kurulum dokümantasyonu oluşturuldu.

### v3.0 - Stable Release (27 Aralık 2025)
İlk stabil production release.

### v2.0 - Enterprise Ready (25 Aralık 2025)
Multi-tenant, LDAP, RLS özellikleri eklendi.

---

## Detaylı Geçmiş

Tüm versiyon notları ve değişiklik detayları için:
`docs/cursorrules_backup_20260115.md`

Bu dosya 15 Ocak 2026 tarihinde oluşturulan tam yedektir ve tüm geçmiş bilgileri içerir.

---

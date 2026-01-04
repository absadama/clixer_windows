# /quick-commit - Hızlı Commit ve Push

Değişiklikleri hızlıca commit et ve GitHub'a push et.

## Kullanım

```bash
# Tüm değişiklikleri commit et
git add .
git commit -m "feat: [değişiklik açıklaması]"
git push origin main
```

## Commit Mesaj Formatları

| Prefix | Kullanım |
|--------|----------|
| `feat:` | Yeni özellik |
| `fix:` | Hata düzeltme |
| `docs:` | Dokümantasyon |
| `style:` | Kod formatı (fonksiyon değişikliği yok) |
| `refactor:` | Kod yeniden yapılandırma |
| `perf:` | Performans iyileştirme |
| `test:` | Test ekleme/düzeltme |
| `chore:` | Bakım işleri |
| `backup:` | Yedekleme |

## Örnekler

```bash
git commit -m "feat: Dashboard'a yeni widget eklendi"
git commit -m "fix: Login sayfası CORS hatası düzeltildi"
git commit -m "docs: README güncellendi"
git commit -m "backup: Full backup 20260104"
```

## Dikkat!

⚠️ Production branch'ına push yapmadan önce:
1. Tüm testlerin geçtiğinden emin ol
2. `/deploy-check` komutunu çalıştır
3. PR oluşturmayı düşün


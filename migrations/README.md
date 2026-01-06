# Clixer Migrations

Bu dizin veritabanı şema değişikliklerini içerir.

## Kullanım

1. Yeni bir SQL dosyası oluşturun:
   ```
   migrations/20260106_001_add_new_column.sql
   ```

2. İsimlendirme kuralı:
   ```
   YYYYMMDD_NNN_aciklama.sql
   ```
   - YYYYMMDD: Tarih
   - NNN: Sıra numarası (001, 002, ...)
   - aciklama: Ne yaptığını anlatan kısa açıklama

3. SQL dosyası içeriği:
   ```sql
   -- Migration: 20260106_001_add_new_column
   -- Açıklama: Users tablosuna phone kolonu eklendi
   
   ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
   ```

## Notlar

- Migrasyonlar alfabetik sıraya göre çalışır (tarih formatı bunu sağlar)
- Her migrasyon sadece BİR KEZ çalışır (`_migrations` tablosunda kaydedilir)
- `IF NOT EXISTS` veya `IF EXISTS` kullanarak idempotent olmasını sağlayın
- Geri alınamaz değişiklikler için dikkatli olun!

## Örnek Migrasyonlar

### Yeni kolon ekleme
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP;
```

### Yeni tablo ekleme
```sql
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    message TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### Index ekleme
```sql
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
```

### Kolon güncelleme
```sql
ALTER TABLE metrics ALTER COLUMN description TYPE TEXT;
```


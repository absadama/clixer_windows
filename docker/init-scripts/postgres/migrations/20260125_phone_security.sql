-- Migration: Telefon güvenlik katmanı
-- Tarih: 2026-01-25
-- Açıklama: Kullanıcılara telefon numarası ve aktif/pasif kontrolü eklenir

-- Telefon numarası alanı ekle
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20);

-- Telefon aktif/pasif durumu (varsayılan: aktif - mevcut kullanıcılar etkilenmesin)
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_active BOOLEAN DEFAULT true;

-- Index ekle (telefon bazlı sorgular için)
CREATE INDEX IF NOT EXISTS idx_users_phone_number ON users(phone_number) WHERE phone_number IS NOT NULL;

-- Yorum
COMMENT ON COLUMN users.phone_number IS 'Kullanıcı telefon numarası (ülke kodu ile)';
COMMENT ON COLUMN users.phone_active IS 'Telefon aktif mi? Pasif ise kullanıcı login olamaz';

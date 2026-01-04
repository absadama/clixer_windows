-- =====================================================
-- CLIXER - İLK KURULUM VERİLERİ (SEED DATA)
-- Bu dosya Docker ilk başlatıldığında otomatik çalışır
-- =====================================================

-- 1. TENANT (Şirket)
INSERT INTO tenants (id, name, code, is_active, created_at, updated_at)
VALUES (
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'Demo Şirket',
  'DEMO',
  true,
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- 2. POZİSYONLAR
INSERT INTO positions (id, tenant_id, name, level, filter_level, is_active, created_at, updated_at) VALUES
  ('pos-001', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Genel Müdür', 1, 'none', true, NOW(), NOW()),
  ('pos-002', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Direktör', 2, 'group', true, NOW(), NOW()),
  ('pos-003', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Bölge Müdürü', 3, 'region', true, NOW(), NOW()),
  ('pos-004', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Mağaza Müdürü', 4, 'store', true, NOW(), NOW()),
  ('pos-005', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Analist', 5, 'none', true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- 3. ADMİN KULLANICI
-- Email: admin@demo.com
-- Şifre: Admin123!
INSERT INTO users (id, tenant_id, email, password_hash, name, position_id, is_active, is_admin, created_at, updated_at)
VALUES (
  'usr-admin-001',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'admin@demo.com',
  '$2a$12$YdFW5QlPSAW2eICRHCX7TeePfjQqZmB1RGqDwb4.sEKL37Nw1.wc2',
  'Sistem Yöneticisi',
  'pos-001',
  true,
  true,
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- 4. VARSAYILAN AYARLAR
INSERT INTO system_settings (id, tenant_id, key, value, created_at, updated_at) VALUES
  (gen_random_uuid(), 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'default_theme', 'corporate', NOW(), NOW()),
  (gen_random_uuid(), 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'language', 'tr', NOW(), NOW()),
  (gen_random_uuid(), 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'currency', 'TRY', NOW(), NOW()),
  (gen_random_uuid(), 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'date_format', 'DD.MM.YYYY', NOW(), NOW()),
  (gen_random_uuid(), 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'timezone', 'Europe/Istanbul', NOW(), NOW()),
  (gen_random_uuid(), 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'cache_enabled', 'true', NOW(), NOW()),
  (gen_random_uuid(), 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'cache_dashboard_ttl', '900', NOW(), NOW())
ON CONFLICT DO NOTHING;

-- 5. MENÜ İZİNLERİ (Tüm pozisyonlar için)
INSERT INTO menu_permissions (id, tenant_id, position_id, menu_key, can_view, can_edit, created_at, updated_at) VALUES
  -- Genel Müdür - Tüm yetkiler
  (gen_random_uuid(), 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'pos-001', 'dashboard', true, true, NOW(), NOW()),
  (gen_random_uuid(), 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'pos-001', 'analysis', true, true, NOW(), NOW()),
  (gen_random_uuid(), 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'pos-001', 'stores', true, true, NOW(), NOW()),
  (gen_random_uuid(), 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'pos-001', 'operations', true, true, NOW(), NOW()),
  (gen_random_uuid(), 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'pos-001', 'finance', true, true, NOW(), NOW()),
  (gen_random_uuid(), 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'pos-001', 'data', true, true, NOW(), NOW()),
  (gen_random_uuid(), 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'pos-001', 'admin', true, true, NOW(), NOW()),
  -- Direktör - Admin hariç
  (gen_random_uuid(), 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'pos-002', 'dashboard', true, true, NOW(), NOW()),
  (gen_random_uuid(), 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'pos-002', 'analysis', true, true, NOW(), NOW()),
  (gen_random_uuid(), 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'pos-002', 'stores', true, true, NOW(), NOW()),
  (gen_random_uuid(), 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'pos-002', 'operations', true, false, NOW(), NOW()),
  (gen_random_uuid(), 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'pos-002', 'finance', true, false, NOW(), NOW()),
  -- Bölge Müdürü - Kısıtlı
  (gen_random_uuid(), 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'pos-003', 'dashboard', true, false, NOW(), NOW()),
  (gen_random_uuid(), 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'pos-003', 'analysis', true, false, NOW(), NOW()),
  (gen_random_uuid(), 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'pos-003', 'stores', true, false, NOW(), NOW()),
  -- Mağaza Müdürü - Sadece görüntüleme
  (gen_random_uuid(), 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'pos-004', 'dashboard', true, false, NOW(), NOW()),
  (gen_random_uuid(), 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'pos-004', 'stores', true, false, NOW(), NOW()),
  -- Analist - Dashboard ve Analiz
  (gen_random_uuid(), 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'pos-005', 'dashboard', true, false, NOW(), NOW()),
  (gen_random_uuid(), 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'pos-005', 'analysis', true, true, NOW(), NOW()),
  (gen_random_uuid(), 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'pos-005', 'data', true, true, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- 6. ÖRNEK BÖLGELER (Master Data)
INSERT INTO regions (id, tenant_id, code, name, description, manager_name, created_at, updated_at) VALUES
  (gen_random_uuid(), 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'MARMARA', 'Marmara Bölgesi', 'İstanbul, Kocaeli, Bursa', 'Ali Yılmaz', NOW(), NOW()),
  (gen_random_uuid(), 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'IC_ANADOLU', 'İç Anadolu Bölgesi', 'Ankara, Konya, Eskişehir', 'Mehmet Demir', NOW(), NOW()),
  (gen_random_uuid(), 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'EGE', 'Ege Bölgesi', 'İzmir, Aydın, Muğla', 'Ayşe Kaya', NOW(), NOW())
ON CONFLICT DO NOTHING;

-- 7. ÖRNEK SAHİPLİK GRUPLARI
INSERT INTO ownership_groups (id, tenant_id, code, name, description, created_at, updated_at) VALUES
  (gen_random_uuid(), 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'MERKEZ', 'Merkez Mağazalar', 'Şirkete ait mağazalar', NOW(), NOW()),
  (gen_random_uuid(), 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'FRANCHISE', 'Franchise Mağazalar', 'Bayilik verilen mağazalar', NOW(), NOW())
ON CONFLICT DO NOTHING;

-- =====================================================
-- KURULUM TAMAMLANDI!
-- 
-- GİRİŞ BİLGİLERİ:
-- Email: admin@demo.com
-- Şifre: Admin123!
-- =====================================================

SELECT 'SEED DATA BAŞARIYLA YÜKLENDİ!' as status;


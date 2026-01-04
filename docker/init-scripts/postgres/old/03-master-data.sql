-- ============================================
-- MASTER VERİLER (RLS için referans tablolar)
-- ============================================

-- ============================================
-- BÖLGELER (Regions)
-- ============================================
CREATE TABLE IF NOT EXISTS regions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,           -- Bölge kodu (RLS'te kullanılacak)
    name VARCHAR(255) NOT NULL,          -- Görünen isim
    description TEXT,                     -- Açıklama
    manager_name VARCHAR(255),           -- Bölge müdürü adı
    manager_email VARCHAR(255),          -- Bölge müdürü email
    is_active BOOLEAN DEFAULT true,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(tenant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_regions_tenant ON regions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_regions_code ON regions(code);

-- ============================================
-- MAĞAZALAR (Stores) - Zengin yapı
-- ============================================
CREATE TABLE IF NOT EXISTS stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,           -- Mağaza kodu (RLS'te kullanılacak)
    name VARCHAR(255) NOT NULL,          -- Mağaza adı
    store_type VARCHAR(50),              -- MERKEZ, FRANCHISE, DEALER, vb.
    ownership_group VARCHAR(50),         -- Sahiplik grubu (MERKEZ, FRANCHISE)
    region_id UUID REFERENCES regions(id) ON DELETE SET NULL,
    
    -- Adres bilgileri
    address TEXT,
    city VARCHAR(100),
    district VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(50) DEFAULT 'TR',
    
    -- İletişim bilgileri
    phone VARCHAR(50),
    email VARCHAR(255),
    manager_name VARCHAR(255),           -- Mağaza müdürü adı
    manager_email VARCHAR(255),          -- Mağaza müdürü email
    
    -- Operasyonel bilgiler
    opening_date DATE,
    closing_date DATE,                   -- Kapandıysa
    square_meters INT,                   -- Metrekare
    employee_count INT,                  -- Çalışan sayısı
    
    -- Finansal bilgiler
    rent_amount DECIMAL(15,2),           -- Kira tutarı
    target_revenue DECIMAL(15,2),        -- Hedef ciro
    
    -- Ekstra alanlar (genişletilebilir)
    tags TEXT[],                         -- Etiketler
    metadata JSONB DEFAULT '{}',         -- Ek veriler
    
    is_active BOOLEAN DEFAULT true,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(tenant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_stores_tenant ON stores(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stores_code ON stores(code);
CREATE INDEX IF NOT EXISTS idx_stores_region ON stores(region_id);
CREATE INDEX IF NOT EXISTS idx_stores_type ON stores(store_type);
CREATE INDEX IF NOT EXISTS idx_stores_ownership ON stores(ownership_group);
CREATE INDEX IF NOT EXISTS idx_stores_active ON stores(is_active) WHERE is_active = true;

-- ============================================
-- SAHİPLİK GRUPLARI (Ownership Groups)
-- ============================================
CREATE TABLE IF NOT EXISTS ownership_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,           -- Grup kodu (RLS'te kullanılacak)
    name VARCHAR(255) NOT NULL,          -- Görünen isim
    description TEXT,
    color VARCHAR(20),                   -- UI rengi (#RRGGBB)
    icon VARCHAR(50),                    -- UI ikonu
    is_active BOOLEAN DEFAULT true,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(tenant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_ownership_groups_tenant ON ownership_groups(tenant_id);

-- ============================================
-- VARSAYILAN VERİLER
-- ============================================

-- Varsayılan bölgeler
INSERT INTO regions (tenant_id, code, name, sort_order) VALUES
    ('00000000-0000-0000-0000-000000000001', 'MARMARA', 'Marmara Bölgesi', 1),
    ('00000000-0000-0000-0000-000000000001', 'EGE', 'Ege Bölgesi', 2),
    ('00000000-0000-0000-0000-000000000001', 'IC_ANADOLU', 'İç Anadolu Bölgesi', 3),
    ('00000000-0000-0000-0000-000000000001', 'AKDENIZ', 'Akdeniz Bölgesi', 4),
    ('00000000-0000-0000-0000-000000000001', 'KARADENIZ', 'Karadeniz Bölgesi', 5),
    ('00000000-0000-0000-0000-000000000001', 'DOGU_ANADOLU', 'Doğu Anadolu Bölgesi', 6),
    ('00000000-0000-0000-0000-000000000001', 'GUNEYDOGU', 'Güneydoğu Anadolu Bölgesi', 7)
ON CONFLICT (tenant_id, code) DO NOTHING;

-- Varsayılan sahiplik grupları
INSERT INTO ownership_groups (tenant_id, code, name, color, icon, sort_order) VALUES
    ('00000000-0000-0000-0000-000000000001', 'MERKEZ', 'Merkez Mağazalar', '#3B82F6', '🏢', 1),
    ('00000000-0000-0000-0000-000000000001', 'FRANCHISE', 'Franchise Mağazalar', '#10B981', '🏪', 2)
ON CONFLICT (tenant_id, code) DO NOTHING;

-- Örnek mağazalar (Bölge ID'lerini al)
DO $$
DECLARE
    marmara_id UUID;
    ege_id UUID;
    ic_anadolu_id UUID;
BEGIN
    SELECT id INTO marmara_id FROM regions WHERE code = 'MARMARA' AND tenant_id = '00000000-0000-0000-0000-000000000001';
    SELECT id INTO ege_id FROM regions WHERE code = 'EGE' AND tenant_id = '00000000-0000-0000-0000-000000000001';
    SELECT id INTO ic_anadolu_id FROM regions WHERE code = 'IC_ANADOLU' AND tenant_id = '00000000-0000-0000-0000-000000000001';
    
    INSERT INTO stores (tenant_id, code, name, store_type, ownership_group, region_id, city, district, is_active, sort_order) VALUES
        ('00000000-0000-0000-0000-000000000001', 'izmir', 'İzmir Alsancak', 'MAGAZA', 'MERKEZ', ege_id, 'İzmir', 'Alsancak', true, 1),
        ('00000000-0000-0000-0000-000000000001', '212avm', '212 AVM', 'MAGAZA', 'MERKEZ', marmara_id, 'İstanbul', 'Bağcılar', true, 2),
        ('00000000-0000-0000-0000-000000000001', 'kadikoy', 'İstanbul Kadıköy', 'MAGAZA', 'MERKEZ', marmara_id, 'İstanbul', 'Kadıköy', true, 3),
        ('00000000-0000-0000-0000-000000000001', 'istinye', 'İstinye Park', 'MAGAZA', 'FRANCHISE', marmara_id, 'İstanbul', 'Sarıyer', true, 4),
        ('00000000-0000-0000-0000-000000000001', 'ankara', 'Ankara Kızılay', 'MAGAZA', 'FRANCHISE', ic_anadolu_id, 'Ankara', 'Çankaya', true, 5)
    ON CONFLICT (tenant_id, code) DO NOTHING;
END $$;

-- ============================================
-- VİEW: Mağaza detayları (JOIN ile)
-- ============================================
CREATE OR REPLACE VIEW v_stores_detail AS
SELECT 
    s.id,
    s.tenant_id,
    s.code,
    s.name,
    s.store_type,
    s.ownership_group,
    s.region_id,
    r.code AS region_code,
    r.name AS region_name,
    s.address,
    s.city,
    s.district,
    s.postal_code,
    s.country,
    s.phone,
    s.email,
    s.manager_name,
    s.manager_email,
    s.opening_date,
    s.closing_date,
    s.square_meters,
    s.employee_count,
    s.rent_amount,
    s.target_revenue,
    s.tags,
    s.metadata,
    s.is_active,
    s.sort_order,
    s.created_at,
    s.updated_at
FROM stores s
LEFT JOIN regions r ON s.region_id = r.id;




-- ============================================
-- LDAP ENTEGRASYON TABLOLARI
-- ============================================

-- ============================================
-- POZİSYONLAR (Roller)
-- ============================================
CREATE TABLE IF NOT EXISTS positions (
    code VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    hierarchy_level INT NOT NULL DEFAULT 99, -- 0: GM, 1: Director, 2: Region, 3: Store, 4: Viewer
    can_see_all_stores BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Varsayılan pozisyonlar
INSERT INTO positions (code, name, hierarchy_level, can_see_all_stores) VALUES
    ('GENERAL_MANAGER', 'Genel Müdür', 0, TRUE),
    ('DIRECTOR', 'Direktör', 1, TRUE),
    ('REGION_MANAGER', 'Bölge Müdürü', 2, FALSE),
    ('STORE_MANAGER', 'Mağaza Müdürü', 3, FALSE),
    ('ANALYST', 'Analist', 3, FALSE),
    ('VIEWER', 'İzleyici', 4, FALSE)
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- MENÜ İZİNLERİ
-- ============================================
CREATE TABLE IF NOT EXISTS menu_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    position_code VARCHAR(50) NOT NULL REFERENCES positions(code) ON DELETE CASCADE,
    menu_item VARCHAR(100) NOT NULL, -- 'dashboard', 'finance', 'operations', 'analysis', 'stores', 'data', 'admin'
    can_view BOOLEAN NOT NULL DEFAULT TRUE,
    can_edit BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (position_code, menu_item)
);

-- Varsayılan menü izinleri
INSERT INTO menu_permissions (position_code, menu_item, can_view, can_edit) VALUES
    -- Genel Müdür (Tüm yetkiler)
    ('GENERAL_MANAGER', 'dashboard', TRUE, TRUE),
    ('GENERAL_MANAGER', 'finance', TRUE, TRUE),
    ('GENERAL_MANAGER', 'operations', TRUE, TRUE),
    ('GENERAL_MANAGER', 'analysis', TRUE, TRUE),
    ('GENERAL_MANAGER', 'stores', TRUE, TRUE),
    ('GENERAL_MANAGER', 'data', TRUE, TRUE),
    ('GENERAL_MANAGER', 'admin', TRUE, TRUE),
    -- Direktör
    ('DIRECTOR', 'dashboard', TRUE, TRUE),
    ('DIRECTOR', 'finance', TRUE, TRUE),
    ('DIRECTOR', 'operations', TRUE, TRUE),
    ('DIRECTOR', 'analysis', TRUE, TRUE),
    ('DIRECTOR', 'stores', TRUE, TRUE),
    ('DIRECTOR', 'data', TRUE, FALSE),
    ('DIRECTOR', 'admin', FALSE, FALSE),
    -- Bölge Müdürü
    ('REGION_MANAGER', 'dashboard', TRUE, TRUE),
    ('REGION_MANAGER', 'finance', TRUE, TRUE),
    ('REGION_MANAGER', 'operations', TRUE, TRUE),
    ('REGION_MANAGER', 'analysis', TRUE, TRUE),
    ('REGION_MANAGER', 'stores', TRUE, TRUE),
    ('REGION_MANAGER', 'data', FALSE, FALSE),
    ('REGION_MANAGER', 'admin', FALSE, FALSE),
    -- Mağaza Müdürü
    ('STORE_MANAGER', 'dashboard', TRUE, TRUE),
    ('STORE_MANAGER', 'finance', TRUE, TRUE),
    ('STORE_MANAGER', 'operations', TRUE, TRUE),
    ('STORE_MANAGER', 'analysis', FALSE, FALSE),
    ('STORE_MANAGER', 'stores', TRUE, TRUE),
    ('STORE_MANAGER', 'data', FALSE, FALSE),
    ('STORE_MANAGER', 'admin', FALSE, FALSE),
    -- Analist
    ('ANALYST', 'dashboard', TRUE, FALSE),
    ('ANALYST', 'finance', TRUE, FALSE),
    ('ANALYST', 'operations', TRUE, FALSE),
    ('ANALYST', 'analysis', TRUE, FALSE),
    ('ANALYST', 'stores', TRUE, FALSE),
    ('ANALYST', 'data', TRUE, FALSE),
    ('ANALYST', 'admin', FALSE, FALSE),
    -- İzleyici
    ('VIEWER', 'dashboard', TRUE, FALSE),
    ('VIEWER', 'finance', TRUE, FALSE),
    ('VIEWER', 'operations', TRUE, FALSE),
    ('VIEWER', 'analysis', FALSE, FALSE),
    ('VIEWER', 'stores', FALSE, FALSE),
    ('VIEWER', 'data', FALSE, FALSE),
    ('VIEWER', 'admin', FALSE, FALSE)
ON CONFLICT (position_code, menu_item) DO NOTHING;

-- ============================================
-- KULLANICI MAĞAZA ATAMALARI
-- ============================================
CREATE TABLE IF NOT EXISTS user_stores (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    store_id VARCHAR(100) NOT NULL, -- Mağaza ID'si (dış sistemden gelebilir)
    assigned_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (user_id, store_id)
);

CREATE INDEX IF NOT EXISTS idx_user_stores_user ON user_stores(user_id);
CREATE INDEX IF NOT EXISTS idx_user_stores_store ON user_stores(store_id);

-- ============================================
-- MAĞAZA FİNANSAL AYARLARI
-- ============================================
CREATE TABLE IF NOT EXISTS store_finance_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    store_id VARCHAR(100) NOT NULL,
    settings JSONB NOT NULL DEFAULT '{}'::jsonb, -- Tüm finansal ayarlar JSON olarak
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(tenant_id, store_id)
);

CREATE INDEX IF NOT EXISTS idx_store_finance_tenant ON store_finance_settings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_store_finance_store ON store_finance_settings(store_id);

-- ============================================
-- LDAP BAĞLANTI AYARLARI
-- ============================================
CREATE TABLE IF NOT EXISTS ldap_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL DEFAULT 'Default LDAP',
    server_url VARCHAR(500) NOT NULL, -- ldap://domain.local:389 veya ldaps://...
    base_dn VARCHAR(500) NOT NULL, -- DC=sirket,DC=local
    bind_dn VARCHAR(500) NOT NULL, -- CN=ServiceAccount,OU=ServiceAccounts,...
    bind_password_encrypted VARCHAR(1000) NOT NULL, -- Şifreli
    user_search_base VARCHAR(500), -- OU=Users,DC=sirket,DC=local (optional)
    user_filter VARCHAR(500) DEFAULT '(&(objectClass=user)(mail=*))', -- LDAP filtre
    group_search_base VARCHAR(500), -- OU=Groups,DC=sirket,DC=local (optional)
    group_filter VARCHAR(500) DEFAULT '(objectClass=group)',
    sync_schedule VARCHAR(50) DEFAULT 'manual', -- '15min', '1hour', '6hours', 'daily', 'manual'
    is_active BOOLEAN DEFAULT false,
    last_sync_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(tenant_id)
);

-- ============================================
-- LDAP GRUP → CLİXER POZİSYON EŞLEMESİ
-- ============================================
CREATE TABLE IF NOT EXISTS ldap_position_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    ldap_group_dn VARCHAR(500) NOT NULL, -- CN=StoreManagers,OU=Groups,DC=sirket,DC=local
    ldap_group_name VARCHAR(255) NOT NULL, -- StoreManagers (görüntüleme için)
    position_code VARCHAR(50) NOT NULL REFERENCES positions(code),
    priority INT DEFAULT 100, -- Birden fazla gruba üyeyse düşük öncelikli kazanır
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(tenant_id, ldap_group_dn)
);

CREATE INDEX IF NOT EXISTS idx_ldap_pos_tenant ON ldap_position_mappings(tenant_id);

-- ============================================
-- LDAP GRUP → CLİXER MAĞAZA EŞLEMESİ
-- ============================================
CREATE TABLE IF NOT EXISTS ldap_store_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    ldap_group_dn VARCHAR(500) NOT NULL, -- CN=Store_212AVM,OU=Stores,DC=sirket,DC=local
    ldap_group_name VARCHAR(255) NOT NULL, -- Store_212AVM
    store_id VARCHAR(100) NOT NULL, -- 212avm (Clixer'daki mağaza ID'si)
    store_name VARCHAR(255), -- 212 AVM (Görüntüleme adı)
    grants_all_stores BOOLEAN DEFAULT FALSE, -- TRUE ise tüm mağazalara erişim verir
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(tenant_id, ldap_group_dn)
);

CREATE INDEX IF NOT EXISTS idx_ldap_store_tenant ON ldap_store_mappings(tenant_id);

-- ============================================
-- LDAP SYNC GEÇMİŞİ
-- ============================================
CREATE TABLE IF NOT EXISTS ldap_sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    started_at TIMESTAMP NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP,
    status VARCHAR(50) NOT NULL DEFAULT 'running', -- 'running', 'success', 'partial', 'failed'
    users_found INT DEFAULT 0,
    users_created INT DEFAULT 0,
    users_updated INT DEFAULT 0,
    users_deactivated INT DEFAULT 0,
    users_skipped INT DEFAULT 0,
    errors JSONB DEFAULT '[]'::jsonb, -- [{user: 'email', error: 'message'}]
    summary TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ldap_sync_tenant ON ldap_sync_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ldap_sync_date ON ldap_sync_logs(started_at DESC);

-- ============================================
-- USERS TABLOSUNA LDAP ALANLARI EKLE
-- ============================================
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS position_code VARCHAR(50) REFERENCES positions(code) DEFAULT 'VIEWER',
    ADD COLUMN IF NOT EXISTS ldap_dn VARCHAR(500),
    ADD COLUMN IF NOT EXISTS ldap_synced BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS ldap_last_sync_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS ldap_groups JSONB DEFAULT '[]'::jsonb;

-- Admin kullanıcısına pozisyon ata
UPDATE users SET position_code = 'GENERAL_MANAGER' WHERE role = 'ADMIN' AND (position_code IS NULL OR position_code = 'VIEWER');

CREATE INDEX IF NOT EXISTS idx_users_ldap_dn ON users(ldap_dn);
CREATE INDEX IF NOT EXISTS idx_users_position ON users(position_code);

-- ============================================
-- SEMANTİK KATMAN İÇİN DATASET EKLEMELERİ
-- ============================================
ALTER TABLE datasets
    ADD COLUMN IF NOT EXISTS date_column VARCHAR(100),
    ADD COLUMN IF NOT EXISTS store_column VARCHAR(100),
    ADD COLUMN IF NOT EXISTS value_column VARCHAR(100),
    ADD COLUMN IF NOT EXISTS qty_column VARCHAR(100),
    ADD COLUMN IF NOT EXISTS category_column VARCHAR(100);

-- ============================================
-- METRİKLER (Semantic Layer)
-- ============================================
CREATE TABLE IF NOT EXISTS metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    label VARCHAR(255),
    description TEXT,
    dataset_id UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    aggregation VARCHAR(50) NOT NULL, -- SUM, AVG, COUNT, MIN, MAX, DISTINCT
    value_expression TEXT NOT NULL, -- e.g., "column_name" veya "(column_a - column_b)"
    filter_sql TEXT, -- Varsayılan filtre
    is_date_filtered BOOLEAN NOT NULL DEFAULT TRUE,
    is_store_filtered BOOLEAN NOT NULL DEFAULT TRUE,
    format VARCHAR(50) DEFAULT 'number', -- currency, percent, number
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_metrics_tenant ON metrics(tenant_id);
CREATE INDEX IF NOT EXISTS idx_metrics_dataset ON metrics(dataset_id);


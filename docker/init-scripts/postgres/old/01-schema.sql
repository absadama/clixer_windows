-- Clixer Database Schema
-- PostgreSQL - Application Settings (OLTP)

-- ============================================
-- TENANTS
-- ============================================
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    logo_url VARCHAR(500),
    settings JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- USERS
-- ============================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'USER',
    is_active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMP,
    two_factor_enabled BOOLEAN DEFAULT false,
    two_factor_secret VARCHAR(255),
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(tenant_id, email)
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_tenant ON users(tenant_id);

-- ============================================
-- DATA CONNECTIONS
-- ============================================
CREATE TABLE data_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'mssql', 'postgresql', 'mysql', 'api', 'excel'
    host VARCHAR(255),
    port INTEGER,
    database_name VARCHAR(255),
    username VARCHAR(255),
    password_encrypted VARCHAR(500),
    api_config JSONB, -- For API connections
    file_path VARCHAR(500), -- For Excel
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'active', 'error'
    last_tested_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_connections_tenant ON data_connections(tenant_id);

-- ============================================
-- DATASETS
-- ============================================
CREATE TABLE datasets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    connection_id UUID REFERENCES data_connections(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    source_table VARCHAR(255) NOT NULL,
    column_mapping JSONB NOT NULL, -- [{source, target, type}]
    sync_strategy VARCHAR(50) DEFAULT 'full_refresh', -- 'timestamp', 'id', 'date_partition', 'full_refresh'
    sync_schedule VARCHAR(50), -- '15min', '1hour', 'daily', 'manual'
    reference_column VARCHAR(255), -- For incremental sync
    row_limit INTEGER DEFAULT 100000,
    clickhouse_table VARCHAR(255), -- Auto-generated table name
    status VARCHAR(50) DEFAULT 'pending',
    last_sync_at TIMESTAMP,
    last_sync_rows INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_datasets_tenant ON datasets(tenant_id);
CREATE INDEX idx_datasets_connection ON datasets(connection_id);

-- ============================================
-- ETL JOBS
-- ============================================
CREATE TABLE etl_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    dataset_id UUID REFERENCES datasets(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL, -- 'initial_sync', 'incremental_sync', 'full_refresh', 'manual_sync'
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    rows_processed INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_etl_jobs_dataset ON etl_jobs(dataset_id);
CREATE INDEX idx_etl_jobs_status ON etl_jobs(status);

-- ============================================
-- DESIGNS (Dashboard layouts)
-- ============================================
CREATE TABLE designs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_default BOOLEAN DEFAULT false,
    layout_config JSONB DEFAULT '{}', -- Grid positions
    settings JSONB DEFAULT '{}',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_designs_tenant ON designs(tenant_id);

-- ============================================
-- COMPONENTS (Widgets + Metrics unified)
-- ============================================
CREATE TABLE components (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    design_id UUID REFERENCES designs(id) ON DELETE CASCADE,
    dataset_id UUID REFERENCES datasets(id) ON DELETE SET NULL,
    type VARCHAR(50) NOT NULL, -- 'kpi_card', 'chart', 'table', 'filter', 'text'
    label VARCHAR(255) NOT NULL,
    config JSONB NOT NULL, -- Type-specific config
    position JSONB NOT NULL, -- {x, y, w, h}
    data_config JSONB, -- Column mapping, aggregation, etc.
    style JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_components_design ON components(design_id);
CREATE INDEX idx_components_dataset ON components(dataset_id);

-- ============================================
-- NOTIFICATIONS
-- ============================================
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- 'info', 'warning', 'error', 'success'
    title VARCHAR(255) NOT NULL,
    message TEXT,
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMP,
    data JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = false;

-- ============================================
-- SYSTEM SETTINGS
-- ============================================
CREATE TABLE system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    category VARCHAR(100) NOT NULL,
    key VARCHAR(100) NOT NULL,
    value JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(tenant_id, category, key)
);

-- ============================================
-- AUDIT LOGS
-- ============================================
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID,
    user_id UUID,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100),
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(50),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_tenant ON audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);

-- ============================================
-- SEED DATA
-- ============================================

-- Default tenant
INSERT INTO tenants (id, name, slug, settings)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Demo Şirket',
    'demo',
    '{"theme": "light", "language": "tr"}'
);

-- Admin user (password: Admin123!)
INSERT INTO users (id, tenant_id, email, password_hash, name, role)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'admin@demo.com',
    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4aMvK.4kKYyXO6Ey',
    'Admin Kullanıcı',
    'ADMIN'
);

-- Default design
INSERT INTO designs (id, tenant_id, name, description, is_default, created_by)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'Ana Dashboard',
    'Varsayılan dashboard tasarımı',
    true,
    '00000000-0000-0000-0000-000000000001'
);


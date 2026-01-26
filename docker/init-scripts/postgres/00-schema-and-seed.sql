-- ============================================
-- CLIXER - TEMİZ ŞEMA VE SEED VERİLERİ
-- Müşteri kurulumu için minimum gerekli veriler
-- TEST VERİSİ DAHİL DEĞİL!
-- ============================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;

-- ============================================
-- FUNCTIONS
-- ============================================

-- Updated At Trigger Function
CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Cleanup Old Audit Logs
CREATE OR REPLACE FUNCTION public.cleanup_old_audit_logs(days_to_keep integer DEFAULT 90) RETURNS integer
    LANGUAGE plpgsql AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM audit_logs WHERE created_at < NOW() - (days_to_keep || ' days')::INTERVAL;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

-- ============================================
-- TABLES
-- ============================================

-- Tenants
CREATE TABLE IF NOT EXISTS public.tenants (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    name character varying(255) NOT NULL,
    slug character varying(100) NOT NULL UNIQUE,
    logo_url character varying(500),
    settings jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);

-- Positions
CREATE TABLE IF NOT EXISTS public.positions (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    code character varying(50) NOT NULL UNIQUE,
    name character varying(100) NOT NULL,
    hierarchy_level integer DEFAULT 0 NOT NULL,
    can_see_all_stores boolean DEFAULT false,
    description text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    filter_level character varying(20) DEFAULT 'store'::character varying
);

-- Users
CREATE TABLE IF NOT EXISTS public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    role character varying(50) DEFAULT 'USER'::character varying NOT NULL,
    is_active boolean DEFAULT true,
    last_login_at timestamp without time zone,
    two_factor_enabled boolean DEFAULT false,
    two_factor_secret character varying(255),
    preferences jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    position_code character varying(50),
    ldap_dn character varying(500),
    ldap_synced boolean DEFAULT false,
    ldap_last_sync_at timestamp without time zone,
    ldap_groups jsonb DEFAULT '[]'::jsonb,
    filter_value text,
    two_factor_backup_codes text[],
    can_see_all_categories boolean DEFAULT false,
    -- Telefon güvenlik katmanı
    phone_number character varying(20),
    phone_active boolean DEFAULT true,
    -- Token invalidation için
    token_version integer DEFAULT 0,
    UNIQUE (tenant_id, email)
);

-- Regions
CREATE TABLE IF NOT EXISTS public.regions (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid REFERENCES public.tenants(id),
    code character varying(50) NOT NULL,
    name character varying(200) NOT NULL,
    description text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    manager_name character varying(255),
    manager_email character varying(255),
    sort_order integer DEFAULT 0,
    updated_at timestamp without time zone DEFAULT now(),
    UNIQUE (tenant_id, code)
);

-- Stores
CREATE TABLE IF NOT EXISTS public.stores (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid REFERENCES public.tenants(id),
    code character varying(100) NOT NULL,
    name character varying(200) NOT NULL,
    store_type character varying(20) DEFAULT 'MERKEZ'::character varying,
    region_id uuid REFERENCES public.regions(id),
    city character varying(100),
    address text,
    phone character varying(50),
    email character varying(200),
    manager_name character varying(200),
    opening_date date,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    ownership_group character varying(50),
    district character varying(100),
    postal_code character varying(20),
    country character varying(50) DEFAULT 'TR'::character varying,
    manager_email character varying(255),
    closing_date date,
    square_meters integer,
    employee_count integer,
    rent_amount numeric(15,2),
    target_revenue numeric(15,2),
    tags text[],
    metadata jsonb DEFAULT '{}'::jsonb,
    sort_order integer DEFAULT 0,
    UNIQUE (tenant_id, code)
);

-- Ownership Groups
CREATE TABLE IF NOT EXISTS public.ownership_groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
    code character varying(50) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    color character varying(20),
    icon character varying(50),
    is_active boolean DEFAULT true,
    sort_order integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    UNIQUE (tenant_id, code)
);

-- Data Connections
CREATE TABLE IF NOT EXISTS public.data_connections (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
    name character varying(255) NOT NULL,
    type character varying(50) NOT NULL,
    host character varying(255),
    port integer,
    database_name character varying(255),
    username character varying(255),
    password_encrypted character varying(500),
    api_config jsonb,
    file_path character varying(500),
    status character varying(50) DEFAULT 'pending'::character varying,
    last_tested_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    description text,
    status_message text,
    created_by uuid REFERENCES public.users(id)
);

-- Datasets
CREATE TABLE IF NOT EXISTS public.datasets (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
    connection_id uuid REFERENCES public.data_connections(id) ON DELETE CASCADE,
    name character varying(255) NOT NULL,
    source_table character varying(255),
    column_mapping jsonb NOT NULL,
    sync_strategy character varying(50) DEFAULT 'full_refresh'::character varying,
    sync_schedule character varying(50),
    reference_column character varying(255),
    row_limit integer DEFAULT 100000,
    clickhouse_table character varying(255),
    status character varying(50) DEFAULT 'pending'::character varying,
    last_sync_at timestamp without time zone,
    last_sync_rows integer,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    description text,
    source_type character varying(50) DEFAULT 'table'::character varying,
    source_query text,
    partition_by character varying(100),
    order_by_columns text[],
    created_by uuid REFERENCES public.users(id),
    status_message text,
    last_sync_value text,
    total_rows bigint DEFAULT 0,
    date_column character varying(100),
    partition_scope character varying(20) DEFAULT 'today'::character varying,
    partition_column character varying(100),
    partition_type character varying(20) DEFAULT 'monthly'::character varying,
    refresh_window_days integer DEFAULT 0,
    archive_after_days integer DEFAULT 0,
    detect_modified boolean DEFAULT false,
    modified_column character varying(100),
    weekly_full_refresh boolean DEFAULT false,
    engine_type character varying(50) DEFAULT 'MergeTree'::character varying,
    custom_where text,
    store_column character varying(100),
    value_column character varying(100),
    qty_column character varying(100),
    category_column character varying(100),
    delete_days integer,
    region_column character varying(100),
    group_column character varying(100)
);

-- ETL Jobs
CREATE TABLE IF NOT EXISTS public.etl_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
    dataset_id uuid REFERENCES public.datasets(id) ON DELETE CASCADE,
    action character varying(50) NOT NULL,
    status character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    started_at timestamp without time zone,
    completed_at timestamp without time zone,
    rows_processed integer DEFAULT 0,
    error_message text,
    created_at timestamp without time zone DEFAULT now(),
    triggered_by uuid REFERENCES public.users(id),
    retry_count integer DEFAULT 0,
    error_details jsonb,
    rows_inserted integer DEFAULT 0,
    rows_updated integer DEFAULT 0,
    rows_deleted integer DEFAULT 0,
    scheduled_at timestamp without time zone
);

-- ETL Schedules
CREATE TABLE IF NOT EXISTS public.etl_schedules (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    dataset_id uuid NOT NULL UNIQUE REFERENCES public.datasets(id) ON DELETE CASCADE,
    cron_expression character varying(100) NOT NULL,
    timezone character varying(100) DEFAULT 'Europe/Istanbul'::character varying,
    is_active boolean DEFAULT true,
    next_run_at timestamp with time zone,
    last_run_at timestamp with time zone,
    last_job_id uuid REFERENCES public.etl_jobs(id),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Designs
CREATE TABLE IF NOT EXISTS public.designs (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
    name character varying(255) NOT NULL,
    description text,
    is_default boolean DEFAULT false,
    layout_config jsonb DEFAULT '{}'::jsonb,
    settings jsonb DEFAULT '{}'::jsonb,
    created_by uuid REFERENCES public.users(id),
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    type character varying(50) DEFAULT 'cockpit'::character varying,
    target_roles jsonb DEFAULT '["ADMIN"]'::jsonb,
    is_active boolean DEFAULT true,
    grid_columns integer DEFAULT 24,
    row_height integer DEFAULT 80,
    allowed_positions text[] DEFAULT ARRAY['GENERAL_MANAGER'::text, 'DIRECTOR'::text, 'REGION_MANAGER'::text, 'STORE_MANAGER'::text, 'ANALYST'::text, 'VIEWER'::text],
    category_id uuid
);

-- Metrics
CREATE TABLE IF NOT EXISTS public.metrics (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    dataset_id uuid REFERENCES public.datasets(id) ON DELETE SET NULL,
    name character varying(255) NOT NULL,
    description text,
    query_sql text,
    result_type character varying(50) DEFAULT 'number'::character varying,
    format_pattern character varying(100),
    prefix character varying(50),
    suffix character varying(50),
    aggregation_type character varying(50) DEFAULT 'sum'::character varying,
    parameters jsonb DEFAULT '[]'::jsonb,
    cache_ttl integer DEFAULT 300,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by uuid REFERENCES public.users(id),
    label character varying(255),
    icon character varying(100) DEFAULT 'BarChart3'::character varying,
    color character varying(50) DEFAULT '#6366f1'::character varying,
    clickhouse_table character varying(255),
    db_column character varying(255),
    filter_sql text,
    group_by_column character varying(255),
    order_by_column character varying(255),
    order_direction character varying(10) DEFAULT 'DESC'::character varying,
    visualization_type character varying(50) DEFAULT 'kpi_card'::character varying,
    chart_config jsonb DEFAULT '{}'::jsonb,
    format_config jsonb DEFAULT '{}'::jsonb,
    comparison_enabled boolean DEFAULT false,
    comparison_type character varying(50),
    target_value numeric(20,4),
    target_column character varying(255),
    default_width integer DEFAULT 4,
    default_height integer DEFAULT 2,
    comparison_config jsonb DEFAULT '{}'::jsonb,
    use_sql_mode boolean DEFAULT false,
    custom_sql text
);

-- Design Widgets
CREATE TABLE IF NOT EXISTS public.design_widgets (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    design_id uuid REFERENCES public.designs(id) ON DELETE CASCADE,
    metric_id uuid REFERENCES public.metrics(id) ON DELETE SET NULL,
    title character varying(200),
    subtitle character varying(200),
    widget_type character varying(30),
    grid_x integer DEFAULT 0,
    grid_y integer DEFAULT 0,
    grid_w integer DEFAULT 3,
    grid_h integer DEFAULT 2,
    config_override jsonb DEFAULT '{}'::jsonb,
    sort_order integer DEFAULT 0,
    is_visible boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now()
);

-- Components
CREATE TABLE IF NOT EXISTS public.components (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
    design_id uuid REFERENCES public.designs(id) ON DELETE CASCADE,
    dataset_id uuid REFERENCES public.datasets(id) ON DELETE SET NULL,
    type character varying(50) NOT NULL,
    label character varying(255) NOT NULL,
    config jsonb NOT NULL,
    "position" jsonb NOT NULL,
    data_config jsonb,
    style jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);

-- System Settings
CREATE TABLE IF NOT EXISTS public.system_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
    category character varying(100) NOT NULL,
    key character varying(100) NOT NULL,
    value jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    UNIQUE (tenant_id, category, key)
);

-- Audit Logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid,
    user_id uuid,
    action character varying(100) NOT NULL,
    entity_type character varying(100),
    entity_id uuid,
    old_values jsonb,
    new_values jsonb,
    ip_address character varying(50),
    user_agent text,
    created_at timestamp without time zone DEFAULT now(),
    resource_type character varying(100),
    resource_id character varying(255),
    resource_name character varying(255),
    details jsonb,
    success boolean DEFAULT true,
    error_message text
);

-- Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
    type character varying(50) NOT NULL,
    title character varying(255) NOT NULL,
    message text,
    is_read boolean DEFAULT false,
    read_at timestamp without time zone,
    data jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT now()
);

-- User Stores
CREATE TABLE IF NOT EXISTS public.user_stores (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    store_id character varying(100) NOT NULL,
    store_name character varying(200),
    assigned_at timestamp with time zone DEFAULT now(),
    assigned_by uuid REFERENCES public.users(id),
    UNIQUE (user_id, store_id)
);

-- Menu Permissions
CREATE TABLE IF NOT EXISTS public.menu_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    position_code character varying(50) REFERENCES public.positions(code) ON DELETE CASCADE,
    menu_key character varying(100) NOT NULL,
    can_view boolean DEFAULT true,
    can_edit boolean DEFAULT false,
    UNIQUE (position_code, menu_key)
);

-- Design Permissions
CREATE TABLE IF NOT EXISTS public.design_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    design_id uuid REFERENCES public.designs(id) ON DELETE CASCADE,
    permission_type character varying(20) NOT NULL,
    permission_value character varying(50) NOT NULL,
    access_level character varying(20) DEFAULT 'view'::character varying,
    created_at timestamp without time zone DEFAULT now()
);

-- Store Finance Settings
CREATE TABLE IF NOT EXISTS public.store_finance_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid REFERENCES public.tenants(id),
    store_id character varying(100) NOT NULL,
    store_name character varying(200),
    fixed_rent numeric(15,2) DEFAULT 0,
    revenue_share_percent numeric(5,2) DEFAULT 0,
    common_area_cost numeric(15,2) DEFAULT 0,
    target_cogs_percent numeric(5,2) DEFAULT 35,
    royalty_percent numeric(5,2) DEFAULT 0,
    marketing_percent numeric(5,2) DEFAULT 0,
    electricity_budget numeric(15,2) DEFAULT 0,
    water_budget numeric(15,2) DEFAULT 0,
    manager_count integer DEFAULT 1,
    manager_salary numeric(15,2) DEFAULT 0,
    kitchen_count integer DEFAULT 0,
    kitchen_salary numeric(15,2) DEFAULT 0,
    service_count integer DEFAULT 0,
    service_salary numeric(15,2) DEFAULT 0,
    courier_count integer DEFAULT 0,
    courier_salary numeric(15,2) DEFAULT 0,
    initial_investment numeric(15,2) DEFAULT 0,
    opening_date date,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    UNIQUE (tenant_id, store_id)
);

-- ETL Scheduler Logs
CREATE TABLE IF NOT EXISTS public.etl_scheduler_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid REFERENCES public.tenants(id),
    checked_at timestamp without time zone DEFAULT now(),
    schedules_found integer DEFAULT 0,
    schedules_triggered integer DEFAULT 0,
    schedules_skipped integer DEFAULT 0,
    details jsonb,
    created_at timestamp without time zone DEFAULT now(),
    schedules_missed integer DEFAULT 0
);

-- LDAP Config
CREATE TABLE IF NOT EXISTS public.ldap_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
    name character varying(255) DEFAULT 'Default LDAP'::character varying NOT NULL,
    server_url character varying(500) NOT NULL,
    base_dn character varying(500) NOT NULL,
    bind_dn character varying(500) NOT NULL,
    bind_password_encrypted character varying(1000) NOT NULL,
    user_search_base character varying(500),
    user_filter character varying(500) DEFAULT '(&(objectClass=user)(mail=*))'::character varying,
    group_search_base character varying(500),
    group_filter character varying(500) DEFAULT '(objectClass=group)'::character varying,
    sync_schedule character varying(50) DEFAULT 'manual'::character varying,
    is_active boolean DEFAULT false,
    last_sync_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);

-- LDAP Position Mappings
CREATE TABLE IF NOT EXISTS public.ldap_position_mappings (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    ldap_group_dn character varying(500) NOT NULL,
    ldap_group_name character varying(255) NOT NULL,
    position_code character varying(50) NOT NULL REFERENCES public.positions(code),
    priority integer DEFAULT 100,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    UNIQUE (tenant_id, ldap_group_dn)
);

-- LDAP Store Mappings
CREATE TABLE IF NOT EXISTS public.ldap_store_mappings (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    ldap_group_dn character varying(500) NOT NULL,
    ldap_group_name character varying(255) NOT NULL,
    store_id character varying(100) NOT NULL,
    store_name character varying(255),
    grants_all_stores boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    UNIQUE (tenant_id, ldap_group_dn)
);

-- LDAP Sync Logs
CREATE TABLE IF NOT EXISTS public.ldap_sync_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    started_at timestamp without time zone DEFAULT now() NOT NULL,
    completed_at timestamp without time zone,
    status character varying(50) DEFAULT 'running'::character varying NOT NULL,
    users_found integer DEFAULT 0,
    users_created integer DEFAULT 0,
    users_updated integer DEFAULT 0,
    users_deactivated integer DEFAULT 0,
    users_skipped integer DEFAULT 0,
    errors jsonb DEFAULT '[]'::jsonb,
    summary text,
    created_at timestamp without time zone DEFAULT now()
);

-- Report Categories (Rapor Kategorileri - Gucler Ayriligi)
CREATE TABLE IF NOT EXISTS public.report_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
    code character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    color character varying(20) DEFAULT '#6366f1'::character varying,
    icon character varying(50) DEFAULT 'Folder'::character varying,
    sort_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    UNIQUE (tenant_id, code)
);

-- User Report Categories (Kullanici-Kategori Iliskisi)
CREATE TABLE IF NOT EXISTS public.user_report_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    category_id uuid NOT NULL REFERENCES public.report_categories(id) ON DELETE CASCADE,
    assigned_at timestamp without time zone DEFAULT now(),
    assigned_by uuid REFERENCES public.users(id),
    UNIQUE (user_id, category_id)
);

-- Geographic Locations
CREATE TABLE IF NOT EXISTS public.geographic_locations (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    country_code character varying(3) DEFAULT 'TR'::character varying,
    country_name character varying(100) DEFAULT 'Turkiye'::character varying,
    region_code character varying(50),
    region_name character varying(100),
    city_code character varying(10),
    city_name character varying(100),
    district_code character varying(20),
    district_name character varying(100),
    neighborhood_code character varying(20),
    neighborhood_name character varying(200),
    postal_code character varying(10),
    latitude numeric(10,7),
    longitude numeric(10,7),
    bbox_north numeric(10,7),
    bbox_south numeric(10,7),
    bbox_east numeric(10,7),
    bbox_west numeric(10,7),
    location_type character varying(20) NOT NULL,
    parent_id uuid REFERENCES public.geographic_locations(id) ON DELETE SET NULL,
    population integer,
    area_km2 numeric(10,2),
    name_ascii character varying(200),
    name_alternatives text[],
    data_source character varying(100),
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_position ON public.users(position_code);
CREATE INDEX IF NOT EXISTS idx_users_ldap_dn ON public.users(ldap_dn);
CREATE INDEX IF NOT EXISTS idx_stores_tenant ON public.stores(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stores_code ON public.stores(code);
CREATE INDEX IF NOT EXISTS idx_stores_active ON public.stores(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_regions_tenant ON public.regions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_designs_tenant ON public.designs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_metrics_tenant ON public.metrics(tenant_id);
CREATE INDEX IF NOT EXISTS idx_metrics_dataset ON public.metrics(dataset_id);
CREATE INDEX IF NOT EXISTS idx_datasets_tenant ON public.datasets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_datasets_connection ON public.datasets(connection_id);
CREATE INDEX IF NOT EXISTS idx_datasets_status ON public.datasets(status);
CREATE INDEX IF NOT EXISTS idx_connections_tenant ON public.data_connections(tenant_id);
CREATE INDEX IF NOT EXISTS idx_connections_status ON public.data_connections(status);
CREATE INDEX IF NOT EXISTS idx_etl_jobs_tenant ON public.etl_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_etl_jobs_dataset ON public.etl_jobs(dataset_id);
CREATE INDEX IF NOT EXISTS idx_etl_jobs_status ON public.etl_jobs(status);
CREATE INDEX IF NOT EXISTS idx_etl_jobs_created ON public.etl_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_etl_schedules_dataset ON public.etl_schedules(dataset_id);
CREATE INDEX IF NOT EXISTS idx_etl_schedules_next_run ON public.etl_schedules(next_run_at) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON public.audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_components_design ON public.components(design_id);
CREATE INDEX IF NOT EXISTS idx_components_dataset ON public.components(dataset_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_user_stores_user ON public.user_stores(user_id);
CREATE INDEX IF NOT EXISTS idx_user_stores_store ON public.user_stores(store_id);
CREATE INDEX IF NOT EXISTS idx_report_categories_tenant ON public.report_categories(tenant_id);
CREATE INDEX IF NOT EXISTS idx_report_categories_code ON public.report_categories(code);
CREATE INDEX IF NOT EXISTS idx_user_report_categories_user ON public.user_report_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_user_report_categories_category ON public.user_report_categories(category_id);
CREATE INDEX IF NOT EXISTS idx_designs_category ON public.designs(category_id);

-- ============================================
-- TRIGGERS
-- ============================================

DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_designs_updated_at ON public.designs;
CREATE TRIGGER update_designs_updated_at BEFORE UPDATE ON public.designs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_datasets_updated_at ON public.datasets;
CREATE TRIGGER update_datasets_updated_at BEFORE UPDATE ON public.datasets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_data_connections_updated_at ON public.data_connections;
CREATE TRIGGER update_data_connections_updated_at BEFORE UPDATE ON public.data_connections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_components_updated_at ON public.components;
CREATE TRIGGER update_components_updated_at BEFORE UPDATE ON public.components FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_system_settings_updated_at ON public.system_settings;
CREATE TRIGGER update_system_settings_updated_at BEFORE UPDATE ON public.system_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_tenants_updated_at ON public.tenants;
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_metrics_updated_at ON public.metrics;
CREATE TRIGGER update_metrics_updated_at BEFORE UPDATE ON public.metrics FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_etl_schedules_updated_at ON public.etl_schedules;
CREATE TRIGGER update_etl_schedules_updated_at BEFORE UPDATE ON public.etl_schedules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- GÜÇLER AYRILIĞI - KATEGORİ YÖNETİMİ TRIGGERs
-- Kullanıcıya kategori atandığında can_see_all_categories = false
-- Tüm kategorileri kaldırıldığında can_see_all_categories = true
-- ============================================

-- Kategori ataması yapıldığında kullanıcıyı güncelle
CREATE OR REPLACE FUNCTION public.update_user_category_access() RETURNS trigger
    LANGUAGE plpgsql AS $$
BEGIN
    -- INSERT: Kullanıcıya kategori atandı, artık tüm kategorileri göremez
    IF TG_OP = 'INSERT' THEN
        UPDATE users SET can_see_all_categories = false WHERE id = NEW.user_id;
        RETURN NEW;
    END IF;
    
    -- DELETE: Kategori kaldırıldı, başka kategorisi kalmadıysa tüm kategorileri görebilir
    IF TG_OP = 'DELETE' THEN
        -- Kullanıcının başka kategorisi var mı kontrol et
        IF NOT EXISTS (SELECT 1 FROM user_report_categories WHERE user_id = OLD.user_id) THEN
            UPDATE users SET can_see_all_categories = true WHERE id = OLD.user_id;
        END IF;
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$;

-- Trigger: Kategori ataması INSERT
DROP TRIGGER IF EXISTS trg_user_category_insert ON public.user_report_categories;
CREATE TRIGGER trg_user_category_insert 
    AFTER INSERT ON public.user_report_categories 
    FOR EACH ROW EXECUTE FUNCTION public.update_user_category_access();

-- Trigger: Kategori ataması DELETE
DROP TRIGGER IF EXISTS trg_user_category_delete ON public.user_report_categories;
CREATE TRIGGER trg_user_category_delete 
    AFTER DELETE ON public.user_report_categories 
    FOR EACH ROW EXECUTE FUNCTION public.update_user_category_access();

-- ============================================
-- SEED DATA - SADECE TEMİZ KURULUM İÇİN
-- ============================================

-- 1. Varsayilan Tenant
INSERT INTO public.tenants (id, name, slug, settings) VALUES
('00000000-0000-0000-0000-000000000001', 'Demo Tenant', 'demo', '{}')
ON CONFLICT (id) DO NOTHING;

-- 2. Varsayilan Pozisyonlar
INSERT INTO public.positions (code, name, filter_level, hierarchy_level, can_see_all_stores) VALUES
('GENERAL_MANAGER', 'Genel Mudur', 'none', 1, true),
('DIRECTOR', 'Direktor', 'group', 2, false),
('REGIONAL_MANAGER', 'Bolge Muduru', 'region', 3, false),
('STORE_MANAGER', 'Magaza Muduru', 'store', 4, false),
('ANALYST', 'Analist', 'none', 5, true),
('VIEWER', 'Izleyici', 'store', 6, false)
ON CONFLICT (code) DO NOTHING;

-- 3. Admin Kullanici (Sifre: Admin1234!)
-- bcrypt hash for 'Admin1234!'
-- ADMIN kullanıcıları her zaman tüm kategorileri görebilir
INSERT INTO public.users (id, tenant_id, email, password_hash, name, role, position_code, is_active, can_see_all_categories) VALUES
('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 
 'admin@clixer', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.SfWvqFw0.iGw/W', 
 'Admin Clixer', 'ADMIN', 'GENERAL_MANAGER', true, true)
ON CONFLICT (id) DO NOTHING;

-- 4. Temel Sistem Ayarlari
INSERT INTO public.system_settings (tenant_id, category, key, value) VALUES
('00000000-0000-0000-0000-000000000001', 'general', 'default_language', '"tr"'),
('00000000-0000-0000-0000-000000000001', 'general', 'default_theme', '"clixer"'),
('00000000-0000-0000-0000-000000000001', 'cache', 'cache_enabled', 'true'),
('00000000-0000-0000-0000-000000000001', 'cache', 'cache_dashboard_ttl', '900'),
('00000000-0000-0000-0000-000000000001', 'cache', 'cache_kpi_ttl', '300')
ON CONFLICT (tenant_id, category, key) DO NOTHING;

-- ============================================
-- KURULUM TAMAMLANDI
-- Login: admin@clixer / Admin1234!
-- ============================================

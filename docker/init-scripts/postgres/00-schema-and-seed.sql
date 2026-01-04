--
-- PostgreSQL database dump
--

\restrict gWr2dU6A5k3t90Amn9zZc00VQIX75lMCLJZXbdJ6IKmCCxgHA2mdYZtVQhp41mY

-- Dumped from database version 15.15
-- Dumped by pg_dump version 15.15

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: cleanup_old_audit_logs(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_old_audit_logs(days_to_keep integer DEFAULT 90) RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM audit_logs 
    WHERE created_at < NOW() - (days_to_keep || ' days')::INTERVAL;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;


--
-- Name: FUNCTION cleanup_old_audit_logs(days_to_keep integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.cleanup_old_audit_logs(days_to_keep integer) IS 'Eski audit loglarını temizler. Varsayılan 90 gün.';


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
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


--
-- Name: TABLE audit_logs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.audit_logs IS 'Kullanıcı aktivite ve sistem olayları kaydı';


--
-- Name: COLUMN audit_logs.action; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.audit_logs.action IS 'CREATE, READ, UPDATE, DELETE, LOGIN, LOGOUT, EXPORT, IMPORT, SYNC, ERROR';


--
-- Name: components; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.components (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid,
    design_id uuid,
    dataset_id uuid,
    type character varying(50) NOT NULL,
    label character varying(255) NOT NULL,
    config jsonb NOT NULL,
    "position" jsonb NOT NULL,
    data_config jsonb,
    style jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: TABLE components; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.components IS 'Dashboard widget''ları';


--
-- Name: data_connections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.data_connections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid,
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
    created_by uuid
);


--
-- Name: TABLE data_connections; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.data_connections IS 'Müşteri veritabanlarına bağlantı bilgileri';


--
-- Name: datasets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.datasets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid,
    connection_id uuid,
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
    created_by uuid,
    status_message text,
    last_sync_value text,
    total_rows bigint DEFAULT 0,
    date_column character varying(100),
    partition_scope character varying(20) DEFAULT 'today'::character varying,
    partition_column character varying(100) DEFAULT NULL::character varying,
    partition_type character varying(20) DEFAULT 'monthly'::character varying,
    refresh_window_days integer DEFAULT 0,
    archive_after_days integer DEFAULT 0,
    detect_modified boolean DEFAULT false,
    modified_column character varying(100) DEFAULT NULL::character varying,
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


--
-- Name: TABLE datasets; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.datasets IS 'ClickHouse''a aktarılacak veri setleri';


--
-- Name: COLUMN datasets.partition_column; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.datasets.partition_column IS 'ClickHouse partition için kullanılacak tarih kolonu';


--
-- Name: COLUMN datasets.partition_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.datasets.partition_type IS 'monthly veya daily partition tipi';


--
-- Name: COLUMN datasets.refresh_window_days; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.datasets.refresh_window_days IS 'Sliding window - son kaç gün yenilenecek (0=tümü)';


--
-- Name: COLUMN datasets.archive_after_days; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.datasets.archive_after_days IS 'Kaç günden sonra partition dondurulacak (0=hiç)';


--
-- Name: COLUMN datasets.detect_modified; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.datasets.detect_modified IS 'modified_at ile değişiklik algılama aktif mi';


--
-- Name: COLUMN datasets.modified_column; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.datasets.modified_column IS 'Değişiklik tarihini tutan kolon adı';


--
-- Name: COLUMN datasets.weekly_full_refresh; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.datasets.weekly_full_refresh IS 'Haftalık tam yenileme yapılsın mı';


--
-- Name: COLUMN datasets.engine_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.datasets.engine_type IS 'ClickHouse engine: MergeTree, ReplacingMergeTree';


--
-- Name: COLUMN datasets.custom_where; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.datasets.custom_where IS 'Full Refresh için opsiyonel WHERE koşulu. Örnek: tarih >= CURRENT_DATE - 7';


--
-- Name: design_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.design_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    design_id uuid,
    permission_type character varying(20) NOT NULL,
    permission_value character varying(50) NOT NULL,
    access_level character varying(20) DEFAULT 'view'::character varying,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: design_widgets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.design_widgets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    design_id uuid,
    metric_id uuid,
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


--
-- Name: designs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.designs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid,
    name character varying(255) NOT NULL,
    description text,
    is_default boolean DEFAULT false,
    layout_config jsonb DEFAULT '{}'::jsonb,
    settings jsonb DEFAULT '{}'::jsonb,
    created_by uuid,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    type character varying(50) DEFAULT 'cockpit'::character varying,
    target_roles jsonb DEFAULT '["ADMIN"]'::jsonb,
    is_active boolean DEFAULT true,
    grid_columns integer DEFAULT 24,
    row_height integer DEFAULT 80,
    allowed_positions text[] DEFAULT ARRAY['GENERAL_MANAGER'::text, 'DIRECTOR'::text, 'REGION_MANAGER'::text, 'STORE_MANAGER'::text, 'ANALYST'::text, 'VIEWER'::text]
);


--
-- Name: TABLE designs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.designs IS 'Dashboard tasarımları';


--
-- Name: COLUMN designs.allowed_positions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.designs.allowed_positions IS 'Bu raporu görebilecek pozisyonların listesi. Boş ise herkes görebilir.';


--
-- Name: etl_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.etl_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid,
    dataset_id uuid,
    action character varying(50) NOT NULL,
    status character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    started_at timestamp without time zone,
    completed_at timestamp without time zone,
    rows_processed integer DEFAULT 0,
    error_message text,
    created_at timestamp without time zone DEFAULT now(),
    triggered_by uuid,
    retry_count integer DEFAULT 0,
    error_details jsonb,
    rows_inserted integer DEFAULT 0,
    rows_updated integer DEFAULT 0,
    rows_deleted integer DEFAULT 0,
    scheduled_at timestamp without time zone
);


--
-- Name: TABLE etl_jobs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.etl_jobs IS 'ETL işlerinin geçmişi';


--
-- Name: etl_scheduler_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.etl_scheduler_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid,
    checked_at timestamp without time zone DEFAULT now(),
    schedules_found integer DEFAULT 0,
    schedules_triggered integer DEFAULT 0,
    schedules_skipped integer DEFAULT 0,
    details jsonb,
    created_at timestamp without time zone DEFAULT now(),
    schedules_missed integer DEFAULT 0
);


--
-- Name: etl_schedules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.etl_schedules (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    dataset_id uuid NOT NULL,
    cron_expression character varying(100) NOT NULL,
    timezone character varying(100) DEFAULT 'Europe/Istanbul'::character varying,
    is_active boolean DEFAULT true,
    next_run_at timestamp with time zone,
    last_run_at timestamp with time zone,
    last_job_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: ldap_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ldap_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
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


--
-- Name: ldap_position_mappings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ldap_position_mappings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    ldap_group_dn character varying(500) NOT NULL,
    ldap_group_name character varying(255) NOT NULL,
    position_code character varying(50) NOT NULL,
    priority integer DEFAULT 100,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: ldap_store_mappings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ldap_store_mappings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    ldap_group_dn character varying(500) NOT NULL,
    ldap_group_name character varying(255) NOT NULL,
    store_id character varying(100) NOT NULL,
    store_name character varying(255),
    grants_all_stores boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: ldap_sync_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ldap_sync_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
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


--
-- Name: menu_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.menu_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    position_code character varying(50),
    menu_key character varying(100) NOT NULL,
    can_view boolean DEFAULT true,
    can_edit boolean DEFAULT false
);


--
-- Name: metrics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.metrics (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    dataset_id uuid,
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
    created_by uuid,
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


--
-- Name: TABLE metrics; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.metrics IS 'ClickHouse sorgularından oluşan metrikler';


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid,
    user_id uuid,
    type character varying(50) NOT NULL,
    title character varying(255) NOT NULL,
    message text,
    is_read boolean DEFAULT false,
    read_at timestamp without time zone,
    data jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: ownership_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ownership_groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid,
    code character varying(50) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    color character varying(20),
    icon character varying(50),
    is_active boolean DEFAULT true,
    sort_order integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: positions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.positions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    hierarchy_level integer DEFAULT 0 NOT NULL,
    can_see_all_stores boolean DEFAULT false,
    description text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    filter_level character varying(20) DEFAULT 'store'::character varying
);


--
-- Name: regions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.regions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid,
    code character varying(50) NOT NULL,
    name character varying(200) NOT NULL,
    description text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    manager_name character varying(255),
    manager_email character varying(255),
    sort_order integer DEFAULT 0,
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: store_finance_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.store_finance_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid,
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
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: stores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stores (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid,
    code character varying(100) NOT NULL,
    name character varying(200) NOT NULL,
    store_type character varying(20) DEFAULT 'MERKEZ'::character varying,
    region_id uuid,
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
    sort_order integer DEFAULT 0
);


--
-- Name: system_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid,
    category character varying(100) NOT NULL,
    key character varying(100) NOT NULL,
    value jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: tenants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    slug character varying(100) NOT NULL,
    logo_url character varying(500),
    settings jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: user_stores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_stores (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    store_id character varying(100) NOT NULL,
    store_name character varying(200),
    assigned_at timestamp with time zone DEFAULT now(),
    assigned_by uuid
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid,
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
    two_factor_backup_codes text[]
);


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: components; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: data_connections; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.data_connections VALUES ('794ffadb-42f9-429e-98a9-2344c05d2622', '00000000-0000-0000-0000-000000000001', 'AzureCanlı', 'mssql', 'snchndr.database.windows.net', 1433, 'chndrDB', 'adminClixer', 'Clixer123*', NULL, NULL, 'error', '2025-12-25 19:56:38.815798', '2025-12-23 16:49:52.621199', '2025-12-25 19:56:38.815798', NULL, 'Bağlantı hatası: This database has reached the monthly free amount allowance for the month of December 2025 and is paused for the remainder of the month. The free amount will renew at 12:00 AM (UTC) on January 01, 2026. To regain access immediately, open the Compute and Storage tab from the database menu on the Azure Portal and select the "Continue using database with additional charges" option. This will resume the database and bill you for additional usage charges the rest of this month. For more details, see https://go.microsoft.com/fwlink/?linkid=2243105&clcid=0x409.', NULL);
INSERT INTO public.data_connections VALUES ('25beb150-c43c-47d7-bc21-2a8296853c13', '00000000-0000-0000-0000-000000000001', 'test', 'api', 'https://api.nettoolkit.com/v1/account/test-api-keys?', NULL, NULL, NULL, NULL, '{"authType": "none"}', NULL, 'active', '2025-12-28 18:08:51.305283', '2025-12-21 14:33:34.469306', '2025-12-28 18:08:51.305283', NULL, 'API erişilebilir', NULL);
INSERT INTO public.data_connections VALUES ('28693401-deed-437f-ac88-13a2200dec83', '00000000-0000-0000-0000-000000000001', 'PA Clixer (9M Satış)', 'postgresql', '127.0.0.1', 5432, 'pa_clixer', 'clixer', 'clixer_secret_2025', NULL, NULL, 'active', '2025-12-28 18:46:02.944629', '2025-12-20 14:42:19.692983', '2025-12-28 18:46:02.944629', '9 milyon satırlık gerçek satış verisi', 'PostgreSQL bağlantısı başarılı', '00000000-0000-0000-0000-000000000001');
INSERT INTO public.data_connections VALUES ('c3c2ec44-fc2f-4f28-9622-fa6de66667c4', '00000000-0000-0000-0000-000000000001', 'mysql ca', 'mysql', 'localhost', 3307, 'test_erp', 'testuser', 'TestPassword123!', NULL, NULL, 'error', '2025-12-28 18:46:06.508545', '2025-12-23 12:54:18.814666', '2025-12-28 18:46:06.508545', NULL, 'Bağlantı hatası: ', NULL);
INSERT INTO public.data_connections VALUES ('eae38e08-5f32-46b3-83bf-d1ba3e7eddd6', '00000000-0000-0000-0000-000000000001', 'Üniversite Otomasyon (50K Öğrenci)', 'mysql', 'localhost', 3307, 'test_university', 'testuser', 'TestPassword123!', NULL, NULL, 'active', '2025-12-28 19:28:57.59225', '2025-12-23 14:40:19.622601', '2025-12-28 19:28:57.59225', NULL, 'MySQL bağlantısı başarılı', NULL);
INSERT INTO public.data_connections VALUES ('9a389b56-c077-4520-88a3-93e829724294', '00000000-0000-0000-0000-000000000001', 'SQL dev', 'mssql', 'localhost', 1433, 'master', 'sa', 'TestPassword123!', NULL, NULL, 'active', NULL, '2025-12-28 20:03:05.759242', '2025-12-28 20:03:05.759242', NULL, NULL, NULL);
INSERT INTO public.data_connections VALUES ('0d3ed938-1aec-4fcd-a315-c7375ba2097c', '00000000-0000-0000-0000-000000000001', 'tekstil', 'mssql', 'localhost', 1433, 'tekstil_retail', 'sa', 'TestPassword123!', NULL, NULL, 'active', NULL, '2025-12-28 21:32:37.336829', '2025-12-28 21:32:37.336829', NULL, NULL, NULL);


--
-- Data for Name: datasets; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.datasets VALUES ('f65d82ec-ae3b-4040-82d4-418ae51b30d2', '00000000-0000-0000-0000-000000000001', '25beb150-c43c-47d7-bc21-2a8296853c13', 'apitest', NULL, '[{"type": "number", "source": "created", "target": "created", "clickhouseType": "Float64"}, {"type": "string", "source": "key", "target": "key", "clickhouseType": "String"}]', 'full_refresh', '1m', NULL, 10000, 'ds_f65d82ec_ae3b_4040_82d4_418ae51b30d2', 'active', '2025-12-28 20:18:14.723207', 1, '2025-12-21 15:07:51.498737', '2025-12-28 20:18:14.723207', NULL, 'table', '{"endpoint":"","method":"GET","responsePath":"results","queryParams":""}', NULL, NULL, NULL, NULL, NULL, 1, NULL, 'today', NULL, 'monthly', 0, 0, false, NULL, false, 'MergeTree', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.datasets VALUES ('c57a05be-6ef4-4773-8fc8-7458ca4384e9', '00000000-0000-0000-0000-000000000001', '0d3ed938-1aec-4fcd-a315-c7375ba2097c', 'TEKSTIL_SATIS', NULL, '[{"type": "string", "source": "id", "target": "id", "sqlType": "BigInt", "clickhouseType": "Int64"}, {"type": "string", "source": "transaction_date", "target": "transaction_date", "sqlType": "DateTime", "clickhouseType": "DateTime"}, {"type": "string", "source": "store_id", "target": "store_id", "sqlType": "Int", "clickhouseType": "Int32"}, {"type": "string", "source": "product_id", "target": "product_id", "sqlType": "Int", "clickhouseType": "Int32"}, {"type": "string", "source": "quantity", "target": "quantity", "sqlType": "Int", "clickhouseType": "Int32"}, {"type": "string", "source": "unit_price", "target": "unit_price", "sqlType": "Decimal", "clickhouseType": "Float64"}, {"type": "string", "source": "discount_percent", "target": "discount_percent", "sqlType": "Decimal", "clickhouseType": "Float64"}, {"type": "string", "source": "discount_amount", "target": "discount_amount", "sqlType": "Decimal", "clickhouseType": "Float64"}, {"type": "string", "source": "net_amount", "target": "net_amount", "sqlType": "Decimal", "clickhouseType": "Float64"}, {"type": "string", "source": "payment_type", "target": "payment_type", "sqlType": "NVarChar", "clickhouseType": "String"}, {"type": "string", "source": "cashier_id", "target": "cashier_id", "sqlType": "Int", "clickhouseType": "Int32"}, {"type": "string", "source": "created_at", "target": "created_at", "sqlType": "DateTime", "clickhouseType": "DateTime"}]', 'id', 'manual', 'id', 10000000, 'ds_c57a05be_6ef4_4773_8fc8_7458ca4384e9', 'active', '2025-12-28 21:38:11.845334', 970000, '2025-12-28 21:36:59.967964', '2025-12-29 06:33:19.954882', NULL, 'table', 'SELECT TOP 10 * FROM sales_transactions', NULL, NULL, NULL, NULL, '1000000', 1000000, NULL, 'today', NULL, 'monthly', 7, 0, false, NULL, false, 'MergeTree', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.datasets VALUES ('6a8bf546-2a91-4fdb-83f7-f2c9b2223419', '00000000-0000-0000-0000-000000000001', '0d3ed938-1aec-4fcd-a315-c7375ba2097c', 'gurkan', NULL, '[{"type": "string", "source": "id", "target": "id", "sqlType": "BigInt", "clickhouseType": "Int64"}, {"type": "string", "source": "transaction_date", "target": "transaction_date", "sqlType": "DateTime", "clickhouseType": "DateTime"}, {"type": "string", "source": "store_id", "target": "store_id", "sqlType": "Int", "clickhouseType": "Int32"}, {"type": "string", "source": "product_id", "target": "product_id", "sqlType": "Int", "clickhouseType": "Int32"}, {"type": "string", "source": "quantity", "target": "quantity", "sqlType": "Int", "clickhouseType": "Int32"}, {"type": "string", "source": "unit_price", "target": "unit_price", "sqlType": "Decimal", "clickhouseType": "Float64"}, {"type": "string", "source": "discount_percent", "target": "discount_percent", "sqlType": "Decimal", "clickhouseType": "Float64"}, {"type": "string", "source": "discount_amount", "target": "discount_amount", "sqlType": "Decimal", "clickhouseType": "Float64"}, {"type": "string", "source": "net_amount", "target": "net_amount", "sqlType": "Decimal", "clickhouseType": "Float64"}, {"type": "string", "source": "payment_type", "target": "payment_type", "sqlType": "NVarChar", "clickhouseType": "String"}, {"type": "string", "source": "cashier_id", "target": "cashier_id", "sqlType": "Int", "clickhouseType": "Int32"}, {"type": "string", "source": "created_at", "target": "created_at", "sqlType": "DateTime", "clickhouseType": "DateTime"}]', 'full_refresh', 'manual', NULL, 10000000, 'ds_6a8bf546_2a91_4fdb_83f7_f2c9b2223419', 'active', '2025-12-29 20:11:21.762209', 1000000, '2025-12-29 20:11:16.295581', '2025-12-29 20:12:37.554803', NULL, 'table', 'SELECT * FROM sales_transactions', NULL, NULL, NULL, NULL, NULL, 1000000, NULL, 'today', NULL, 'monthly', 7, 0, false, NULL, false, 'MergeTree', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.datasets VALUES ('5f0b1b9e-dd11-43cf-ba74-272f1882777c', '00000000-0000-0000-0000-000000000001', '0d3ed938-1aec-4fcd-a315-c7375ba2097c', 'TEKSTIL_ vw_category_analysis', NULL, '[{"type": "string", "source": "kategori", "target": "kategori", "sqlType": "NVarChar", "clickhouseType": "String"}, {"type": "string", "source": "alt_kategori", "target": "alt_kategori", "sqlType": "NVarChar", "clickhouseType": "String"}, {"type": "string", "source": "urun_sayisi", "target": "urun_sayisi", "sqlType": "Int", "clickhouseType": "Int32"}, {"type": "string", "source": "satis_adedi", "target": "satis_adedi", "sqlType": "Int", "clickhouseType": "Int32"}, {"type": "string", "source": "toplam_adet", "target": "toplam_adet", "sqlType": "Int", "clickhouseType": "Int32"}, {"type": "string", "source": "toplam_ciro", "target": "toplam_ciro", "sqlType": "Decimal", "clickhouseType": "Float64"}, {"type": "string", "source": "ortalama_fiyat", "target": "ortalama_fiyat", "sqlType": "Decimal", "clickhouseType": "Float64"}, {"type": "string", "source": "ortalama_indirim_yuzdesi", "target": "ortalama_indirim_yuzdesi", "sqlType": "Decimal", "clickhouseType": "Float64"}]', 'full_refresh', 'manual', 'id', 10000000, 'ds_5f0b1b9e_dd11_43cf_ba74_272f1882777c', 'active', '2025-12-28 21:42:25.444677', 25, '2025-12-28 21:42:23.836071', '2025-12-28 21:42:25.444677', NULL, 'table', 'SELECT * FROM vw_category_analysis ', NULL, NULL, NULL, NULL, NULL, 25, NULL, 'today', NULL, 'monthly', 7, 0, false, NULL, false, 'MergeTree', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.datasets VALUES ('5165f56a-0984-49ec-8281-48dfc359116b', '00000000-0000-0000-0000-000000000001', '0d3ed938-1aec-4fcd-a315-c7375ba2097c', 'TEKSTIL_ vw_store_performance', NULL, '[{"type": "string", "source": "magaza_kodu", "target": "magaza_kodu", "sqlType": "NVarChar", "clickhouseType": "String"}, {"type": "string", "source": "magaza_adi", "target": "magaza_adi", "sqlType": "NVarChar", "clickhouseType": "String"}, {"type": "string", "source": "bolge", "target": "bolge", "sqlType": "NVarChar", "clickhouseType": "String"}, {"type": "string", "source": "il", "target": "il", "sqlType": "NVarChar", "clickhouseType": "String"}, {"type": "string", "source": "sahiplik_tipi", "target": "sahiplik_tipi", "sqlType": "NVarChar", "clickhouseType": "String"}, {"type": "string", "source": "metrekare", "target": "metrekare", "sqlType": "Int", "clickhouseType": "Int32"}, {"type": "string", "source": "calisan_sayisi", "target": "calisan_sayisi", "sqlType": "Int", "clickhouseType": "Int32"}, {"type": "string", "source": "aktif_gun_sayisi", "target": "aktif_gun_sayisi", "sqlType": "Int", "clickhouseType": "Int32"}, {"type": "string", "source": "toplam_islem", "target": "toplam_islem", "sqlType": "Int", "clickhouseType": "Int32"}, {"type": "string", "source": "toplam_adet", "target": "toplam_adet", "sqlType": "Int", "clickhouseType": "Int32"}, {"type": "string", "source": "toplam_ciro", "target": "toplam_ciro", "sqlType": "Decimal", "clickhouseType": "Float64"}]', 'full_refresh', 'manual', 'id', 10000000, 'ds_5165f56a_0984_49ec_8281_48dfc359116b', 'active', '2025-12-28 21:41:49.680473', 39, '2025-12-28 21:41:34.329271', '2025-12-28 21:41:49.680473', NULL, 'table', 'SELECT * FROM vw_store_performance ', NULL, NULL, NULL, NULL, NULL, 39, NULL, 'today', NULL, 'monthly', 7, 0, false, NULL, false, 'MergeTree', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.datasets VALUES ('2d4f4bb7-0183-442b-bbf7-314b109db01c', '00000000-0000-0000-0000-000000000001', '0d3ed938-1aec-4fcd-a315-c7375ba2097c', 'TEKSTIL_ vw_regional_summary', NULL, '[{"type": "string", "source": "bolge_kodu", "target": "bolge_kodu", "sqlType": "NVarChar", "clickhouseType": "String"}, {"type": "string", "source": "bolge_adi", "target": "bolge_adi", "sqlType": "NVarChar", "clickhouseType": "String"}, {"type": "string", "source": "bolge_muduru", "target": "bolge_muduru", "sqlType": "NVarChar", "clickhouseType": "String"}, {"type": "string", "source": "magaza_sayisi", "target": "magaza_sayisi", "sqlType": "Int", "clickhouseType": "Int32"}, {"type": "string", "source": "toplam_metrekare", "target": "toplam_metrekare", "sqlType": "Int", "clickhouseType": "Int32"}, {"type": "string", "source": "toplam_calisan", "target": "toplam_calisan", "sqlType": "Int", "clickhouseType": "Int32"}, {"type": "string", "source": "toplam_islem", "target": "toplam_islem", "sqlType": "Int", "clickhouseType": "Int32"}, {"type": "string", "source": "toplam_ciro", "target": "toplam_ciro", "sqlType": "Decimal", "clickhouseType": "Float64"}]', 'full_refresh', 'manual', 'id', 10000000, 'ds_2d4f4bb7_0183_442b_bbf7_314b109db01c', 'active', '2025-12-28 21:42:42.610749', 7, '2025-12-28 21:42:42.155936', '2025-12-28 21:42:42.610749', NULL, 'table', 'SELECT * FROM vw_regional_summary ', NULL, NULL, NULL, NULL, NULL, 7, NULL, 'today', NULL, 'monthly', 7, 0, false, NULL, false, 'MergeTree', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.datasets VALUES ('9555e13e-a703-4870-8d5f-d1010bf7b1b3', '00000000-0000-0000-0000-000000000001', '0d3ed938-1aec-4fcd-a315-c7375ba2097c', 'TEKSTIL_ vw_top_products', NULL, '[{"type": "string", "source": "urun_kodu", "target": "urun_kodu", "sqlType": "NVarChar", "clickhouseType": "String"}, {"type": "string", "source": "urun_adi", "target": "urun_adi", "sqlType": "NVarChar", "clickhouseType": "String"}, {"type": "string", "source": "marka", "target": "marka", "sqlType": "NVarChar", "clickhouseType": "String"}, {"type": "string", "source": "kategori", "target": "kategori", "sqlType": "NVarChar", "clickhouseType": "String"}, {"type": "string", "source": "alt_kategori", "target": "alt_kategori", "sqlType": "NVarChar", "clickhouseType": "String"}, {"type": "string", "source": "toplam_adet", "target": "toplam_adet", "sqlType": "Int", "clickhouseType": "Int32"}, {"type": "string", "source": "toplam_ciro", "target": "toplam_ciro", "sqlType": "Decimal", "clickhouseType": "Float64"}, {"type": "string", "source": "satan_magaza_sayisi", "target": "satan_magaza_sayisi", "sqlType": "Int", "clickhouseType": "Int32"}]', 'full_refresh', 'manual', 'id', 10000000, 'ds_9555e13e_a703_4870_8d5f_d1010bf7b1b3', 'active', '2025-12-28 21:43:40.086058', 100, '2025-12-28 21:43:33.475311', '2025-12-28 21:43:40.086058', NULL, 'table', 'SELECT * FROM vw_top_products ', NULL, NULL, NULL, NULL, NULL, 100, NULL, 'today', NULL, 'monthly', 7, 0, false, NULL, false, 'MergeTree', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.datasets VALUES ('06470d77-2cf2-4987-9b5b-b2cea980c12a', '00000000-0000-0000-0000-000000000001', '28693401-deed-437f-ac88-13a2200dec83', 'Günlük Satışlar (9M)', 'gunluk_satis', '[{"source": "id", "target": "id", "clickhouseType": "String"}, {"source": "tarih", "target": "tarih", "clickhouseType": "String"}, {"source": "magaza_id", "target": "magaza_id", "clickhouseType": "String"}, {"source": "urun_id", "target": "urun_id", "clickhouseType": "String"}, {"source": "adet", "target": "adet", "clickhouseType": "Float64"}, {"source": "brut_tutar", "target": "brut_tutar", "clickhouseType": "Float64"}, {"source": "indirim", "target": "indirim", "clickhouseType": "Float64"}, {"source": "net_tutar", "target": "net_tutar", "clickhouseType": "Float64"}, {"source": "created_at", "target": "created_at", "clickhouseType": "String"}]', 'full_refresh', 'manual', NULL, NULL, 'ds_g_nl_k_sat__lar__9m__mjeeql76', 'active', '2025-12-28 20:45:21.630789', 9009725, '2025-12-20 14:42:36.125737', '2025-12-28 20:45:21.630789', '9 milyon satırlık gerçek satış verisi', 'table', 'SELECT id, tarih, magaza_id, urun_id, adet, brut_tutar, indirim, net_tutar FROM gunluk_satis', 'toYYYYMM(tarih)', '{tarih,magaza_id}', '00000000-0000-0000-0000-000000000001', NULL, NULL, 9009725, NULL, 'today', NULL, 'monthly', 0, 0, false, NULL, false, 'MergeTree', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.datasets VALUES ('333e7668-7b60-4028-a594-9b226e968932', '00000000-0000-0000-0000-000000000001', '0d3ed938-1aec-4fcd-a315-c7375ba2097c', 'ttertetetet', NULL, '[{"type": "string", "source": "id", "target": "id", "sqlType": "BigInt", "clickhouseType": "Int64"}, {"type": "string", "source": "transaction_date", "target": "transaction_date", "sqlType": "DateTime", "clickhouseType": "DateTime"}, {"type": "string", "source": "store_id", "target": "store_id", "sqlType": "Int", "clickhouseType": "Int32"}, {"type": "string", "source": "product_id", "target": "product_id", "sqlType": "Int", "clickhouseType": "Int32"}, {"type": "string", "source": "quantity", "target": "quantity", "sqlType": "Int", "clickhouseType": "Int32"}, {"type": "string", "source": "unit_price", "target": "unit_price", "sqlType": "Decimal", "clickhouseType": "Float64"}, {"type": "string", "source": "discount_percent", "target": "discount_percent", "sqlType": "Decimal", "clickhouseType": "Float64"}, {"type": "string", "source": "discount_amount", "target": "discount_amount", "sqlType": "Decimal", "clickhouseType": "Float64"}, {"type": "string", "source": "net_amount", "target": "net_amount", "sqlType": "Decimal", "clickhouseType": "Float64"}, {"type": "string", "source": "payment_type", "target": "payment_type", "sqlType": "NVarChar", "clickhouseType": "String"}, {"type": "string", "source": "cashier_id", "target": "cashier_id", "sqlType": "Int", "clickhouseType": "Int32"}, {"type": "string", "source": "created_at", "target": "created_at", "sqlType": "DateTime", "clickhouseType": "DateTime"}]', 'id', 'daily', NULL, 10000000, 'ds_333e7668_7b60_4028_a594_9b226e968932', 'active', '2025-12-29 14:41:20.045632', 1000000, '2025-12-29 14:39:59.108485', '2025-12-29 14:41:58.570731', NULL, 'table', 'SELECT * FROM sales_transactions ', NULL, NULL, NULL, NULL, NULL, 1000000, NULL, 'today', NULL, 'monthly', 7, 0, false, NULL, false, 'MergeTree', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.datasets VALUES ('5d3356b2-59af-4c35-a773-609eceba314a', '00000000-0000-0000-0000-000000000001', 'eae38e08-5f32-46b3-83bf-d1ba3e7eddd6', 'faturalar_mysql', NULL, '[{"type": "string", "source": "id", "target": "id", "sqlType": "int", "clickhouseType": "Int32"}, {"type": "string", "source": "fatura_no", "target": "fatura_no", "sqlType": "varchar", "clickhouseType": "String"}, {"type": "string", "source": "ogrenci_id", "target": "ogrenci_id", "sqlType": "int", "clickhouseType": "Int32"}, {"type": "string", "source": "tutar", "target": "tutar", "sqlType": "newdecimal", "clickhouseType": "Float64"}, {"type": "string", "source": "kdv", "target": "kdv", "sqlType": "newdecimal", "clickhouseType": "Float64"}, {"type": "string", "source": "toplam", "target": "toplam", "sqlType": "newdecimal", "clickhouseType": "Float64"}, {"type": "string", "source": "fatura_tipi", "target": "fatura_tipi", "sqlType": "varchar", "clickhouseType": "String"}, {"type": "string", "source": "donem", "target": "donem", "sqlType": "varchar", "clickhouseType": "String"}, {"type": "string", "source": "odeme_durumu", "target": "odeme_durumu", "sqlType": "varchar", "clickhouseType": "String"}, {"type": "string", "source": "created_at", "target": "created_at", "sqlType": "datetime", "clickhouseType": "DateTime"}, {"type": "string", "source": "modified_at", "target": "modified_at", "sqlType": "datetime", "clickhouseType": "DateTime"}]', 'full_refresh', 'manual', 'created_at', 100000, 'ds_5d3356b2_59af_4c35_a773_609eceba314a', 'active', '2025-12-28 21:13:40.145983', 50000, '2025-12-28 20:48:36.791574', '2025-12-28 21:13:40.145983', NULL, 'table', 'SELECT * FROM faturalar LIMIT 10', NULL, NULL, NULL, NULL, NULL, 50000, NULL, 'today', NULL, 'monthly', 7, 0, false, NULL, false, 'MergeTree', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.datasets VALUES ('825012b4-55e3-4108-a34b-97bc2c466055', '00000000-0000-0000-0000-000000000001', '0d3ed938-1aec-4fcd-a315-c7375ba2097c', 'yılmaz', NULL, '[{"type": "string", "source": "id", "target": "id", "sqlType": "BigInt", "clickhouseType": "Int64"}, {"type": "string", "source": "transaction_date", "target": "transaction_date", "sqlType": "DateTime", "clickhouseType": "DateTime"}, {"type": "string", "source": "store_id", "target": "store_id", "sqlType": "Int", "clickhouseType": "Int32"}, {"type": "string", "source": "product_id", "target": "product_id", "sqlType": "Int", "clickhouseType": "Int32"}, {"type": "string", "source": "quantity", "target": "quantity", "sqlType": "Int", "clickhouseType": "Int32"}, {"type": "string", "source": "unit_price", "target": "unit_price", "sqlType": "Decimal", "clickhouseType": "Float64"}, {"type": "string", "source": "discount_percent", "target": "discount_percent", "sqlType": "Decimal", "clickhouseType": "Float64"}, {"type": "string", "source": "discount_amount", "target": "discount_amount", "sqlType": "Decimal", "clickhouseType": "Float64"}, {"type": "string", "source": "net_amount", "target": "net_amount", "sqlType": "Decimal", "clickhouseType": "Float64"}, {"type": "string", "source": "payment_type", "target": "payment_type", "sqlType": "NVarChar", "clickhouseType": "String"}, {"type": "string", "source": "cashier_id", "target": "cashier_id", "sqlType": "Int", "clickhouseType": "Int32"}, {"type": "string", "source": "created_at", "target": "created_at", "sqlType": "DateTime", "clickhouseType": "DateTime"}]', 'id', 'daily', 'id', 10000000, 'ds_825012b4_55e3_4108_a34b_97bc2c466055', 'active', '2025-12-29 17:58:55.278873', 0, '2025-12-29 17:57:26.392737', '2025-12-29 17:59:03.684251', NULL, 'table', 'SELECT * FROM sales_transactions ', NULL, NULL, NULL, NULL, NULL, 1000000, NULL, 'today', NULL, 'monthly', 7, 0, false, NULL, false, 'MergeTree', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);


--
-- Data for Name: design_permissions; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.design_permissions VALUES ('8459d3a3-328d-4deb-a7b8-160359ca9150', '5ae31297-6006-43d4-8ed9-632e3319a2df', 'role', 'ADMIN', 'view', '2025-12-29 06:27:04.867643');
INSERT INTO public.design_permissions VALUES ('36cc03c3-b307-4677-a1d5-a703f0a18b5b', 'bfdda8d5-dcbe-4fb8-aac4-c708ddad0d52', 'role', 'ADMIN', 'view', '2025-12-29 11:09:21.622945');
INSERT INTO public.design_permissions VALUES ('231326ab-6ba4-42b0-a6a2-90546e4ad906', '53dfb49f-7f47-41b6-afec-3ce7f806cd67', 'role', 'ADMIN', 'view', '2025-12-29 14:45:40.801671');
INSERT INTO public.design_permissions VALUES ('3c4cbf8f-348b-4dff-8d23-e4059dcd925b', '8cdbbe1a-a53a-4cb0-b68d-1945541cd8e2', 'role', 'ADMIN', 'view', '2025-12-29 18:01:23.997344');
INSERT INTO public.design_permissions VALUES ('285bc84f-4b98-4fb4-9b8e-71aa2eaf38f7', 'a6d6e7c5-a1b5-4a53-9efc-ba0fee92e3f7', 'role', 'ADMIN', 'view', '2025-12-29 20:14:59.547782');


--
-- Data for Name: design_widgets; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: designs; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.designs VALUES ('8cdbbe1a-a53a-4cb0-b68d-1945541cd8e2', '00000000-0000-0000-0000-000000000001', 'yılmaz', NULL, false, '{"widgets": [{"h": 4, "w": 6, "x": 0, "y": 0, "id": "widget-1767031253724", "minH": 2, "minW": 3, "type": "mini_card", "label": "total satış", "metricId": "7ab8f1fd-eed9-4ae8-b568-16d6bbda8f08", "metricName": "satış yılmaz"}]}', '{"responsive": true, "gridColumns": 24}', '00000000-0000-0000-0000-000000000001', '2025-12-29 18:01:23.99221', '2025-12-29 18:01:23.99221', 'analysis', '["ADMIN"]', true, 24, 80, '{GENERAL_MANAGER}');
INSERT INTO public.designs VALUES ('5ae31297-6006-43d4-8ed9-632e3319a2df', '00000000-0000-0000-0000-000000000001', 'Fakülte', NULL, false, '{"widgets": [{"h": 4, "w": 5, "x": 0, "y": 0, "id": "widget-1766989614964", "minH": 2, "minW": 3, "type": "mini_card", "label": "PRICE", "metricId": "a00767b7-38cf-4da3-8607-37bc1e26bed6", "metricName": "PRICE"}, {"h": 4, "w": 5, "x": 5, "y": 0, "id": "widget-1766992182124", "minH": 2, "minW": 3, "type": "mini_card", "label": "NETAMOUNT", "metricId": "67e3fce4-36be-48f8-80a9-27da4141c192", "metricName": "NETAMOUNT"}, {"h": 4, "w": 5, "x": 10, "y": 0, "id": "widget-1766992531990", "minH": 2, "minW": 3, "type": "mini_card", "label": "QUANTITY", "metricId": "fa4a82fb-840b-472b-a0d9-e0f4575d54a8", "metricName": "QUANTITY"}, {"h": 4, "w": 5, "x": 15, "y": 0, "id": "widget-1766992826789", "minH": 2, "minW": 3, "type": "mini_card", "label": "DISCOUNTAMOUNT", "metricId": "45292c15-df1b-4394-97d2-f38a8d8580ce", "metricName": "DISCOUNTAMOUNT"}, {"h": 4, "w": 4, "x": 20, "y": 0, "id": "widget-1766993302676", "minH": 2, "minW": 3, "type": "mini_card", "label": "DPERCENT", "metricId": "4ac25f0e-482c-4222-be05-96a572d57da2", "metricName": "DPERCENT"}, {"h": 6, "w": 8, "x": 0, "y": 4, "id": "widget-1766993876802", "minH": 5, "minW": 8, "type": "grid", "label": "SIRALAMA", "metricId": "36f2c90b-59d5-4a55-91cd-151ab690d924", "metricName": "SIRALAMLIST"}, {"h": 6, "w": 8, "x": 8, "y": 4, "id": "widget-1766996257855", "minH": 4, "minW": 6, "type": "chart", "label": "Marka Dağılım", "metricId": "a17467a6-0a97-4c13-9850-add7b56dd740", "metricName": "pasta"}, {"h": 6, "w": 8, "x": 16, "y": 4, "id": "widget-1766996886030", "minH": 4, "minW": 6, "type": "chart", "label": "CUBUK", "metricId": "f9eeddda-e732-4230-92c2-ce8fd90510b3", "metricName": "cubuk"}, {"h": 6, "w": 8, "x": 0, "y": 10, "id": "widget-1766997192536", "minH": 4, "minW": 6, "type": "chart", "label": "CIZGI", "metricId": "f7baee35-cc4b-4870-a696-c7c5dc357d5b", "metricName": "CIZGI"}, {"h": 6, "w": 8, "x": 8, "y": 10, "id": "widget-1766997451968", "minH": 3, "minW": 4, "type": "card", "label": "HALKA", "metricId": "dc7ca7e0-a53f-4c7f-92f4-a680344d124f", "metricName": "HALKA"}, {"h": 6, "w": 8, "x": 16, "y": 10, "id": "widget-1766997625454", "minH": 4, "minW": 6, "type": "chart", "label": "DAGILIM", "metricId": "baef4844-d2f9-456b-8999-dac7bdc44da3", "metricName": "DAGILIM"}, {"h": 6, "w": 8, "x": 0, "y": 16, "id": "widget-1766997625828", "minH": 4, "minW": 6, "type": "chart", "label": "HUNI", "metricId": "9e855513-ed9c-43fd-bcd4-55ff8feeb839", "metricName": "HUNI"}, {"h": 6, "w": 8, "x": 8, "y": 16, "id": "widget-1766997626157", "minH": 4, "minW": 6, "type": "chart", "label": "AGAC", "metricId": "b2065ec7-1e53-4342-adad-fc0d71e1cb49", "metricName": "AGAC"}, {"h": 6, "w": 8, "x": 16, "y": 16, "id": "widget-1766997626487", "minH": 4, "minW": 6, "type": "chart", "label": "ISI", "metricId": "6be7a805-7bf7-4717-a06c-cb6fe4db127c", "metricName": "ISI"}, {"h": 4, "w": 8, "x": 0, "y": 22, "id": "widget-1766998507842", "minH": 2, "minW": 3, "type": "mini_card", "label": "ilerleme", "metricId": "41c02b02-fd20-4d15-bf2b-0ed750f65774", "metricName": "ilerleme cubugu"}, {"h": 4, "w": 8, "x": 8, "y": 22, "id": "widget-1766998779877", "minH": 2, "minW": 3, "type": "sparkline", "label": "SPARKLINE", "metricId": "4f01b9fb-8e3a-4737-947a-f25c0e704bd7", "metricName": "TREND"}, {"h": 4, "w": 8, "x": 16, "y": 22, "id": "widget-1766999247617", "minH": 3, "minW": 5, "type": "comparison", "label": "Karşılaştırma", "metricId": "2bb3174b-673c-474f-b078-c7908f59fdf0", "metricName": "KARSILASTIRMA"}, {"h": 4, "w": 8, "x": 0, "y": 26, "id": "widget-1766999552071", "minH": 3, "minW": 4, "type": "gauge", "label": "Gösterge", "metricId": "6a69f5ba-689e-488c-8192-45c1a3c883d4", "metricName": "GÖSTEGE"}]}', '{"responsive": true, "gridColumns": 24}', '00000000-0000-0000-0000-000000000001', '2025-12-29 06:27:04.852117', '2025-12-29 09:12:39.907284', 'analysis', '["ADMIN"]', true, 24, 80, '{GENERAL_MANAGER}');
INSERT INTO public.designs VALUES ('a6d6e7c5-a1b5-4a53-9efc-ba0fee92e3f7', '00000000-0000-0000-0000-000000000001', 'gt', NULL, false, '{"widgets": [{"h": 5, "w": 11, "x": 0, "y": 0, "id": "widget-1767039258628", "minH": 2, "minW": 3, "type": "mini_card", "label": "satış", "metricId": "172b8165-5d7f-4e7a-83ca-d50b96ce39d2", "metricName": "sales gt"}]}', '{"responsive": true, "gridColumns": 24}', '00000000-0000-0000-0000-000000000001', '2025-12-29 20:14:59.539225', '2025-12-29 20:14:59.539225', 'analysis', '["ADMIN"]', true, 24, 80, '{GENERAL_MANAGER}');
INSERT INTO public.designs VALUES ('bfdda8d5-dcbe-4fb8-aac4-c708ddad0d52', '00000000-0000-0000-0000-000000000001', 'Yeni Tasarım', NULL, false, '{"widgets": [{"h": 4, "w": 7, "x": 0, "y": 0, "id": "widget-1767006509431", "minH": 4, "minW": 6, "type": "gauge", "label": "Grafik", "metricId": "6a69f5ba-689e-488c-8192-45c1a3c883d4", "metricName": "GÖSTEGE"}, {"h": 4, "w": 7, "x": 7, "y": 0, "id": "widget-1767006509805", "minH": 4, "minW": 6, "type": "sparkline", "label": "Grafik", "metricId": "4f01b9fb-8e3a-4737-947a-f25c0e704bd7", "metricName": "TREND"}]}', '{"responsive": true, "gridColumns": 24}', '00000000-0000-0000-0000-000000000001', '2025-12-29 11:09:21.600691', '2025-12-29 11:34:55.837279', 'analysis', '["ADMIN"]', true, 24, 80, '{GENERAL_MANAGER}');
INSERT INTO public.designs VALUES ('53dfb49f-7f47-41b6-afec-3ce7f806cd67', '00000000-0000-0000-0000-000000000001', 'alkan1', NULL, false, '{"widgets": [{"h": 4, "w": 7, "x": 0, "y": 0, "id": "widget-1767019512314", "minH": 3, "minW": 4, "type": "card", "label": "satış", "metricId": "41cfb803-b5dc-4f98-9c14-20aa404a72e9", "metricName": "alkan"}, {"h": 8, "w": 12, "x": 0, "y": 4, "id": "widget-1767019715007", "minH": 5, "minW": 8, "type": "grid", "label": "list", "metricId": "c7c39690-e66f-4db0-99a6-0d383ac1d3c4", "metricName": "list"}]}', '{"responsive": true, "gridColumns": 24}', '00000000-0000-0000-0000-000000000001', '2025-12-29 14:45:40.785787', '2025-12-29 14:48:49.729511', 'analysis', '["ADMIN"]', true, 24, 80, '{GENERAL_MANAGER}');


--
-- Data for Name: etl_jobs; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.etl_jobs VALUES ('0d807903-233c-468a-aa21-1ee798060e5c', '00000000-0000-0000-0000-000000000001', '5165f56a-0984-49ec-8281-48dfc359116b', 'initial_sync', 'completed', '2025-12-28 21:41:34.392429', '2025-12-28 21:41:34.811105', 39, NULL, '2025-12-28 21:41:34.392429', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('6b83d23a-3b24-4698-b445-cd2019bce900', '00000000-0000-0000-0000-000000000001', '06470d77-2cf2-4987-9b5b-b2cea980c12a', 'manual_sync', 'completed', '2025-12-21 18:17:17.353128', '2025-12-21 18:17:53.293217', 9009725, NULL, '2025-12-21 18:17:15.935822', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('4a17d29e-2d3f-4b63-80f7-19dffb2681ac', '00000000-0000-0000-0000-000000000001', '06470d77-2cf2-4987-9b5b-b2cea980c12a', 'manual_sync', 'completed', '2025-12-20 16:53:36.088465', '2025-12-20 16:53:36.820301', 100000, NULL, '2025-12-20 16:53:36.088465', '00000000-0000-0000-0000-000000000001', 0, NULL, 100000, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('0659d2ec-ba8a-4972-b492-5101a0739d71', '00000000-0000-0000-0000-000000000001', '5d3356b2-59af-4c35-a773-609eceba314a', 'manual_sync', 'completed', '2025-12-28 21:01:21.80028', '2025-12-28 21:01:22.208895', 40321, NULL, '2025-12-28 21:01:21.776212', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('0725bcc1-648c-4b47-8688-933417754d8d', '00000000-0000-0000-0000-000000000001', '06470d77-2cf2-4987-9b5b-b2cea980c12a', 'manual_sync', 'completed', '2025-12-20 16:53:36.920369', '2025-12-20 16:53:37.514066', 100000, NULL, '2025-12-20 16:53:36.920369', '00000000-0000-0000-0000-000000000001', 0, NULL, 100000, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('4f1e1203-fa12-475f-95d6-e88acf5b76ba', '00000000-0000-0000-0000-000000000001', '5f0b1b9e-dd11-43cf-ba74-272f1882777c', 'initial_sync', 'completed', '2025-12-28 21:42:23.89623', '2025-12-28 21:42:25.439464', 25, NULL, '2025-12-28 21:42:23.89623', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('8795e827-afb5-4e9e-ac60-f338cf2d5b6e', '00000000-0000-0000-0000-000000000001', '06470d77-2cf2-4987-9b5b-b2cea980c12a', 'initial_sync', 'failed', '2025-12-20 14:42:36.141145', '2025-12-20 15:32:56.379857', 0, 'ETL Worker restarted', '2025-12-20 14:42:36.141145', '00000000-0000-0000-0000-000000000001', 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('bee3da2f-5e58-4743-bbf9-669034644ffa', '00000000-0000-0000-0000-000000000001', '2d4f4bb7-0183-442b-bbf7-314b109db01c', 'initial_sync', 'completed', '2025-12-28 21:42:42.205875', '2025-12-28 21:42:42.605426', 7, NULL, '2025-12-28 21:42:42.205875', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('d6e08b59-e771-417c-89dc-12e3c03f78ac', '00000000-0000-0000-0000-000000000001', '06470d77-2cf2-4987-9b5b-b2cea980c12a', 'manual_sync', 'completed', '2025-12-21 15:36:10.595429', '2025-12-21 15:37:22.420093', 9009725, NULL, '2025-12-21 15:36:10.595429', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('50a95cdf-3933-40dd-b322-9528c529c45b', '00000000-0000-0000-0000-000000000001', 'f65d82ec-ae3b-4040-82d4-418ae51b30d2', 'scheduled_sync', 'completed', '2025-12-21 15:54:03.295781', '2025-12-21 15:54:04.632875', 1, NULL, '2025-12-21 15:54:03.295781', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('271d50ac-6b6b-4ecb-9913-57c3d3d58b0c', '00000000-0000-0000-0000-000000000001', '9555e13e-a703-4870-8d5f-d1010bf7b1b3', 'initial_sync', 'completed', '2025-12-28 21:43:33.51734', '2025-12-28 21:43:33.958125', 100, NULL, '2025-12-28 21:43:33.51734', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('4fb68cf6-9d1f-4bf1-a9a4-190b862e72fe', '00000000-0000-0000-0000-000000000001', 'f65d82ec-ae3b-4040-82d4-418ae51b30d2', 'scheduled_sync', 'completed', '2025-12-21 16:12:03.331291', '2025-12-21 16:12:04.099898', 1, NULL, '2025-12-21 16:12:03.331291', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('4e196a2e-0dc2-4537-b315-b19228109d01', '00000000-0000-0000-0000-000000000001', '333e7668-7b60-4028-a594-9b226e968932', 'initial_sync', 'completed', '2025-12-29 14:39:59.203542', '2025-12-29 14:40:05.461191', 1000000, NULL, '2025-12-29 14:39:59.203542', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('265ac434-45c3-49a3-be3c-85791e40a413', '00000000-0000-0000-0000-000000000001', 'f65d82ec-ae3b-4040-82d4-418ae51b30d2', 'manual_sync', 'completed', '2025-12-21 19:40:53.832045', '2025-12-21 19:40:54.72383', 1, NULL, '2025-12-21 19:40:47.088434', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('516da09b-7f26-4ddc-be60-fcc04d60c137', '00000000-0000-0000-0000-000000000001', 'f65d82ec-ae3b-4040-82d4-418ae51b30d2', 'manual_sync', 'completed', '2025-12-21 17:10:10.424015', '2025-12-21 17:10:11.091338', 1, NULL, '2025-12-21 16:59:30.894439', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('3b717885-2c7e-4476-a361-23d3788093ac', '00000000-0000-0000-0000-000000000001', '06470d77-2cf2-4987-9b5b-b2cea980c12a', 'manual_sync', 'completed', '2025-12-21 19:40:54.729714', '2025-12-21 19:41:23.951969', 9009725, 'Aynı dataset için zaten çalışan bir job var (duplicate prevention)', '2025-12-21 19:40:47.088434', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('058a2c6c-86e5-4360-a3b7-bc3c8f0fff8c', '00000000-0000-0000-0000-000000000001', '06470d77-2cf2-4987-9b5b-b2cea980c12a', 'manual_sync', 'cancelled', '2025-12-21 17:10:12.239725', '2025-12-21 17:13:12.181137', 0, 'Worker crash - otomatik iptal edildi', '2025-12-21 16:59:30.894439', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('19a0d938-5528-435b-b4e8-7088d1275a7c', '00000000-0000-0000-0000-000000000001', '06470d77-2cf2-4987-9b5b-b2cea980c12a', 'manual_sync', 'cancelled', '2025-12-21 17:10:37.29198', '2025-12-21 17:13:12.181137', 0, 'Worker crash - otomatik iptal edildi', '2025-12-21 17:09:24.125752', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('ddf8bb25-f6c7-4c06-b884-38876f7ca97b', '00000000-0000-0000-0000-000000000001', 'f65d82ec-ae3b-4040-82d4-418ae51b30d2', 'manual_sync', 'cancelled', '2025-12-21 17:10:27.720479', '2025-12-21 17:13:12.181137', 0, 'Worker crash - otomatik iptal edildi', '2025-12-21 17:09:24.125752', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('df3f3a68-679c-4b72-97c6-1b17df0a18ca', '00000000-0000-0000-0000-000000000001', '06470d77-2cf2-4987-9b5b-b2cea980c12a', 'manual_sync', 'cancelled', '2025-12-20 15:42:30.454832', '2025-12-20 15:45:06.4476', 0, 'Cancelled - row limit too high', '2025-12-20 15:42:30.454832', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('60830920-0a6d-4418-aef2-2f827fc4862b', '00000000-0000-0000-0000-000000000001', '06470d77-2cf2-4987-9b5b-b2cea980c12a', 'manual_sync', 'failed', '2025-12-20 15:45:57.129044', '2025-12-20 15:45:57.782012', 100000, 'column "total_rows" does not exist', '2025-12-20 15:45:57.129044', NULL, 1, '{"stack": "Error: column \"total_rows\" does not exist\n    at Object.query (/Users/cihanadar/Downloads/clixer/shared/dist/db.js:74:15)\n    at processTicksAndRejections (node:internal/process/task_queues:105:5)\n    at processETLJob (/Users/cihanadar/Downloads/clixer/services/etl-worker/src/index.ts:197:7)\n    at /Users/cihanadar/Downloads/clixer/services/etl-worker/src/index.ts:760:9"}', 100000, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('8e730e9b-2a1d-408f-a102-5da43470e387', '00000000-0000-0000-0000-000000000001', '06470d77-2cf2-4987-9b5b-b2cea980c12a', 'incremental_sync', 'completed', '2025-12-20 18:02:13.307907', '2025-12-20 18:02:14.150343', 100000, NULL, '2025-12-20 18:02:13.307907', '00000000-0000-0000-0000-000000000001', 0, NULL, 100000, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('8610b870-45ed-43c6-bd3c-b8fd8b247eb5', '00000000-0000-0000-0000-000000000001', 'f65d82ec-ae3b-4040-82d4-418ae51b30d2', 'scheduled_sync', 'completed', '2025-12-21 15:56:03.289635', '2025-12-21 15:56:04.133281', 1, NULL, '2025-12-21 15:56:03.289635', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('901ebd53-db18-4b72-becc-d0ea1cb8d117', '00000000-0000-0000-0000-000000000001', '06470d77-2cf2-4987-9b5b-b2cea980c12a', 'manual_sync', 'cancelled', '2025-12-21 17:51:11.69512', '2025-12-21 17:54:09.713334', 0, 'Kullanıcı tarafından iptal edildi', '2025-12-21 17:51:09.096449', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('fe4ba398-e81b-4880-a9fe-42b365748b7a', '00000000-0000-0000-0000-000000000001', '5d3356b2-59af-4c35-a773-609eceba314a', 'manual_sync', 'completed', '2025-12-28 21:12:09.745724', '2025-12-28 21:12:10.025906', 21693, NULL, '2025-12-28 21:12:09.72013', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('1d3eb8e6-5f13-4ea5-a959-e702c22aed80', '00000000-0000-0000-0000-000000000001', '5165f56a-0984-49ec-8281-48dfc359116b', 'manual_sync', 'completed', '2025-12-28 21:41:49.076485', '2025-12-28 21:41:49.669871', 39, NULL, '2025-12-28 21:41:49.052642', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('d9be3c47-b484-471f-90d5-f94d725aab5b', '00000000-0000-0000-0000-000000000001', 'f65d82ec-ae3b-4040-82d4-418ae51b30d2', 'scheduled_sync', 'completed', '2025-12-21 16:14:03.351312', '2025-12-21 16:14:05.172228', 1, NULL, '2025-12-21 16:14:03.351312', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('d964adbf-878a-4603-b8f4-5086dcea7929', '00000000-0000-0000-0000-000000000001', '06470d77-2cf2-4987-9b5b-b2cea980c12a', 'manual_sync', 'cancelled', '2025-12-21 18:06:50.95946', NULL, 0, 'Yeniden başlatma için iptal', '2025-12-21 18:06:50.95946', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('28faa5a3-05d1-4ad7-aa6a-c08bd8f884de', '00000000-0000-0000-0000-000000000001', '06470d77-2cf2-4987-9b5b-b2cea980c12a', 'manual_sync', 'cancelled', '2025-12-21 19:21:40.055348', '2025-12-21 19:22:13.743303', 0, 'Admin tarafından toplu iptal edildi', '2025-12-21 19:21:40.055348', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('002d14e2-30af-46f7-9193-833fb0cb8cac', '00000000-0000-0000-0000-000000000001', '06470d77-2cf2-4987-9b5b-b2cea980c12a', 'manual_sync', 'completed', '2025-12-21 19:32:09.174056', '2025-12-21 19:33:00.54796', 9009725, NULL, '2025-12-21 19:32:05.198051', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('11c21edb-d384-4d64-bf96-d789cb84b6db', '00000000-0000-0000-0000-000000000001', '333e7668-7b60-4028-a594-9b226e968932', 'manual_sync', 'completed', '2025-12-29 14:41:13.715691', '2025-12-29 14:41:20.042247', 1000000, NULL, '2025-12-29 14:41:13.700047', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('39b0ebc2-c053-40b5-9d01-f355d8bb40c0', '00000000-0000-0000-0000-000000000001', '06470d77-2cf2-4987-9b5b-b2cea980c12a', 'manual_sync', 'completed', '2025-12-21 19:41:22.51672', '2025-12-21 19:42:07.894362', 9009725, 'Kullanıcı tarafından iptal edildi', '2025-12-21 19:41:22.51672', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('f98e8186-07ed-40d6-b080-45879f4888d4', '00000000-0000-0000-0000-000000000001', '06470d77-2cf2-4987-9b5b-b2cea980c12a', 'manual_sync', 'completed', '2025-12-21 20:16:12.73488', '2025-12-21 20:16:41.875215', 9009725, 'Aynı dataset için zaten çalışan bir job var (duplicate prevention)', '2025-12-21 20:16:05.09369', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('7ceed2a5-a9e7-4c4b-983b-c0fbb3a35f9e', '00000000-0000-0000-0000-000000000001', '06470d77-2cf2-4987-9b5b-b2cea980c12a', 'manual_sync', 'completed', '2025-12-21 20:20:49.996303', '2025-12-21 20:21:34.156717', 9009725, 'Kullanıcı tarafından iptal edildi', '2025-12-21 20:20:49.996303', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('a252f703-07b4-4e9b-bd55-abf819fad337', '00000000-0000-0000-0000-000000000001', '06470d77-2cf2-4987-9b5b-b2cea980c12a', 'manual_sync', 'completed', '2025-12-21 14:25:28.177635', '2025-12-21 14:26:42.257307', 9009725, NULL, '2025-12-21 14:25:28.177635', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('c76fa142-c3ec-4e10-9854-66a177be25cd', '00000000-0000-0000-0000-000000000001', 'f65d82ec-ae3b-4040-82d4-418ae51b30d2', 'scheduled_sync', 'completed', '2025-12-21 15:58:03.211821', '2025-12-21 15:58:03.988736', 1, NULL, '2025-12-21 15:58:03.211821', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('5f5c22dc-c885-4b06-a999-4bc720d035da', '00000000-0000-0000-0000-000000000001', '06470d77-2cf2-4987-9b5b-b2cea980c12a', 'manual_sync', 'cancelled', '2025-12-21 17:51:09.13271', '2025-12-21 17:51:17.253135', 0, 'Kullanıcı tarafından iptal edildi', '2025-12-21 17:51:09.13271', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('24110f4f-e657-4570-8ecb-0a2d6acd8daf', '00000000-0000-0000-0000-000000000001', '333e7668-7b60-4028-a594-9b226e968932', 'manual_sync', 'completed', '2025-12-29 14:40:55.188876', '2025-12-29 14:40:56.005191', 100000, NULL, '2025-12-29 14:40:55.168737', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('4ef015a0-90a0-4976-90e6-bb73546c9e9a', '00000000-0000-0000-0000-000000000001', 'f65d82ec-ae3b-4040-82d4-418ae51b30d2', 'scheduled_sync', 'completed', '2025-12-21 16:16:03.346247', '2025-12-21 16:16:04.146274', 1, NULL, '2025-12-21 16:16:03.346247', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('aac2e643-8369-4813-9b74-522fc9e3c631', '00000000-0000-0000-0000-000000000001', 'f65d82ec-ae3b-4040-82d4-418ae51b30d2', 'manual_sync', 'completed', '2025-12-28 20:18:13.648426', '2025-12-28 20:18:14.718892', 1, NULL, '2025-12-28 20:18:13.648426', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('0f209078-9a33-4293-830c-b95c319a76e1', '00000000-0000-0000-0000-000000000001', '06470d77-2cf2-4987-9b5b-b2cea980c12a', 'manual_sync', 'cancelled', '2025-12-21 18:09:47.112884', '2025-12-21 18:09:49.966437', 0, 'Aynı dataset için zaten çalışan bir job var (duplicate prevention)', '2025-12-21 18:09:47.112884', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('5b6f14f6-2a73-46c3-b428-ddcd7931d63e', '00000000-0000-0000-0000-000000000001', '06470d77-2cf2-4987-9b5b-b2cea980c12a', 'manual_sync', 'completed', '2025-12-28 20:44:37.179975', '2025-12-28 20:45:21.512009', 9009725, NULL, '2025-12-28 20:44:37.159474', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('69b5d358-876d-42ff-8578-2351e78f91bf', '00000000-0000-0000-0000-000000000001', '06470d77-2cf2-4987-9b5b-b2cea980c12a', 'manual_sync', 'completed', '2025-12-21 19:32:05.218819', '2025-12-21 19:32:55.769009', 9009725, 'Kullanıcı tarafından iptal edildi', '2025-12-21 19:32:05.218819', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('9afbfa81-008d-4b48-aa98-c73c17dfd090', '00000000-0000-0000-0000-000000000001', '5d3356b2-59af-4c35-a773-609eceba314a', 'manual_sync', 'completed', '2025-12-28 21:13:39.753552', '2025-12-28 21:13:40.141457', 50000, NULL, '2025-12-28 21:13:39.731631', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('68f997f0-29f2-490d-aef2-a8e93f220f26', '00000000-0000-0000-0000-000000000001', '06470d77-2cf2-4987-9b5b-b2cea980c12a', 'full_sync', 'cancelled', '2025-12-20 21:41:29.947419', NULL, 0, 'Büyük veri için streaming gerekli', '2025-12-20 21:41:29.947419', NULL, 0, NULL, 0, 0, 0, '2025-12-21 00:41:29.948');
INSERT INTO public.etl_jobs VALUES ('66cd3572-a16b-4ee4-a0e6-14947fd0bda8', '00000000-0000-0000-0000-000000000001', '9555e13e-a703-4870-8d5f-d1010bf7b1b3', 'manual_sync', 'completed', '2025-12-28 21:43:39.672998', '2025-12-28 21:43:40.082346', 100, NULL, '2025-12-28 21:43:39.654333', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('760841e4-1171-49ff-86a8-f86f3668bc48', '00000000-0000-0000-0000-000000000001', '06470d77-2cf2-4987-9b5b-b2cea980c12a', 'full_sync', 'failed', '2025-12-20 22:00:10.308682', '2025-12-20 22:00:17.875798', 0, 'ClickHouse: (total) memory limit exceeded: would use 6.90 GiB (attempt to allocate chunk of 5.68 MiB), current RSS: 2.08 GiB, maximum: 6.89 GiB. OvercommitTracker decision: Query was selected to stop by OvercommitTracker: While executing ParallelParsingBlockInputFormat. ', '2025-12-20 22:00:10.308682', NULL, 1, '{"stack": "Error: ClickHouse: (total) memory limit exceeded: would use 6.90 GiB (attempt to allocate chunk of 5.68 MiB), current RSS: 2.08 GiB, maximum: 6.89 GiB. OvercommitTracker decision: Query was selected to stop by OvercommitTracker: While executing ParallelParsingBlockInputFormat. \n    at Object.insert (/Users/cihanadar/Downloads/clixer/shared/dist/clickhouse.js:85:15)\n    at processTicksAndRejections (node:internal/process/task_queues:105:5)\n    at insertToClickHouse (/Users/cihanadar/Downloads/clixer/services/etl-worker/src/index.ts:1026:7)\n    at fullRefreshPaginated (/Users/cihanadar/Downloads/clixer/services/etl-worker/src/index.ts:464:7)\n    at fullRefresh (/Users/cihanadar/Downloads/clixer/services/etl-worker/src/index.ts:369:14)\n    at processETLJob (/Users/cihanadar/Downloads/clixer/services/etl-worker/src/index.ts:186:18)\n    at /Users/cihanadar/Downloads/clixer/services/etl-worker/src/index.ts:1414:9"}', 0, 0, 0, '2025-12-21 01:00:10.309');
INSERT INTO public.etl_jobs VALUES ('52fc393e-0692-491c-b8bb-624276bf91eb', '00000000-0000-0000-0000-000000000001', '825012b4-55e3-4108-a34b-97bc2c466055', 'initial_sync', 'completed', '2025-12-29 17:57:26.457938', '2025-12-29 17:57:31.841969', 1000000, NULL, '2025-12-29 17:57:26.457938', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('f2120e78-7164-4686-abe5-071acef0fbf7', '00000000-0000-0000-0000-000000000001', '06470d77-2cf2-4987-9b5b-b2cea980c12a', 'full_sync', 'completed', '2025-12-20 22:05:24.559707', '2025-12-20 22:07:23.321046', 9009725, NULL, '2025-12-20 22:05:24.559707', NULL, 0, NULL, 9009725, 0, 0, '2025-12-21 01:05:24.558');
INSERT INTO public.etl_jobs VALUES ('b04d2719-277b-4370-ae78-5d1d122c84b2', '00000000-0000-0000-0000-000000000001', '06470d77-2cf2-4987-9b5b-b2cea980c12a', 'incremental_sync', 'completed', '2025-12-20 22:05:23.722844', '2025-12-20 22:07:23.321217', 9009725, NULL, '2025-12-20 22:05:23.722844', NULL, 0, NULL, 9009725, 0, 0, '2025-12-21 00:33:15.3');
INSERT INTO public.etl_jobs VALUES ('ba735549-e1fe-497d-a8c8-6bb6dca4f14b', '00000000-0000-0000-0000-000000000001', '825012b4-55e3-4108-a34b-97bc2c466055', 'incremental_sync', 'completed', '2025-12-29 17:58:54.975571', '2025-12-29 17:58:55.275939', 0, NULL, '2025-12-29 17:58:54.975571', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('d6f785d5-a06f-4cc6-b48b-ddc6b4d33c35', '00000000-0000-0000-0000-000000000001', '06470d77-2cf2-4987-9b5b-b2cea980c12a', 'manual_sync', 'completed', '2025-12-21 20:20:52.805821', '2025-12-21 20:21:37.153449', 9009725, NULL, '2025-12-21 20:20:49.98611', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('34f9e847-230f-4022-8b95-47b897c9a147', '00000000-0000-0000-0000-000000000001', 'f65d82ec-ae3b-4040-82d4-418ae51b30d2', 'manual_sync', 'completed', '2025-12-21 17:13:58.707589', '2025-12-21 17:13:59.81326', 1, NULL, '2025-12-21 17:13:58.707589', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('78c18e52-92ce-46fb-89e8-608350cde190', '00000000-0000-0000-0000-000000000001', 'f65d82ec-ae3b-4040-82d4-418ae51b30d2', 'manual_sync', 'completed', '2025-12-21 17:14:03.928841', '2025-12-21 17:14:05.731718', 1, NULL, '2025-12-21 17:14:03.928841', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('444a80d1-a483-4495-a385-c8e98cb4debc', '00000000-0000-0000-0000-000000000001', 'f65d82ec-ae3b-4040-82d4-418ae51b30d2', 'scheduled_sync', 'completed', '2025-12-21 16:00:03.303087', '2025-12-21 16:00:04.142903', 1, NULL, '2025-12-21 16:00:03.303087', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('86ef27e5-1a22-4b3b-9310-001b0a57f0e4', '00000000-0000-0000-0000-000000000001', 'f65d82ec-ae3b-4040-82d4-418ae51b30d2', 'scheduled_sync', 'completed', '2025-12-21 16:18:03.334552', '2025-12-21 16:18:04.128963', 1, NULL, '2025-12-21 16:18:03.334552', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('b24cda71-8c85-47a2-953f-79b0287ef1a1', '00000000-0000-0000-0000-000000000001', '06470d77-2cf2-4987-9b5b-b2cea980c12a', 'manual_sync', 'completed', '2025-12-21 16:57:45.576638', '2025-12-21 16:58:56.406374', 9009725, NULL, '2025-12-21 16:57:45.576638', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('536a6dc2-eef0-44bd-bdd7-bc627253d7aa', '00000000-0000-0000-0000-000000000001', 'f65d82ec-ae3b-4040-82d4-418ae51b30d2', 'manual_sync', 'cancelled', '2025-12-21 17:54:17.376036', '2025-12-21 17:58:59.271921', 0, 'ETL Worker yeniden başlatıldı - önceki bekleyen job iptal edildi', '2025-12-21 17:54:17.376036', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('e3aedd1a-05db-4df1-89c4-6f3941b08a6f', '00000000-0000-0000-0000-000000000001', '06470d77-2cf2-4987-9b5b-b2cea980c12a', 'manual_sync', 'cancelled', '2025-12-21 17:54:17.376036', '2025-12-21 17:58:59.271921', 0, 'ETL Worker yeniden başlatıldı - önceki bekleyen job iptal edildi', '2025-12-21 17:54:17.376036', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('a44f5ae3-b124-4e22-9381-e208f3eddc8f', '00000000-0000-0000-0000-000000000001', '06470d77-2cf2-4987-9b5b-b2cea980c12a', 'full_sync', 'cancelled', '2025-12-20 21:33:51.924141', NULL, 0, 'source_query eksikti', '2025-12-20 21:33:51.924141', NULL, 0, NULL, 0, 0, 0, '2025-12-21 00:33:51.924');
INSERT INTO public.etl_jobs VALUES ('94d15843-f435-4a14-a292-69f38f081022', '00000000-0000-0000-0000-000000000001', '06470d77-2cf2-4987-9b5b-b2cea980c12a', 'manual_sync', 'cancelled', '2025-12-21 18:10:29.978808', NULL, 0, NULL, '2025-12-21 18:10:27.370136', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('95835f39-568c-40b0-bd7e-c7ea1bb7df79', '00000000-0000-0000-0000-000000000001', '06470d77-2cf2-4987-9b5b-b2cea980c12a', 'full_sync', 'failed', '2025-12-20 22:02:11.192092', '2025-12-20 22:02:11.323405', 0, 'ClickHouse: default: Authentication failed: password is incorrect, or there is no user with such name.

If you use ClickHouse Cloud, the password can be reset at https://clickhouse.cloud/
on the settings page for the corresponding service.

If you have installed ClickHouse and forgot password you can reset it in the configuration file.
The password for default user is typically located at /etc/clickhouse-server/users.d/default-password.xml
and deleting this file will reset the password.
See also /etc/clickhouse-server/users.xml on the server where ClickHouse is installed.

. ', '2025-12-20 22:02:11.192092', NULL, 1, '{"stack": "Error: ClickHouse: default: Authentication failed: password is incorrect, or there is no user with such name.\n\nIf you use ClickHouse Cloud, the password can be reset at https://clickhouse.cloud/\non the settings page for the corresponding service.\n\nIf you have installed ClickHouse and forgot password you can reset it in the configuration file.\nThe password for default user is typically located at /etc/clickhouse-server/users.d/default-password.xml\nand deleting this file will reset the password.\nSee also /etc/clickhouse-server/users.xml on the server where ClickHouse is installed.\n\n. \n    at Object.execute (/Users/cihanadar/Downloads/clixer/shared/dist/clickhouse.js:99:15)\n    at processTicksAndRejections (node:internal/process/task_queues:105:5)\n    at fullRefresh (/Users/cihanadar/Downloads/clixer/services/etl-worker/src/index.ts:362:5)\n    at processETLJob (/Users/cihanadar/Downloads/clixer/services/etl-worker/src/index.ts:186:18)\n    at /Users/cihanadar/Downloads/clixer/services/etl-worker/src/index.ts:1414:9"}', 0, 0, 0, '2025-12-21 01:02:11.193');
INSERT INTO public.etl_jobs VALUES ('c3e5e122-4851-49f4-99ed-cc1b2d2cf8b8', '00000000-0000-0000-0000-000000000001', '6a8bf546-2a91-4fdb-83f7-f2c9b2223419', 'initial_sync', 'completed', '2025-12-29 20:11:16.33714', '2025-12-29 20:11:21.753272', 1000000, NULL, '2025-12-29 20:11:16.33714', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('fdf3ffaa-8f21-4f0d-b6b8-b5a90cc4e3be', '00000000-0000-0000-0000-000000000001', '06470d77-2cf2-4987-9b5b-b2cea980c12a', 'manual_sync', 'completed', '2025-12-21 19:31:00.254102', '2025-12-21 19:31:30.54154', 9009725, 'Aynı dataset için zaten çalışan bir job var (duplicate prevention)', '2025-12-21 19:30:57.209424', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('61f89421-072e-4650-82bb-2f6f19d389c3', '00000000-0000-0000-0000-000000000001', 'f65d82ec-ae3b-4040-82d4-418ae51b30d2', 'manual_sync', 'skipped', '2025-12-21 19:31:01.534908', '2025-12-21 19:31:30.744515', 1, 'Aynı dataset için zaten çalışan bir job var (duplicate prevention)', '2025-12-21 19:30:57.209424', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('ba92c1bb-a829-4cbb-a425-573ad869ba6e', '00000000-0000-0000-0000-000000000001', '5d3356b2-59af-4c35-a773-609eceba314a', 'initial_sync', 'completed', '2025-12-28 20:48:36.836313', '2025-12-28 20:48:36.867867', 10, NULL, '2025-12-28 20:48:36.836313', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('02602984-909f-46b9-b26e-83041cf24d1c', '00000000-0000-0000-0000-000000000001', '06470d77-2cf2-4987-9b5b-b2cea980c12a', 'manual_sync', 'completed', '2025-12-21 19:32:05.218832', '2025-12-21 19:32:41.900588', 9009725, 'Kullanıcı tarafından iptal edildi', '2025-12-21 19:32:05.218832', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('543d7920-ac41-4de0-9596-ccd85be69e06', '00000000-0000-0000-0000-000000000001', 'f65d82ec-ae3b-4040-82d4-418ae51b30d2', 'manual_sync', 'completed', '2025-12-21 20:16:11.779304', '2025-12-21 20:16:12.715917', 1, NULL, '2025-12-21 20:16:05.09369', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('7528a3dc-2782-4b9b-9b4a-370edf9971b4', '00000000-0000-0000-0000-000000000001', 'f65d82ec-ae3b-4040-82d4-418ae51b30d2', 'manual_sync', 'cancelled', '2025-12-21 19:33:48.410683', '2025-12-21 19:34:04.565581', 0, 'Kullanıcı tarafından iptal edildi', '2025-12-21 19:33:48.410683', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('36427b9f-b55e-45a3-9012-a37731be2f6d', '00000000-0000-0000-0000-000000000001', '06470d77-2cf2-4987-9b5b-b2cea980c12a', 'manual_sync', 'cancelled', '2025-12-21 17:14:03.927968', '2025-12-21 17:50:58.692275', 0, 'Kullanıcı tarafından iptal edildi', '2025-12-21 17:14:03.927968', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('f9be2bc4-9c5c-4090-8a5d-76b85201101b', '00000000-0000-0000-0000-000000000001', '06470d77-2cf2-4987-9b5b-b2cea980c12a', 'manual_sync', 'cancelled', '2025-12-21 17:13:58.707821', '2025-12-21 17:51:02.306328', 0, 'Kullanıcı tarafından iptal edildi', '2025-12-21 17:13:58.707821', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('d0532473-3b87-410a-b41d-fff3ba7a976a', '00000000-0000-0000-0000-000000000001', 'f65d82ec-ae3b-4040-82d4-418ae51b30d2', 'scheduled_sync', 'completed', '2025-12-21 16:02:03.310072', '2025-12-21 16:02:04.219401', 1, NULL, '2025-12-21 16:02:03.310072', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('70a883d1-9943-4fa1-aa45-184925351405', '00000000-0000-0000-0000-000000000001', 'f65d82ec-ae3b-4040-82d4-418ae51b30d2', 'scheduled_sync', 'completed', '2025-12-21 16:20:03.347964', '2025-12-21 16:20:04.219434', 1, NULL, '2025-12-21 16:20:03.347964', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('438c3827-344e-40bd-b175-8e83f7388b8c', '00000000-0000-0000-0000-000000000001', 'f65d82ec-ae3b-4040-82d4-418ae51b30d2', 'manual_sync', 'completed', '2025-12-21 16:57:45.576771', '2025-12-21 16:57:48.071952', 1, NULL, '2025-12-21 16:57:45.576771', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('f4559af1-e277-4d9b-b2fe-207fd5c55996', '00000000-0000-0000-0000-000000000001', 'f65d82ec-ae3b-4040-82d4-418ae51b30d2', 'manual_sync', 'cancelled', '2025-12-21 17:54:46.044436', '2025-12-21 17:58:59.271921', 0, 'ETL Worker yeniden başlatıldı - önceki bekleyen job iptal edildi', '2025-12-21 17:54:46.044436', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('74567ef6-d7ff-47b2-9cdc-9bc756696d1d', '00000000-0000-0000-0000-000000000001', '06470d77-2cf2-4987-9b5b-b2cea980c12a', 'manual_sync', 'cancelled', '2025-12-21 17:54:46.044436', '2025-12-21 17:58:59.271921', 0, 'ETL Worker yeniden başlatıldı - önceki bekleyen job iptal edildi', '2025-12-21 17:54:46.044436', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('5434a20f-7972-4fa4-9f09-7d1138b93607', '00000000-0000-0000-0000-000000000001', '06470d77-2cf2-4987-9b5b-b2cea980c12a', 'manual_sync', 'completed', '2025-12-21 18:11:56.933323', '2025-12-21 18:11:57.535874', 100000, NULL, '2025-12-21 18:11:55.477306', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('a2b5b599-568a-4e0f-8cda-2ea7a63cb9c5', '00000000-0000-0000-0000-000000000001', '06470d77-2cf2-4987-9b5b-b2cea980c12a', 'full_sync', 'cancelled', '2025-12-20 21:36:58.858118', NULL, 0, 'Bellek optimizasyonu için iptal', '2025-12-20 21:36:58.858118', NULL, 0, NULL, 0, 0, 0, '2025-12-21 00:36:58.858');
INSERT INTO public.etl_jobs VALUES ('3a9f34cb-3c3c-414c-9014-c95a7c9be10b', '00000000-0000-0000-0000-000000000001', '06470d77-2cf2-4987-9b5b-b2cea980c12a', 'incremental_sync', 'failed', '2025-12-20 21:54:15.915542', '2025-12-20 21:54:15.928746', 0, 'SourceDB: Sorgu hatası: syntax error at or near "SELECT"', '2025-12-20 21:54:15.915542', NULL, 1, '{"stack": "Error: SourceDB: Sorgu hatası: syntax error at or near \"SELECT\"\n    at PostgreSQLConnector.executeQuery (/Users/cihanadar/Downloads/clixer/shared/dist/sourceConnector.js:193:19)\n    at processTicksAndRejections (node:internal/process/task_queues:105:5)\n    at fullRefresh (/Users/cihanadar/Downloads/clixer/services/etl-worker/src/index.ts:343:25)\n    at processETLJob (/Users/cihanadar/Downloads/clixer/services/etl-worker/src/index.ts:186:18)\n    at checkScheduledJobs (/Users/cihanadar/Downloads/clixer/services/etl-worker/src/index.ts:1194:9)\n    at Timeout._onTimeout (/Users/cihanadar/Downloads/clixer/services/etl-worker/src/index.ts:1368:5)"}', 0, 0, 0, '2025-12-21 00:33:15.3');
INSERT INTO public.etl_jobs VALUES ('81fe10ff-c3b6-4acc-8f26-1b30564b2982', '00000000-0000-0000-0000-000000000001', '06470d77-2cf2-4987-9b5b-b2cea980c12a', 'full_sync', 'failed', '2025-12-20 21:54:18.335148', '2025-12-20 21:54:18.341394', 0, 'SourceDB: Sorgu hatası: syntax error at or near "SELECT"', '2025-12-20 21:54:18.335148', NULL, 1, '{"stack": "Error: SourceDB: Sorgu hatası: syntax error at or near \"SELECT\"\n    at PostgreSQLConnector.executeQuery (/Users/cihanadar/Downloads/clixer/shared/dist/sourceConnector.js:193:19)\n    at processTicksAndRejections (node:internal/process/task_queues:105:5)\n    at fullRefresh (/Users/cihanadar/Downloads/clixer/services/etl-worker/src/index.ts:343:25)\n    at processETLJob (/Users/cihanadar/Downloads/clixer/services/etl-worker/src/index.ts:186:18)\n    at /Users/cihanadar/Downloads/clixer/services/etl-worker/src/index.ts:1414:9"}', 0, 0, 0, '2025-12-21 00:54:18.335');
INSERT INTO public.etl_jobs VALUES ('906ddef0-e7af-450e-83d2-9d7f3a124351', '00000000-0000-0000-0000-000000000001', '06470d77-2cf2-4987-9b5b-b2cea980c12a', 'incremental_sync', 'failed', '2025-12-20 22:02:10.798759', '2025-12-20 22:02:11.227867', 0, 'ClickHouse: default: Authentication failed: password is incorrect, or there is no user with such name.

If you use ClickHouse Cloud, the password can be reset at https://clickhouse.cloud/
on the settings page for the corresponding service.

If you have installed ClickHouse and forgot password you can reset it in the configuration file.
The password for default user is typically located at /etc/clickhouse-server/users.d/default-password.xml
and deleting this file will reset the password.
See also /etc/clickhouse-server/users.xml on the server where ClickHouse is installed.

. ', '2025-12-20 22:02:10.798759', NULL, 1, '{"stack": "Error: ClickHouse: default: Authentication failed: password is incorrect, or there is no user with such name.\n\nIf you use ClickHouse Cloud, the password can be reset at https://clickhouse.cloud/\non the settings page for the corresponding service.\n\nIf you have installed ClickHouse and forgot password you can reset it in the configuration file.\nThe password for default user is typically located at /etc/clickhouse-server/users.d/default-password.xml\nand deleting this file will reset the password.\nSee also /etc/clickhouse-server/users.xml on the server where ClickHouse is installed.\n\n. \n    at Object.execute (/Users/cihanadar/Downloads/clixer/shared/dist/clickhouse.js:99:15)\n    at processTicksAndRejections (node:internal/process/task_queues:105:5)\n    at fullRefresh (/Users/cihanadar/Downloads/clixer/services/etl-worker/src/index.ts:362:5)\n    at processETLJob (/Users/cihanadar/Downloads/clixer/services/etl-worker/src/index.ts:186:18)\n    at checkScheduledJobs (/Users/cihanadar/Downloads/clixer/services/etl-worker/src/index.ts:1194:9)\n    at Timeout._onTimeout (/Users/cihanadar/Downloads/clixer/services/etl-worker/src/index.ts:1368:5)"}', 0, 0, 0, '2025-12-21 00:33:15.3');
INSERT INTO public.etl_jobs VALUES ('4d8541f7-815b-4805-8914-c678b45bc823', '00000000-0000-0000-0000-000000000001', '06470d77-2cf2-4987-9b5b-b2cea980c12a', 'incremental_sync', 'cancelled', '2025-12-20 21:59:54.6472', '2025-12-21 17:12:39.223278', 0, 'Worker crash - otomatik iptal edildi', '2025-12-20 21:59:54.6472', NULL, 0, NULL, 0, 0, 0, '2025-12-21 00:33:15.3');
INSERT INTO public.etl_jobs VALUES ('66b96492-fe12-4669-af01-6bc5405d0f0e', '00000000-0000-0000-0000-000000000001', '06470d77-2cf2-4987-9b5b-b2cea980c12a', 'manual_sync', 'completed', '2025-12-28 20:18:13.671707', '2025-12-28 20:18:21.562037', 1640000, 'Kullanıcı tarafından iptal edildi', '2025-12-28 20:18:13.671707', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('246c7b55-d79a-4ca1-b803-1d4181a104c1', '00000000-0000-0000-0000-000000000001', '5d3356b2-59af-4c35-a773-609eceba314a', 'manual_sync', 'completed', '2025-12-28 20:48:51.183859', '2025-12-28 20:48:51.625634', 50000, NULL, '2025-12-28 20:48:51.16494', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('438cad14-c0dc-4c4f-b568-3a626fab9c05', '00000000-0000-0000-0000-000000000001', '06470d77-2cf2-4987-9b5b-b2cea980c12a', 'incremental_sync', 'completed', '2025-12-20 19:18:18.52819', '2025-12-20 19:18:19.127949', 100000, NULL, '2025-12-20 19:18:18.52819', NULL, 0, NULL, 100000, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('34f15f45-9030-452f-8e0a-a2dee58fe23b', '00000000-0000-0000-0000-000000000001', 'f65d82ec-ae3b-4040-82d4-418ae51b30d2', 'scheduled_sync', 'completed', '2025-12-21 16:04:03.332679', '2025-12-21 16:04:04.150612', 1, NULL, '2025-12-21 16:04:03.332679', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('d762a6f2-b05b-48b7-aa01-d89d6244a4ab', '00000000-0000-0000-0000-000000000001', 'f65d82ec-ae3b-4040-82d4-418ae51b30d2', 'scheduled_sync', 'completed', '2025-12-21 16:22:03.369375', '2025-12-21 16:22:04.225945', 1, NULL, '2025-12-21 16:22:03.369375', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('a8260ce2-f645-474f-9929-a5751ca0a7ed', '00000000-0000-0000-0000-000000000001', '06470d77-2cf2-4987-9b5b-b2cea980c12a', 'manual_sync', 'completed', '2025-12-20 19:31:23.95601', '2025-12-20 19:31:24.708293', 100000, NULL, '2025-12-20 19:31:23.95601', '00000000-0000-0000-0000-000000000001', 0, NULL, 100000, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('c279d26d-eff5-49ef-810d-4af3266678cd', '00000000-0000-0000-0000-000000000001', '06470d77-2cf2-4987-9b5b-b2cea980c12a', 'manual_sync', 'completed', '2025-12-20 19:31:25.500116', '2025-12-20 19:31:26.193697', 100000, NULL, '2025-12-20 19:31:25.500116', '00000000-0000-0000-0000-000000000001', 0, NULL, 100000, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('547d9e30-b93e-4a25-a1cb-2171751e30aa', '00000000-0000-0000-0000-000000000001', '06470d77-2cf2-4987-9b5b-b2cea980c12a', 'full_sync', 'completed', '2025-12-20 21:39:55.025217', '2025-12-20 21:39:57.611682', 500000, NULL, '2025-12-20 21:39:55.025217', NULL, 0, NULL, 500000, 0, 0, '2025-12-21 00:39:55.025');
INSERT INTO public.etl_jobs VALUES ('d5fc8578-45b3-43a7-bfc1-67b6e0bb066b', '00000000-0000-0000-0000-000000000001', '5d3356b2-59af-4c35-a773-609eceba314a', 'manual_sync', 'completed', '2025-12-28 20:49:19.885755', '2025-12-28 20:49:23.339995', 50000, NULL, '2025-12-28 20:49:19.865294', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('7bb7e4c1-caa5-4782-b333-34e00d71d70a', '00000000-0000-0000-0000-000000000001', '06470d77-2cf2-4987-9b5b-b2cea980c12a', 'manual_sync', 'cancelled', '2025-12-21 17:06:50.834206', '2025-12-21 17:12:39.223278', 0, 'Worker crash - otomatik iptal edildi', '2025-12-21 16:56:58.102297', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('612c53b1-8d76-49c8-8fc8-dc6a7b69f314', '00000000-0000-0000-0000-000000000001', 'f65d82ec-ae3b-4040-82d4-418ae51b30d2', 'initial_sync', 'completed', '2025-12-21 15:07:51.597158', '2025-12-21 15:07:52.430488', 1, NULL, '2025-12-21 15:07:51.597158', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('72671fe2-5cad-4a29-a479-254a4276c3ea', '00000000-0000-0000-0000-000000000001', 'f65d82ec-ae3b-4040-82d4-418ae51b30d2', 'scheduled_sync', 'completed', '2025-12-21 16:06:03.44523', '2025-12-21 16:06:04.429797', 1, NULL, '2025-12-21 16:06:03.44523', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('26506178-e07b-4330-a237-00cb7991278e', '00000000-0000-0000-0000-000000000001', 'f65d82ec-ae3b-4040-82d4-418ae51b30d2', 'manual_sync', 'completed', '2025-12-21 17:07:46.4661', '2025-12-21 17:07:47.539122', 1, NULL, '2025-12-21 16:56:58.102297', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('d4db9051-a3aa-4b58-ac12-1cbcc41ec7ef', '00000000-0000-0000-0000-000000000001', 'f65d82ec-ae3b-4040-82d4-418ae51b30d2', 'manual_sync', 'completed', '2025-12-21 18:04:28.432165', '2025-12-21 18:04:31.471181', 1, NULL, '2025-12-21 18:04:14.20574', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('f44bf40f-4f10-42e7-890c-7f9dac53dbe5', '00000000-0000-0000-0000-000000000001', '06470d77-2cf2-4987-9b5b-b2cea980c12a', 'manual_sync', 'cancelled', '2025-12-21 18:04:21.339347', '2025-12-21 18:04:32.141441', 0, 'Aynı dataset için zaten çalışan bir job var (duplicate prevention)', '2025-12-21 18:04:14.20574', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('4074cfdb-87ff-4b6e-a11a-4a2b7cd7d08a', '00000000-0000-0000-0000-000000000001', 'f65d82ec-ae3b-4040-82d4-418ae51b30d2', 'manual_sync', 'failed', '2025-12-21 18:15:40.679429', '2025-12-21 18:15:41.673776', 0, 'rows is not defined', '2025-12-21 18:15:38.676561', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('8087a008-7560-417d-aa1d-7513f612ad2d', '00000000-0000-0000-0000-000000000001', '06470d77-2cf2-4987-9b5b-b2cea980c12a', 'manual_sync', 'failed', '2025-12-21 18:15:41.678152', '2025-12-21 18:15:41.681596', 0, 'streamingPostgreSQLSync is not defined', '2025-12-21 18:15:38.676561', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('aba3504f-f59a-456c-8710-3bfc819d382b', '00000000-0000-0000-0000-000000000001', '06470d77-2cf2-4987-9b5b-b2cea980c12a', 'manual_sync', 'cancelled', '2025-12-21 17:07:57.12229', '2025-12-21 17:13:12.181137', 0, 'Worker crash - otomatik iptal edildi', '2025-12-21 16:57:15.44276', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('3a87807c-3235-4da4-b77f-d633c7c5a11a', '00000000-0000-0000-0000-000000000001', '06470d77-2cf2-4987-9b5b-b2cea980c12a', 'manual_sync', 'completed', '2025-12-21 14:23:39.031048', '2025-12-21 14:25:07.04509', 9009725, NULL, '2025-12-21 14:23:39.031048', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('954d0430-ebc3-4e54-96c0-58face56aac1', '00000000-0000-0000-0000-000000000001', '5d3356b2-59af-4c35-a773-609eceba314a', 'manual_sync', 'completed', '2025-12-28 20:50:50.509065', '2025-12-28 20:50:50.918678', 50000, NULL, '2025-12-28 20:50:50.486855', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('1f4ec57d-c5e7-453d-8cb2-f6f0e7e786f1', '00000000-0000-0000-0000-000000000001', 'f65d82ec-ae3b-4040-82d4-418ae51b30d2', 'scheduled_sync', 'completed', '2025-12-21 16:08:03.505759', '2025-12-21 16:08:04.294969', 1, NULL, '2025-12-21 16:08:03.505759', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('a7c773f0-ab72-4819-b161-b01705d04081', '00000000-0000-0000-0000-000000000001', '06470d77-2cf2-4987-9b5b-b2cea980c12a', 'manual_sync', 'completed', '2025-12-21 13:18:49.133807', '2025-12-21 13:18:49.139608', 0, NULL, '2025-12-21 13:18:49.133807', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('5bf43577-0d76-4ba2-a256-4491fae95360', '00000000-0000-0000-0000-000000000001', '06470d77-2cf2-4987-9b5b-b2cea980c12a', 'manual_sync', 'completed', '2025-12-21 19:41:24.753358', '2025-12-21 19:42:10.005799', 9009725, NULL, '2025-12-21 19:41:22.50164', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('13cca616-b3d6-4d4d-ba47-f3db0fc3fabd', '00000000-0000-0000-0000-000000000001', 'f65d82ec-ae3b-4040-82d4-418ae51b30d2', 'manual_sync', 'completed', '2025-12-21 17:07:56.329196', '2025-12-21 17:07:57.11278', 1, NULL, '2025-12-21 16:57:15.44276', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('565d1ee7-4001-42e1-92a4-c8d70cb60b52', '00000000-0000-0000-0000-000000000001', 'f65d82ec-ae3b-4040-82d4-418ae51b30d2', 'manual_sync', 'completed', '2025-12-25 15:06:23.95699', '2025-12-25 15:06:25.041697', 1, NULL, '2025-12-25 15:06:23.95699', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('cf4850c0-5b43-4191-802f-f24f887a35e7', '00000000-0000-0000-0000-000000000001', '06470d77-2cf2-4987-9b5b-b2cea980c12a', 'manual_sync', 'completed', '2025-12-21 13:49:10.887767', '2025-12-21 13:50:20.48036', 9009725, NULL, '2025-12-21 13:49:10.887767', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('a86c1426-dc11-48f2-9012-fa67754ce410', '00000000-0000-0000-0000-000000000001', '06470d77-2cf2-4987-9b5b-b2cea980c12a', 'manual_sync', 'completed', '2025-12-21 14:10:25.143744', '2025-12-21 14:11:30.589608', 9009725, NULL, '2025-12-21 14:10:25.143744', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('d242bed1-cd99-49a2-bb0d-7b93d0eb8243', '00000000-0000-0000-0000-000000000001', '06470d77-2cf2-4987-9b5b-b2cea980c12a', 'manual_sync', 'completed', '2025-12-21 17:08:45.191459', '2025-12-21 17:09:55.801301', 9009725, NULL, '2025-12-21 16:57:26.033007', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('159468b1-caf9-4221-a602-77ee0ba82a0a', '00000000-0000-0000-0000-000000000001', '5d3356b2-59af-4c35-a773-609eceba314a', 'manual_sync', 'completed', '2025-12-28 20:54:14.002036', '2025-12-28 20:54:14.354564', 31428, NULL, '2025-12-28 20:54:13.980107', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('26bf0bfd-96b2-44c7-a5ef-b2fb3505e77e', '00000000-0000-0000-0000-000000000001', 'f65d82ec-ae3b-4040-82d4-418ae51b30d2', 'manual_sync', 'completed', '2025-12-21 15:36:10.593214', '2025-12-21 15:36:11.788208', 1, NULL, '2025-12-21 15:36:10.593214', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('185e737c-02b1-4654-b86c-05a9013cfd82', '00000000-0000-0000-0000-000000000001', 'f65d82ec-ae3b-4040-82d4-418ae51b30d2', 'scheduled_sync', 'completed', '2025-12-21 16:10:03.322817', '2025-12-21 16:10:04.25118', 1, NULL, '2025-12-21 16:10:03.322817', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('8cf24555-6687-4337-8c0b-fd3197ed9e94', '00000000-0000-0000-0000-000000000001', '06470d77-2cf2-4987-9b5b-b2cea980c12a', 'manual_sync', 'completed', '2025-12-21 13:19:06.532009', '2025-12-21 13:19:06.534181', 0, NULL, '2025-12-21 13:19:06.532009', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('bd74f154-4230-4f3e-b085-e91e54f3f09f', '00000000-0000-0000-0000-000000000001', 'f65d82ec-ae3b-4040-82d4-418ae51b30d2', 'manual_sync', 'completed', '2025-12-21 17:08:44.276531', '2025-12-21 17:08:45.183811', 1, NULL, '2025-12-21 16:57:26.033007', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('b941ff3c-4e1c-48fb-8280-ea7097ec3bdf', '00000000-0000-0000-0000-000000000001', 'c57a05be-6ef4-4773-8fc8-7458ca4384e9', 'initial_sync', 'completed', '2025-12-28 21:36:59.994132', '2025-12-28 21:37:00.033493', 10, NULL, '2025-12-28 21:36:59.994132', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('36e4e6b0-faa2-4200-aad4-0d06df793d42', '00000000-0000-0000-0000-000000000001', '5d3356b2-59af-4c35-a773-609eceba314a', 'manual_sync', 'completed', '2025-12-28 20:57:35.829686', '2025-12-28 20:57:36.291547', 50000, NULL, '2025-12-28 20:57:35.806045', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('fc9ec30d-2dcc-43da-a86c-dccff5599838', '00000000-0000-0000-0000-000000000001', '5d3356b2-59af-4c35-a773-609eceba314a', 'manual_sync', 'completed', '2025-12-28 20:58:04.618376', '2025-12-28 20:58:04.855928', 21693, NULL, '2025-12-28 20:58:04.60317', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('bed59aee-a39d-493b-bd29-23f0a83549e2', '00000000-0000-0000-0000-000000000001', '5d3356b2-59af-4c35-a773-609eceba314a', 'manual_sync', 'completed', '2025-12-28 20:57:54.432283', '2025-12-28 20:57:54.668506', 21693, NULL, '2025-12-28 20:57:54.414654', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('7cbb9429-8e94-46b5-8cd6-9b8a6409a42d', '00000000-0000-0000-0000-000000000001', 'c57a05be-6ef4-4773-8fc8-7458ca4384e9', 'manual_sync', 'completed', '2025-12-28 21:37:16.023738', '2025-12-28 21:37:16.200953', 10000, NULL, '2025-12-28 21:37:16.005706', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('d75d84cd-b2f2-4e80-8cbb-df2f28127e8a', '00000000-0000-0000-0000-000000000001', '06470d77-2cf2-4987-9b5b-b2cea980c12a', 'manual_sync', 'failed', '2025-12-28 18:16:56.413614', '2025-12-28 18:16:56.415724', 0, 'Cannot find module ''pg-cursor''
Require stack:
- /Users/cihanadar/Downloads/clixer/services/etl-worker/src/index.ts', '2025-12-28 18:16:56.406691', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('4aa70d90-eefa-49b2-9f73-ae9462b44c12', '00000000-0000-0000-0000-000000000001', 'f65d82ec-ae3b-4040-82d4-418ae51b30d2', 'manual_sync', 'failed', '2025-12-28 18:17:47.030191', '2025-12-28 18:17:47.969709', 0, 'ClickHouse: default: Authentication failed: password is incorrect, or there is no user with such name.

If you use ClickHouse Cloud, the password can be reset at https://clickhouse.cloud/
on the settings page for the corresponding service.

If you have installed ClickHouse and forgot password you can reset it in the configuration file.
The password for default user is typically located at /etc/clickhouse-server/users.d/default-password.xml
and deleting this file will reset the password.
See also /etc/clickhouse-server/users.xml on the server where ClickHouse is installed.

. ', '2025-12-28 18:17:47.011646', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('a879938e-2427-40dc-af24-7bf025ebd501', '00000000-0000-0000-0000-000000000001', 'c57a05be-6ef4-4773-8fc8-7458ca4384e9', 'manual_sync', 'completed', '2025-12-28 21:37:36.825545', '2025-12-28 21:37:37.179012', 10000, 'Kaynak: 1,000,000, Hedef: 20,000 - 980,000 satır fark (98%)', '2025-12-28 21:37:36.806376', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('0b3bd46a-d181-4b06-b1f4-0093b1f0f374', '00000000-0000-0000-0000-000000000001', 'f65d82ec-ae3b-4040-82d4-418ae51b30d2', 'manual_sync', 'failed', '2025-12-28 18:17:56.279403', '2025-12-28 18:17:57.161118', 0, 'ClickHouse: default: Authentication failed: password is incorrect, or there is no user with such name.

If you use ClickHouse Cloud, the password can be reset at https://clickhouse.cloud/
on the settings page for the corresponding service.

If you have installed ClickHouse and forgot password you can reset it in the configuration file.
The password for default user is typically located at /etc/clickhouse-server/users.d/default-password.xml
and deleting this file will reset the password.
See also /etc/clickhouse-server/users.xml on the server where ClickHouse is installed.

. ', '2025-12-28 18:17:56.256157', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('1c4ba86c-9b44-4d8f-89fa-f9de8245e69d', '00000000-0000-0000-0000-000000000001', '06470d77-2cf2-4987-9b5b-b2cea980c12a', 'manual_sync', 'failed', '2025-12-28 18:17:57.19034', '2025-12-28 18:17:57.194336', 0, 'password authentication failed for user "clixer"', '2025-12-28 18:17:57.185083', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('50e987f2-e342-4eaf-b7a9-72fce127ebf1', '00000000-0000-0000-0000-000000000001', '5d3356b2-59af-4c35-a773-609eceba314a', 'manual_sync', 'completed', '2025-12-28 20:59:57.536293', '2025-12-28 20:59:57.881449', 31428, NULL, '2025-12-28 20:59:57.507352', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('9c8852ed-8836-4838-be18-cf47ed449e2f', '00000000-0000-0000-0000-000000000001', 'f65d82ec-ae3b-4040-82d4-418ae51b30d2', 'manual_sync', 'failed', '2025-12-28 18:22:27.743451', '2025-12-28 18:22:28.638723', 0, 'ClickHouse: default: Authentication failed: password is incorrect, or there is no user with such name.

If you use ClickHouse Cloud, the password can be reset at https://clickhouse.cloud/
on the settings page for the corresponding service.

If you have installed ClickHouse and forgot password you can reset it in the configuration file.
The password for default user is typically located at /etc/clickhouse-server/users.d/default-password.xml
and deleting this file will reset the password.
See also /etc/clickhouse-server/users.xml on the server where ClickHouse is installed.

. ', '2025-12-28 18:22:27.698542', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('630047a2-dff8-445b-a738-b0305ad240e4', '00000000-0000-0000-0000-000000000001', 'c57a05be-6ef4-4773-8fc8-7458ca4384e9', 'manual_sync', 'completed', '2025-12-28 21:37:50.580704', '2025-12-28 21:37:50.794513', 10000, 'Kaynak: 1,000,000, Hedef: 30,000 - 970,000 satır fark (97%)', '2025-12-28 21:37:50.564684', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('20fe8395-fa3a-4c41-9c62-976ecf4ec539', '00000000-0000-0000-0000-000000000001', 'c57a05be-6ef4-4773-8fc8-7458ca4384e9', 'manual_sync', 'completed', '2025-12-28 21:38:06.079813', '2025-12-28 21:38:11.842965', 970000, NULL, '2025-12-28 21:38:06.065021', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('636db905-48ed-4adc-9bf4-592147bfc105', '00000000-0000-0000-0000-000000000001', '06470d77-2cf2-4987-9b5b-b2cea980c12a', 'manual_sync', 'failed', '2025-12-28 18:34:49.955743', '2025-12-28 18:34:49.97977', 0, 'ClickHouse: Could not find table: ds_g_nl_k_sat__lar__9m__mjeeql76. ', '2025-12-28 18:34:49.937586', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('cf2899e9-9241-464f-9137-a2b0ee3f835e', '00000000-0000-0000-0000-000000000001', '06470d77-2cf2-4987-9b5b-b2cea980c12a', 'manual_sync', 'completed', '2025-12-28 18:36:45.519102', '2025-12-28 18:37:23.454991', 9009725, NULL, '2025-12-28 18:36:45.506341', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('11fa7e38-3d8a-4bc0-845a-34c388fe8efa', '00000000-0000-0000-0000-000000000001', 'f65d82ec-ae3b-4040-82d4-418ae51b30d2', 'manual_sync', 'failed', '2025-12-28 18:40:20.1232', '2025-12-28 18:40:21.36748', 0, 'ClickHouse: Could not find table: ds_f65d82ec_ae3b_4040_82d4_418ae51b30d2. ', '2025-12-28 18:40:20.097009', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('29f1927a-d6a9-42e0-bac0-fe5342bd8055', '00000000-0000-0000-0000-000000000001', '06470d77-2cf2-4987-9b5b-b2cea980c12a', 'manual_sync', 'failed', '2025-12-28 18:49:03.78591', '2025-12-28 18:49:03.91778', 0, 'ClickHouse: Cannot parse DateTime: Cannot parse DateTime from String: while executing ''FUNCTION if(isNull(-dummy-0) : 3, defaultValueOfTypeName(''DateTime'') :: 2, _CAST(-dummy-0, ''DateTime'') :: 4) -> if(isNull(-dummy-0), defaultValueOfTypeName(''DateTime''), _CAST(-dummy-0, ''DateTime'')) DateTime : 1'': While executing ValuesBlockInputFormat. ', '2025-12-28 18:49:03.774369', NULL, 0, NULL, 0, 0, 0, NULL);
INSERT INTO public.etl_jobs VALUES ('bbbf012a-2098-4ab7-a6b1-042a8b633a2e', '00000000-0000-0000-0000-000000000001', '06470d77-2cf2-4987-9b5b-b2cea980c12a', 'manual_sync', 'completed', '2025-12-28 18:51:52.652821', '2025-12-28 18:52:32.128059', 9009725, NULL, '2025-12-28 18:51:52.638848', NULL, 0, NULL, 0, 0, 0, NULL);


--
-- Data for Name: etl_scheduler_logs; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.etl_scheduler_logs VALUES ('d6ad815e-fb1d-4c93-a880-f6872534cc12', NULL, '2025-12-20 23:25:51.194', 1, 1, 0, '[{"status": "triggered", "datasetId": "c0dd96c2-9593-45d9-9745-21bc4419e49e", "datasetName": "urunler", "scheduledAt": "2025-12-20T20:25:03.114Z"}]', '2025-12-20 20:25:51.266658', 0);
INSERT INTO public.etl_scheduler_logs VALUES ('0580e10c-1ed2-4fac-894d-49c3b49c4c23', NULL, '2025-12-20 23:27:28.588', 1, 1, 0, '[{"status": "triggered", "datasetId": "c0dd96c2-9593-45d9-9745-21bc4419e49e", "datasetName": "urunler", "scheduledAt": "2025-12-20T20:26:51.266Z"}]', '2025-12-20 20:27:28.674598', 0);
INSERT INTO public.etl_scheduler_logs VALUES ('e1017783-c283-4bc9-af55-0222068a0bca', NULL, '2025-12-20 23:29:03.088', 1, 1, 0, '[{"status": "triggered", "datasetId": "c0dd96c2-9593-45d9-9745-21bc4419e49e", "datasetName": "urunler", "scheduledAt": "2025-12-20T20:28:28.675Z"}]', '2025-12-20 20:29:03.196238', 0);
INSERT INTO public.etl_scheduler_logs VALUES ('94ceb2ab-ddb6-412b-a0ef-357b233770a7', NULL, '2025-12-20 23:30:03.09', 1, 1, 0, '[{"status": "triggered", "datasetId": "fced2aa7-80b8-46bc-9d49-75b080868ed6", "datasetName": "ccccccc", "scheduledAt": "2025-12-20T20:29:58.153Z"}]', '2025-12-20 20:30:03.515225', 0);
INSERT INTO public.etl_scheduler_logs VALUES ('f8882bba-444d-463f-bb9b-30d853055d54', NULL, '2025-12-20 23:31:03.093', 1, 1, 0, '[{"status": "triggered", "datasetId": "c0dd96c2-9593-45d9-9745-21bc4419e49e", "datasetName": "urunler", "scheduledAt": "2025-12-20T20:30:03.192Z"}]', '2025-12-20 20:31:03.189772', 0);
INSERT INTO public.etl_scheduler_logs VALUES ('b85e4a34-8941-403d-8867-5a31f7b239d7', NULL, '2025-12-20 23:33:03.099', 1, 1, 0, '[{"status": "triggered", "datasetId": "c0dd96c2-9593-45d9-9745-21bc4419e49e", "datasetName": "urunler", "scheduledAt": "2025-12-20T20:32:03.189Z"}]', '2025-12-20 20:33:03.225204', 0);
INSERT INTO public.etl_scheduler_logs VALUES ('d93b7079-17a5-4e3e-bbcf-d286a30949fc', NULL, '2025-12-20 23:36:03.107', 2, 2, 0, '[{"status": "triggered", "datasetId": "fced2aa7-80b8-46bc-9d49-75b080868ed6", "datasetName": "ccccccc", "scheduledAt": "2025-12-20T20:35:03.514Z"}, {"status": "triggered", "datasetId": "c0dd96c2-9593-45d9-9745-21bc4419e49e", "datasetName": "urunler", "scheduledAt": "2025-12-20T20:34:03.226Z"}]', '2025-12-20 20:36:03.304184', 0);
INSERT INTO public.etl_scheduler_logs VALUES ('f976a02b-99c3-42b9-b43e-6f796d07c5b1', NULL, '2025-12-20 23:38:03.111', 2, 2, 0, '[{"status": "triggered", "datasetId": "fced2aa7-80b8-46bc-9d49-75b080868ed6", "datasetName": "ccccccc", "scheduledAt": "2025-12-20T20:37:03.285Z"}, {"status": "triggered", "datasetId": "c0dd96c2-9593-45d9-9745-21bc4419e49e", "datasetName": "urunler", "scheduledAt": "2025-12-20T20:37:03.304Z"}]', '2025-12-20 20:38:03.312359', 0);
INSERT INTO public.etl_scheduler_logs VALUES ('ecc4d1aa-c0d0-42fa-9eba-0ebd1ac47aef', NULL, '2025-12-20 23:39:03.113', 1, 1, 0, '[{"status": "triggered", "datasetId": "c468cda8-bb75-4021-91c0-60d3046fedeb", "datasetName": "musteriler", "scheduledAt": "2025-12-20T20:38:58.437Z"}]', '2025-12-20 20:39:03.204436', 0);
INSERT INTO public.etl_scheduler_logs VALUES ('8f2b33c3-f719-4e2f-ae7a-5e371637bb60', NULL, '2025-12-20 23:40:03.115', 3, 3, 0, '[{"status": "triggered", "datasetId": "fced2aa7-80b8-46bc-9d49-75b080868ed6", "datasetName": "ccccccc", "scheduledAt": "2025-12-20T20:39:03.279Z"}, {"status": "triggered", "datasetId": "c0dd96c2-9593-45d9-9745-21bc4419e49e", "datasetName": "urunler", "scheduledAt": "2025-12-20T20:39:03.312Z"}, {"status": "triggered", "datasetId": "f55da91f-e87e-45cc-9bb0-8b468daa40de", "datasetName": "magaza", "scheduledAt": "2025-12-20T20:40:03.115Z"}]', '2025-12-20 20:40:03.352453', 0);
INSERT INTO public.etl_scheduler_logs VALUES ('e359e677-0ec1-4d1b-bc79-5f39a066306e', NULL, '2025-12-20 23:41:03.117', 1, 1, 0, '[{"status": "triggered", "datasetId": "c468cda8-bb75-4021-91c0-60d3046fedeb", "datasetName": "musteriler", "scheduledAt": "2025-12-20T20:40:03.204Z"}]', '2025-12-20 20:41:03.169996', 0);
INSERT INTO public.etl_scheduler_logs VALUES ('ba3ca6c7-ff2e-415c-8a44-1451b02200e6', NULL, '2025-12-20 23:42:03.119', 2, 2, 0, '[{"status": "triggered", "datasetId": "c0dd96c2-9593-45d9-9745-21bc4419e49e", "datasetName": "urunler", "scheduledAt": "2025-12-20T20:41:03.315Z"}, {"status": "triggered", "datasetId": "f55da91f-e87e-45cc-9bb0-8b468daa40de", "datasetName": "magaza", "scheduledAt": "2025-12-20T20:41:03.351Z"}]', '2025-12-20 20:42:03.335056', 0);
INSERT INTO public.etl_scheduler_logs VALUES ('2d20f4e2-196c-44a8-a749-b6f2da44332e', NULL, '2025-12-20 23:42:26.744', 0, 0, 0, '{"error": "getExpectedIntervalMs is not defined"}', '2025-12-20 20:42:26.765595', 0);
INSERT INTO public.etl_scheduler_logs VALUES ('1c7e59c8-3615-4fd5-a271-2deb052a5f4d', NULL, '2025-12-20 23:42:41.702', 0, 0, 0, '{"error": "getExpectedIntervalMs is not defined"}', '2025-12-20 20:42:41.718994', 0);
INSERT INTO public.etl_scheduler_logs VALUES ('f3620218-46c2-4c0d-b120-52b4704f7115', NULL, '2025-12-20 23:43:03.454', 3, 3, 1, '[{"status": "missed", "datasetId": "c468cda8-bb75-4021-91c0-60d3046fedeb", "lastRunAt": "2025-12-20T20:41:03.169Z", "nextRunAt": "2025-12-20T20:42:03.169Z", "datasetName": "musteriler", "missedMinutes": 2}, {"status": "triggered", "datasetId": "c468cda8-bb75-4021-91c0-60d3046fedeb", "datasetName": "musteriler", "scheduledAt": "2025-12-20T20:42:03.169Z"}, {"status": "triggered", "datasetId": "c0dd96c2-9593-45d9-9745-21bc4419e49e", "datasetName": "urunler", "scheduledAt": "2025-12-20T20:43:03.302Z"}, {"status": "triggered", "datasetId": "f55da91f-e87e-45cc-9bb0-8b468daa40de", "datasetName": "magaza", "scheduledAt": "2025-12-20T20:43:03.334Z"}]', '2025-12-20 20:43:03.615722', 0);
INSERT INTO public.etl_scheduler_logs VALUES ('c395f3fd-22ef-419d-860b-4a3b186e2a13', NULL, '2025-12-20 23:44:09.607', 2, 2, 1, '[{"status": "missed", "datasetId": "c468cda8-bb75-4021-91c0-60d3046fedeb", "lastRunAt": "2025-12-20T20:38:20.805Z", "nextRunAt": "2025-12-20T20:53:20.805Z", "datasetName": "musteriler", "missedMinutes": 6}, {"status": "triggered", "datasetId": "c0dd96c2-9593-45d9-9745-21bc4419e49e", "datasetName": "urunler", "scheduledAt": "2025-12-20T20:44:03.589Z"}, {"status": "triggered", "datasetId": "f55da91f-e87e-45cc-9bb0-8b468daa40de", "datasetName": "magaza", "scheduledAt": "2025-12-20T20:44:03.617Z"}]', '2025-12-20 20:44:09.744552', 0);
INSERT INTO public.etl_scheduler_logs VALUES ('7770a6f4-b002-4d61-8c18-1f6b26318134', NULL, '2025-12-20 23:45:09.604', 4, 4, 2, '[{"status": "missed", "datasetId": "c468cda8-bb75-4021-91c0-60d3046fedeb", "lastRunAt": "2025-12-20T20:38:20.805Z", "nextRunAt": "2025-12-20T20:44:47.215Z", "datasetName": "musteriler", "missedMinutes": 7}, {"status": "missed", "datasetId": "fced2aa7-80b8-46bc-9d49-75b080868ed6", "lastRunAt": "2025-12-20T20:40:03.281Z", "nextRunAt": "2025-12-20T20:44:59.580Z", "datasetName": "ccccccc", "missedMinutes": 5}, {"status": "triggered", "datasetId": "f55da91f-e87e-45cc-9bb0-8b468daa40de", "datasetName": "magaza", "scheduledAt": "2025-12-20T20:44:59.580Z"}, {"status": "triggered", "datasetId": "c468cda8-bb75-4021-91c0-60d3046fedeb", "datasetName": "musteriler", "scheduledAt": "2025-12-20T20:44:47.215Z"}, {"status": "triggered", "datasetId": "c0dd96c2-9593-45d9-9745-21bc4419e49e", "datasetName": "urunler", "scheduledAt": "2025-12-20T20:44:59.580Z"}, {"status": "triggered", "datasetId": "fced2aa7-80b8-46bc-9d49-75b080868ed6", "datasetName": "ccccccc", "scheduledAt": "2025-12-20T20:44:59.580Z"}]', '2025-12-20 20:45:09.833337', 0);
INSERT INTO public.etl_scheduler_logs VALUES ('5c07e61d-c134-452c-a034-d0eca51d9ecf', NULL, '2025-12-20 23:46:12.478', 4, 4, 0, '[{"status": "triggered", "datasetId": "f55da91f-e87e-45cc-9bb0-8b468daa40de", "datasetName": "magaza", "scheduledAt": "2025-12-20T20:46:09.683Z"}, {"status": "triggered", "datasetId": "c468cda8-bb75-4021-91c0-60d3046fedeb", "datasetName": "musteriler", "scheduledAt": "2025-12-20T20:46:09.714Z"}, {"status": "triggered", "datasetId": "c0dd96c2-9593-45d9-9745-21bc4419e49e", "datasetName": "urunler", "scheduledAt": "2025-12-20T20:46:09.739Z"}, {"status": "triggered", "datasetId": "fced2aa7-80b8-46bc-9d49-75b080868ed6", "datasetName": "ccccccc", "scheduledAt": "2025-12-20T20:46:09.831Z"}]', '2025-12-20 20:46:12.707544', 0);
INSERT INTO public.etl_scheduler_logs VALUES ('0d316148-19b4-4fe2-8b94-6e42790af084', NULL, '2025-12-20 23:48:12.481', 1, 1, 0, '[{"status": "triggered", "datasetId": "c0dd96c2-9593-45d9-9745-21bc4419e49e", "datasetName": "urunler", "scheduledAt": "2025-12-20T20:47:12.615Z"}]', '2025-12-20 20:48:12.582514', 0);
INSERT INTO public.etl_scheduler_logs VALUES ('6adc0810-66d7-4a82-bd01-210fc4924dbd', NULL, '2025-12-20 23:50:12.485', 1, 1, 0, '[{"status": "triggered", "datasetId": "c0dd96c2-9593-45d9-9745-21bc4419e49e", "datasetName": "urunler", "scheduledAt": "2025-12-20T20:49:12.578Z"}]', '2025-12-20 20:50:12.561938', 0);
INSERT INTO public.etl_scheduler_logs VALUES ('a876886c-dea0-4480-a48f-0758ce2db871', NULL, '2025-12-20 23:52:12.489', 1, 1, 0, '[{"status": "triggered", "datasetId": "c0dd96c2-9593-45d9-9745-21bc4419e49e", "datasetName": "urunler", "scheduledAt": "2025-12-20T20:51:12.561Z"}]', '2025-12-20 20:52:13.474', 0);
INSERT INTO public.etl_scheduler_logs VALUES ('7a9fbfb3-1b40-40ee-ac3b-83c3c43a7b0e', NULL, '2025-12-20 23:53:41.775', 1, 1, 0, '[{"status": "triggered", "datasetId": "c0dd96c2-9593-45d9-9745-21bc4419e49e", "datasetName": "urunler", "scheduledAt": "2025-12-20T20:53:12.842Z"}]', '2025-12-20 20:53:41.857985', 0);
INSERT INTO public.etl_scheduler_logs VALUES ('e8215849-bd5e-4076-b2f1-3223fd26a2e7', NULL, '2025-12-20 23:56:21.544', 1, 1, 1, '[{"status": "missed", "datasetId": "c0dd96c2-9593-45d9-9745-21bc4419e49e", "lastRunAt": "2025-12-20T20:53:41.856Z", "nextRunAt": "2025-12-20T20:54:41.857Z", "datasetName": "urunler", "missedMinutes": 3}, {"status": "triggered", "datasetId": "c0dd96c2-9593-45d9-9745-21bc4419e49e", "datasetName": "urunler", "scheduledAt": "2025-12-20T20:54:41.857Z"}]', '2025-12-20 20:56:21.644349', 0);
INSERT INTO public.etl_scheduler_logs VALUES ('83cd395a-4f7a-43d2-b551-926938314528', NULL, '2025-12-21 00:11:55.054', 1, 1, 1, '[{"status": "missed", "datasetId": "c0dd96c2-9593-45d9-9745-21bc4419e49e", "lastRunAt": "2025-12-20T20:56:21.642Z", "nextRunAt": "2025-12-20T20:57:21.644Z", "datasetName": "urunler", "missedMinutes": 16}, {"status": "triggered", "datasetId": "c0dd96c2-9593-45d9-9745-21bc4419e49e", "datasetName": "urunler", "scheduledAt": "2025-12-20T20:57:21.644Z"}]', '2025-12-20 21:11:55.150341', 0);
INSERT INTO public.etl_scheduler_logs VALUES ('9b4911c7-3ea1-43af-84bf-c8751d3633b0', NULL, '2025-12-21 00:26:55.022', 1, 1, 1, '[{"status": "missed", "datasetId": "c0dd96c2-9593-45d9-9745-21bc4419e49e", "lastRunAt": "2025-12-20T21:11:55.149Z", "nextRunAt": "2025-12-20T21:12:55.151Z", "datasetName": "urunler", "missedMinutes": 15}, {"status": "triggered", "datasetId": "c0dd96c2-9593-45d9-9745-21bc4419e49e", "datasetName": "urunler", "scheduledAt": "2025-12-20T21:12:55.151Z"}]', '2025-12-20 21:26:55.069003', 0);
INSERT INTO public.etl_scheduler_logs VALUES ('1b5d8f18-a426-4ed4-9099-19f2833717a1', NULL, '2025-12-21 00:29:21.688', 1, 1, 1, '[{"status": "missed", "datasetId": "c0dd96c2-9593-45d9-9745-21bc4419e49e", "lastRunAt": "2025-12-20T21:26:55.068Z", "nextRunAt": "2025-12-20T21:28:40.726Z", "datasetName": "urunler", "missedMinutes": 2}, {"status": "triggered", "datasetId": "c0dd96c2-9593-45d9-9745-21bc4419e49e", "datasetName": "urunler", "scheduledAt": "2025-12-20T21:28:40.726Z"}]', '2025-12-20 21:29:21.784612', 0);
INSERT INTO public.etl_scheduler_logs VALUES ('3d5379a0-4aab-4aa2-984b-b14ff6e90117', NULL, '2025-12-21 00:30:09.321', 0, 0, 0, '[]', '2025-12-20 21:30:09.328758', 0);
INSERT INTO public.etl_scheduler_logs VALUES ('55eb1345-b966-4783-b157-d6357ead7ca0', NULL, '2025-12-21 00:30:30.41', 1, 1, 0, '[{"status": "triggered", "datasetId": "c0dd96c2-9593-45d9-9745-21bc4419e49e", "datasetName": "urunler", "scheduledAt": "2025-12-20T21:30:21.785Z"}]', '2025-12-20 21:30:30.573836', 0);
INSERT INTO public.etl_scheduler_logs VALUES ('d13d08e9-39e1-4fc7-ada7-848ad0e09599', NULL, '2025-12-21 00:32:32.753', 2, 2, 1, '[{"status": "missed", "datasetId": "c0dd96c2-9593-45d9-9745-21bc4419e49e", "lastRunAt": "2025-12-20T21:30:30.572Z", "nextRunAt": "2025-12-20T21:31:30.572Z", "datasetName": "urunler", "missedMinutes": 2}, {"status": "triggered", "datasetId": "c0dd96c2-9593-45d9-9745-21bc4419e49e", "datasetName": "urunler", "scheduledAt": "2025-12-20T21:31:30.572Z"}, {"status": "triggered", "datasetId": "c468cda8-bb75-4021-91c0-60d3046fedeb", "datasetName": "musteriler", "scheduledAt": "2025-12-20T21:32:32.276Z"}]', '2025-12-20 21:32:32.83089', 0);
INSERT INTO public.etl_scheduler_logs VALUES ('96d55499-0492-47d7-8d8d-cb7cca69fdca', NULL, '2025-12-21 00:36:59.253', 1, 1, 1, '[{"status": "missed", "datasetId": "c0dd96c2-9593-45d9-9745-21bc4419e49e", "lastRunAt": "2025-12-20T21:32:32.810Z", "nextRunAt": "2025-12-20T21:33:32.808Z", "datasetName": "urunler", "missedMinutes": 4}, {"status": "triggered", "datasetId": "c0dd96c2-9593-45d9-9745-21bc4419e49e", "datasetName": "urunler", "scheduledAt": "2025-12-20T21:33:32.808Z"}]', '2025-12-20 21:37:00.49131', 0);
INSERT INTO public.etl_scheduler_logs VALUES ('add83b27-e4c3-4b92-9453-429c722cfeae', NULL, '2025-12-21 00:39:55.455', 1, 1, 1, '[{"status": "missed", "datasetId": "c0dd96c2-9593-45d9-9745-21bc4419e49e", "lastRunAt": "2025-12-20T21:37:00.463Z", "nextRunAt": "2025-12-20T21:38:00.463Z", "datasetName": "urunler", "missedMinutes": 3}, {"status": "triggered", "datasetId": "c0dd96c2-9593-45d9-9745-21bc4419e49e", "datasetName": "urunler", "scheduledAt": "2025-12-20T21:38:00.463Z"}]', '2025-12-20 21:39:56.301287', 0);
INSERT INTO public.etl_scheduler_logs VALUES ('aa71208c-6015-4a97-8bc8-ca69b7b80ba0', NULL, '2025-12-21 00:45:52.313', 1, 1, 1, '[{"status": "missed", "datasetId": "c0dd96c2-9593-45d9-9745-21bc4419e49e", "lastRunAt": "2025-12-20T21:39:56.300Z", "nextRunAt": "2025-12-20T21:40:56.300Z", "datasetName": "urunler", "missedMinutes": 6}, {"status": "triggered", "datasetId": "c0dd96c2-9593-45d9-9745-21bc4419e49e", "datasetName": "urunler", "scheduledAt": "2025-12-20T21:40:56.300Z"}]', '2025-12-20 21:45:52.369425', 0);
INSERT INTO public.etl_scheduler_logs VALUES ('88578982-28a1-4bc8-a0cb-d78d48e81893', NULL, '2025-12-21 00:54:15.847', 3, 2, 2, '[{"status": "missed", "datasetId": "c0dd96c2-9593-45d9-9745-21bc4419e49e", "lastRunAt": "2025-12-20T21:45:52.368Z", "nextRunAt": "2025-12-20T21:46:52.369Z", "datasetName": "urunler", "missedMinutes": 8}, {"status": "triggered", "datasetId": "c468cda8-bb75-4021-91c0-60d3046fedeb", "datasetName": "musteriler", "scheduledAt": "2025-12-20T21:47:32.828Z"}, {"error": "SourceDB: Sorgu hatası: syntax error at or near \"SELECT\"", "status": "failed", "datasetId": "06470d77-2cf2-4987-9b5b-b2cea980c12a", "datasetName": "Günlük Satışlar (9M)", "scheduledAt": "2025-12-20T21:33:15.300Z"}, {"status": "triggered", "datasetId": "c0dd96c2-9593-45d9-9745-21bc4419e49e", "datasetName": "urunler", "scheduledAt": "2025-12-20T21:46:52.369Z"}]', '2025-12-20 21:54:15.950058', 0);
INSERT INTO public.etl_scheduler_logs VALUES ('66adddd4-90be-4b3a-bbae-ee7bc1165df6', NULL, '2025-12-21 01:00:09.941', 1, 1, 1, '[{"status": "missed", "datasetId": "c0dd96c2-9593-45d9-9745-21bc4419e49e", "lastRunAt": "2025-12-20T21:54:15.949Z", "nextRunAt": "2025-12-20T21:55:15.950Z", "datasetName": "urunler", "missedMinutes": 6}, {"status": "triggered", "datasetId": "c0dd96c2-9593-45d9-9745-21bc4419e49e", "datasetName": "urunler", "scheduledAt": "2025-12-20T21:55:15.950Z"}]', '2025-12-20 22:00:10.144157', 0);
INSERT INTO public.etl_scheduler_logs VALUES ('6200465d-6387-4024-abc2-4fd9469ace8b', NULL, '2025-12-21 01:02:10.747', 2, 0, 3, '[{"status": "missed", "datasetId": "c0dd96c2-9593-45d9-9745-21bc4419e49e", "lastRunAt": "2025-12-20T22:00:10.141Z", "nextRunAt": "2025-12-20T22:01:10.141Z", "datasetName": "urunler", "missedMinutes": 2}, {"error": "ClickHouse: default: Authentication failed: password is incorrect, or there is no user with such name.\n\nIf you use ClickHouse Cloud, the password can be reset at https://clickhouse.cloud/\non the settings page for the corresponding service.\n\nIf you have installed ClickHouse and forgot password you can reset it in the configuration file.\nThe password for default user is typically located at /etc/clickhouse-server/users.d/default-password.xml\nand deleting this file will reset the password.\nSee also /etc/clickhouse-server/users.xml on the server where ClickHouse is installed.\n\n. ", "status": "failed", "datasetId": "06470d77-2cf2-4987-9b5b-b2cea980c12a", "datasetName": "Günlük Satışlar (9M)", "scheduledAt": "2025-12-20T21:33:15.300Z"}, {"error": "ClickHouse: default: Authentication failed: password is incorrect, or there is no user with such name.\n\nIf you use ClickHouse Cloud, the password can be reset at https://clickhouse.cloud/\non the settings page for the corresponding service.\n\nIf you have installed ClickHouse and forgot password you can reset it in the configuration file.\nThe password for default user is typically located at /etc/clickhouse-server/users.d/default-password.xml\nand deleting this file will reset the password.\nSee also /etc/clickhouse-server/users.xml on the server where ClickHouse is installed.\n\n. ", "status": "failed", "datasetId": "c0dd96c2-9593-45d9-9745-21bc4419e49e", "datasetName": "urunler", "scheduledAt": "2025-12-20T22:01:10.141Z"}]', '2025-12-20 22:02:11.249169', 0);
INSERT INTO public.etl_scheduler_logs VALUES ('608313cc-ce99-432c-b9ae-0200306f4aab', NULL, '2025-12-21 01:05:23.694', 2, 2, 1, '[{"status": "missed", "datasetId": "c0dd96c2-9593-45d9-9745-21bc4419e49e", "lastRunAt": "2025-12-20T22:00:10.141Z", "nextRunAt": "2025-12-20T22:01:10.141Z", "datasetName": "urunler", "missedMinutes": 5}, {"status": "triggered", "datasetId": "06470d77-2cf2-4987-9b5b-b2cea980c12a", "datasetName": "Günlük Satışlar (9M)", "scheduledAt": "2025-12-20T21:33:15.300Z"}, {"status": "triggered", "datasetId": "c0dd96c2-9593-45d9-9745-21bc4419e49e", "datasetName": "urunler", "scheduledAt": "2025-12-20T22:01:10.141Z"}]', '2025-12-20 22:07:23.417403', 0);
INSERT INTO public.etl_scheduler_logs VALUES ('4c749b99-0675-4198-9af1-e121d714df47', NULL, '2025-12-21 01:12:09.916', 2, 2, 1, '[{"status": "missed", "datasetId": "c0dd96c2-9593-45d9-9745-21bc4419e49e", "lastRunAt": "2025-12-20T22:07:23.416Z", "nextRunAt": "2025-12-20T22:08:23.417Z", "datasetName": "urunler", "missedMinutes": 5}, {"status": "triggered", "datasetId": "c468cda8-bb75-4021-91c0-60d3046fedeb", "datasetName": "musteriler", "scheduledAt": "2025-12-20T22:09:15.914Z"}, {"status": "triggered", "datasetId": "c0dd96c2-9593-45d9-9745-21bc4419e49e", "datasetName": "urunler", "scheduledAt": "2025-12-20T22:08:23.417Z"}]', '2025-12-20 22:12:10.012471', 0);
INSERT INTO public.etl_scheduler_logs VALUES ('8ee3197a-19af-4689-8532-475eb42034d9', NULL, '2025-12-21 01:40:07.607', 2, 1, 2, '[{"status": "missed", "datasetId": "c0dd96c2-9593-45d9-9745-21bc4419e49e", "lastRunAt": "2025-12-20T22:12:10.012Z", "nextRunAt": "2025-12-20T22:35:45.289Z", "datasetName": "urunler", "missedMinutes": 28}, {"status": "triggered", "datasetId": "c0dd96c2-9593-45d9-9745-21bc4419e49e", "datasetName": "urunler", "scheduledAt": "2025-12-20T22:35:45.289Z"}, {"error": "ClickHouse: Table clixer_analytics.ds_ccccccc_mjeob5rp does not exist. ", "status": "failed", "datasetId": "fced2aa7-80b8-46bc-9d49-75b080868ed6", "datasetName": "ccccccc", "scheduledAt": "2025-12-20T22:40:07.607Z"}]', '2025-12-20 22:40:07.777839', 0);
INSERT INTO public.etl_scheduler_logs VALUES ('18330744-a5dc-4b61-8c5d-359e0322c7c8', NULL, '2025-12-21 01:40:38.029', 1, 0, 1, '[{"error": "ClickHouse: Table clixer_analytics.ds_ccccccc_mjeob5rp does not exist. ", "status": "failed", "datasetId": "fced2aa7-80b8-46bc-9d49-75b080868ed6", "datasetName": "ccccccc", "scheduledAt": "2025-12-20T22:40:38.029Z"}]', '2025-12-20 22:40:38.09946', 0);
INSERT INTO public.etl_scheduler_logs VALUES ('d13c0adc-e1a7-40af-beb1-a71c6fbd723a', NULL, '2025-12-21 01:55:38.159', 2, 2, 1, '[{"status": "missed", "datasetId": "c0dd96c2-9593-45d9-9745-21bc4419e49e", "lastRunAt": "2025-12-20T22:40:07.731Z", "nextRunAt": "2025-12-20T22:45:07.732Z", "datasetName": "urunler", "missedMinutes": 16}, {"status": "triggered", "datasetId": "c0dd96c2-9593-45d9-9745-21bc4419e49e", "datasetName": "urunler", "scheduledAt": "2025-12-20T22:45:07.732Z"}, {"status": "triggered", "datasetId": "fced2aa7-80b8-46bc-9d49-75b080868ed6", "datasetName": "ccccccc", "scheduledAt": "2025-12-20T22:55:38.159Z"}]', '2025-12-20 22:55:38.377415', 0);
INSERT INTO public.etl_scheduler_logs VALUES ('4ea6a9c3-b64d-4775-8d51-52834da8367b', NULL, '2025-12-21 02:10:07.18', 2, 2, 2, '[{"status": "missed", "datasetId": "c0dd96c2-9593-45d9-9745-21bc4419e49e", "lastRunAt": "2025-12-20T22:55:38.253Z", "nextRunAt": "2025-12-20T23:00:38.254Z", "datasetName": "urunler", "missedMinutes": 14}, {"status": "missed", "datasetId": "fced2aa7-80b8-46bc-9d49-75b080868ed6", "lastRunAt": "2025-12-20T22:55:38.376Z", "nextRunAt": "2025-12-20T22:56:38.376Z", "datasetName": "ccccccc", "missedMinutes": 14}, {"status": "triggered", "datasetId": "c0dd96c2-9593-45d9-9745-21bc4419e49e", "datasetName": "urunler", "scheduledAt": "2025-12-20T23:00:38.254Z"}, {"status": "triggered", "datasetId": "fced2aa7-80b8-46bc-9d49-75b080868ed6", "datasetName": "ccccccc", "scheduledAt": "2025-12-20T22:56:38.376Z"}]', '2025-12-20 23:10:07.335117', 0);
INSERT INTO public.etl_scheduler_logs VALUES ('9fb5e9c9-6462-40ee-bf2a-5d13e56d9929', NULL, '2025-12-21 02:11:11.786', 1, 1, 0, '[{"status": "triggered", "datasetId": "fced2aa7-80b8-46bc-9d49-75b080868ed6", "datasetName": "ccccccc", "scheduledAt": "2025-12-20T23:11:07.334Z"}]', '2025-12-20 23:11:11.908821', 0);
INSERT INTO public.etl_scheduler_logs VALUES ('7fbc34ea-5c40-4f69-8565-1b17b227bc40', NULL, '2025-12-21 02:18:34.267', 3, 2, 2, '[{"status": "missed", "datasetId": "fced2aa7-80b8-46bc-9d49-75b080868ed6", "lastRunAt": "2025-12-20T23:11:11.908Z", "nextRunAt": "2025-12-20T23:12:11.908Z", "datasetName": "ccccccc", "missedMinutes": 7}, {"error": "ClickHouse: Cannot parse input: expected ''\"'' before: ''T21:01:58Z\",\"content\":\"MYQORZO, a Cardiac Myosin Inhibitor, Directly Addresses Underlying Hypercontractility Associated with Obstructive HCM\\\\r\\\\nFDA Approval Bas'': (while reading the value of key publishedAt): (at row 1)\n: While executing ParallelParsingBlockInputFormat. ", "status": "failed", "datasetId": "9a64f0e9-7b08-40f7-b0dd-58f2745c16c6", "datasetName": "title", "scheduledAt": "2025-12-20T23:18:34.267Z"}, {"status": "triggered", "datasetId": "c0dd96c2-9593-45d9-9745-21bc4419e49e", "datasetName": "urunler", "scheduledAt": "2025-12-20T23:15:07.269Z"}, {"status": "triggered", "datasetId": "fced2aa7-80b8-46bc-9d49-75b080868ed6", "datasetName": "ccccccc", "scheduledAt": "2025-12-20T23:12:11.908Z"}]', '2025-12-20 23:18:34.765472', 0);
INSERT INTO public.etl_scheduler_logs VALUES ('2f050a94-5663-4d17-a4f9-c2f4afd4951e', NULL, '2025-12-21 02:18:50.784', 1, 0, 1, '[{"error": "ClickHouse: Cannot parse input: expected ''\"'' before: ''T21:01:58Z\",\"content\":\"MYQORZO, a Cardiac Myosin Inhibitor, Directly Addresses Underlying Hypercontractility Associated with Obstructive HCM\\\\r\\\\nFDA Approval Bas'': (while reading the value of key publishedAt): (at row 1)\n: While executing ParallelParsingBlockInputFormat. ", "status": "failed", "datasetId": "9a64f0e9-7b08-40f7-b0dd-58f2745c16c6", "datasetName": "title", "scheduledAt": "2025-12-20T23:18:50.784Z"}]', '2025-12-20 23:18:50.97782', 0);
INSERT INTO public.etl_scheduler_logs VALUES ('c0422ae7-63fb-4b05-b0ae-408b8b58f4f0', NULL, '2025-12-21 02:19:56.356', 2, 1, 1, '[{"error": "ClickHouse: Cannot parse input: expected ''\"'' before: '' 21:01:58\",\"content\":\"MYQORZO, a Cardiac Myosin Inhibitor, Directly Addresses Underlying Hypercontractility Associated with Obstructive HCM\\\\r\\\\nFDA Approval Base'': (while reading the value of key publishedAt): (at row 1)\n: While executing ParallelParsingBlockInputFormat. ", "status": "failed", "datasetId": "9a64f0e9-7b08-40f7-b0dd-58f2745c16c6", "datasetName": "title", "scheduledAt": "2025-12-20T23:19:56.356Z"}, {"status": "triggered", "datasetId": "fced2aa7-80b8-46bc-9d49-75b080868ed6", "datasetName": "ccccccc", "scheduledAt": "2025-12-20T23:19:34.766Z"}]', '2025-12-20 23:19:56.869054', 0);
INSERT INTO public.etl_scheduler_logs VALUES ('1dfcc12e-b7e8-492d-894d-71e8c7910242', NULL, '2025-12-21 02:21:00.487', 1, 1, 0, '[{"status": "triggered", "datasetId": "fced2aa7-80b8-46bc-9d49-75b080868ed6", "datasetName": "ccccccc", "scheduledAt": "2025-12-20T23:20:56.869Z"}]', '2025-12-20 23:21:00.575905', 0);
INSERT INTO public.etl_scheduler_logs VALUES ('9d6987e0-4e3e-4c18-a315-682960a4b54d', NULL, '2025-12-21 02:36:00.572', 3, 3, 2, '[{"status": "missed", "datasetId": "c0dd96c2-9593-45d9-9745-21bc4419e49e", "lastRunAt": "2025-12-20T23:18:34.701Z", "nextRunAt": "2025-12-20T23:23:34.702Z", "datasetName": "urunler", "missedMinutes": 17}, {"status": "missed", "datasetId": "fced2aa7-80b8-46bc-9d49-75b080868ed6", "lastRunAt": "2025-12-20T23:21:00.575Z", "nextRunAt": "2025-12-20T23:22:00.575Z", "datasetName": "ccccccc", "missedMinutes": 15}, {"status": "triggered", "datasetId": "76b1b58e-962b-41e5-ac68-5f935791b25d", "datasetName": "titleeee", "scheduledAt": "2025-12-20T23:36:00.572Z"}, {"status": "triggered", "datasetId": "c0dd96c2-9593-45d9-9745-21bc4419e49e", "datasetName": "urunler", "scheduledAt": "2025-12-20T23:23:34.702Z"}, {"status": "triggered", "datasetId": "fced2aa7-80b8-46bc-9d49-75b080868ed6", "datasetName": "ccccccc", "scheduledAt": "2025-12-20T23:22:00.575Z"}]', '2025-12-20 23:36:01.060104', 0);
INSERT INTO public.etl_scheduler_logs VALUES ('fa9ddb95-844e-4b9c-b7b2-630ec0b746f2', NULL, '2025-12-21 02:38:12.681', 2, 2, 2, '[{"status": "missed", "datasetId": "76b1b58e-962b-41e5-ac68-5f935791b25d", "lastRunAt": "2025-12-20T23:36:00.934Z", "nextRunAt": "2025-12-20T23:37:00.935Z", "datasetName": "titleeee", "missedMinutes": 2}, {"status": "missed", "datasetId": "fced2aa7-80b8-46bc-9d49-75b080868ed6", "lastRunAt": "2025-12-20T23:36:01.059Z", "nextRunAt": "2025-12-20T23:37:01.060Z", "datasetName": "ccccccc", "missedMinutes": 2}, {"status": "triggered", "datasetId": "76b1b58e-962b-41e5-ac68-5f935791b25d", "datasetName": "titleeee", "scheduledAt": "2025-12-20T23:37:00.935Z"}, {"status": "triggered", "datasetId": "fced2aa7-80b8-46bc-9d49-75b080868ed6", "datasetName": "ccccccc", "scheduledAt": "2025-12-20T23:37:01.060Z"}]', '2025-12-20 23:38:13.318021', 0);
INSERT INTO public.etl_scheduler_logs VALUES ('dc763557-91e4-4b1b-9991-b6281004d2b5', NULL, '2025-12-21 02:39:35.912', 2, 2, 0, '[{"status": "triggered", "datasetId": "76b1b58e-962b-41e5-ac68-5f935791b25d", "datasetName": "titleeee", "scheduledAt": "2025-12-20T23:39:13.230Z"}, {"status": "triggered", "datasetId": "fced2aa7-80b8-46bc-9d49-75b080868ed6", "datasetName": "ccccccc", "scheduledAt": "2025-12-20T23:39:13.317Z"}]', '2025-12-20 23:39:36.491133', 0);
INSERT INTO public.etl_scheduler_logs VALUES ('2e2d15aa-ea4b-421e-8359-5e87083351fb', NULL, '2025-12-21 02:40:36.522', 2, 2, 0, '[{"status": "triggered", "datasetId": "76b1b58e-962b-41e5-ac68-5f935791b25d", "datasetName": "titleeee", "scheduledAt": "2025-12-20T23:40:36.380Z"}, {"status": "triggered", "datasetId": "fced2aa7-80b8-46bc-9d49-75b080868ed6", "datasetName": "ccccccc", "scheduledAt": "2025-12-20T23:40:36.490Z"}]', '2025-12-20 23:40:36.984107', 0);
INSERT INTO public.etl_scheduler_logs VALUES ('50482ae5-6fd7-4247-9f33-bf72393b6b1e', NULL, '2025-12-21 02:56:43.841', 0, 0, 0, '[]', '2025-12-20 23:56:43.851781', 0);
INSERT INTO public.etl_scheduler_logs VALUES ('9f710182-8e87-480c-bd26-9df91ecb73ed', NULL, '2025-12-21 02:57:43.837', 1, 1, 1, '[{"status": "missed", "datasetId": "fced2aa7-80b8-46bc-9d49-75b080868ed6", "lastRunAt": "2025-12-20T23:40:36.983Z", "nextRunAt": "2025-12-20T23:41:36.984Z", "datasetName": "ccccccc", "missedMinutes": 17}, {"status": "triggered", "datasetId": "fced2aa7-80b8-46bc-9d49-75b080868ed6", "datasetName": "ccccccc", "scheduledAt": "2025-12-20T23:41:36.984Z"}]', '2025-12-20 23:57:43.958569', 0);
INSERT INTO public.etl_scheduler_logs VALUES ('168b79f7-f12b-42ef-9fb1-64cffbfa33ec', NULL, '2025-12-21 02:59:43.818', 1, 1, 0, '[{"status": "triggered", "datasetId": "fced2aa7-80b8-46bc-9d49-75b080868ed6", "datasetName": "ccccccc", "scheduledAt": "2025-12-20T23:58:43.954Z"}]', '2025-12-20 23:59:43.89953', 0);
INSERT INTO public.etl_scheduler_logs VALUES ('65233d4b-1e3a-46c4-b0c2-43870c16f0f0', NULL, '2025-12-21 03:21:59.263', 0, 0, 0, '[]', '2025-12-21 00:21:59.274631', 0);
INSERT INTO public.etl_scheduler_logs VALUES ('ffbe9438-6382-467e-a013-413c1f590fee', NULL, '2025-12-21 03:22:59.284', 0, 0, 0, '[]', '2025-12-21 00:22:59.299234', 0);
INSERT INTO public.etl_scheduler_logs VALUES ('5a468166-a545-467a-9aae-e7d700504a0f', NULL, '2025-12-21 14:56:43.533', 1, 1, 0, '[{"status": "triggered", "datasetId": "8cd1e011-d6d0-460f-9b01-ccf7857e789e", "datasetName": "magazaaa", "scheduledAt": "2025-12-21T11:56:43.533Z"}]', '2025-12-21 11:56:43.64921', 0);
INSERT INTO public.etl_scheduler_logs VALUES ('eadb2b02-e0f7-48e0-b5f6-659521d6723b', NULL, '2025-12-21 14:57:43.671', 1, 1, 0, '[{"status": "triggered", "datasetId": "8cd1e011-d6d0-460f-9b01-ccf7857e789e", "datasetName": "magazaaa", "scheduledAt": "2025-12-21T11:57:43.647Z"}]', '2025-12-21 11:57:43.722406', 0);
INSERT INTO public.etl_scheduler_logs VALUES ('37652e85-f193-4ec0-a2bb-6f43ceddb780', NULL, '2025-12-21 14:59:43.665', 1, 1, 0, '[{"status": "triggered", "datasetId": "8cd1e011-d6d0-460f-9b01-ccf7857e789e", "datasetName": "magazaaa", "scheduledAt": "2025-12-21T11:58:43.722Z"}]', '2025-12-21 11:59:43.711914', 0);


--
-- Data for Name: etl_schedules; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.etl_schedules VALUES ('e8ddecc4-042a-4bae-b280-8c21bed1feda', '00000000-0000-0000-0000-000000000001', 'f65d82ec-ae3b-4040-82d4-418ae51b30d2', '* * * * *', 'Europe/Istanbul', false, '2025-12-21 16:23:04.234+00', '2025-12-21 16:22:04.234698+00', NULL, '2025-12-21 15:53:25.142788+00', '2025-12-21 16:23:10.666062+00');
INSERT INTO public.etl_schedules VALUES ('1620ac98-c872-4b95-b11b-21fb718b5c6f', '00000000-0000-0000-0000-000000000001', '06470d77-2cf2-4987-9b5b-b2cea980c12a', '*/15 * * * *', 'Europe/Istanbul', false, '2025-12-20 22:22:23.361+00', '2025-12-20 22:07:23.360826+00', NULL, '2025-12-20 21:33:15.300408+00', '2025-12-21 19:41:18.170846+00');
INSERT INTO public.etl_schedules VALUES ('d5b413cd-8cd8-4725-adfa-92eeedb26fe7', '00000000-0000-0000-0000-000000000001', '333e7668-7b60-4028-a594-9b226e968932', '* * * * *', 'Europe/Istanbul', false, NULL, NULL, NULL, '2025-12-29 14:41:58.575594+00', '2025-12-29 14:42:21.262456+00');
INSERT INTO public.etl_schedules VALUES ('59214446-3921-4c9d-8b4d-eb40b2a22d4d', '00000000-0000-0000-0000-000000000001', '825012b4-55e3-4108-a34b-97bc2c466055', 'daily', 'Europe/Istanbul', false, '2025-12-29 17:59:55.281+00', '2025-12-29 17:58:55.280448+00', NULL, '2025-12-29 17:58:52.62279+00', '2025-12-29 17:59:14.183093+00');


--
-- Data for Name: ldap_config; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.ldap_config VALUES ('96561893-13c8-4e0a-a228-f85cb69d1bb1', '00000000-0000-0000-0000-000000000001', 'Default LDAP', 'ldap://localhost:389', 'dc=clixer,dc=local', 'cn=admin,dc=clixer,dc=local', 'YWRtaW4xMjM=', '', '(&(objectClass=inetOrgPerson)(mail=*))', '', '(objectClass=group)', 'manual', true, '2025-12-25 16:30:56.794174', '2025-12-23 12:53:10.562662', '2025-12-25 16:30:50.066511');


--
-- Data for Name: ldap_position_mappings; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: ldap_store_mappings; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: ldap_sync_logs; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.ldap_sync_logs VALUES ('f95053ff-cfe7-4273-bb78-635cf8fd869d', '00000000-0000-0000-0000-000000000001', '2025-12-24 21:03:11.003688', '2025-12-24 21:03:11.019105', 'failed', 0, 0, 0, 0, 0, '[{"error": "localhost is an invalid LDAP URL (protocol)"}]', 'Senkronizasyon başarısız: localhost is an invalid LDAP URL (protocol)', '2025-12-24 21:03:11.003688');
INSERT INTO public.ldap_sync_logs VALUES ('76ebed67-b974-4608-845e-f862cf52f046', '00000000-0000-0000-0000-000000000001', '2025-12-24 21:03:32.270685', '2025-12-24 21:03:32.288747', 'success', 0, 0, 0, 0, 0, '[]', '0 kullanıcı bulundu, 0 oluşturuldu, 0 güncellendi, 0 deaktive edildi', '2025-12-24 21:03:32.270685');
INSERT INTO public.ldap_sync_logs VALUES ('384ba1e1-24e1-4ef0-bc1d-42bdcb3a8a43', '00000000-0000-0000-0000-000000000001', '2025-12-24 21:04:13.411381', '2025-12-24 21:04:13.424049', 'success', 0, 0, 0, 0, 0, '[]', '0 kullanıcı bulundu, 0 oluşturuldu, 0 güncellendi, 0 deaktive edildi', '2025-12-24 21:04:13.411381');
INSERT INTO public.ldap_sync_logs VALUES ('a854ee78-07e1-43cc-a0ef-029159063f05', '00000000-0000-0000-0000-000000000001', '2025-12-24 21:09:09.950227', '2025-12-24 21:09:09.990563', 'success', 8, 8, 0, 6, 0, '[]', '8 kullanıcı bulundu, 8 oluşturuldu, 0 güncellendi, 6 deaktive edildi', '2025-12-24 21:09:09.950227');
INSERT INTO public.ldap_sync_logs VALUES ('e8a4f357-756a-4f0d-bc28-b7b8c42d7ac5', '00000000-0000-0000-0000-000000000001', '2025-12-25 16:30:56.745079', '2025-12-25 16:30:56.793623', 'success', 8, 0, 8, 6, 0, '[]', '8 kullanıcı bulundu, 0 oluşturuldu, 8 güncellendi, 6 deaktive edildi', '2025-12-25 16:30:56.745079');


--
-- Data for Name: menu_permissions; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.menu_permissions VALUES ('d13ad0b8-087d-48f1-96ff-295cb10c48ca', 'VIEWER', 'dashboard', true, false);
INSERT INTO public.menu_permissions VALUES ('d7a2d75d-0ca7-4a84-8d66-0120a2573a0b', 'VIEWER', 'finance', false, false);
INSERT INTO public.menu_permissions VALUES ('0b17b3eb-0a18-4159-9e16-6f2a10ae532c', 'VIEWER', 'operations', false, false);
INSERT INTO public.menu_permissions VALUES ('0e4322ea-cb58-4996-9260-8ada76bf8451', 'VIEWER', 'stores', false, false);
INSERT INTO public.menu_permissions VALUES ('86afe4e5-6f27-4202-b4d0-1eba3591a5ed', 'VIEWER', 'data', false, false);
INSERT INTO public.menu_permissions VALUES ('c4ebf8b1-149f-413f-84f8-f60304edb9c5', 'VIEWER', 'admin', false, false);
INSERT INTO public.menu_permissions VALUES ('f96efefd-00c8-46c7-b96b-54772d387077', 'VIEWER', 'analysis', true, false);
INSERT INTO public.menu_permissions VALUES ('a3bcc2c2-73ba-41cc-97e6-b1e2764f9ba9', 'REGION_MANAGER', 'dashboard', true, true);
INSERT INTO public.menu_permissions VALUES ('6750b03c-6a5f-4478-a80b-bf76c3227773', 'REGION_MANAGER', 'finance', true, false);
INSERT INTO public.menu_permissions VALUES ('964c7c2e-8520-40ec-a714-3418c7bc852c', 'REGION_MANAGER', 'operations', true, true);
INSERT INTO public.menu_permissions VALUES ('e27ed1b9-7ecd-4cbf-8930-d9e552eddf25', 'REGION_MANAGER', 'analysis', true, false);
INSERT INTO public.menu_permissions VALUES ('ce94be4d-9a64-4d17-9bde-4a19208c70a6', 'REGION_MANAGER', 'stores', true, false);
INSERT INTO public.menu_permissions VALUES ('2de071b2-9725-4e1a-8675-92679aa9fb6c', 'REGION_MANAGER', 'data', false, false);
INSERT INTO public.menu_permissions VALUES ('cce66287-ff37-448a-8126-0f3700670422', 'REGION_MANAGER', 'admin', false, false);
INSERT INTO public.menu_permissions VALUES ('2dc8f4c6-504b-434d-86dd-378892b65ce2', 'STORE_MANAGER', 'analysis', true, true);
INSERT INTO public.menu_permissions VALUES ('9b89a1a4-1f8d-4ced-92fe-cc86ca12d859', 'STORE_MANAGER', 'dashboard', true, true);
INSERT INTO public.menu_permissions VALUES ('2d7551c4-ee2f-4bd2-9fdd-8e7c81159055', 'STORE_MANAGER', 'admin', false, false);
INSERT INTO public.menu_permissions VALUES ('3d0b3c76-75ce-485d-9753-ee1679ec1786', 'STORE_MANAGER', 'data', false, false);
INSERT INTO public.menu_permissions VALUES ('c1d56292-90b8-4bee-9fb2-1bc570911b54', 'STORE_MANAGER', 'stores', false, false);
INSERT INTO public.menu_permissions VALUES ('8e4eb1e0-9ead-417a-8b65-a7b16e8a36f1', 'STORE_MANAGER', 'operations', false, false);
INSERT INTO public.menu_permissions VALUES ('ac431a64-9465-4d8c-8ad5-24c385b1c017', 'STORE_MANAGER', 'finance', false, false);
INSERT INTO public.menu_permissions VALUES ('0cf02ed5-73f1-4fe7-b617-53a15210e72a', 'ANALYST', 'dashboard', true, false);
INSERT INTO public.menu_permissions VALUES ('fc291e6e-0b1e-4b3a-8c57-57cd7fa0882a', 'ANALYST', 'finance', true, false);
INSERT INTO public.menu_permissions VALUES ('32ca482a-b838-412a-9370-d2a915fb178f', 'ANALYST', 'operations', false, false);
INSERT INTO public.menu_permissions VALUES ('d7c03feb-0a4e-49ea-b8a4-b5b070eec2e9', 'ANALYST', 'analysis', true, false);
INSERT INTO public.menu_permissions VALUES ('db6cef97-089e-4637-b446-a1e6153f10dc', 'ANALYST', 'stores', false, false);
INSERT INTO public.menu_permissions VALUES ('09d98412-e10d-4fb2-8d7d-cf24f0494803', 'ANALYST', 'data', false, false);
INSERT INTO public.menu_permissions VALUES ('38d5f4d6-d566-4d94-a6d8-cc6e50619f95', 'ANALYST', 'admin', false, false);
INSERT INTO public.menu_permissions VALUES ('3e8e4b5a-aef2-499f-99bd-6a4bc118d140', 'GENERAL_MANAGER', 'dashboard', true, true);
INSERT INTO public.menu_permissions VALUES ('a2de6533-67c9-4082-a96c-fbe010bb00ea', 'GENERAL_MANAGER', 'analysis', true, true);
INSERT INTO public.menu_permissions VALUES ('5bb7753f-26c7-4f84-973e-4eec365068b1', 'GENERAL_MANAGER', 'stores', true, true);
INSERT INTO public.menu_permissions VALUES ('1b24a28d-5bf8-42be-80d5-72aca0700d24', 'GENERAL_MANAGER', 'finance', true, true);
INSERT INTO public.menu_permissions VALUES ('cef19a6a-5a7c-42c9-891f-40ea9e3559f2', 'GENERAL_MANAGER', 'operations', true, true);
INSERT INTO public.menu_permissions VALUES ('268c90cc-fb45-4980-8668-eeb05e0c5c19', 'GENERAL_MANAGER', 'admin', true, true);
INSERT INTO public.menu_permissions VALUES ('2ac6952c-d811-465f-a8d2-2ff1352ee819', 'GENERAL_MANAGER', 'data', false, false);
INSERT INTO public.menu_permissions VALUES ('d9463ba1-fe5b-4261-ac6a-2e84558a3a75', 'DIRECTOR', 'dashboard', true, true);
INSERT INTO public.menu_permissions VALUES ('0e7072e2-9653-4c10-a331-374fa8fff6a0', 'DIRECTOR', 'finance', true, true);
INSERT INTO public.menu_permissions VALUES ('bf07155e-aee2-4751-85ad-9752482d17a1', 'DIRECTOR', 'operations', true, true);
INSERT INTO public.menu_permissions VALUES ('5a5966cc-305a-4bd1-b0a1-2b1e6f348662', 'DIRECTOR', 'analysis', true, true);
INSERT INTO public.menu_permissions VALUES ('bf582afc-02b0-4503-9936-787e2bc47eb2', 'DIRECTOR', 'admin', false, false);
INSERT INTO public.menu_permissions VALUES ('9fdfa69c-e160-4fd3-a2cf-7d306f464296', 'DIRECTOR', 'data', false, false);
INSERT INTO public.menu_permissions VALUES ('e262ec93-7d62-4daa-9227-2671e131b655', 'DIRECTOR', 'stores', true, true);


--
-- Data for Name: metrics; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.metrics VALUES ('b2065ec7-1e53-4342-adad-fc0d71e1cb49', '00000000-0000-0000-0000-000000000001', '9555e13e-a703-4870-8d5f-d1010bf7b1b3', 'AGAC', NULL, NULL, 'number', NULL, NULL, NULL, 'SUM', '[]', 300, true, '2025-12-29 08:39:38.675225+00', '2025-12-29 08:42:56.802844+00', NULL, 'AGAC', 'BarChart3', '#10B981', 'ds_9555e13e_a703_4870_8d5f_d1010bf7b1b3', NULL, NULL, NULL, NULL, 'DESC', 'treemap', '{"limit": 0, "colorMode": "accent", "customSql": "SELECT  marka,sum(toplam_adet)Toplam\nFROM TEKSTIL_vw_top_product\ngroup by marka\n ", "useSqlMode": true, "borderStyle": "rounded"}', '{"type": "number"}', false, NULL, NULL, NULL, 4, 2, '{}', true, 'SELECT  marka,sum(toplam_adet)Toplam
FROM TEKSTIL_vw_top_product
group by marka
 ');
INSERT INTO public.metrics VALUES ('41c02b02-fd20-4d15-bf2b-0ed750f65774', '00000000-0000-0000-0000-000000000001', '9555e13e-a703-4870-8d5f-d1010bf7b1b3', 'ilerleme cubugu', NULL, 'SELECT SUM(toplam_ciro) as value FROM ds_9555e13e_a703_4870_8d5f_d1010bf7b1b3', 'number', NULL, NULL, NULL, 'SUM', '[]', 300, true, '2025-12-29 08:54:45.677652+00', '2025-12-29 08:56:02.430374+00', '00000000-0000-0000-0000-000000000001', 'ilerleme cubugu', 'BarChart3', '#06B6D4', 'ds_9555e13e_a703_4870_8d5f_d1010bf7b1b3', 'toplam_ciro', NULL, NULL, NULL, 'DESC', 'progress', '{"limit": 0, "colorMode": "full", "useSqlMode": false, "borderStyle": "rounded"}', '{"type": "number"}', false, NULL, 750000000.0000, NULL, 3, 2, '{}', false, NULL);
INSERT INTO public.metrics VALUES ('9e855513-ed9c-43fd-bcd4-55ff8feeb839', '00000000-0000-0000-0000-000000000001', '9555e13e-a703-4870-8d5f-d1010bf7b1b3', 'HUNI', NULL, NULL, 'number', NULL, NULL, NULL, 'SUM', '[]', 300, true, '2025-12-29 08:39:52.166732+00', '2025-12-29 08:42:51.953143+00', NULL, 'HUNI', 'BarChart3', '', 'ds_9555e13e_a703_4870_8d5f_d1010bf7b1b3', NULL, NULL, NULL, NULL, 'DESC', 'funnel_chart', '{"limit": 0, "colorMode": "accent", "customSql": "SELECT  marka,sum(toplam_adet)Toplam\nFROM TEKSTIL_vw_top_product\ngroup by marka\n ", "useSqlMode": true, "borderStyle": "rounded"}', '{"type": "number"}', false, NULL, NULL, NULL, 4, 2, '{}', true, 'SELECT  marka,sum(toplam_adet)Toplam
FROM TEKSTIL_vw_top_product
group by marka
 ');
INSERT INTO public.metrics VALUES ('a17467a6-0a97-4c13-9850-add7b56dd740', '00000000-0000-0000-0000-000000000001', '9555e13e-a703-4870-8d5f-d1010bf7b1b3', 'pasta', NULL, NULL, 'number', NULL, NULL, NULL, 'SUM', '[]', 300, true, '2025-12-29 08:17:24.958022+00', '2025-12-29 08:17:24.958022+00', '00000000-0000-0000-0000-000000000001', 'pasta', 'BarChart3', '#EC4899', 'ds_9555e13e_a703_4870_8d5f_d1010bf7b1b3', NULL, NULL, NULL, NULL, 'DESC', 'pie_chart', '{"limit": 0, "colorMode": "accent", "customSql": "SELECT  marka,sum(toplam_adet)Toplam\nFROM TEKSTIL_vw_top_product\ngroup by marka\n ", "useSqlMode": true, "borderStyle": "rounded"}', '{"type": "number"}', false, NULL, NULL, NULL, 3, 2, '{}', true, 'SELECT  marka,sum(toplam_adet)Toplam
FROM TEKSTIL_vw_top_product
group by marka
 ');
INSERT INTO public.metrics VALUES ('67e3fce4-36be-48f8-80a9-27da4141c192', '00000000-0000-0000-0000-000000000001', 'c57a05be-6ef4-4773-8fc8-7458ca4384e9', 'NETAMOUNT', NULL, 'SELECT SUM(net_amount) as value FROM ds_c57a05be_6ef4_4773_8fc8_7458ca4384e9', 'number', NULL, NULL, NULL, 'SUM', '[]', 300, true, '2025-12-29 07:10:35.514306+00', '2025-12-29 07:10:35.514306+00', '00000000-0000-0000-0000-000000000001', 'NETAMOUNT', 'PieChart', '#8B5CF6', 'ds_c57a05be_6ef4_4773_8fc8_7458ca4384e9', 'net_amount', NULL, NULL, NULL, 'DESC', 'kpi_card', '{"limit": 0, "colorMode": "full", "useSqlMode": false, "borderStyle": "rounded", "comparisonLabel": "YTD", "comparisonColumn": "transaction_date"}', '{"type": "number"}', true, 'ytd', NULL, NULL, 3, 2, '{"type": "ytd", "label": "YTD", "column": "transaction_date"}', false, NULL);
INSERT INTO public.metrics VALUES ('a00767b7-38cf-4da3-8607-37bc1e26bed6', '00000000-0000-0000-0000-000000000001', 'c57a05be-6ef4-4773-8fc8-7458ca4384e9', 'UNIT', NULL, 'SELECT SUM(unit_price) as value FROM ds_c57a05be_6ef4_4773_8fc8_7458ca4384e9', 'number', NULL, NULL, NULL, 'SUM', '[]', 300, true, '2025-12-29 07:19:27.209448+00', '2025-12-29 07:22:54.994408+00', '00000000-0000-0000-0000-000000000001', 'PRICE', 'Gauge', '#06B6D4', 'ds_c57a05be_6ef4_4773_8fc8_7458ca4384e9', 'unit_price', NULL, NULL, NULL, 'DESC', 'kpi_card', '{"limit": 0, "colorMode": "full", "useSqlMode": false, "borderStyle": "rounded", "comparisonLabel": "", "comparisonColumn": "transaction_date"}', '{"type": "number"}', true, 'mom', NULL, NULL, 3, 2, '{"type": "mom", "label": null, "column": "transaction_date"}', false, NULL);
INSERT INTO public.metrics VALUES ('fa4a82fb-840b-472b-a0d9-e0f4575d54a8', '00000000-0000-0000-0000-000000000001', 'c57a05be-6ef4-4773-8fc8-7458ca4384e9', 'QUANTITY', NULL, 'SELECT SUM(quantity) as value FROM ds_c57a05be_6ef4_4773_8fc8_7458ca4384e9', 'number', NULL, NULL, NULL, 'SUM', '[]', 300, true, '2025-12-29 07:15:18.275049+00', '2025-12-29 07:24:35.069089+00', '00000000-0000-0000-0000-000000000001', 'QUANTITY', 'Database', '#F97316', 'ds_c57a05be_6ef4_4773_8fc8_7458ca4384e9', 'quantity', NULL, NULL, NULL, 'DESC', 'kpi_card', '{"limit": 0, "colorMode": "none", "useSqlMode": false, "borderStyle": "sharp", "comparisonLabel": "VS Geçen Yıl", "comparisonColumn": "transaction_date"}', '{"type": "number"}', true, 'yoy', NULL, NULL, 3, 2, '{"type": "yoy", "label": "VS Geçen Yıl", "column": "transaction_date"}', false, NULL);
INSERT INTO public.metrics VALUES ('45292c15-df1b-4394-97d2-f38a8d8580ce', '00000000-0000-0000-0000-000000000001', 'c57a05be-6ef4-4773-8fc8-7458ca4384e9', 'DISCOUNTAMOUNT', NULL, 'SELECT SUM(unit_price) as value FROM ds_c57a05be_6ef4_4773_8fc8_7458ca4384e9', 'number', NULL, NULL, NULL, 'SUM', '[]', 300, true, '2025-12-29 07:12:10.104127+00', '2025-12-29 07:24:41.598987+00', '00000000-0000-0000-0000-000000000001', 'DISCOUNTAMOUNT', 'BarChart3', '#10B981', 'ds_c57a05be_6ef4_4773_8fc8_7458ca4384e9', 'discount_amount', NULL, NULL, NULL, 'DESC', 'kpi_card', '{"limit": 0, "colorMode": "accent", "useSqlMode": false, "borderStyle": "pill", "comparisonLabel": "vs Geçen Hafta", "comparisonColumn": "transaction_date"}', '{"type": "number"}', true, 'lfl', NULL, NULL, 3, 2, '{"type": "lfl", "label": "vs Geçen Hafta", "column": "transaction_date"}', false, NULL);
INSERT INTO public.metrics VALUES ('4ac25f0e-482c-4222-be05-96a572d57da2', '00000000-0000-0000-0000-000000000001', 'c57a05be-6ef4-4773-8fc8-7458ca4384e9', 'DPERCENT', NULL, 'SELECT SUM(discount_percent) as value FROM ds_c57a05be_6ef4_4773_8fc8_7458ca4384e9', 'number', NULL, NULL, NULL, 'SUM', '[]', 300, true, '2025-12-29 07:28:08.240815+00', '2025-12-29 07:28:08.240815+00', '00000000-0000-0000-0000-000000000001', 'DPERCENT', 'BarChart3', '#6366F1', 'ds_c57a05be_6ef4_4773_8fc8_7458ca4384e9', 'discount_percent', NULL, NULL, NULL, 'DESC', 'kpi_card', '{"limit": 0, "colorMode": "full", "useSqlMode": false, "borderStyle": "rounded", "comparisonLabel": "vs Geçen Ay", "comparisonColumn": "transaction_date"}', '{"type": "number"}', true, 'mom', NULL, NULL, 3, 2, '{"type": "mom", "label": "vs Geçen Ay", "column": "transaction_date"}', false, NULL);
INSERT INTO public.metrics VALUES ('f9eeddda-e732-4230-92c2-ce8fd90510b3', '00000000-0000-0000-0000-000000000001', '9555e13e-a703-4870-8d5f-d1010bf7b1b3', 'cubuk', NULL, NULL, 'number', NULL, NULL, NULL, 'SUM', '[]', 300, true, '2025-12-29 08:27:47.698786+00', '2025-12-29 08:27:54.947046+00', NULL, 'cubuk', 'BarChart3', '#06B6D4', 'ds_9555e13e_a703_4870_8d5f_d1010bf7b1b3', NULL, NULL, NULL, NULL, 'DESC', 'bar_chart', '{"limit": 0, "colorMode": "accent", "customSql": "SELECT  marka,sum(toplam_adet)Toplam\nFROM TEKSTIL_vw_top_product\ngroup by marka\n ", "useSqlMode": true, "borderStyle": "rounded"}', '{"type": "number"}', false, NULL, NULL, NULL, 4, 2, '{}', true, 'SELECT  marka,sum(toplam_adet)Toplam
FROM TEKSTIL_vw_top_product
group by marka
 ');
INSERT INTO public.metrics VALUES ('36f2c90b-59d5-4a55-91cd-151ab690d924', '00000000-0000-0000-0000-000000000001', 'c57a05be-6ef4-4773-8fc8-7458ca4384e9', 'SIRALAMA ', NULL, NULL, 'number', NULL, NULL, NULL, 'SUM', '[]', 300, true, '2025-12-29 07:37:34.230072+00', '2025-12-29 08:08:10.931956+00', '00000000-0000-0000-0000-000000000001', 'SIRALAMLIST', 'BarChart3', '#3B82F6', 'ds_c57a05be_6ef4_4773_8fc8_7458ca4384e9', NULL, NULL, NULL, NULL, 'DESC', 'ranking_list', '{"limit": 0, "colorMode": "none", "customSql": "SELECT \n  toString(product_id) as label,\n  CONCAT(toString(SUM(quantity)), '' adet'') as subtitle,\n  SUM(net_amount) as value\nFROM TEKSTIL_SATIS\nGROUP BY product_id\nORDER BY value DESC\nLIMIT 10", "useSqlMode": true, "borderStyle": "rounded", "gridColumns": [], "comparisonLabel": "", "comparisonColumn": "transaction_date", "autoCalculateTrend": true, "trendComparisonType": "mom"}', '{"type": "number"}', true, 'mom', NULL, NULL, 3, 2, '{"type": "mom", "label": null, "column": "transaction_date"}', true, 'SELECT 
  toString(product_id) as label,
  CONCAT(toString(SUM(quantity)), '' adet'') as subtitle,
  SUM(net_amount) as value
FROM TEKSTIL_SATIS
GROUP BY product_id
ORDER BY value DESC
LIMIT 10');
INSERT INTO public.metrics VALUES ('baef4844-d2f9-456b-8999-dac7bdc44da3', '00000000-0000-0000-0000-000000000001', '9555e13e-a703-4870-8d5f-d1010bf7b1b3', 'DAGILIM', NULL, NULL, 'number', NULL, NULL, NULL, 'SUM', '[]', 300, true, '2025-12-29 08:44:11.087301+00', '2025-12-29 08:44:54.648871+00', NULL, 'DAGILIM', 'BarChart3', '#6366F1', 'ds_9555e13e_a703_4870_8d5f_d1010bf7b1b3', NULL, NULL, NULL, NULL, 'DESC', 'scatter_plot', '{"limit": 0, "colorMode": "accent", "customSql": "SELECT  marka,COUNT(*)ADET,sum(toplam_adet)Toplam\nFROM TEKSTIL_vw_top_product\ngroup by marka\n \n", "useSqlMode": true, "borderStyle": "rounded"}', '{"type": "number"}', false, NULL, NULL, NULL, 4, 2, '{}', true, 'SELECT  marka,COUNT(*)ADET,sum(toplam_adet)Toplam
FROM TEKSTIL_vw_top_product
group by marka
 
');
INSERT INTO public.metrics VALUES ('f7baee35-cc4b-4870-a696-c7c5dc357d5b', '00000000-0000-0000-0000-000000000001', '9555e13e-a703-4870-8d5f-d1010bf7b1b3', 'ALAN', NULL, NULL, 'number', NULL, NULL, NULL, 'SUM', '[]', 300, true, '2025-12-29 08:32:50.954389+00', '2025-12-29 08:35:50.733861+00', NULL, 'ALAN', 'BarChart3', '#84CC16', 'ds_9555e13e_a703_4870_8d5f_d1010bf7b1b3', NULL, NULL, NULL, NULL, 'DESC', 'area_chart', '{"limit": 0, "colorMode": "full", "customSql": "SELECT  marka,sum(toplam_adet)Toplam\nFROM TEKSTIL_vw_top_product\ngroup by marka\n ", "useSqlMode": true, "borderStyle": "rounded"}', '{"type": "number"}', false, NULL, NULL, NULL, 4, 2, '{}', true, 'SELECT  marka,sum(toplam_adet)Toplam
FROM TEKSTIL_vw_top_product
group by marka
 ');
INSERT INTO public.metrics VALUES ('6be7a805-7bf7-4717-a06c-cb6fe4db127c', '00000000-0000-0000-0000-000000000001', '9555e13e-a703-4870-8d5f-d1010bf7b1b3', 'ISI', NULL, NULL, 'number', NULL, NULL, NULL, 'SUM', '[]', 300, true, '2025-12-29 08:39:25.957522+00', '2025-12-29 08:39:30.091218+00', NULL, 'ISI', 'BarChart3', '', 'ds_9555e13e_a703_4870_8d5f_d1010bf7b1b3', NULL, NULL, NULL, NULL, 'DESC', 'heatmap', '{"limit": 0, "colorMode": "full", "customSql": "SELECT  marka,sum(toplam_adet)Toplam\nFROM TEKSTIL_vw_top_product\ngroup by marka\n ", "useSqlMode": true, "borderStyle": "rounded"}', '{"type": "number"}', false, NULL, NULL, NULL, 4, 2, '{}', true, 'SELECT  marka,sum(toplam_adet)Toplam
FROM TEKSTIL_vw_top_product
group by marka
 ');
INSERT INTO public.metrics VALUES ('dc7ca7e0-a53f-4c7f-92f4-a680344d124f', '00000000-0000-0000-0000-000000000001', '9555e13e-a703-4870-8d5f-d1010bf7b1b3', 'HALKA', NULL, NULL, 'number', NULL, NULL, NULL, 'SUM', '[]', 300, true, '2025-12-29 08:37:14.127555+00', '2025-12-29 08:46:19.415996+00', NULL, 'HALKA', 'BarChart3', '#EF4444', 'ds_9555e13e_a703_4870_8d5f_d1010bf7b1b3', NULL, NULL, NULL, NULL, 'DESC', 'map_chart', '{"limit": 0, "colorMode": "accent", "customSql": "SELECT  marka,sum(toplam_adet)Toplam\nFROM TEKSTIL_vw_top_product\ngroup by marka\n ", "useSqlMode": true, "borderStyle": "rounded"}', '{"type": "number"}', false, NULL, NULL, NULL, 4, 2, '{}', true, 'SELECT  marka,sum(toplam_adet)Toplam
FROM TEKSTIL_vw_top_product
group by marka
 ');
INSERT INTO public.metrics VALUES ('41cfb803-b5dc-4f98-9c14-20aa404a72e9', '00000000-0000-0000-0000-000000000001', '333e7668-7b60-4028-a594-9b226e968932', 'alkan', NULL, 'SELECT SUM(net_amount) as value FROM ds_333e7668_7b60_4028_a594_9b226e968932', 'number', NULL, NULL, NULL, 'SUM', '[]', 300, true, '2025-12-29 14:44:59.89698+00', '2025-12-29 14:46:06.956776+00', '00000000-0000-0000-0000-000000000001', 'alkan', 'BarChart3', '#06B6D4', 'ds_333e7668_7b60_4028_a594_9b226e968932', 'net_amount', NULL, NULL, NULL, 'DESC', 'kpi_card', '{"limit": 0, "colorMode": "full", "useSqlMode": false, "borderStyle": "pill", "comparisonLabel": "", "comparisonColumn": "transaction_date"}', '{"type": "number"}', true, 'mom', NULL, NULL, 3, 2, '{"type": "mom", "label": null, "column": "transaction_date"}', false, NULL);
INSERT INTO public.metrics VALUES ('c7c39690-e66f-4db0-99a6-0d383ac1d3c4', '00000000-0000-0000-0000-000000000001', '2d4f4bb7-0183-442b-bbf7-314b109db01c', 'list', NULL, NULL, 'number', NULL, NULL, NULL, 'SUM', '[]', 300, true, '2025-12-29 14:48:27.624895+00', '2025-12-29 14:49:24.92458+00', '00000000-0000-0000-0000-000000000001', 'list', 'BarChart3', '#3B82F6', 'ds_2d4f4bb7_0183_442b_bbf7_314b109db01c', NULL, NULL, NULL, NULL, 'DESC', 'data_grid', '{"limit": 0, "colorMode": "none", "customSql": "select * from TEKSTIL_ vw_regional_summary", "useSqlMode": true, "borderStyle": "rounded", "gridColumns": [{"label": "bolge_kodu", "column": "bolge_kodu", "visible": true}, {"label": "bolge_adi", "column": "bolge_adi", "visible": true}, {"label": "bolge_muduru", "column": "bolge_muduru", "visible": true}, {"label": "magaza_sayisi", "column": "magaza_sayisi", "visible": true}, {"label": "toplam_metrekare", "column": "toplam_metrekare", "visible": true}, {"label": "toplam_calisan", "column": "toplam_calisan", "visible": true}, {"label": "toplam_islem", "column": "toplam_islem", "visible": true}, {"label": "toplam_ciro", "column": "toplam_ciro", "visible": true}]}', '{"type": "number"}', false, NULL, NULL, NULL, 3, 2, '{}', true, 'select * from TEKSTIL_ vw_regional_summary');
INSERT INTO public.metrics VALUES ('4f01b9fb-8e3a-4737-947a-f25c0e704bd7', '00000000-0000-0000-0000-000000000001', 'c57a05be-6ef4-4773-8fc8-7458ca4384e9', 'TREND', NULL, NULL, 'number', NULL, NULL, NULL, 'SUM', '[]', 300, true, '2025-12-29 09:04:19.161936+00', '2025-12-29 09:05:46.430875+00', '00000000-0000-0000-0000-000000000001', 'TREND', 'BarChart3', '#F97316', 'ds_c57a05be_6ef4_4773_8fc8_7458ca4384e9', NULL, NULL, NULL, NULL, 'DESC', 'trend', '{"limit": 0, "colorMode": "none", "customSql": "SELECT \n  toDate(transaction_date) as label,\n  SUM(net_amount) as value\nFROM TEKSTIL_SATIS\nWHERE transaction_date >= today() - 30\nGROUP BY label\nORDER BY label ASC", "useSqlMode": true, "borderStyle": "rounded", "comparisonLabel": "", "comparisonColumn": "transaction_date"}', '{"type": "number"}', true, 'mom', NULL, NULL, 3, 2, '{"type": "mom", "label": null, "column": "transaction_date"}', true, 'SELECT 
  toDate(transaction_date) as label,
  SUM(net_amount) as value
FROM TEKSTIL_SATIS
WHERE transaction_date >= today() - 30
GROUP BY label
ORDER BY label ASC');
INSERT INTO public.metrics VALUES ('2bb3174b-673c-474f-b078-c7908f59fdf0', '00000000-0000-0000-0000-000000000001', 'c57a05be-6ef4-4773-8fc8-7458ca4384e9', 'KARSILASTIRMA', NULL, NULL, 'number', NULL, NULL, NULL, 'SUM', '[]', 300, true, '2025-12-29 09:07:05.784642+00', '2025-12-29 09:09:27.632955+00', NULL, 'KARSILASTIRMA', 'BarChart3', '#6366F1', 'ds_c57a05be_6ef4_4773_8fc8_7458ca4384e9', 'net_amount', NULL, NULL, NULL, 'DESC', 'comparison', '{"limit": 0, "colorMode": "none", "useSqlMode": false, "borderStyle": "rounded", "comparisonLabel": "", "comparisonColumn": "transaction_date"}', '{"type": "number"}', true, 'mom', NULL, NULL, 4, 2, '{"type": "mom", "label": null, "column": "transaction_date"}', false, NULL);
INSERT INTO public.metrics VALUES ('6a69f5ba-689e-488c-8192-45c1a3c883d4', '00000000-0000-0000-0000-000000000001', '9555e13e-a703-4870-8d5f-d1010bf7b1b3', 'GÖSTEGE', NULL, NULL, 'number', NULL, NULL, NULL, 'SUM', '[]', 300, true, '2025-12-29 09:12:10.610414+00', '2025-12-29 09:12:20.260333+00', NULL, 'GÖSTEGE', 'BarChart3', '#F97316', 'ds_9555e13e_a703_4870_8d5f_d1010bf7b1b3', 'toplam_ciro', NULL, NULL, NULL, 'DESC', 'gauge', '{"limit": 0, "colorMode": "full", "useSqlMode": false, "borderStyle": "rounded"}', '{"type": "number"}', false, NULL, 750000000.0000, NULL, 4, 2, '{}', false, NULL);
INSERT INTO public.metrics VALUES ('7ab8f1fd-eed9-4ae8-b568-16d6bbda8f08', '00000000-0000-0000-0000-000000000001', '825012b4-55e3-4108-a34b-97bc2c466055', 'yılmaz satıs', NULL, 'SELECT SUM(net_amount) as value FROM ds_825012b4_55e3_4108_a34b_97bc2c466055', 'number', NULL, NULL, NULL, 'SUM', '[]', 300, true, '2025-12-29 18:00:43.714225+00', '2025-12-29 18:08:02.651783+00', '00000000-0000-0000-0000-000000000001', 'satış yılmaz', 'BarChart3', '#8B5CF6', 'ds_825012b4_55e3_4108_a34b_97bc2c466055', 'net_amount', NULL, NULL, NULL, 'DESC', 'kpi_card', '{"limit": 0, "colorMode": "full", "useSqlMode": false, "borderStyle": "rounded", "comparisonLabel": "", "comparisonColumn": "transaction_date"}', '{"type": "number"}', true, 'mom', NULL, NULL, 3, 2, '{"type": "mom", "label": null, "column": "transaction_date"}', false, NULL);
INSERT INTO public.metrics VALUES ('2669d0a0-c1bc-4c30-a890-a6b685458ba8', '00000000-0000-0000-0000-000000000001', '6a8bf546-2a91-4fdb-83f7-f2c9b2223419', 'gt', NULL, NULL, 'number', NULL, NULL, NULL, 'SUM', '[]', 300, true, '2025-12-29 20:17:31.671423+00', '2025-12-29 20:17:31.671423+00', NULL, 'gt', 'BarChart3', '#06B6D4', 'ds_6a8bf546_2a91_4fdb_83f7_f2c9b2223419', 'net_amount', NULL, NULL, NULL, 'DESC', 'kpi_card', '{"limit": 0, "colorMode": "full", "useSqlMode": false, "borderStyle": "rounded", "comparisonLabel": "", "comparisonColumn": "transaction_date"}', '{}', true, 'mom', NULL, NULL, 4, 2, '{}', false, NULL);
INSERT INTO public.metrics VALUES ('172b8165-5d7f-4e7a-83ca-d50b96ce39d2', '00000000-0000-0000-0000-000000000001', '6a8bf546-2a91-4fdb-83f7-f2c9b2223419', 'gurkan sales', NULL, 'SELECT SUM(net_amount) as value FROM ds_6a8bf546_2a91_4fdb_83f7_f2c9b2223419', 'number', NULL, NULL, NULL, 'SUM', '[]', 300, true, '2025-12-29 20:14:14.20186+00', '2025-12-29 20:16:42.308717+00', '00000000-0000-0000-0000-000000000001', 'sales gt', 'BarChart3', '#06B6D4', 'ds_6a8bf546_2a91_4fdb_83f7_f2c9b2223419', 'net_amount', NULL, NULL, NULL, 'DESC', 'kpi_card', '{"limit": 0, "colorMode": "full", "useSqlMode": false, "borderStyle": "rounded", "comparisonLabel": "", "comparisonColumn": "transaction_date"}', '{"type": "number"}', true, 'mom', NULL, NULL, 3, 2, '{"type": "mom", "label": null, "column": "transaction_date"}', false, NULL);


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: ownership_groups; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.ownership_groups VALUES ('a55513a6-a4d5-434e-86f9-727e0626da3f', '00000000-0000-0000-0000-000000000001', 'MERKEZ', 'Merkez Mağazalar', '', '#5533ff', '🏢', true, 1, '2025-12-25 15:16:57.396623', '2025-12-25 16:27:26.642441');
INSERT INTO public.ownership_groups VALUES ('71199885-f871-4e89-921a-dcf0c056220c', '00000000-0000-0000-0000-000000000001', 'FRANCHISE', 'Franchise Mağazalar', '', '#b71010', '🏪', true, 2, '2025-12-25 15:16:57.396623', '2025-12-25 16:27:37.931918');
INSERT INTO public.ownership_groups VALUES ('f09dfd1a-d594-4772-91eb-a52454dce720', '00000000-0000-0000-0000-000000000001', '03', 'İNTERNET', 'SDFDSF', '#3bf76a', '🏢', true, 0, '2025-12-25 16:36:22.542419', '2025-12-25 16:36:22.542419');


--
-- Data for Name: positions; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.positions VALUES ('a8a089e9-b81e-40a9-acd1-72132b371dbb', 'GENERAL_MANAGER', 'Genel Müdür', 0, true, 'Tüm mağazalara ve verilere erişim', '2025-12-22 17:38:17.135338+00', '2025-12-22 17:38:17.135338+00', 'none');
INSERT INTO public.positions VALUES ('b6e8ceed-1f73-40d2-bc39-159064a14dab', 'DIRECTOR', 'Direktör', 1, true, 'Tüm mağazalara erişim, sınırlı admin', '2025-12-22 17:38:17.135338+00', '2025-12-22 17:38:17.135338+00', 'group');
INSERT INTO public.positions VALUES ('5f9e2159-ed56-4e30-9dd6-c70b4f393ea0', 'REGION_MANAGER', 'Bölge Müdürü', 2, false, 'Atanan bölgelerdeki mağazalara erişim', '2025-12-22 17:38:17.135338+00', '2025-12-22 17:38:17.135338+00', 'region');
INSERT INTO public.positions VALUES ('032e4c8c-3220-40ca-8b78-bb9fea8aa6a1', 'STORE_MANAGER', 'Mağaza Müdürü', 3, false, 'Sadece kendi mağazasına erişim', '2025-12-22 17:38:17.135338+00', '2025-12-22 17:38:17.135338+00', 'store');
INSERT INTO public.positions VALUES ('7dc4af61-49dd-4e46-8c89-5bb98f873135', 'ANALYST', 'Analist', 3, false, 'Görüntüleme ve analiz', '2025-12-22 17:38:17.135338+00', '2025-12-22 17:38:17.135338+00', 'store');
INSERT INTO public.positions VALUES ('256edab3-f368-4684-b73a-510c25059c3f', 'VIEWER', 'İzleyici', 4, false, 'Sadece görüntüleme', '2025-12-22 17:38:17.135338+00', '2025-12-22 17:38:17.135338+00', 'store');


--
-- Data for Name: regions; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.regions VALUES ('11336ea7-e19f-4780-9c92-aabf88b99e74', '00000000-0000-0000-0000-000000000001', 'MARMARA', 'Marmara Bölgesi', 'İstanbul, Kocaeli, Bursa', true, '2025-12-23 08:57:23.074287+00', NULL, NULL, 0, '2025-12-25 16:10:59.796469');
INSERT INTO public.regions VALUES ('becf50c9-c492-457f-a17f-3b99d237e1a9', '00000000-0000-0000-0000-000000000001', 'EGE', 'Ege Bölgesi', 'İzmir, Aydın, Muğla', true, '2025-12-23 08:57:23.074287+00', NULL, NULL, 0, '2025-12-25 16:10:59.796469');
INSERT INTO public.regions VALUES ('93eaf259-a2a1-4d61-a00c-d4735ec95ede', '00000000-0000-0000-0000-000000000001', 'IC_ANADOLU', 'İç Anadolu Bölgesi', 'Ankara, Konya, Eskişehir', true, '2025-12-23 08:57:23.074287+00', NULL, NULL, 0, '2025-12-25 16:10:59.796469');
INSERT INTO public.regions VALUES ('9c2adc4f-dedf-44aa-b58f-2283caf1490a', '00000000-0000-0000-0000-000000000001', 'AKDENIZ', 'Akdeniz Bölgesi', 'Test güncelleme başarılı', true, '2025-12-23 08:57:23.074287+00', NULL, NULL, 0, '2025-12-25 16:11:20.007444');
INSERT INTO public.regions VALUES ('e1fa6eb8-482c-41d0-aa4f-ed33ba6bd5c7', '00000000-0000-0000-0000-000000000001', '09', 'DOĞUANADOLU', 'TEST', true, '2025-12-25 16:37:27.491836+00', 'AHMET YILMAZ', 'TEST@DESO.COM', 0, '2025-12-25 16:37:27.491836');


--
-- Data for Name: store_finance_settings; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.store_finance_settings VALUES ('2651c3f3-a325-4a37-8dab-fcf8db46bf28', '00000000-0000-0000-0000-000000000001', 'ankara', 'Ankara Kızılay', 8888.00, 8.00, 12000.00, 35.00, 5.00, 3.00, 15000.00, 3000.00, 1, 45000.00, 4, 25000.00, 6, 22000.00, 2, 20000.00, 1500000.00, '2024-12-08', '2025-12-23 08:49:48.716634+00', '2025-12-23 08:49:48.716634+00');
INSERT INTO public.store_finance_settings VALUES ('f2f4854d-a807-4ec2-a4ed-264b5a8cc293', '00000000-0000-0000-0000-000000000001', 'izmir', 'İzmir Alsancak', 10000.00, 8.00, 12000.00, 35.00, 5.00, 3.00, 15000.00, 3000.00, 1, 45000.00, 4, 25000.00, 6, 22000.00, 2, 20000.00, 1500000.00, '2024-12-08', '2025-12-23 08:50:05.82574+00', '2025-12-23 08:50:05.82574+00');
INSERT INTO public.store_finance_settings VALUES ('db08c684-dbf4-4402-bc7e-11d0f98217bf', '00000000-0000-0000-0000-000000000001', 'kadikoy', 'İstanbul Kadıköy', 95000.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 11, 55000.00, 14, 25000.00, 116, 22000.00, 1, 20000.00, 10000.00, '2024-01-01', '2025-12-22 20:00:37.954143+00', '2025-12-23 09:04:40.348971+00');
INSERT INTO public.store_finance_settings VALUES ('5fafb633-8bad-44bf-a5f2-8d5e70643c80', '00000000-0000-0000-0000-000000000001', 'istinye', 'İstinye Park', 55000.00, 8.00, 12000.00, 35.00, 5.00, 3.00, 15000.00, 3000.00, 1, 45000.00, 4, 25000.00, 6, 22000.00, 2, 20000.00, 1500000.00, '2024-12-07', '2025-12-23 08:50:17.049829+00', '2025-12-25 11:24:00.977596+00');
INSERT INTO public.store_finance_settings VALUES ('033356c9-9b8a-4632-af9e-a64057c1364a', '00000000-0000-0000-0000-000000000001', '2222', 'VAN100', 88888.00, 8.00, 12000.00, 35.00, 5.00, 3.00, 15000.00, 3000.00, 1, 45000.00, 4, 25000.00, 6, 22000.00, 2, 20000.00, 1500000.00, '2024-12-08', '2025-12-26 22:51:17.444772+00', '2025-12-26 22:51:17.444772+00');
INSERT INTO public.store_finance_settings VALUES ('b1c47a49-09f9-4319-be47-efed97a18679', '00000000-0000-0000-0000-000000000001', '15', 'mersin mağazası', 9000.00, 8.00, 12000.00, 35.00, 5.00, 3.00, 15000.00, 3000.00, 1, 45000.00, 4, 25000.00, 6, 22000.00, 2, 20000.00, 1500000.00, '2024-12-08', '2025-12-28 18:07:10.387397+00', '2025-12-28 18:07:10.387397+00');


--
-- Data for Name: stores; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.stores VALUES ('5a63e5b4-b763-499d-8b3f-9f4c4baa800e', '00000000-0000-0000-0000-000000000001', 'istinye', 'İstinye Park', 'FRANCHISE', '11336ea7-e19f-4780-9c92-aabf88b99e74', 'İstanbul', NULL, NULL, NULL, NULL, NULL, true, '2025-12-23 08:57:23.074287+00', '2025-12-23 08:57:23.074287+00', 'FRANCHISE', NULL, NULL, 'TR', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{}', 0);
INSERT INTO public.stores VALUES ('1d6f0566-48f6-4a27-9b17-c76b96bdba22', '00000000-0000-0000-0000-000000000001', 'ankara', 'Ankara Kızılay', 'FRANCHISE', '93eaf259-a2a1-4d61-a00c-d4735ec95ede', 'Ankara', NULL, NULL, NULL, NULL, NULL, true, '2025-12-23 08:57:23.074287+00', '2025-12-23 08:57:23.074287+00', 'FRANCHISE', NULL, NULL, 'TR', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{}', 0);
INSERT INTO public.stores VALUES ('eda0f61c-1b59-43fe-ba8c-6957d58f5fd0', '00000000-0000-0000-0000-000000000001', 'STORE004', 'ANTALYA MALL OFF', 'MAGAZA', '11336ea7-e19f-4780-9c92-aabf88b99e74', 'İstanbul', 'Bahariye Cad. No:123', '0216 123 4567', 'kadikoy@sirket.com', 'Ahmet Yılmaz', '2025-12-04', true, '2025-12-25 16:06:59.772306+00', '2025-12-25 16:26:19.765781+00', 'MERKEZ', 'ANTALYA', NULL, 'TR', '', NULL, NULL, NULL, NULL, NULL, NULL, '{}', 0);
INSERT INTO public.stores VALUES ('e672d738-b021-4eb8-a6c2-f5a79f1edb3c', '00000000-0000-0000-0000-000000000001', '212avm', '212 AVM', 'MERKEZ', '11336ea7-e19f-4780-9c92-aabf88b99e74', 'İstanbul', '', '', '', '', '2025-06-14', true, '2025-12-23 08:57:23.074287+00', '2025-12-25 16:26:45.787348+00', 'MERKEZ', '', NULL, 'TR', '', NULL, NULL, NULL, NULL, NULL, NULL, '{}', 0);
INSERT INTO public.stores VALUES ('56739d03-e250-4c45-91d0-1c5a91aed66e', '00000000-0000-0000-0000-000000000001', 'izmir', 'İzmir Alsancak', 'MERKEZ', 'becf50c9-c492-457f-a17f-3b99d237e1a9', 'İzmir', '', '', '', '', '2024-01-14', true, '2025-12-23 08:57:23.074287+00', '2025-12-25 16:26:53.420157+00', 'MERKEZ', '', NULL, 'TR', '', NULL, NULL, NULL, NULL, NULL, NULL, '{}', 0);
INSERT INTO public.stores VALUES ('91bbe1d4-e3bd-42f8-8d4d-45cb6c63f97c', '00000000-0000-0000-0000-000000000001', '2222', 'VAN100', 'MAGAZA', 'e1fa6eb8-482c-41d0-aa4f-ed33ba6bd5c7', 'VAN', 'SS', 'SS', 'SSSS', 'YILMSFSF', '2025-12-04', true, '2025-12-25 16:38:25.494529+00', '2025-12-25 16:38:25.494529+00', '03', 'SS', NULL, 'TR', 'DSFDSF@DEMO', NULL, 455, 9, 210000.00, 2100000.00, NULL, '{}', 0);
INSERT INTO public.stores VALUES ('e576dd1f-09be-4c93-95ac-70fecc93567b', '00000000-0000-0000-0000-000000000001', '1', 'kadıköy', 'MAGAZA', '11336ea7-e19f-4780-9c92-aabf88b99e74', '', '', '', '', '', '2025-12-05', true, '2025-12-25 17:35:58.633369+00', '2025-12-25 17:35:58.633369+00', 'MERKEZ', '', NULL, 'TR', '', NULL, NULL, NULL, NULL, NULL, NULL, '{}', 0);
INSERT INTO public.stores VALUES ('4d5dce1a-f549-4c30-8808-451ee79b8a80', '00000000-0000-0000-0000-000000000001', '15', 'mersin mağazası', 'MAGAZA', '9c2adc4f-dedf-44aa-b58f-2283caf1490a', '', '', '', '', '', '2025-12-04', true, '2025-12-25 17:57:25.143333+00', '2025-12-25 17:57:25.143333+00', 'FRANCHISE', '', NULL, 'TR', '', NULL, NULL, NULL, NULL, NULL, NULL, '{}', 0);
INSERT INTO public.stores VALUES ('acdb3e9b-88b1-45db-b47a-271cbc1e833d', '00000000-0000-0000-0000-000000000001', '17', 'samsun', 'MAGAZA', '9c2adc4f-dedf-44aa-b58f-2283caf1490a', '', '', '', '', '', '2025-12-10', true, '2025-12-25 18:17:19.706739+00', '2025-12-25 18:17:19.706739+00', 'FRANCHISE', '', NULL, 'TR', '', NULL, NULL, NULL, NULL, NULL, NULL, '{}', 0);


--
-- Data for Name: system_settings; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.system_settings VALUES ('44df9ef4-de09-456b-a26f-fa066c406b26', NULL, 'etl', 'default_row_limit', '10000000', '2025-12-20 21:28:40.726244', '2025-12-20 21:28:40.726244');
INSERT INTO public.system_settings VALUES ('65537324-c971-425d-9052-8a6a2732f9b1', NULL, 'finance', 'finance_show_roi', '{"type": "boolean", "label": "ROI Göster", "value": "true", "description": "Finansal şeffaflık sayfasında ROI kartını göster"}', '2025-12-22 17:09:59.104315', '2025-12-22 20:48:57.93749');
INSERT INTO public.system_settings VALUES ('cbaa1383-7227-4b6b-a0c6-0afb8377e85c', NULL, 'performance', 'cache_redis_policy', '{"value": "allkeys-lfu", "options": ["allkeys-lru", "allkeys-lfu", "volatile-lru", "volatile-ttl"], "description": "Redis bellek dolunca silme politikası"}', '2025-12-28 15:18:52.158898', '2025-12-28 15:44:09.925547');
INSERT INTO public.system_settings VALUES ('437cc803-7d4c-4da4-b7f9-35d201a9c282', NULL, 'etl', 'scheduler_check_interval', '1', '2025-12-20 23:39:28.85951', '2025-12-20 23:39:28.85951');
INSERT INTO public.system_settings VALUES ('aec9323c-33fb-48c8-a101-89f1f570154e', NULL, 'general', 'app_logo_url', '{"type": "url", "label": "Logo URL", "value": "/logo.png", "description": "Uygulama logosu"}', '2025-12-22 17:09:38.000628', '2025-12-22 17:09:38.000628');
INSERT INTO public.system_settings VALUES ('ee566134-f25c-4de1-8636-7e52bdead57a', NULL, 'general', 'support_email', '{"type": "string", "label": "Destek E-postası", "value": "destek@clixer.io", "description": "Kullanıcı destek e-postası"}', '2025-12-22 17:09:38.133845', '2025-12-22 17:09:38.133845');
INSERT INTO public.system_settings VALUES ('af9ca8ab-e7bc-45a3-a60b-257a8a07a5a6', NULL, 'finance', 'finance_target_roi', '{"type": "number", "label": "Hedef ROI (%)", "value": "15", "description": "Yatırım getirisi hedefi"}', '2025-12-22 17:09:38.24083', '2025-12-22 17:09:38.24083');
INSERT INTO public.system_settings VALUES ('45ac7754-16af-4d51-b6ea-8c418765f412', NULL, 'general', 'app_favicon_url', '{"type": "url", "label": "Favicon URL", "value": "/favicon.ico", "description": "Tarayıcı sekmesinde görünecek ikon"}', '2025-12-22 17:09:59.104315', '2025-12-22 17:09:59.104315');
INSERT INTO public.system_settings VALUES ('aa506b9c-8de3-4a3e-a735-49bade5722fe', NULL, 'theme', 'primary_color', '{"type": "color", "label": "Ana Renk", "value": "#00ABBD", "description": "Uygulama ana vurgu rengi"}', '2025-12-22 17:09:59.104315', '2025-12-22 17:09:59.104315');
INSERT INTO public.system_settings VALUES ('21d9bf4b-a697-475a-8aca-1c2ed79c2fa4', NULL, 'locale', 'default_language', '{"type": "select", "label": "Varsayılan Dil", "value": "tr", "description": "Yeni kullanıcılar için varsayılan dil"}', '2025-12-22 17:09:59.104315', '2025-12-22 17:09:59.104315');
INSERT INTO public.system_settings VALUES ('c18198ad-3b34-4859-8791-71a4a4d0d379', NULL, 'locale', 'default_timezone', '{"type": "string", "label": "Varsayılan Saat Dilimi", "value": "Europe/Istanbul", "description": "Tarih ve saat gösterimi için"}', '2025-12-22 17:09:59.104315', '2025-12-22 17:09:59.104315');
INSERT INTO public.system_settings VALUES ('860f8190-d701-4f04-9192-54bffdb0a22d', NULL, 'security', 'session_timeout', '{"type": "number", "label": "Oturum Süresi (dk)", "value": "30", "description": "Hareketsizlik sonrası oturum sonlandırma"}', '2025-12-22 17:09:59.104315', '2025-12-22 17:09:59.104315');
INSERT INTO public.system_settings VALUES ('1f3ea0d1-bc30-4061-a1d5-eb92b1356c04', NULL, 'security', '2fa_enabled', '{"type": "boolean", "label": "2FA Zorunlu", "value": "false", "description": "Tüm kullanıcılar için 2FA zorunluluğu"}', '2025-12-22 17:09:59.104315', '2025-12-22 17:09:59.104315');
INSERT INTO public.system_settings VALUES ('65dbd763-1eea-4379-b49c-076f0da9422a', NULL, 'finance', 'finance_target_profit_margin', '{"type": "number", "label": "Hedef Kar Marjı (%)", "value": "25", "description": "Kar marjı hedefi"}', '2025-12-22 17:09:59.104315', '2025-12-22 17:09:59.104315');
INSERT INTO public.system_settings VALUES ('4a4a429f-df25-41d9-b276-0861202bf927', NULL, 'finance', 'finance_currency', '{"type": "select", "label": "Para Birimi", "value": "TRY", "description": "Varsayılan para birimi"}', '2025-12-22 17:09:59.104315', '2025-12-22 17:09:59.104315');
INSERT INTO public.system_settings VALUES ('77c04568-ecea-428c-a4ec-e00f2b1620f5', NULL, 'performance', 'cache_redis_max_memory', '{"value": "2gb", "description": "Redis maksimum bellek limiti"}', '2025-12-28 15:18:52.158898', '2025-12-28 15:44:37.77072');
INSERT INTO public.system_settings VALUES ('f4228413-03ca-4a25-a42d-50a58823d458', NULL, 'general', 'company_name', '{"type": "string", "label": "Şirket Adı", "value": "Clixer Analyticssss", "description": "Footer ve yasal metinlerde kullanılacak"}', '2025-12-22 17:09:38.057501', '2025-12-22 19:43:58.895166');
INSERT INTO public.system_settings VALUES ('f3eb9055-dd02-4860-b171-743692bb28d6', NULL, 'general', 'support_phone', '{"type": "string", "label": "Destek Telefonu", "value": "+90 212 000 00 44", "description": "Kullanıcı destek telefonu"}', '2025-12-22 17:09:59.104315', '2025-12-22 20:20:36.652842');
INSERT INTO public.system_settings VALUES ('040d21c2-ab41-4cf2-84cb-dcbed6f56441', NULL, 'finance', 'finance_show_profit_margin', '{"type": "boolean", "label": "Kar Marjı Göster", "value": "true", "description": "Kar marjı kartını göster"}', '2025-12-22 17:09:59.104315', '2025-12-22 20:49:06.438713');
INSERT INTO public.system_settings VALUES ('6eef1bec-d482-4e74-b484-ae4f400c7ebb', NULL, 'finance', 'finance_show_expense_breakdown', '{"type": "boolean", "label": "Gider Dağılımı Göster", "value": "true", "description": "Gider dağılım grafiğini göster"}', '2025-12-22 17:09:59.104315', '2025-12-22 20:49:10.842613');
INSERT INTO public.system_settings VALUES ('4d4685f6-9922-4bc5-9c8c-6f50a28c8e9e', '00000000-0000-0000-0000-000000000001', 'finance', 'finance_roi_positions', '["GENERAL_MANAGER", "DIRECTOR"]', '2025-12-22 20:11:37.81831', '2025-12-22 20:11:37.81831');
INSERT INTO public.system_settings VALUES ('05421f15-3c4c-4c84-bb1e-8874d0c11465', '00000000-0000-0000-0000-000000000001', 'finance', 'finance_profit_margin_positions', '["GENERAL_MANAGER", "DIRECTOR", "REGION_MANAGER"]', '2025-12-22 20:11:37.81831', '2025-12-22 20:11:37.81831');
INSERT INTO public.system_settings VALUES ('8f952460-ed1f-400c-8758-a98d4ee7dd5b', '00000000-0000-0000-0000-000000000001', 'finance', 'finance_expense_breakdown_positions', '["GENERAL_MANAGER", "DIRECTOR", "REGION_MANAGER"]', '2025-12-22 20:11:37.81831', '2025-12-22 20:11:37.81831');
INSERT INTO public.system_settings VALUES ('c0e0d3ce-7256-495c-a1aa-9f1054e32f13', '00000000-0000-0000-0000-000000000001', 'finance', 'finance_settings_positions', '["GENERAL_MANAGER", "DIRECTOR"]', '2025-12-22 20:11:37.81831', '2025-12-22 20:11:37.81831');
INSERT INTO public.system_settings VALUES ('f97265d9-531d-4f6f-af25-da7ded47f4db', '00000000-0000-0000-0000-000000000001', 'finance', 'finance_show_amortization_warning', '{"type": "boolean", "label": "Amorti Uyarısı Göster", "value": "true", "description": "Finans sayfasında Amorti Edilemiyor uyarı kartını göster"}', '2025-12-22 20:45:32.590346', '2025-12-22 20:49:18.278523');
INSERT INTO public.system_settings VALUES ('f16670e6-f0a2-4f57-883b-8f8430880d81', NULL, 'theme', 'default_theme', '{"type": "select", "label": "Varsayılan Tema", "value": "corporate", "description": "Yeni kullanıcılar için varsayılan tema"}', '2025-12-22 17:09:38.19116', '2025-12-22 20:49:38.295147');
INSERT INTO public.system_settings VALUES ('19e027f2-52ce-4c1e-bb93-0ef33487cc42', NULL, 'ldap', 'ldap_server_url', '"ldap://localhost:389"', '2025-12-24 22:52:47.932948', '2025-12-24 22:52:47.932948');
INSERT INTO public.system_settings VALUES ('9b885a64-58fd-4ac0-844a-4898fa19b8aa', '00000000-0000-0000-0000-000000000001', 'finance', 'finance_amortization_positions', '["GENERAL_MANAGER", "DIRECTOR", "REGION_MANAGER"]', '2025-12-22 20:45:32.590346', '2025-12-22 20:45:32.590346');
INSERT INTO public.system_settings VALUES ('61e49316-9e98-4374-8c2f-e6a26eb2c7d6', NULL, 'ldap', 'ldap_bind_dn', '"cn=admin,dc=clixer,dc=local"', '2025-12-24 22:52:47.932948', '2025-12-24 22:52:47.932948');
INSERT INTO public.system_settings VALUES ('23ba266b-782d-425d-aa96-a319949d93a2', NULL, 'ldap', 'ldap_bind_password', '"admin123"', '2025-12-24 22:52:47.932948', '2025-12-24 22:52:47.932948');
INSERT INTO public.system_settings VALUES ('e316bd7d-359f-47ec-8284-f4ce69ba406b', NULL, 'ldap', 'ldap_base_dn', '"dc=clixer,dc=local"', '2025-12-24 22:52:47.932948', '2025-12-24 22:52:47.932948');
INSERT INTO public.system_settings VALUES ('1cb0161d-f968-4075-bed6-15654ebe07d4', NULL, 'ldap', 'ldap_enabled', 'true', '2025-12-24 22:52:47.932948', '2025-12-24 22:52:47.932948');
INSERT INTO public.system_settings VALUES ('269af515-4e56-4158-94aa-16b17df11da6', '00000000-0000-0000-0000-000000000001', 'security', 'admin_ip_whitelist', '["*"]', '2025-12-27 00:22:55.790418', '2025-12-27 00:22:55.790418');
INSERT INTO public.system_settings VALUES ('010834d4-cde3-4ca7-adf8-a6f8657486bd', NULL, 'performance', 'cache_auto_warmup', '{"enabled": false, "description": "Sunucu başlangıcında popüler dashboardları önceden cachele"}', '2025-12-28 15:18:52.158898', '2025-12-28 15:18:52.158898');
INSERT INTO public.system_settings VALUES ('b93b139f-8b31-4c2f-bb14-5e002308f252', NULL, 'performance', 'cache_table_ttl', '{"value": "{\"max\":7200,\"min\":300,\"value\":900,\"description\":\"Tablo cache süresi (saniye)\"}"}', '2025-12-28 15:18:52.158898', '2025-12-28 15:33:52.88723');
INSERT INTO public.system_settings VALUES ('ebb8efd9-e13d-4760-ad04-c0a77cf4dcc4', NULL, 'performance', 'cache_invalidate_on_etl', '{"enabled": true, "description": "ETL sonrası ilgili cache temizlensin mi?"}', '2025-12-28 15:18:52.158898', '2025-12-28 15:46:55.246817');
INSERT INTO public.system_settings VALUES ('40438052-3d2e-4c16-bec9-5dcfddb6617a', NULL, 'performance', 'cache_kpi_ttl', '{"value": 300}', '2025-12-28 15:18:52.158898', '2025-12-29 14:57:52.397013');
INSERT INTO public.system_settings VALUES ('4ab174f7-48fc-454b-aa1b-8969da7b1e35', NULL, 'performance', 'cache_chart_ttl', '{"value": 900}', '2025-12-28 15:18:52.158898', '2025-12-29 14:57:54.422946');
INSERT INTO public.system_settings VALUES ('f75dd5fe-4d3b-475f-a7ae-17471b1c19e9', NULL, 'performance', 'cache_dashboard_ttl', '{"value": 300}', '2025-12-28 15:18:52.158898', '2025-12-29 20:25:48.364798');
INSERT INTO public.system_settings VALUES ('cd9a9bc3-bc93-4be4-b82c-0388a2a29d62', NULL, 'general', 'app_name', '{"type": "string", "label": "Uygulama Adı", "value": "Nebim", "description": "Başlıkta ve menülerde görünecek uygulama adı"}', '2025-12-22 17:09:37.891758', '2025-12-29 18:30:19.528756');
INSERT INTO public.system_settings VALUES ('c67fc0fc-a7e1-4ca1-8241-60b13016b4db', NULL, 'performance', 'cache_enabled', '{"enabled": true, "description": "Genel cache aktif/pasif"}', '2025-12-28 15:18:52.158898', '2025-12-29 20:25:45.747925');


--
-- Data for Name: tenants; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.tenants VALUES ('00000000-0000-0000-0000-000000000001', 'Demo Şirket', 'demo', NULL, '{"theme": "light", "language": "tr"}', true, '2025-12-20 12:20:33.659946', '2025-12-20 12:20:33.659946');


--
-- Data for Name: user_stores; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.user_stores VALUES ('0d3350cc-32bc-4e87-b5a3-ca501c316d30', '10000000-0000-0000-0000-000000000003', 'kadikoy', 'İstanbul Kadıköy', '2025-12-22 20:16:23.064111+00', NULL);
INSERT INTO public.user_stores VALUES ('f965385b-8b71-4d26-b50c-e5bb2baa354a', '10000000-0000-0000-0000-000000000003', '212avm', '212 AVM', '2025-12-22 20:16:23.064111+00', NULL);
INSERT INTO public.user_stores VALUES ('f4936b71-b174-4a2d-9656-29de48e6d81b', '10000000-0000-0000-0000-000000000003', 'istinye', 'İstinye Park', '2025-12-22 20:16:23.064111+00', NULL);
INSERT INTO public.user_stores VALUES ('1da953b4-6b73-44b1-9b2a-401cc3f4b227', '10000000-0000-0000-0000-000000000005', 'kadikoy', 'İstanbul Kadıköy', '2025-12-22 20:16:23.064111+00', NULL);
INSERT INTO public.user_stores VALUES ('23a57261-b3b7-4fff-8feb-3999702bb599', '10000000-0000-0000-0000-000000000005', 'ankara', 'Ankara Kızılay', '2025-12-22 20:16:23.064111+00', NULL);
INSERT INTO public.user_stores VALUES ('bca62c18-0615-4856-ac36-404a325a465e', '10000000-0000-0000-0000-000000000006', 'izmir', 'İzmir Alsancak', '2025-12-22 20:16:23.064111+00', NULL);
INSERT INTO public.user_stores VALUES ('a36ff877-8fee-43b3-afad-97f4d05837d9', '10000000-0000-0000-0000-000000000004', 'izmir', 'İzmir Alsancak', '2025-12-23 09:03:33.693166+00', '00000000-0000-0000-0000-000000000001');
INSERT INTO public.user_stores VALUES ('28fea8ca-0552-4bc2-aa7e-dd1a4536a2f2', '10000000-0000-0000-0000-000000000004', 'istinye', 'İstinye Park', '2025-12-23 09:03:33.694603+00', '00000000-0000-0000-0000-000000000001');
INSERT INTO public.user_stores VALUES ('1f5d7647-85cc-47e5-a044-4ff573d99707', '52621dd0-0fe2-492b-bc1f-9b8d73cc5194', 'M001', 'Kadıköy Merkez', '2025-12-25 17:36:22.880384+00', '00000000-0000-0000-0000-000000000001');
INSERT INTO public.user_stores VALUES ('c562ca8a-3591-46ee-8b26-d53d605d4ebc', '52621dd0-0fe2-492b-bc1f-9b8d73cc5194', '212avm', '212 AVM', '2025-12-25 17:36:22.8812+00', '00000000-0000-0000-0000-000000000001');
INSERT INTO public.user_stores VALUES ('3c827840-64b8-441c-b76a-d32e111969af', '52621dd0-0fe2-492b-bc1f-9b8d73cc5194', 'STORE004', 'ANTALYA MALL OFF', '2025-12-25 17:36:22.88162+00', '00000000-0000-0000-0000-000000000001');
INSERT INTO public.user_stores VALUES ('281dc87e-5e28-4a19-8437-86564f0d1d2e', '52621dd0-0fe2-492b-bc1f-9b8d73cc5194', 'kadikoy', 'İstanbul Kadıköy', '2025-12-25 17:36:22.882069+00', '00000000-0000-0000-0000-000000000001');


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.users VALUES ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'test.bolge@demo.com', '$2a$10$ihWwKNSDCFIkbIZKxOi3jui9dJngPVCHFB.oC1k3N3/zyUcSvJHa.', 'Test Bölge Müdürü', 'MANAGER', true, NULL, false, NULL, '{}', '2025-12-22 20:16:06.973318', '2025-12-25 16:48:20.905434', 'REGION_MANAGER', 'CN=Test Bolge Muduru,OU=Users,DC=demo,DC=com', true, '2025-12-22 20:16:06.973318', '[]', 'MARMARA', NULL);
INSERT INTO public.users VALUES ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'test.gm@demo.com', '$2a$10$ihWwKNSDCFIkbIZKxOi3jui9dJngPVCHFB.oC1k3N3/zyUcSvJHa.', 'Test Genel Müdür', 'ADMIN', true, NULL, false, NULL, '{}', '2025-12-22 20:16:06.973318', '2025-12-25 16:48:20.905434', 'GENERAL_MANAGER', 'CN=Test Genel Mudur,OU=Users,DC=demo,DC=com', true, '2025-12-22 20:16:06.973318', '[]', NULL, NULL);
INSERT INTO public.users VALUES ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'test.direktor@demo.com', '$2a$10$ihWwKNSDCFIkbIZKxOi3jui9dJngPVCHFB.oC1k3N3/zyUcSvJHa.', 'Test Direktör', 'MANAGER', true, NULL, false, NULL, '{}', '2025-12-22 20:16:06.973318', '2025-12-25 16:48:20.905434', 'DIRECTOR', 'CN=Test Direktor,OU=Users,DC=demo,DC=com', true, '2025-12-22 20:16:06.973318', '[]', NULL, NULL);
INSERT INTO public.users VALUES ('52621dd0-0fe2-492b-bc1f-9b8d73cc5194', '00000000-0000-0000-0000-000000000001', 'cihan.adar@sirket.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.AVwP1J1B0.JQWG', 'Cihan Adar', 'USER', true, NULL, false, NULL, '{}', '2025-12-24 21:09:09.967504', '2025-12-25 17:36:22.877187', 'VIEWER', 'uid=cadar,ou=Users,dc=clixer,dc=local', true, '2025-12-25 16:30:56.780178', '[]', '1', NULL);
INSERT INTO public.users VALUES ('daffbf23-58a8-47a3-b5f9-cd66befe666c', '00000000-0000-0000-0000-000000000001', 'volkan.mumcu@sirket.com', '', 'Volkan Mumcu', 'USER', true, NULL, false, NULL, '{}', '2025-12-24 21:09:09.962212', '2025-12-25 16:30:56.764073', 'VIEWER', 'uid=vmumcu,ou=Users,dc=clixer,dc=local', true, '2025-12-25 16:30:56.764073', '[]', NULL, NULL);
INSERT INTO public.users VALUES ('f759b1eb-df7b-4e2a-8c46-298721439eb5', '00000000-0000-0000-0000-000000000001', 'dogan.topkaya@sirket.com', '', 'Doğan Topkaya', 'USER', true, NULL, false, NULL, '{}', '2025-12-24 21:09:09.970162', '2025-12-25 16:30:56.782209', 'VIEWER', 'uid=dtopkaya,ou=Users,dc=clixer,dc=local', true, '2025-12-25 16:30:56.782209', '[]', NULL, NULL);
INSERT INTO public.users VALUES ('86c11c6c-9aa9-4a7a-8f10-1b4719361a75', '00000000-0000-0000-0000-000000000001', 'emir.turhan@sirket.com', '', 'Emir Turhan', 'USER', true, NULL, false, NULL, '{}', '2025-12-24 21:09:09.972188', '2025-12-25 16:30:56.783316', 'VIEWER', 'uid=eturhan,ou=Users,dc=clixer,dc=local', true, '2025-12-25 16:30:56.783316', '[]', NULL, NULL);
INSERT INTO public.users VALUES ('2a37eb4d-7e5d-418f-9ff9-a7c9e66c63e3', '00000000-0000-0000-0000-000000000001', 'musa.kabatas@sirket.com', '', 'Musa Kabataş', 'USER', true, NULL, false, NULL, '{}', '2025-12-24 21:09:09.975054', '2025-12-25 16:30:56.784204', 'VIEWER', 'uid=mkabatas,ou=Users,dc=clixer,dc=local', true, '2025-12-25 16:30:56.784204', '[]', NULL, NULL);
INSERT INTO public.users VALUES ('4e294fdf-8874-46d6-9f6a-6e410030eb08', '00000000-0000-0000-0000-000000000001', 'kubra.erol@sirket.com', '', 'Kübra Erol', 'USER', true, NULL, false, NULL, '{}', '2025-12-24 21:09:09.977036', '2025-12-25 16:30:56.785009', 'VIEWER', 'uid=kerol,ou=Users,dc=clixer,dc=local', true, '2025-12-25 16:30:56.785009', '[]', NULL, NULL);
INSERT INTO public.users VALUES ('107b1d66-288c-4512-a476-c0ada5ecfd24', '00000000-0000-0000-0000-000000000001', 'saadet.ozkum@sirket.com', '', 'Saadet Özkum', 'USER', true, NULL, false, NULL, '{}', '2025-12-24 21:09:09.97897', '2025-12-25 16:30:56.785987', 'VIEWER', 'uid=sozkum,ou=Users,dc=clixer,dc=local', true, '2025-12-25 16:30:56.785987', '[]', NULL, NULL);
INSERT INTO public.users VALUES ('e4077782-1735-405d-bf76-d9d3c0e68de8', '00000000-0000-0000-0000-000000000001', 'fatma.yilmaz@sirket.com', '', 'Fatma Yılmaz', 'USER', true, NULL, false, NULL, '{}', '2025-12-24 21:09:09.980846', '2025-12-25 16:30:56.787603', 'VIEWER', 'uid=fyilmaz,ou=Users,dc=clixer,dc=local', true, '2025-12-25 16:30:56.787603', '[]', NULL, NULL);
INSERT INTO public.users VALUES ('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'test.analist@demo.com', '$2a$10$ihWwKNSDCFIkbIZKxOi3jui9dJngPVCHFB.oC1k3N3/zyUcSvJHa.', 'Test Analist', 'ANALYST', true, NULL, false, NULL, '{}', '2025-12-22 20:16:06.973318', '2025-12-25 16:48:20.905434', 'ANALYST', 'CN=Test Analist,OU=Users,DC=demo,DC=com', true, '2025-12-22 20:16:06.973318', '[]', NULL, NULL);
INSERT INTO public.users VALUES ('10000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 'test.izleyici@demo.com', '$2a$10$ihWwKNSDCFIkbIZKxOi3jui9dJngPVCHFB.oC1k3N3/zyUcSvJHa.', 'Test İzleyici', 'VIEWER', true, NULL, false, NULL, '{}', '2025-12-22 20:16:06.973318', '2025-12-25 16:48:20.905434', 'VIEWER', 'CN=Test Izleyici,OU=Users,DC=demo,DC=com', true, '2025-12-22 20:16:06.973318', '[]', NULL, NULL);
INSERT INTO public.users VALUES ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'test.magaza@demo.com', '$2a$10$ihWwKNSDCFIkbIZKxOi3jui9dJngPVCHFB.oC1k3N3/zyUcSvJHa.', 'Test Mağaza Müdürü', 'VIEWER', true, NULL, false, NULL, '{}', '2025-12-22 20:16:06.973318', '2025-12-25 16:49:55.631214', 'STORE_MANAGER', 'CN=Test Magaza Muduru,OU=Users,DC=demo,DC=com', true, '2025-12-22 20:16:06.973318', '[]', '1', NULL);
INSERT INTO public.users VALUES ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'admin@clixer', '$2a$12$vbYIs9ged8NvSP2Oc1yFweiTJPWPr32HSwNr2fBw1V/RamN3t.XUC', 'Admin Clixer', 'ADMIN', true, NULL, false, 'PE5UG3ZYJMXHUSKNJMQTK5KINZKWCNKXFJ2DKNZQMNMEE5CWMJSQ', '{}', '2025-12-20 12:20:33.660659', '2025-12-30 00:39:45.621792', 'GENERAL_MANAGER', NULL, false, NULL, '[]', NULL, '{6Q991J,MIK38L,82NFE8,8KW28Q,H1IFOP,AB2QMF,UG6NWN,6AJNP3}');
INSERT INTO public.users VALUES ('38a18128-ba64-49b8-8bd3-fd9a223a37f6', '00000000-0000-0000-0000-000000000001', 'nilay@demo.com', '$2a$12$YdFW5QlPSAW2eICRHCX7TeePfjQqZmB1RGqDwb4.sEKL37Nw1.wc2', 'nilay adar', 'MANAGER', true, NULL, false, NULL, '{}', '2025-12-25 18:16:29.610643', '2025-12-30 00:17:14.998629', 'GENERAL_MANAGER', NULL, false, NULL, '[]', '17', NULL);
INSERT INTO public.users VALUES ('b34d3e66-5952-4344-9f98-eef8eaf3186e', '00000000-0000-0000-0000-000000000001', 'poyraz@demo.com', '$2b$12$jAIm7YIDA8sLPpItA9DQ4uRFHumf.ZEUoVH5hALUtuJj5yRpsLbjK', 'poyraz adar', 'USER', true, NULL, false, NULL, '{}', '2025-12-25 17:56:56.414156', '2025-12-30 00:17:27.203621', 'STORE_MANAGER', NULL, false, NULL, '[]', '15', NULL);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: components components_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.components
    ADD CONSTRAINT components_pkey PRIMARY KEY (id);


--
-- Name: data_connections data_connections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_connections
    ADD CONSTRAINT data_connections_pkey PRIMARY KEY (id);


--
-- Name: datasets datasets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.datasets
    ADD CONSTRAINT datasets_pkey PRIMARY KEY (id);


--
-- Name: design_permissions design_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.design_permissions
    ADD CONSTRAINT design_permissions_pkey PRIMARY KEY (id);


--
-- Name: design_widgets design_widgets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.design_widgets
    ADD CONSTRAINT design_widgets_pkey PRIMARY KEY (id);


--
-- Name: designs designs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.designs
    ADD CONSTRAINT designs_pkey PRIMARY KEY (id);


--
-- Name: etl_jobs etl_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.etl_jobs
    ADD CONSTRAINT etl_jobs_pkey PRIMARY KEY (id);


--
-- Name: etl_scheduler_logs etl_scheduler_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.etl_scheduler_logs
    ADD CONSTRAINT etl_scheduler_logs_pkey PRIMARY KEY (id);


--
-- Name: etl_schedules etl_schedules_dataset_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.etl_schedules
    ADD CONSTRAINT etl_schedules_dataset_id_key UNIQUE (dataset_id);


--
-- Name: etl_schedules etl_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.etl_schedules
    ADD CONSTRAINT etl_schedules_pkey PRIMARY KEY (id);


--
-- Name: ldap_config ldap_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ldap_config
    ADD CONSTRAINT ldap_config_pkey PRIMARY KEY (id);


--
-- Name: ldap_config ldap_config_tenant_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ldap_config
    ADD CONSTRAINT ldap_config_tenant_id_key UNIQUE (tenant_id);


--
-- Name: ldap_position_mappings ldap_position_mappings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ldap_position_mappings
    ADD CONSTRAINT ldap_position_mappings_pkey PRIMARY KEY (id);


--
-- Name: ldap_position_mappings ldap_position_mappings_tenant_id_ldap_group_dn_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ldap_position_mappings
    ADD CONSTRAINT ldap_position_mappings_tenant_id_ldap_group_dn_key UNIQUE (tenant_id, ldap_group_dn);


--
-- Name: ldap_store_mappings ldap_store_mappings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ldap_store_mappings
    ADD CONSTRAINT ldap_store_mappings_pkey PRIMARY KEY (id);


--
-- Name: ldap_store_mappings ldap_store_mappings_tenant_id_ldap_group_dn_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ldap_store_mappings
    ADD CONSTRAINT ldap_store_mappings_tenant_id_ldap_group_dn_key UNIQUE (tenant_id, ldap_group_dn);


--
-- Name: ldap_sync_logs ldap_sync_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ldap_sync_logs
    ADD CONSTRAINT ldap_sync_logs_pkey PRIMARY KEY (id);


--
-- Name: menu_permissions menu_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_permissions
    ADD CONSTRAINT menu_permissions_pkey PRIMARY KEY (id);


--
-- Name: menu_permissions menu_permissions_position_code_menu_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_permissions
    ADD CONSTRAINT menu_permissions_position_code_menu_key_key UNIQUE (position_code, menu_key);


--
-- Name: metrics metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metrics
    ADD CONSTRAINT metrics_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: ownership_groups ownership_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ownership_groups
    ADD CONSTRAINT ownership_groups_pkey PRIMARY KEY (id);


--
-- Name: ownership_groups ownership_groups_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ownership_groups
    ADD CONSTRAINT ownership_groups_tenant_id_code_key UNIQUE (tenant_id, code);


--
-- Name: positions positions_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.positions
    ADD CONSTRAINT positions_code_key UNIQUE (code);


--
-- Name: positions positions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.positions
    ADD CONSTRAINT positions_pkey PRIMARY KEY (id);


--
-- Name: regions regions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.regions
    ADD CONSTRAINT regions_pkey PRIMARY KEY (id);


--
-- Name: regions regions_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.regions
    ADD CONSTRAINT regions_tenant_id_code_key UNIQUE (tenant_id, code);


--
-- Name: store_finance_settings store_finance_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_finance_settings
    ADD CONSTRAINT store_finance_settings_pkey PRIMARY KEY (id);


--
-- Name: store_finance_settings store_finance_settings_tenant_id_store_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_finance_settings
    ADD CONSTRAINT store_finance_settings_tenant_id_store_id_key UNIQUE (tenant_id, store_id);


--
-- Name: stores stores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stores
    ADD CONSTRAINT stores_pkey PRIMARY KEY (id);


--
-- Name: stores stores_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stores
    ADD CONSTRAINT stores_tenant_id_code_key UNIQUE (tenant_id, code);


--
-- Name: system_settings system_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_pkey PRIMARY KEY (id);


--
-- Name: system_settings system_settings_tenant_id_category_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_tenant_id_category_key_key UNIQUE (tenant_id, category, key);


--
-- Name: tenants tenants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_pkey PRIMARY KEY (id);


--
-- Name: tenants tenants_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_slug_key UNIQUE (slug);


--
-- Name: user_stores user_stores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_stores
    ADD CONSTRAINT user_stores_pkey PRIMARY KEY (id);


--
-- Name: user_stores user_stores_user_id_store_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_stores
    ADD CONSTRAINT user_stores_user_id_store_id_key UNIQUE (user_id, store_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_tenant_id_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_tenant_id_email_key UNIQUE (tenant_id, email);


--
-- Name: idx_audit_logs_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_action ON public.audit_logs USING btree (action);


--
-- Name: idx_audit_logs_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_created ON public.audit_logs USING btree (created_at);


--
-- Name: idx_audit_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_created_at ON public.audit_logs USING btree (created_at DESC);


--
-- Name: idx_audit_logs_created_at_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_created_at_action ON public.audit_logs USING btree (created_at DESC, action);


--
-- Name: idx_audit_logs_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_tenant ON public.audit_logs USING btree (tenant_id);


--
-- Name: idx_audit_logs_tenant_action_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_tenant_action_date ON public.audit_logs USING btree (tenant_id, action, created_at DESC);


--
-- Name: idx_audit_logs_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_tenant_id ON public.audit_logs USING btree (tenant_id);


--
-- Name: idx_audit_logs_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_user ON public.audit_logs USING btree (user_id);


--
-- Name: idx_audit_logs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_user_id ON public.audit_logs USING btree (user_id);


--
-- Name: idx_components_dataset; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_components_dataset ON public.components USING btree (dataset_id);


--
-- Name: idx_components_design; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_components_design ON public.components USING btree (design_id);


--
-- Name: idx_connections_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_connections_status ON public.data_connections USING btree (status);


--
-- Name: idx_connections_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_connections_tenant ON public.data_connections USING btree (tenant_id);


--
-- Name: idx_datasets_connection; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_datasets_connection ON public.datasets USING btree (connection_id);


--
-- Name: idx_datasets_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_datasets_status ON public.datasets USING btree (status);


--
-- Name: idx_datasets_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_datasets_tenant ON public.datasets USING btree (tenant_id);


--
-- Name: idx_designs_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_designs_tenant ON public.designs USING btree (tenant_id);


--
-- Name: idx_etl_jobs_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_etl_jobs_created ON public.etl_jobs USING btree (created_at DESC);


--
-- Name: idx_etl_jobs_dataset; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_etl_jobs_dataset ON public.etl_jobs USING btree (dataset_id);


--
-- Name: idx_etl_jobs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_etl_jobs_status ON public.etl_jobs USING btree (status);


--
-- Name: idx_etl_jobs_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_etl_jobs_tenant ON public.etl_jobs USING btree (tenant_id);


--
-- Name: idx_etl_schedules_dataset; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_etl_schedules_dataset ON public.etl_schedules USING btree (dataset_id);


--
-- Name: idx_etl_schedules_next_run; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_etl_schedules_next_run ON public.etl_schedules USING btree (next_run_at) WHERE (is_active = true);


--
-- Name: idx_ldap_pos_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ldap_pos_tenant ON public.ldap_position_mappings USING btree (tenant_id);


--
-- Name: idx_ldap_store_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ldap_store_tenant ON public.ldap_store_mappings USING btree (tenant_id);


--
-- Name: idx_ldap_sync_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ldap_sync_date ON public.ldap_sync_logs USING btree (started_at DESC);


--
-- Name: idx_ldap_sync_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ldap_sync_tenant ON public.ldap_sync_logs USING btree (tenant_id);


--
-- Name: idx_metrics_dataset; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_metrics_dataset ON public.metrics USING btree (dataset_id);


--
-- Name: idx_metrics_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_metrics_tenant ON public.metrics USING btree (tenant_id);


--
-- Name: idx_notifications_unread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_unread ON public.notifications USING btree (user_id, is_read) WHERE (is_read = false);


--
-- Name: idx_notifications_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user ON public.notifications USING btree (user_id);


--
-- Name: idx_ownership_groups_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ownership_groups_tenant ON public.ownership_groups USING btree (tenant_id);


--
-- Name: idx_regions_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_regions_tenant ON public.regions USING btree (tenant_id);


--
-- Name: idx_scheduler_logs_checked; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scheduler_logs_checked ON public.etl_scheduler_logs USING btree (checked_at DESC);


--
-- Name: idx_store_finance_store; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_store_finance_store ON public.store_finance_settings USING btree (store_id);


--
-- Name: idx_store_finance_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_store_finance_tenant ON public.store_finance_settings USING btree (tenant_id);


--
-- Name: idx_stores_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stores_active ON public.stores USING btree (is_active) WHERE (is_active = true);


--
-- Name: idx_stores_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stores_code ON public.stores USING btree (code);


--
-- Name: idx_stores_ownership; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stores_ownership ON public.stores USING btree (ownership_group);


--
-- Name: idx_stores_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stores_tenant ON public.stores USING btree (tenant_id);


--
-- Name: idx_user_stores_store; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_stores_store ON public.user_stores USING btree (store_id);


--
-- Name: idx_user_stores_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_stores_user ON public.user_stores USING btree (user_id);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: idx_users_ldap_dn; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_ldap_dn ON public.users USING btree (ldap_dn);


--
-- Name: idx_users_position; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_position ON public.users USING btree (position_code);


--
-- Name: components update_components_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_components_updated_at BEFORE UPDATE ON public.components FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: data_connections update_data_connections_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_data_connections_updated_at BEFORE UPDATE ON public.data_connections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: datasets update_datasets_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_datasets_updated_at BEFORE UPDATE ON public.datasets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: designs update_designs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_designs_updated_at BEFORE UPDATE ON public.designs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: etl_schedules update_etl_schedules_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_etl_schedules_updated_at BEFORE UPDATE ON public.etl_schedules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: metrics update_metrics_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_metrics_updated_at BEFORE UPDATE ON public.metrics FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: system_settings update_system_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_system_settings_updated_at BEFORE UPDATE ON public.system_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: tenants update_tenants_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: users update_users_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: components components_dataset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.components
    ADD CONSTRAINT components_dataset_id_fkey FOREIGN KEY (dataset_id) REFERENCES public.datasets(id) ON DELETE SET NULL;


--
-- Name: components components_design_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.components
    ADD CONSTRAINT components_design_id_fkey FOREIGN KEY (design_id) REFERENCES public.designs(id) ON DELETE CASCADE;


--
-- Name: components components_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.components
    ADD CONSTRAINT components_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: data_connections data_connections_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_connections
    ADD CONSTRAINT data_connections_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: data_connections data_connections_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_connections
    ADD CONSTRAINT data_connections_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: datasets datasets_connection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.datasets
    ADD CONSTRAINT datasets_connection_id_fkey FOREIGN KEY (connection_id) REFERENCES public.data_connections(id) ON DELETE CASCADE;


--
-- Name: datasets datasets_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.datasets
    ADD CONSTRAINT datasets_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: datasets datasets_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.datasets
    ADD CONSTRAINT datasets_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: design_permissions design_permissions_design_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.design_permissions
    ADD CONSTRAINT design_permissions_design_id_fkey FOREIGN KEY (design_id) REFERENCES public.designs(id) ON DELETE CASCADE;


--
-- Name: design_widgets design_widgets_design_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.design_widgets
    ADD CONSTRAINT design_widgets_design_id_fkey FOREIGN KEY (design_id) REFERENCES public.designs(id) ON DELETE CASCADE;


--
-- Name: design_widgets design_widgets_metric_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.design_widgets
    ADD CONSTRAINT design_widgets_metric_id_fkey FOREIGN KEY (metric_id) REFERENCES public.metrics(id) ON DELETE SET NULL;


--
-- Name: designs designs_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.designs
    ADD CONSTRAINT designs_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: designs designs_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.designs
    ADD CONSTRAINT designs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: etl_jobs etl_jobs_dataset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.etl_jobs
    ADD CONSTRAINT etl_jobs_dataset_id_fkey FOREIGN KEY (dataset_id) REFERENCES public.datasets(id) ON DELETE CASCADE;


--
-- Name: etl_jobs etl_jobs_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.etl_jobs
    ADD CONSTRAINT etl_jobs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: etl_jobs etl_jobs_triggered_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.etl_jobs
    ADD CONSTRAINT etl_jobs_triggered_by_fkey FOREIGN KEY (triggered_by) REFERENCES public.users(id);


--
-- Name: etl_scheduler_logs etl_scheduler_logs_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.etl_scheduler_logs
    ADD CONSTRAINT etl_scheduler_logs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: etl_schedules etl_schedules_dataset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.etl_schedules
    ADD CONSTRAINT etl_schedules_dataset_id_fkey FOREIGN KEY (dataset_id) REFERENCES public.datasets(id) ON DELETE CASCADE;


--
-- Name: etl_schedules etl_schedules_last_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.etl_schedules
    ADD CONSTRAINT etl_schedules_last_job_id_fkey FOREIGN KEY (last_job_id) REFERENCES public.etl_jobs(id);


--
-- Name: etl_schedules etl_schedules_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.etl_schedules
    ADD CONSTRAINT etl_schedules_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: ldap_config ldap_config_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ldap_config
    ADD CONSTRAINT ldap_config_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: ldap_position_mappings ldap_position_mappings_position_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ldap_position_mappings
    ADD CONSTRAINT ldap_position_mappings_position_code_fkey FOREIGN KEY (position_code) REFERENCES public.positions(code);


--
-- Name: ldap_position_mappings ldap_position_mappings_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ldap_position_mappings
    ADD CONSTRAINT ldap_position_mappings_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: ldap_store_mappings ldap_store_mappings_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ldap_store_mappings
    ADD CONSTRAINT ldap_store_mappings_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: ldap_sync_logs ldap_sync_logs_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ldap_sync_logs
    ADD CONSTRAINT ldap_sync_logs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: menu_permissions menu_permissions_position_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_permissions
    ADD CONSTRAINT menu_permissions_position_code_fkey FOREIGN KEY (position_code) REFERENCES public.positions(code) ON DELETE CASCADE;


--
-- Name: metrics metrics_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metrics
    ADD CONSTRAINT metrics_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: metrics metrics_dataset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metrics
    ADD CONSTRAINT metrics_dataset_id_fkey FOREIGN KEY (dataset_id) REFERENCES public.datasets(id) ON DELETE SET NULL;


--
-- Name: metrics metrics_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metrics
    ADD CONSTRAINT metrics_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: ownership_groups ownership_groups_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ownership_groups
    ADD CONSTRAINT ownership_groups_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: regions regions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.regions
    ADD CONSTRAINT regions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: store_finance_settings store_finance_settings_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_finance_settings
    ADD CONSTRAINT store_finance_settings_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: stores stores_region_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stores
    ADD CONSTRAINT stores_region_id_fkey FOREIGN KEY (region_id) REFERENCES public.regions(id);


--
-- Name: stores stores_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stores
    ADD CONSTRAINT stores_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: system_settings system_settings_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: user_stores user_stores_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_stores
    ADD CONSTRAINT user_stores_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.users(id);


--
-- Name: user_stores user_stores_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_stores
    ADD CONSTRAINT user_stores_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users users_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict gWr2dU6A5k3t90Amn9zZc00VQIX75lMCLJZXbdJ6IKmCCxgHA2mdYZtVQhp41mY


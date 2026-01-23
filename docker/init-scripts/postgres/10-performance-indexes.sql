-- ============================================
-- CLIXER - Performance Indexes & FK Constraints
-- Composite indexes for common query patterns
-- ============================================

-- ============================================
-- COMPOSITE INDEXES
-- ============================================

-- Users: tenant + active (user list queries)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_tenant_active 
ON public.users(tenant_id, is_active) WHERE is_active = true;

-- Users: tenant + role (role-based queries)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_tenant_role 
ON public.users(tenant_id, role);

-- ETL Jobs: dataset + status (job monitoring)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_etl_jobs_dataset_status 
ON public.etl_jobs(dataset_id, status);

-- ETL Jobs: tenant + created_at (job history)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_etl_jobs_tenant_created 
ON public.etl_jobs(tenant_id, created_at DESC);

-- ETL Jobs: status + started_at (stuck job detection)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_etl_jobs_running 
ON public.etl_jobs(status, started_at) WHERE status = 'running';

-- Audit Logs: tenant + created_at (audit queries)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_tenant_created 
ON public.audit_logs(tenant_id, created_at DESC);

-- Audit Logs: tenant + action + created_at (filtered audit)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_tenant_action_created 
ON public.audit_logs(tenant_id, action, created_at DESC);

-- Designs: tenant + active (design list)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_designs_tenant_active 
ON public.designs(tenant_id, is_active) WHERE is_active = true;

-- Designs: tenant + category (category filtering)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_designs_tenant_category 
ON public.designs(tenant_id, category_id);

-- Stores: tenant + region (regional queries)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stores_tenant_region 
ON public.stores(tenant_id, region_id);

-- Stores: tenant + ownership_group
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stores_tenant_ownership 
ON public.stores(tenant_id, ownership_group);

-- Datasets: tenant + status (dataset list)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_datasets_tenant_status 
ON public.datasets(tenant_id, status);

-- Data Connections: tenant + status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_connections_tenant_status 
ON public.data_connections(tenant_id, status);

-- Metrics: tenant + dataset (metric queries)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_metrics_tenant_dataset 
ON public.metrics(tenant_id, dataset_id);

-- Notifications: user + created_at (notification history)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_created 
ON public.notifications(user_id, created_at DESC);

-- User Stores: composite for joins
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_stores_user_store 
ON public.user_stores(user_id, store_id);

-- User Report Categories: composite for joins
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_report_categories_composite 
ON public.user_report_categories(user_id, category_id);

-- ============================================
-- FOREIGN KEY CONSTRAINTS
-- ============================================

-- Add FK constraint for designs.category_id -> report_categories.id
-- First check if constraint exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_designs_category' 
    AND table_name = 'designs'
  ) THEN
    ALTER TABLE public.designs 
    ADD CONSTRAINT fk_designs_category 
    FOREIGN KEY (category_id) 
    REFERENCES public.report_categories(id) 
    ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================
-- ANALYZE TABLES
-- Update statistics for query planner
-- ============================================

ANALYZE public.users;
ANALYZE public.stores;
ANALYZE public.regions;
ANALYZE public.designs;
ANALYZE public.metrics;
ANALYZE public.datasets;
ANALYZE public.data_connections;
ANALYZE public.etl_jobs;
ANALYZE public.audit_logs;
ANALYZE public.notifications;
ANALYZE public.user_stores;
ANALYZE public.user_report_categories;

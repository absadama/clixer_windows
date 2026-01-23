-- ============================================
-- REPORT CATEGORIES MIGRATION
-- Güçler Ayrılığı için rapor kategorileri
-- ============================================

-- Report Categories tablosu
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

-- User Report Categories tablosu (Kullanıcı-Kategori ilişkisi)
CREATE TABLE IF NOT EXISTS public.user_report_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    category_id uuid NOT NULL REFERENCES public.report_categories(id) ON DELETE CASCADE,
    assigned_at timestamp without time zone DEFAULT now(),
    assigned_by uuid REFERENCES public.users(id),
    UNIQUE (user_id, category_id)
);

-- Designs tablosuna category_id kolonu ekle
ALTER TABLE public.designs ADD COLUMN IF NOT EXISTS category_id uuid;

-- Users tablosuna can_see_all_categories kolonu ekle (varsayılan: false - kategori atanmalı)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS can_see_all_categories boolean DEFAULT false;

-- Index'ler
CREATE INDEX IF NOT EXISTS idx_report_categories_tenant ON public.report_categories(tenant_id);
CREATE INDEX IF NOT EXISTS idx_report_categories_code ON public.report_categories(code);
CREATE INDEX IF NOT EXISTS idx_user_report_categories_user ON public.user_report_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_user_report_categories_category ON public.user_report_categories(category_id);
CREATE INDEX IF NOT EXISTS idx_designs_category ON public.designs(category_id);

-- ============================================
-- MIGRATION TAMAMLANDI
-- ============================================

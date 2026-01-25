-- Navigation Items Table for Dynamic Search
-- Tüm menüler, sayfalar, tablar, komutlar burada saklanır
-- Search ve Sidebar bu tabloyu kullanır

CREATE TABLE IF NOT EXISTS public.navigation_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
    
    -- Item tipi: page, tab, command, setting, sidebar_group, sidebar_item
    item_type varchar(50) NOT NULL,
    
    -- Temel bilgiler
    code varchar(100) NOT NULL,           -- Benzersiz kod (örn: page-dashboard, tab-admin-users)
    label varchar(255) NOT NULL,          -- Görünen isim
    description text,                      -- Açıklama
    
    -- Navigasyon
    path varchar(255),                     -- URL path (örn: /dashboard, /admin?tab=users)
    icon varchar(100),                     -- Lucide icon adı (örn: LayoutDashboard)
    
    -- Hiyerarşi
    parent_id uuid REFERENCES public.navigation_items(id) ON DELETE CASCADE,
    parent_code varchar(100),              -- Parent'ın kodu (kolay referans için)
    
    -- Arama optimizasyonu
    keywords text[],                       -- Arama anahtar kelimeleri
    search_priority int DEFAULT 0,         -- Yüksek = önce göster
    
    -- Yetkilendirme
    required_roles text[],                 -- Gerekli roller (SUPER_ADMIN, ADMIN, USER)
    required_permissions text[],           -- Gerekli izinler
    
    -- Görünürlük
    is_active boolean DEFAULT true,
    is_searchable boolean DEFAULT true,    -- Search'te görünsün mü?
    is_visible_in_menu boolean DEFAULT true, -- Sidebar'da görünsün mü?
    
    -- Sıralama
    sort_order int DEFAULT 0,
    
    -- Meta
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    
    UNIQUE(tenant_id, code)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_nav_items_tenant ON public.navigation_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_nav_items_type ON public.navigation_items(item_type);
CREATE INDEX IF NOT EXISTS idx_nav_items_parent ON public.navigation_items(parent_id);
CREATE INDEX IF NOT EXISTS idx_nav_items_code ON public.navigation_items(code);
CREATE INDEX IF NOT EXISTS idx_nav_items_searchable ON public.navigation_items(is_searchable) WHERE is_searchable = true;

-- Full text search index for Turkish
CREATE INDEX IF NOT EXISTS idx_nav_items_search ON public.navigation_items 
    USING gin(to_tsvector('turkish', coalesce(label, '') || ' ' || coalesce(description, '') || ' ' || coalesce(array_to_string(keywords, ' '), '')));

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_navigation_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_navigation_items_updated_at ON public.navigation_items;
CREATE TRIGGER trigger_navigation_items_updated_at
    BEFORE UPDATE ON public.navigation_items
    FOR EACH ROW
    EXECUTE FUNCTION update_navigation_items_updated_at();

-- Comment
COMMENT ON TABLE public.navigation_items IS 'Dynamic navigation items for search and sidebar - supports multi-tenant';

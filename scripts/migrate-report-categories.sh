#!/bin/bash
# ============================================
# CLIXER - Report Categories Migration
# Güçler Ayrılığı özelliği için veritabanı migration
# ============================================

set -e

echo "=========================================="
echo "CLIXER - Report Categories Migration"
echo "=========================================="

# PostgreSQL bağlantı bilgileri
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-clixer}"
DB_USER="${DB_USER:-clixer}"

echo "Database: $DB_NAME @ $DB_HOST:$DB_PORT"
echo ""

# Migration SQL
MIGRATION_SQL="
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

-- Users tablosuna can_see_all_categories kolonu ekle (varsayılan: false)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS can_see_all_categories boolean DEFAULT false;

-- Index'ler
CREATE INDEX IF NOT EXISTS idx_report_categories_tenant ON public.report_categories(tenant_id);
CREATE INDEX IF NOT EXISTS idx_report_categories_code ON public.report_categories(code);
CREATE INDEX IF NOT EXISTS idx_user_report_categories_user ON public.user_report_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_user_report_categories_category ON public.user_report_categories(category_id);
CREATE INDEX IF NOT EXISTS idx_designs_category ON public.designs(category_id);

-- Mevcut kullanıcıları true yap (geriye uyumluluk - mevcut kullanıcılar tüm raporları görebilsin)
-- Yeni kullanıcılar false olarak gelecek
UPDATE public.users SET can_see_all_categories = true WHERE can_see_all_categories IS NULL;
"

echo "Running migration..."
echo ""

# Docker ortamında mı yoksa doğrudan mı?
if command -v docker &> /dev/null && docker ps --format '{{.Names}}' | grep -q 'clixer_postgres\|postgres'; then
    # Docker container'da çalıştır
    CONTAINER_NAME=$(docker ps --format '{{.Names}}' | grep -E 'clixer_postgres|postgres' | head -1)
    echo "Using Docker container: $CONTAINER_NAME"
    echo "$MIGRATION_SQL" | docker exec -i "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME"
else
    # Doğrudan psql ile çalıştır
    echo "Using direct psql connection"
    echo "$MIGRATION_SQL" | PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME"
fi

echo ""
echo "=========================================="
echo "Migration completed successfully!"
echo "=========================================="
echo ""
echo "Yeni özellikler:"
echo "  - Rapor Kategorileri yönetimi (Admin Panel)"
echo "  - Kullanıcılara kategori atama"
echo "  - Raporlara kategori atama (Designer)"
echo "  - Güçler Ayrılığı: Her kullanıcı sadece kendi kategorisindeki raporları görür"
echo ""

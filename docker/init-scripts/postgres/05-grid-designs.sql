-- Grid Designs Table - Kullanıcı DataGrid Tasarımları
-- Enterprise DataGrid için kullanıcı bazlı tasarım kaydetme

CREATE TABLE IF NOT EXISTS grid_designs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    grid_id VARCHAR(100) NOT NULL,  -- Hangi grid için (demo-grid, sales-grid, etc.)
    name VARCHAR(200) NOT NULL,
    state JSONB NOT NULL,  -- Kolon sırası, gizli kolonlar, filtreler, gruplama vb.
    is_default BOOLEAN DEFAULT false,
    dataset_id UUID REFERENCES datasets(id) ON DELETE SET NULL,  -- Hangi dataset ile çalışıyor
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Her kullanıcı her grid için aynı isimde sadece 1 tasarım olabilir
    UNIQUE (user_id, grid_id, name)
);

-- Index'ler
CREATE INDEX IF NOT EXISTS idx_grid_designs_user ON grid_designs(user_id);
CREATE INDEX IF NOT EXISTS idx_grid_designs_tenant ON grid_designs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_grid_designs_grid_id ON grid_designs(grid_id);
CREATE INDEX IF NOT EXISTS idx_grid_designs_default ON grid_designs(user_id, grid_id, is_default) WHERE is_default = true;

-- Trigger: updated_at otomatik güncelleme
CREATE OR REPLACE FUNCTION update_grid_designs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_grid_designs_updated_at ON grid_designs;
CREATE TRIGGER trg_grid_designs_updated_at
    BEFORE UPDATE ON grid_designs
    FOR EACH ROW
    EXECUTE FUNCTION update_grid_designs_updated_at();

-- Yorum
COMMENT ON TABLE grid_designs IS 'Kullanıcıların DataGrid tasarımlarını (kolon sırası, filtreler, gruplama) kaydettiği tablo';
COMMENT ON COLUMN grid_designs.grid_id IS 'Hangi DataGrid bileşeni için (demo-grid, sales-grid vb.)';
COMMENT ON COLUMN grid_designs.state IS 'JSON formatında grid state (columns, filters, sorting, grouping, columnOrder, hiddenColumns, columnWidths, density)';


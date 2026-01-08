-- ============================================
-- GRID_DESIGNS TABLOSU
-- Enterprise DataGrid tasarım şablonları
-- ============================================

CREATE TABLE IF NOT EXISTS grid_designs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  grid_id VARCHAR(100) NOT NULL,
  name VARCHAR(200) NOT NULL,
  state JSONB NOT NULL DEFAULT '{}',
  is_default BOOLEAN DEFAULT false,
  dataset_id UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (user_id, grid_id, name)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_grid_designs_user ON grid_designs(user_id);
CREATE INDEX IF NOT EXISTS idx_grid_designs_grid_id ON grid_designs(grid_id);
CREATE INDEX IF NOT EXISTS idx_grid_designs_tenant ON grid_designs(tenant_id);

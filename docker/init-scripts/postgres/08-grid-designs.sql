-- ============================================
-- GRID_DESIGNS TABLOSU
-- Enterprise DataGrid tasarım şablonları
-- ============================================

CREATE TABLE IF NOT EXISTS grid_designs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  grid_key VARCHAR(100) NOT NULL,
  name VARCHAR(200) NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  dataset_id UUID,
  grid_id VARCHAR(100),
  state JSONB DEFAULT '{}',
  UNIQUE (user_id, grid_key, name)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_grid_designs_user ON grid_designs(user_id);
CREATE INDEX IF NOT EXISTS idx_grid_designs_grid_key ON grid_designs(grid_key);
CREATE INDEX IF NOT EXISTS idx_grid_designs_tenant ON grid_designs(tenant_id);


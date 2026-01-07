-- ============================================
-- LABELS TABLOSU
-- Dinamik etiket sistemi (WhiteLabel)
-- Menü ve pozisyon isimleri müşteriye göre değiştirilebilir
-- ============================================

CREATE TABLE IF NOT EXISTS labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  label_type VARCHAR(50) NOT NULL,  -- 'menu' veya 'position'
  label_key VARCHAR(100) NOT NULL,  -- 'stores', 'STORE_MANAGER'
  label_value VARCHAR(200) NOT NULL, -- 'Magazalar', 'Magaza Muduru'
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (tenant_id, label_type, label_key)
);

-- Varsayılan etiketler (ASCII - Türkçe karakter olmadan)
INSERT INTO labels (tenant_id, label_type, label_key, label_value) VALUES
-- Menü etiketleri
('00000000-0000-0000-0000-000000000001', 'menu', 'dashboard', 'Kokpit'),
('00000000-0000-0000-0000-000000000001', 'menu', 'finance', 'Finans'),
('00000000-0000-0000-0000-000000000001', 'menu', 'operations', 'Operasyon'),
('00000000-0000-0000-0000-000000000001', 'menu', 'analysis', 'Detayli Analiz'),
('00000000-0000-0000-0000-000000000001', 'menu', 'stores', 'Magazalar'),
('00000000-0000-0000-0000-000000000001', 'menu', 'designer', 'Tasarim Studyosu'),
('00000000-0000-0000-0000-000000000001', 'menu', 'data', 'Veri Baglantilari'),
('00000000-0000-0000-0000-000000000001', 'menu', 'admin', 'Yonetim Paneli'),
('00000000-0000-0000-0000-000000000001', 'menu', 'datagrid', 'DataGrid Demo'),
('00000000-0000-0000-0000-000000000001', 'menu', 'metrics', 'Metrikler'),
-- Pozisyon etiketleri
('00000000-0000-0000-0000-000000000001', 'position', 'GENERAL_MANAGER', 'Genel Mudur'),
('00000000-0000-0000-0000-000000000001', 'position', 'DIRECTOR', 'Direktor'),
('00000000-0000-0000-0000-000000000001', 'position', 'REGIONAL_MANAGER', 'Bolge Muduru'),
('00000000-0000-0000-0000-000000000001', 'position', 'STORE_MANAGER', 'Magaza Muduru'),
('00000000-0000-0000-0000-000000000001', 'position', 'ANALYST', 'Analist'),
('00000000-0000-0000-0000-000000000001', 'position', 'VIEWER', 'Izleyici')
ON CONFLICT (tenant_id, label_type, label_key) DO NOTHING;




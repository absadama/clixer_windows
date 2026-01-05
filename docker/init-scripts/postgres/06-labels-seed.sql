-- Labels Seed - Varsayılan Menü ve Pozisyon Etiketleri
-- WhiteLabel/NoCode için dinamik etiketler

DO $$
DECLARE
    default_tenant_id UUID;
BEGIN
    -- Varsayılan tenant ID'yi al
    SELECT id INTO default_tenant_id FROM tenants LIMIT 1;
    
    IF default_tenant_id IS NOT NULL THEN
        -- Menü Etiketleri (ASCII - Türkçe karaktersiz)
        INSERT INTO labels (id, tenant_id, label_type, label_key, label_value, is_active) VALUES
            (gen_random_uuid(), default_tenant_id, 'menu', 'dashboard', 'Kokpit', true),
            (gen_random_uuid(), default_tenant_id, 'menu', 'finance', 'Finans', true),
            (gen_random_uuid(), default_tenant_id, 'menu', 'operations', 'Operasyon', true),
            (gen_random_uuid(), default_tenant_id, 'menu', 'analysis', 'Detayli Analiz', true),
            (gen_random_uuid(), default_tenant_id, 'menu', 'stores', 'Magazalar', true),
            (gen_random_uuid(), default_tenant_id, 'menu', 'designer', 'Tasarim Studyosu', true),
            (gen_random_uuid(), default_tenant_id, 'menu', 'data', 'Veri Baglantilari', true),
            (gen_random_uuid(), default_tenant_id, 'menu', 'datagrid', 'DataGrid Demo', true),
            (gen_random_uuid(), default_tenant_id, 'menu', 'metrics', 'Metrik Yonetimi', true),
            (gen_random_uuid(), default_tenant_id, 'menu', 'admin', 'Yonetim Paneli', true),
            (gen_random_uuid(), default_tenant_id, 'menu', 'profile', 'Profilim', true)
        ON CONFLICT (tenant_id, label_type, label_key) DO UPDATE SET label_value = EXCLUDED.label_value;
        
        -- Pozisyon Etiketleri (ASCII - Türkçe karaktersiz)
        INSERT INTO labels (id, tenant_id, label_type, label_key, label_value, is_active) VALUES
            (gen_random_uuid(), default_tenant_id, 'position', 'GENERAL_MANAGER', 'Genel Mudur', true),
            (gen_random_uuid(), default_tenant_id, 'position', 'DIRECTOR', 'Direktor', true),
            (gen_random_uuid(), default_tenant_id, 'position', 'REGIONAL_MANAGER', 'Bolge Muduru', true),
            (gen_random_uuid(), default_tenant_id, 'position', 'STORE_MANAGER', 'Magaza Muduru', true),
            (gen_random_uuid(), default_tenant_id, 'position', 'ANALYST', 'Analist', true),
            (gen_random_uuid(), default_tenant_id, 'position', 'VIEWER', 'Izleyici', true)
        ON CONFLICT (tenant_id, label_type, label_key) DO UPDATE SET label_value = EXCLUDED.label_value;
        
        RAISE NOTICE 'Labels seeded successfully for tenant %', default_tenant_id;
    ELSE
        RAISE WARNING 'No tenant found, labels not seeded';
    END IF;
END $$;



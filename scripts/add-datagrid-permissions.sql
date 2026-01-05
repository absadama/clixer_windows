-- DataGrid (GridXer) menü izinleri ekleme
-- Sadece GENERAL_MANAGER ve DIRECTOR görebilir, diğerleri göremez

-- Önce mevcut datagrid izinlerini sil (varsa)
DELETE FROM menu_permissions WHERE menu_key = 'datagrid';
DELETE FROM menu_permissions WHERE menu_key = 'designer';

-- DataGrid izinleri ekle
INSERT INTO menu_permissions (id, position_code, menu_key, can_view, can_edit) VALUES
(gen_random_uuid(), 'GENERAL_MANAGER', 'datagrid', true, true),
(gen_random_uuid(), 'DIRECTOR', 'datagrid', true, true),
(gen_random_uuid(), 'REGION_MANAGER', 'datagrid', false, false),
(gen_random_uuid(), 'STORE_MANAGER', 'datagrid', false, false),
(gen_random_uuid(), 'ANALYST', 'datagrid', false, false),
(gen_random_uuid(), 'VIEWER', 'datagrid', false, false);

-- Designer (Tasarım Stüdyosu) izinleri ekle
INSERT INTO menu_permissions (id, position_code, menu_key, can_view, can_edit) VALUES
(gen_random_uuid(), 'GENERAL_MANAGER', 'designer', true, true),
(gen_random_uuid(), 'DIRECTOR', 'designer', true, true),
(gen_random_uuid(), 'REGION_MANAGER', 'designer', false, false),
(gen_random_uuid(), 'STORE_MANAGER', 'designer', false, false),
(gen_random_uuid(), 'ANALYST', 'designer', false, false),
(gen_random_uuid(), 'VIEWER', 'designer', false, false);



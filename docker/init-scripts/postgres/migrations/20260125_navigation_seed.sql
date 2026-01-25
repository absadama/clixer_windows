-- Navigation Items Seed Data
-- Default tenant için başlangıç navigasyon verileri

-- NOT: Bu INSERT'ler tenant_id = NULL olanlar global itemlar (tüm tenant'larda görünür)
-- Tenant-specific itemlar için tenant_id belirtilmeli

-- =============================================
-- ANA SAYFALAR (Pages)
-- =============================================

INSERT INTO public.navigation_items (item_type, code, label, description, path, icon, keywords, search_priority, sort_order) VALUES
-- Ana Sayfalar
('page', 'page-dashboard', 'Dashboard', 'Ana gösterge paneli ve özet metrikler', '/dashboard', 'LayoutDashboard', 
 ARRAY['anasayfa', 'home', 'özet', 'summary', 'gösterge', 'panel'], 100, 1),

('page', 'page-designer', 'Tasarımcı', 'Rapor ve dashboard tasarımı', '/designer', 'Palette', 
 ARRAY['rapor', 'report', 'tasarım', 'design', 'chart', 'grafik', 'widget'], 95, 2),

('page', 'page-stores', 'Mağazalar', 'Mağaza listesi ve performans', '/stores', 'Store', 
 ARRAY['magaza', 'store', 'şube', 'branch', 'lokasyon', 'location'], 90, 3),

('page', 'page-analysis', 'Analizler', 'Detaylı analiz ve raporlar', '/analysis', 'PieChart', 
 ARRAY['analiz', 'analysis', 'rapor', 'report', 'istatistik', 'statistics'], 85, 4),

('page', 'page-data', 'Veri Bağlantıları', 'Veri kaynakları ve ETL yönetimi', '/data', 'Database', 
 ARRAY['veri', 'data', 'bağlantı', 'connection', 'kaynak', 'source', 'etl', 'dataset'], 80, 5),

('page', 'page-admin', 'Yönetim Paneli', 'Sistem ve kullanıcı yönetimi', '/admin', 'Shield', 
 ARRAY['admin', 'yönetim', 'panel', 'ayar', 'setting', 'kullanıcı', 'user'], 75, 6)

ON CONFLICT (tenant_id, code) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  path = EXCLUDED.path,
  icon = EXCLUDED.icon,
  keywords = EXCLUDED.keywords,
  search_priority = EXCLUDED.search_priority,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

-- =============================================
-- YÖNETİM PANELİ TAB'LARI (Admin Tabs)
-- =============================================

INSERT INTO public.navigation_items (item_type, code, label, description, path, icon, parent_code, keywords, search_priority, sort_order, required_roles) VALUES

('tab', 'tab-admin-users', 'Kullanıcı Yönetimi', 'Kullanıcı ekleme, düzenleme ve yetkilendirme', '/admin?tab=users', 'Users', 'page-admin',
 ARRAY['kullanıcı', 'user', 'üye', 'member', 'yetki', 'permission', 'rol', 'role'], 70, 1, ARRAY['ADMIN', 'SUPER_ADMIN']),

('tab', 'tab-admin-security', 'Güvenlik', 'Güvenlik ayarları ve 2FA yönetimi', '/admin?tab=security', 'Lock', 'page-admin',
 ARRAY['güvenlik', 'security', '2fa', 'şifre', 'password', 'oturum', 'session'], 70, 2, ARRAY['ADMIN', 'SUPER_ADMIN']),

('tab', 'tab-admin-settings', 'Sistem Ayarları', 'Genel sistem konfigürasyonu', '/admin?tab=settings', 'Settings', 'page-admin',
 ARRAY['ayar', 'setting', 'config', 'yapılandırma', 'configuration'], 70, 3, ARRAY['ADMIN', 'SUPER_ADMIN']),

('tab', 'tab-admin-master', 'Ana Veriler', 'Bölge, marka ve master data yönetimi', '/admin?tab=master', 'Database', 'page-admin',
 ARRAY['master', 'ana veri', 'bölge', 'region', 'marka', 'brand'], 70, 4, ARRAY['ADMIN', 'SUPER_ADMIN']),

('tab', 'tab-admin-positions', 'Pozisyonlar', 'Organizasyonel pozisyon tanımları', '/admin?tab=positions', 'UserCog', 'page-admin',
 ARRAY['pozisyon', 'position', 'unvan', 'title', 'organizasyon'], 65, 5, ARRAY['SUPER_ADMIN']),

('tab', 'tab-admin-ip', 'IP Yönetimi', 'IP whitelist ve erişim kontrolü', '/admin?tab=ip-management', 'Network', 'page-admin',
 ARRAY['ip', 'whitelist', 'erişim', 'access', 'firewall'], 65, 6, ARRAY['SUPER_ADMIN']),

('tab', 'tab-admin-themes', 'Tema Yönetimi', 'Kurumsal tema ve renk ayarları', '/admin?tab=themes', 'Palette', 'page-admin',
 ARRAY['tema', 'theme', 'renk', 'color', 'görünüm', 'appearance'], 60, 7, ARRAY['ADMIN', 'SUPER_ADMIN']),

('tab', 'tab-admin-audit', 'Denetim Logları', 'Sistem aktivite ve güvenlik logları', '/admin?tab=audit', 'Activity', 'page-admin',
 ARRAY['log', 'denetim', 'audit', 'aktivite', 'activity', 'izleme', 'monitoring'], 60, 8, ARRAY['ADMIN', 'SUPER_ADMIN']),

('tab', 'tab-admin-categories', 'Rapor Kategorileri', 'Dashboard kategorileri yönetimi', '/admin?tab=categories', 'FolderTree', 'page-admin',
 ARRAY['kategori', 'category', 'klasör', 'folder', 'grup', 'group'], 55, 9, ARRAY['ADMIN', 'SUPER_ADMIN'])

ON CONFLICT (tenant_id, code) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  path = EXCLUDED.path,
  icon = EXCLUDED.icon,
  parent_code = EXCLUDED.parent_code,
  keywords = EXCLUDED.keywords,
  search_priority = EXCLUDED.search_priority,
  sort_order = EXCLUDED.sort_order,
  required_roles = EXCLUDED.required_roles,
  updated_at = now();

-- =============================================
-- VERİ BAĞLANTILARI TAB'LARI (Data Tabs)
-- =============================================

INSERT INTO public.navigation_items (item_type, code, label, description, path, icon, parent_code, keywords, search_priority, sort_order) VALUES

('tab', 'tab-data-connections', 'Bağlantılar', 'Veritabanı ve API bağlantıları', '/data?tab=connections', 'Plug', 'page-data',
 ARRAY['bağlantı', 'connection', 'veritabanı', 'database', 'api', 'kaynak', 'source'], 70, 1),

('tab', 'tab-data-datasets', 'Dataset''ler', 'Veri setleri ve tablo eşlemeleri', '/data?tab=datasets', 'Table2', 'page-data',
 ARRAY['dataset', 'veri seti', 'tablo', 'table', 'eşleme', 'mapping'], 70, 2),

('tab', 'tab-data-sql', 'SQL Editör', 'SQL sorgu yazma ve çalıştırma', '/data?tab=sql', 'Code', 'page-data',
 ARRAY['sql', 'sorgu', 'query', 'editör', 'editor', 'kod', 'code'], 65, 3),

('tab', 'tab-data-etl', 'ETL Geçmişi', 'Veri senkronizasyon işlemleri', '/data?tab=etl', 'RefreshCw', 'page-data',
 ARRAY['etl', 'senkronizasyon', 'sync', 'transfer', 'işlem', 'job'], 65, 4),

('tab', 'tab-data-clickhouse', 'Clixer DB', 'ClickHouse veritabanı yönetimi', '/data?tab=clickhouse', 'HardDrive', 'page-data',
 ARRAY['clickhouse', 'clixer', 'db', 'veritabanı', 'olap', 'analitik'], 60, 5),

('tab', 'tab-data-performance', 'Performans Danışmanı', 'Sorgu optimizasyonu önerileri', '/data?tab=performance', 'Gauge', 'page-data',
 ARRAY['performans', 'performance', 'optimizasyon', 'hız', 'speed', 'danışman'], 55, 6),

('tab', 'tab-data-system', 'Sistem Sağlığı', 'Veritabanı ve servis durumu', '/data?tab=system', 'HeartPulse', 'page-data',
 ARRAY['sistem', 'system', 'sağlık', 'health', 'durum', 'status', 'monitoring'], 55, 7)

ON CONFLICT (tenant_id, code) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  path = EXCLUDED.path,
  icon = EXCLUDED.icon,
  parent_code = EXCLUDED.parent_code,
  keywords = EXCLUDED.keywords,
  search_priority = EXCLUDED.search_priority,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

-- =============================================
-- TASARIMCI TAB'LARI (Designer Tabs)
-- =============================================

INSERT INTO public.navigation_items (item_type, code, label, description, path, icon, parent_code, keywords, search_priority, sort_order) VALUES

('tab', 'tab-designer-reports', 'Raporlar', 'Kayıtlı raporlar ve dashboardlar', '/designer?tab=reports', 'FileText', 'page-designer',
 ARRAY['rapor', 'report', 'dashboard', 'kayıtlı', 'saved'], 70, 1),

('tab', 'tab-designer-metrics', 'Metrikler', 'Metrik tanımları ve formüller', '/designer?tab=metrics', 'BarChart3', 'page-designer',
 ARRAY['metrik', 'metric', 'kpi', 'formül', 'formula', 'hesaplama'], 70, 2),

('tab', 'tab-designer-widgets', 'Widget''lar', 'Görsel bileşen kütüphanesi', '/designer?tab=widgets', 'Layers', 'page-designer',
 ARRAY['widget', 'bileşen', 'component', 'grafik', 'chart', 'görsel'], 65, 3)

ON CONFLICT (tenant_id, code) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  path = EXCLUDED.path,
  icon = EXCLUDED.icon,
  parent_code = EXCLUDED.parent_code,
  keywords = EXCLUDED.keywords,
  search_priority = EXCLUDED.search_priority,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

-- =============================================
-- HIZLI KOMUTLAR (Commands)
-- =============================================

INSERT INTO public.navigation_items (item_type, code, label, description, path, icon, keywords, search_priority, sort_order, is_visible_in_menu) VALUES

('command', 'cmd-logout', 'Çıkış Yap', 'Oturumu sonlandır', NULL, 'LogOut',
 ARRAY['çıkış', 'logout', 'oturum', 'session', 'kapat'], 50, 1, false),

('command', 'cmd-theme-toggle', 'Tema Değiştir', 'Açık/Koyu tema geçişi', NULL, 'Moon',
 ARRAY['tema', 'theme', 'karanlık', 'dark', 'açık', 'light', 'mod', 'mode'], 50, 2, false),

('command', 'cmd-language', 'Dil Değiştir', 'Arayüz dilini değiştir', NULL, 'Globe',
 ARRAY['dil', 'language', 'türkçe', 'english', 'ingilizce'], 50, 3, false),

('command', 'cmd-refresh', 'Sayfayı Yenile', 'Mevcut sayfayı yenile', NULL, 'RefreshCw',
 ARRAY['yenile', 'refresh', 'reload', 'güncelle', 'update'], 45, 4, false),

('command', 'cmd-fullscreen', 'Tam Ekran', 'Tam ekran moduna geç', NULL, 'Maximize',
 ARRAY['tam ekran', 'fullscreen', 'büyüt', 'maximize'], 45, 5, false)

ON CONFLICT (tenant_id, code) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  keywords = EXCLUDED.keywords,
  search_priority = EXCLUDED.search_priority,
  sort_order = EXCLUDED.sort_order,
  is_visible_in_menu = EXCLUDED.is_visible_in_menu,
  updated_at = now();

-- =============================================
-- MASTER DATA BÖLÜMLERI (Admin > Master Data sections)
-- =============================================

INSERT INTO public.navigation_items (item_type, code, label, description, path, icon, parent_code, keywords, search_priority, sort_order, required_roles) VALUES

('tab', 'tab-master-regions', 'Bölgeler', 'Bölge tanımları ve yöneticileri', '/admin?tab=master&section=regions', 'Building', 'tab-admin-master',
 ARRAY['bölge', 'region', 'alan', 'area', 'coğrafi'], 60, 1, ARRAY['ADMIN', 'SUPER_ADMIN']),

('tab', 'tab-master-brands', 'Markalar', 'Marka tanımları', '/admin?tab=master&section=brands', 'Tag', 'tab-admin-master',
 ARRAY['marka', 'brand', 'logo'], 60, 2, ARRAY['ADMIN', 'SUPER_ADMIN']),

('tab', 'tab-master-labels', 'Etiketler', 'Özelleştirilebilir alan etiketleri', '/admin?tab=master&section=labels', 'Tag', 'tab-admin-master',
 ARRAY['etiket', 'label', 'alan', 'field', 'özelleştirme'], 55, 3, ARRAY['ADMIN', 'SUPER_ADMIN'])

ON CONFLICT (tenant_id, code) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  path = EXCLUDED.path,
  icon = EXCLUDED.icon,
  parent_code = EXCLUDED.parent_code,
  keywords = EXCLUDED.keywords,
  search_priority = EXCLUDED.search_priority,
  sort_order = EXCLUDED.sort_order,
  required_roles = EXCLUDED.required_roles,
  updated_at = now();

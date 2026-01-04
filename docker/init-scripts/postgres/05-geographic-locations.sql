-- ============================================
-- COĞRAFİ LOKASYONLAR MASTER TABLOSU
-- Türkiye'nin tüm il, ilçe, mahalle verileri
-- Harita görselleştirmesi için koordinat lookup
-- ============================================

-- ============================================
-- ANA TABLO: geographic_locations
-- ============================================
CREATE TABLE IF NOT EXISTS geographic_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Ülke bilgisi
    country_code VARCHAR(3) DEFAULT 'TR',        -- ISO 3166-1 alpha-2/3
    country_name VARCHAR(100) DEFAULT 'Türkiye',
    
    -- Coğrafi bölge (7 bölge)
    region_code VARCHAR(50),                      -- MARMARA, EGE, IC_ANADOLU, vb.
    region_name VARCHAR(100),                     -- Marmara Bölgesi, Ege Bölgesi, vb.
    
    -- İl bilgisi
    city_code VARCHAR(10),                        -- Plaka kodu: 34, 06, 35, vb.
    city_name VARCHAR(100),                       -- İstanbul, Ankara, İzmir, vb.
    
    -- İlçe bilgisi
    district_code VARCHAR(20),                    -- İlçe kodu (opsiyonel)
    district_name VARCHAR(100),                   -- Kadıköy, Çankaya, Konak, vb.
    
    -- Mahalle/Semt bilgisi
    neighborhood_code VARCHAR(20),                -- Mahalle kodu (opsiyonel)
    neighborhood_name VARCHAR(200),               -- Caferağa Mah., Kızılay Mah., vb.
    
    -- Posta kodu
    postal_code VARCHAR(10),                      -- 34710, 06100, vb.
    
    -- Koordinatlar
    latitude DECIMAL(10, 7),                      -- Enlem (39.9334)
    longitude DECIMAL(10, 7),                     -- Boylam (32.8597)
    
    -- Bounding box (isteğe bağlı - poligon için)
    bbox_north DECIMAL(10, 7),
    bbox_south DECIMAL(10, 7),
    bbox_east DECIMAL(10, 7),
    bbox_west DECIMAL(10, 7),
    
    -- Lokasyon tipi
    location_type VARCHAR(20) NOT NULL,           -- COUNTRY, REGION, CITY, DISTRICT, NEIGHBORHOOD
    
    -- Hiyerarşi için parent referansı
    parent_id UUID REFERENCES geographic_locations(id) ON DELETE SET NULL,
    
    -- Ek bilgiler
    population INT,                               -- Nüfus (TÜİK verisi)
    area_km2 DECIMAL(10, 2),                      -- Alan (km²)
    
    -- Alternatif isimler (arama için)
    name_ascii VARCHAR(200),                      -- ASCII versiyonu (Istanbul, Ankara)
    name_alternatives TEXT[],                     -- Alternatif isimler
    
    -- Meta
    data_source VARCHAR(100),                     -- Veri kaynağı
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_geo_country ON geographic_locations(country_code);
CREATE INDEX IF NOT EXISTS idx_geo_region ON geographic_locations(region_code);
CREATE INDEX IF NOT EXISTS idx_geo_city ON geographic_locations(city_code, city_name);
CREATE INDEX IF NOT EXISTS idx_geo_district ON geographic_locations(district_name);
CREATE INDEX IF NOT EXISTS idx_geo_neighborhood ON geographic_locations(neighborhood_name);
CREATE INDEX IF NOT EXISTS idx_geo_type ON geographic_locations(location_type);
CREATE INDEX IF NOT EXISTS idx_geo_parent ON geographic_locations(parent_id);
CREATE INDEX IF NOT EXISTS idx_geo_coords ON geographic_locations(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_geo_name_ascii ON geographic_locations(name_ascii);

-- Full-text search için
CREATE INDEX IF NOT EXISTS idx_geo_search ON geographic_locations 
    USING gin(to_tsvector('turkish', COALESCE(city_name, '') || ' ' || COALESCE(district_name, '') || ' ' || COALESCE(neighborhood_name, '')));

-- ============================================
-- TÜRKİYE İLLERİ (81 İL) - KOORDİNATLARLA
-- ============================================
INSERT INTO geographic_locations (country_code, country_name, region_code, region_name, city_code, city_name, latitude, longitude, location_type, name_ascii, population) VALUES
-- MARMARA BÖLGESİ
('TR', 'Türkiye', 'MARMARA', 'Marmara Bölgesi', '34', 'İstanbul', 41.0082, 28.9784, 'CITY', 'Istanbul', 15840900),
('TR', 'Türkiye', 'MARMARA', 'Marmara Bölgesi', '41', 'Kocaeli', 40.8533, 29.8815, 'CITY', 'Kocaeli', 2033441),
('TR', 'Türkiye', 'MARMARA', 'Marmara Bölgesi', '16', 'Bursa', 40.1885, 29.0610, 'CITY', 'Bursa', 3147818),
('TR', 'Türkiye', 'MARMARA', 'Marmara Bölgesi', '59', 'Tekirdağ', 40.9833, 27.5167, 'CITY', 'Tekirdag', 1108257),
('TR', 'Türkiye', 'MARMARA', 'Marmara Bölgesi', '22', 'Edirne', 41.6771, 26.5557, 'CITY', 'Edirne', 413903),
('TR', 'Türkiye', 'MARMARA', 'Marmara Bölgesi', '39', 'Kırklareli', 41.7333, 27.2167, 'CITY', 'Kirklareli', 369347),
('TR', 'Türkiye', 'MARMARA', 'Marmara Bölgesi', '17', 'Çanakkale', 40.1553, 26.4142, 'CITY', 'Canakkale', 559383),
('TR', 'Türkiye', 'MARMARA', 'Marmara Bölgesi', '10', 'Balıkesir', 39.6484, 27.8826, 'CITY', 'Balikesir', 1250990),
('TR', 'Türkiye', 'MARMARA', 'Marmara Bölgesi', '77', 'Yalova', 40.6500, 29.2667, 'CITY', 'Yalova', 296333),
('TR', 'Türkiye', 'MARMARA', 'Marmara Bölgesi', '54', 'Sakarya', 40.7569, 30.3781, 'CITY', 'Sakarya', 1060876),
('TR', 'Türkiye', 'MARMARA', 'Marmara Bölgesi', '11', 'Bilecik', 40.0567, 30.0665, 'CITY', 'Bilecik', 228673),

-- EGE BÖLGESİ
('TR', 'Türkiye', 'EGE', 'Ege Bölgesi', '35', 'İzmir', 38.4237, 27.1428, 'CITY', 'Izmir', 4425789),
('TR', 'Türkiye', 'EGE', 'Ege Bölgesi', '09', 'Aydın', 37.8560, 27.8416, 'CITY', 'Aydin', 1134031),
('TR', 'Türkiye', 'EGE', 'Ege Bölgesi', '48', 'Muğla', 37.2153, 28.3636, 'CITY', 'Mugla', 1021141),
('TR', 'Türkiye', 'EGE', 'Ege Bölgesi', '20', 'Denizli', 37.7765, 29.0864, 'CITY', 'Denizli', 1046107),
('TR', 'Türkiye', 'EGE', 'Ege Bölgesi', '45', 'Manisa', 38.6191, 27.4289, 'CITY', 'Manisa', 1450616),
('TR', 'Türkiye', 'EGE', 'Ege Bölgesi', '64', 'Uşak', 38.6823, 29.4082, 'CITY', 'Usak', 375454),
('TR', 'Türkiye', 'EGE', 'Ege Bölgesi', '43', 'Kütahya', 39.4167, 29.9833, 'CITY', 'Kutahya', 579831),
('TR', 'Türkiye', 'EGE', 'Ege Bölgesi', '03', 'Afyonkarahisar', 38.7507, 30.5567, 'CITY', 'Afyonkarahisar', 747555),

-- AKDENİZ BÖLGESİ
('TR', 'Türkiye', 'AKDENIZ', 'Akdeniz Bölgesi', '07', 'Antalya', 36.8969, 30.7133, 'CITY', 'Antalya', 2619832),
('TR', 'Türkiye', 'AKDENIZ', 'Akdeniz Bölgesi', '01', 'Adana', 37.0000, 35.3213, 'CITY', 'Adana', 2274106),
('TR', 'Türkiye', 'AKDENIZ', 'Akdeniz Bölgesi', '33', 'Mersin', 36.8121, 34.6415, 'CITY', 'Mersin', 1891145),
('TR', 'Türkiye', 'AKDENIZ', 'Akdeniz Bölgesi', '31', 'Hatay', 36.2028, 36.1600, 'CITY', 'Hatay', 1686043),
('TR', 'Türkiye', 'AKDENIZ', 'Akdeniz Bölgesi', '32', 'Isparta', 37.7648, 30.5566, 'CITY', 'Isparta', 450562),
('TR', 'Türkiye', 'AKDENIZ', 'Akdeniz Bölgesi', '15', 'Burdur', 37.4613, 30.0665, 'CITY', 'Burdur', 273716),
('TR', 'Türkiye', 'AKDENIZ', 'Akdeniz Bölgesi', '46', 'Kahramanmaraş', 37.5858, 36.9371, 'CITY', 'Kahramanmaras', 1177436),
('TR', 'Türkiye', 'AKDENIZ', 'Akdeniz Bölgesi', '80', 'Osmaniye', 37.0742, 36.2478, 'CITY', 'Osmaniye', 559405),

-- İÇ ANADOLU BÖLGESİ
('TR', 'Türkiye', 'IC_ANADOLU', 'İç Anadolu Bölgesi', '06', 'Ankara', 39.9334, 32.8597, 'CITY', 'Ankara', 5782285),
('TR', 'Türkiye', 'IC_ANADOLU', 'İç Anadolu Bölgesi', '18', 'Çankırı', 40.6013, 33.6134, 'CITY', 'Cankiri', 195789),
('TR', 'Türkiye', 'IC_ANADOLU', 'İç Anadolu Bölgesi', '42', 'Konya', 37.8667, 32.4833, 'CITY', 'Konya', 2296347),
('TR', 'Türkiye', 'IC_ANADOLU', 'İç Anadolu Bölgesi', '26', 'Eskişehir', 39.7767, 30.5206, 'CITY', 'Eskisehir', 906617),
('TR', 'Türkiye', 'IC_ANADOLU', 'İç Anadolu Bölgesi', '38', 'Kayseri', 38.7225, 35.4875, 'CITY', 'Kayseri', 1441523),
('TR', 'Türkiye', 'IC_ANADOLU', 'İç Anadolu Bölgesi', '50', 'Nevşehir', 38.6244, 34.7239, 'CITY', 'Nevsehir', 308092),
('TR', 'Türkiye', 'IC_ANADOLU', 'İç Anadolu Bölgesi', '51', 'Niğde', 37.9667, 34.6833, 'CITY', 'Nigde', 364707),
('TR', 'Türkiye', 'IC_ANADOLU', 'İç Anadolu Bölgesi', '68', 'Aksaray', 38.3725, 34.0250, 'CITY', 'Aksaray', 433055),
('TR', 'Türkiye', 'IC_ANADOLU', 'İç Anadolu Bölgesi', '40', 'Kırşehir', 39.1500, 34.1667, 'CITY', 'Kirsehir', 244519),
('TR', 'Türkiye', 'IC_ANADOLU', 'İç Anadolu Bölgesi', '70', 'Karaman', 37.1759, 33.2287, 'CITY', 'Karaman', 258838),
('TR', 'Türkiye', 'IC_ANADOLU', 'İç Anadolu Bölgesi', '71', 'Kırıkkale', 39.8468, 33.5153, 'CITY', 'Kirikkale', 288749),
('TR', 'Türkiye', 'IC_ANADOLU', 'İç Anadolu Bölgesi', '58', 'Sivas', 39.7477, 37.0179, 'CITY', 'Sivas', 651138),
('TR', 'Türkiye', 'IC_ANADOLU', 'İç Anadolu Bölgesi', '66', 'Yozgat', 39.8181, 34.8147, 'CITY', 'Yozgat', 418442),

-- KARADENİZ BÖLGESİ
('TR', 'Türkiye', 'KARADENIZ', 'Karadeniz Bölgesi', '55', 'Samsun', 41.2867, 36.3300, 'CITY', 'Samsun', 1371274),
('TR', 'Türkiye', 'KARADENIZ', 'Karadeniz Bölgesi', '61', 'Trabzon', 41.0027, 39.7168, 'CITY', 'Trabzon', 818023),
('TR', 'Türkiye', 'KARADENIZ', 'Karadeniz Bölgesi', '52', 'Ordu', 40.9839, 37.8764, 'CITY', 'Ordu', 771932),
('TR', 'Türkiye', 'KARADENIZ', 'Karadeniz Bölgesi', '28', 'Giresun', 40.9128, 38.3895, 'CITY', 'Giresun', 454146),
('TR', 'Türkiye', 'KARADENIZ', 'Karadeniz Bölgesi', '53', 'Rize', 41.0201, 40.5234, 'CITY', 'Rize', 348608),
('TR', 'Türkiye', 'KARADENIZ', 'Karadeniz Bölgesi', '08', 'Artvin', 41.1828, 41.8183, 'CITY', 'Artvin', 174010),
('TR', 'Türkiye', 'KARADENIZ', 'Karadeniz Bölgesi', '67', 'Zonguldak', 41.4564, 31.7987, 'CITY', 'Zonguldak', 599698),
('TR', 'Türkiye', 'KARADENIZ', 'Karadeniz Bölgesi', '78', 'Karabük', 41.2061, 32.6204, 'CITY', 'Karabuk', 251269),
('TR', 'Türkiye', 'KARADENIZ', 'Karadeniz Bölgesi', '74', 'Bartın', 41.6344, 32.3375, 'CITY', 'Bartin', 203351),
('TR', 'Türkiye', 'KARADENIZ', 'Karadeniz Bölgesi', '37', 'Kastamonu', 41.3887, 33.7827, 'CITY', 'Kastamonu', 389180),
('TR', 'Türkiye', 'KARADENIZ', 'Karadeniz Bölgesi', '57', 'Sinop', 42.0231, 35.1531, 'CITY', 'Sinop', 218408),
('TR', 'Türkiye', 'KARADENIZ', 'Karadeniz Bölgesi', '19', 'Çorum', 40.5506, 34.9556, 'CITY', 'Corum', 536483),
('TR', 'Türkiye', 'KARADENIZ', 'Karadeniz Bölgesi', '05', 'Amasya', 40.6499, 35.8353, 'CITY', 'Amasya', 338267),
('TR', 'Türkiye', 'KARADENIZ', 'Karadeniz Bölgesi', '60', 'Tokat', 40.3167, 36.5500, 'CITY', 'Tokat', 612646),
('TR', 'Türkiye', 'KARADENIZ', 'Karadeniz Bölgesi', '81', 'Düzce', 40.8438, 31.1565, 'CITY', 'Duzce', 400847),
('TR', 'Türkiye', 'KARADENIZ', 'Karadeniz Bölgesi', '14', 'Bolu', 40.7356, 31.6061, 'CITY', 'Bolu', 320824),

-- DOĞU ANADOLU BÖLGESİ
('TR', 'Türkiye', 'DOGU_ANADOLU', 'Doğu Anadolu Bölgesi', '25', 'Erzurum', 39.9000, 41.2700, 'CITY', 'Erzurum', 767848),
('TR', 'Türkiye', 'DOGU_ANADOLU', 'Doğu Anadolu Bölgesi', '65', 'Van', 38.5012, 43.4089, 'CITY', 'Van', 1141015),
('TR', 'Türkiye', 'DOGU_ANADOLU', 'Doğu Anadolu Bölgesi', '44', 'Malatya', 38.3552, 38.3095, 'CITY', 'Malatya', 812580),
('TR', 'Türkiye', 'DOGU_ANADOLU', 'Doğu Anadolu Bölgesi', '23', 'Elazığ', 38.6810, 39.2264, 'CITY', 'Elazig', 591497),
('TR', 'Türkiye', 'DOGU_ANADOLU', 'Doğu Anadolu Bölgesi', '24', 'Erzincan', 39.7500, 39.5000, 'CITY', 'Erzincan', 238276),
('TR', 'Türkiye', 'DOGU_ANADOLU', 'Doğu Anadolu Bölgesi', '04', 'Ağrı', 39.7191, 43.0503, 'CITY', 'Agri', 536199),
('TR', 'Türkiye', 'DOGU_ANADOLU', 'Doğu Anadolu Bölgesi', '36', 'Kars', 40.6167, 43.1000, 'CITY', 'Kars', 285410),
('TR', 'Türkiye', 'DOGU_ANADOLU', 'Doğu Anadolu Bölgesi', '76', 'Iğdır', 39.9237, 44.0450, 'CITY', 'Igdir', 203594),
('TR', 'Türkiye', 'DOGU_ANADOLU', 'Doğu Anadolu Bölgesi', '75', 'Ardahan', 41.1105, 42.7022, 'CITY', 'Ardahan', 92481),
('TR', 'Türkiye', 'DOGU_ANADOLU', 'Doğu Anadolu Bölgesi', '12', 'Bingöl', 38.8855, 40.4966, 'CITY', 'Bingol', 281205),
('TR', 'Türkiye', 'DOGU_ANADOLU', 'Doğu Anadolu Bölgesi', '49', 'Muş', 38.7432, 41.5064, 'CITY', 'Mus', 399202),
('TR', 'Türkiye', 'DOGU_ANADOLU', 'Doğu Anadolu Bölgesi', '13', 'Bitlis', 38.3938, 42.1232, 'CITY', 'Bitlis', 353988),
('TR', 'Türkiye', 'DOGU_ANADOLU', 'Doğu Anadolu Bölgesi', '30', 'Hakkari', 37.5833, 43.7333, 'CITY', 'Hakkari', 280991),
('TR', 'Türkiye', 'DOGU_ANADOLU', 'Doğu Anadolu Bölgesi', '62', 'Tunceli', 39.1079, 39.5401, 'CITY', 'Tunceli', 84660),
('TR', 'Türkiye', 'DOGU_ANADOLU', 'Doğu Anadolu Bölgesi', '29', 'Gümüşhane', 40.4386, 39.5086, 'CITY', 'Gumushane', 141702),
('TR', 'Türkiye', 'DOGU_ANADOLU', 'Doğu Anadolu Bölgesi', '69', 'Bayburt', 40.2552, 40.2249, 'CITY', 'Bayburt', 84843),

-- GÜNEYDOĞU ANADOLU BÖLGESİ
('TR', 'Türkiye', 'GUNEYDOGU', 'Güneydoğu Anadolu Bölgesi', '27', 'Gaziantep', 37.0662, 37.3833, 'CITY', 'Gaziantep', 2130432),
('TR', 'Türkiye', 'GUNEYDOGU', 'Güneydoğu Anadolu Bölgesi', '63', 'Şanlıurfa', 37.1591, 38.7969, 'CITY', 'Sanliurfa', 2170110),
('TR', 'Türkiye', 'GUNEYDOGU', 'Güneydoğu Anadolu Bölgesi', '21', 'Diyarbakır', 37.9144, 40.2306, 'CITY', 'Diyarbakir', 1804880),
('TR', 'Türkiye', 'GUNEYDOGU', 'Güneydoğu Anadolu Bölgesi', '47', 'Mardin', 37.3212, 40.7245, 'CITY', 'Mardin', 870374),
('TR', 'Türkiye', 'GUNEYDOGU', 'Güneydoğu Anadolu Bölgesi', '02', 'Adıyaman', 37.7648, 38.2786, 'CITY', 'Adiyaman', 635169),
('TR', 'Türkiye', 'GUNEYDOGU', 'Güneydoğu Anadolu Bölgesi', '72', 'Batman', 37.8812, 41.1351, 'CITY', 'Batman', 620278),
('TR', 'Türkiye', 'GUNEYDOGU', 'Güneydoğu Anadolu Bölgesi', '73', 'Şırnak', 37.4187, 42.4918, 'CITY', 'Sirnak', 557605),
('TR', 'Türkiye', 'GUNEYDOGU', 'Güneydoğu Anadolu Bölgesi', '56', 'Siirt', 37.9333, 41.9500, 'CITY', 'Siirt', 331670),
('TR', 'Türkiye', 'GUNEYDOGU', 'Güneydoğu Anadolu Bölgesi', '79', 'Kilis', 36.7184, 37.1212, 'CITY', 'Kilis', 147919)

ON CONFLICT DO NOTHING;

-- ============================================
-- İSTANBUL İLÇELERİ (Örnek detay)
-- ============================================
DO $$
DECLARE
    istanbul_id UUID;
BEGIN
    SELECT id INTO istanbul_id FROM geographic_locations WHERE city_code = '34' AND location_type = 'CITY' LIMIT 1;
    
    IF istanbul_id IS NOT NULL THEN
        INSERT INTO geographic_locations (parent_id, country_code, country_name, region_code, region_name, city_code, city_name, district_name, latitude, longitude, location_type, name_ascii, population) VALUES
        (istanbul_id, 'TR', 'Türkiye', 'MARMARA', 'Marmara Bölgesi', '34', 'İstanbul', 'Kadıköy', 40.9927, 29.0277, 'DISTRICT', 'Kadikoy', 458638),
        (istanbul_id, 'TR', 'Türkiye', 'MARMARA', 'Marmara Bölgesi', '34', 'İstanbul', 'Beşiktaş', 41.0430, 29.0094, 'DISTRICT', 'Besiktas', 181074),
        (istanbul_id, 'TR', 'Türkiye', 'MARMARA', 'Marmara Bölgesi', '34', 'İstanbul', 'Üsküdar', 41.0234, 29.0152, 'DISTRICT', 'Uskudar', 529145),
        (istanbul_id, 'TR', 'Türkiye', 'MARMARA', 'Marmara Bölgesi', '34', 'İstanbul', 'Fatih', 41.0186, 28.9395, 'DISTRICT', 'Fatih', 433790),
        (istanbul_id, 'TR', 'Türkiye', 'MARMARA', 'Marmara Bölgesi', '34', 'İstanbul', 'Beyoğlu', 41.0370, 28.9850, 'DISTRICT', 'Beyoglu', 226875),
        (istanbul_id, 'TR', 'Türkiye', 'MARMARA', 'Marmara Bölgesi', '34', 'İstanbul', 'Şişli', 41.0602, 28.9877, 'DISTRICT', 'Sisli', 274289),
        (istanbul_id, 'TR', 'Türkiye', 'MARMARA', 'Marmara Bölgesi', '34', 'İstanbul', 'Bakırköy', 40.9819, 28.8719, 'DISTRICT', 'Bakirkoy', 222668),
        (istanbul_id, 'TR', 'Türkiye', 'MARMARA', 'Marmara Bölgesi', '34', 'İstanbul', 'Ataşehir', 40.9923, 29.1244, 'DISTRICT', 'Atasehir', 426727),
        (istanbul_id, 'TR', 'Türkiye', 'MARMARA', 'Marmara Bölgesi', '34', 'İstanbul', 'Maltepe', 40.9340, 29.1295, 'DISTRICT', 'Maltepe', 511156),
        (istanbul_id, 'TR', 'Türkiye', 'MARMARA', 'Marmara Bölgesi', '34', 'İstanbul', 'Kartal', 40.9067, 29.1856, 'DISTRICT', 'Kartal', 469664),
        (istanbul_id, 'TR', 'Türkiye', 'MARMARA', 'Marmara Bölgesi', '34', 'İstanbul', 'Pendik', 40.8755, 29.2335, 'DISTRICT', 'Pendik', 727293),
        (istanbul_id, 'TR', 'Türkiye', 'MARMARA', 'Marmara Bölgesi', '34', 'İstanbul', 'Tuzla', 40.8218, 29.3008, 'DISTRICT', 'Tuzla', 276057),
        (istanbul_id, 'TR', 'Türkiye', 'MARMARA', 'Marmara Bölgesi', '34', 'İstanbul', 'Sarıyer', 41.1667, 29.0500, 'DISTRICT', 'Sariyer', 352073),
        (istanbul_id, 'TR', 'Türkiye', 'MARMARA', 'Marmara Bölgesi', '34', 'İstanbul', 'Beykoz', 41.1299, 29.1007, 'DISTRICT', 'Beykoz', 246700),
        (istanbul_id, 'TR', 'Türkiye', 'MARMARA', 'Marmara Bölgesi', '34', 'İstanbul', 'Zeytinburnu', 41.0047, 28.9047, 'DISTRICT', 'Zeytinburnu', 284935),
        (istanbul_id, 'TR', 'Türkiye', 'MARMARA', 'Marmara Bölgesi', '34', 'İstanbul', 'Bahçelievler', 41.0019, 28.8619, 'DISTRICT', 'Bahcelievler', 596368),
        (istanbul_id, 'TR', 'Türkiye', 'MARMARA', 'Marmara Bölgesi', '34', 'İstanbul', 'Bağcılar', 41.0386, 28.8575, 'DISTRICT', 'Bagcilar', 734369),
        (istanbul_id, 'TR', 'Türkiye', 'MARMARA', 'Marmara Bölgesi', '34', 'İstanbul', 'Güngören', 41.0194, 28.8775, 'DISTRICT', 'Gungoren', 289441),
        (istanbul_id, 'TR', 'Türkiye', 'MARMARA', 'Marmara Bölgesi', '34', 'İstanbul', 'Esenler', 41.0433, 28.8747, 'DISTRICT', 'Esenler', 449117),
        (istanbul_id, 'TR', 'Türkiye', 'MARMARA', 'Marmara Bölgesi', '34', 'İstanbul', 'Bayrampaşa', 41.0467, 28.9011, 'DISTRICT', 'Bayrampasa', 270567),
        (istanbul_id, 'TR', 'Türkiye', 'MARMARA', 'Marmara Bölgesi', '34', 'İstanbul', 'Eyüpsultan', 41.0486, 28.9339, 'DISTRICT', 'Eyupsultan', 409043),
        (istanbul_id, 'TR', 'Türkiye', 'MARMARA', 'Marmara Bölgesi', '34', 'İstanbul', 'Gaziosmanpaşa', 41.0719, 28.9122, 'DISTRICT', 'Gaziosmanpasa', 476046),
        (istanbul_id, 'TR', 'Türkiye', 'MARMARA', 'Marmara Bölgesi', '34', 'İstanbul', 'Kağıthane', 41.0847, 28.9747, 'DISTRICT', 'Kagithane', 447942),
        (istanbul_id, 'TR', 'Türkiye', 'MARMARA', 'Marmara Bölgesi', '34', 'İstanbul', 'Sultangazi', 41.1053, 28.8672, 'DISTRICT', 'Sultangazi', 533079),
        (istanbul_id, 'TR', 'Türkiye', 'MARMARA', 'Marmara Bölgesi', '34', 'İstanbul', 'Başakşehir', 41.0922, 28.8017, 'DISTRICT', 'Basaksehir', 484662),
        (istanbul_id, 'TR', 'Türkiye', 'MARMARA', 'Marmara Bölgesi', '34', 'İstanbul', 'Küçükçekmece', 41.0028, 28.7803, 'DISTRICT', 'Kucukcekmece', 792821),
        (istanbul_id, 'TR', 'Türkiye', 'MARMARA', 'Marmara Bölgesi', '34', 'İstanbul', 'Avcılar', 40.9794, 28.7214, 'DISTRICT', 'Avcilar', 442771),
        (istanbul_id, 'TR', 'Türkiye', 'MARMARA', 'Marmara Bölgesi', '34', 'İstanbul', 'Esenyurt', 41.0311, 28.6756, 'DISTRICT', 'Esenyurt', 957398),
        (istanbul_id, 'TR', 'Türkiye', 'MARMARA', 'Marmara Bölgesi', '34', 'İstanbul', 'Beylikdüzü', 40.9844, 28.6408, 'DISTRICT', 'Beylikduzu', 361208),
        (istanbul_id, 'TR', 'Türkiye', 'MARMARA', 'Marmara Bölgesi', '34', 'İstanbul', 'Büyükçekmece', 41.0214, 28.5806, 'DISTRICT', 'Buyukcekmece', 266439),
        (istanbul_id, 'TR', 'Türkiye', 'MARMARA', 'Marmara Bölgesi', '34', 'İstanbul', 'Çatalca', 41.1417, 28.4611, 'DISTRICT', 'Catalca', 78243),
        (istanbul_id, 'TR', 'Türkiye', 'MARMARA', 'Marmara Bölgesi', '34', 'İstanbul', 'Silivri', 41.0742, 28.2467, 'DISTRICT', 'Silivri', 201258),
        (istanbul_id, 'TR', 'Türkiye', 'MARMARA', 'Marmara Bölgesi', '34', 'İstanbul', 'Arnavutköy', 41.1850, 28.7394, 'DISTRICT', 'Arnavutkoy', 335216),
        (istanbul_id, 'TR', 'Türkiye', 'MARMARA', 'Marmara Bölgesi', '34', 'İstanbul', 'Çekmeköy', 41.0333, 29.1833, 'DISTRICT', 'Cekmekoy', 274023),
        (istanbul_id, 'TR', 'Türkiye', 'MARMARA', 'Marmara Bölgesi', '34', 'İstanbul', 'Sancaktepe', 41.0042, 29.2289, 'DISTRICT', 'Sancaktepe', 472389),
        (istanbul_id, 'TR', 'Türkiye', 'MARMARA', 'Marmara Bölgesi', '34', 'İstanbul', 'Sultanbeyli', 40.9647, 29.2636, 'DISTRICT', 'Sultanbeyli', 344215),
        (istanbul_id, 'TR', 'Türkiye', 'MARMARA', 'Marmara Bölgesi', '34', 'İstanbul', 'Ümraniye', 41.0167, 29.1167, 'DISTRICT', 'Umraniye', 704706),
        (istanbul_id, 'TR', 'Türkiye', 'MARMARA', 'Marmara Bölgesi', '34', 'İstanbul', 'Şile', 41.1750, 29.6125, 'DISTRICT', 'Sile', 41156),
        (istanbul_id, 'TR', 'Türkiye', 'MARMARA', 'Marmara Bölgesi', '34', 'İstanbul', 'Adalar', 40.8761, 29.0911, 'DISTRICT', 'Adalar', 16119)
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

-- ============================================
-- ANKARA İLÇELERİ (Örnek detay)
-- ============================================
DO $$
DECLARE
    ankara_id UUID;
BEGIN
    SELECT id INTO ankara_id FROM geographic_locations WHERE city_code = '06' AND location_type = 'CITY' LIMIT 1;
    
    IF ankara_id IS NOT NULL THEN
        INSERT INTO geographic_locations (parent_id, country_code, country_name, region_code, region_name, city_code, city_name, district_name, latitude, longitude, location_type, name_ascii, population) VALUES
        (ankara_id, 'TR', 'Türkiye', 'IC_ANADOLU', 'İç Anadolu Bölgesi', '06', 'Ankara', 'Çankaya', 39.9179, 32.8622, 'DISTRICT', 'Cankaya', 944609),
        (ankara_id, 'TR', 'Türkiye', 'IC_ANADOLU', 'İç Anadolu Bölgesi', '06', 'Ankara', 'Keçiören', 39.9833, 32.8667, 'DISTRICT', 'Kecioren', 939958),
        (ankara_id, 'TR', 'Türkiye', 'IC_ANADOLU', 'İç Anadolu Bölgesi', '06', 'Ankara', 'Mamak', 39.9333, 32.9167, 'DISTRICT', 'Mamak', 682041),
        (ankara_id, 'TR', 'Türkiye', 'IC_ANADOLU', 'İç Anadolu Bölgesi', '06', 'Ankara', 'Yenimahalle', 39.9667, 32.8000, 'DISTRICT', 'Yenimahalle', 687429),
        (ankara_id, 'TR', 'Türkiye', 'IC_ANADOLU', 'İç Anadolu Bölgesi', '06', 'Ankara', 'Etimesgut', 39.9500, 32.6667, 'DISTRICT', 'Etimesgut', 603696),
        (ankara_id, 'TR', 'Türkiye', 'IC_ANADOLU', 'İç Anadolu Bölgesi', '06', 'Ankara', 'Sincan', 39.9833, 32.5833, 'DISTRICT', 'Sincan', 540502),
        (ankara_id, 'TR', 'Türkiye', 'IC_ANADOLU', 'İç Anadolu Bölgesi', '06', 'Ankara', 'Altındağ', 39.9500, 32.8833, 'DISTRICT', 'Altindag', 365929),
        (ankara_id, 'TR', 'Türkiye', 'IC_ANADOLU', 'İç Anadolu Bölgesi', '06', 'Ankara', 'Pursaklar', 40.0333, 32.9000, 'DISTRICT', 'Pursaklar', 155328),
        (ankara_id, 'TR', 'Türkiye', 'IC_ANADOLU', 'İç Anadolu Bölgesi', '06', 'Ankara', 'Gölbaşı', 39.7833, 32.8000, 'DISTRICT', 'Golbasi', 149610),
        (ankara_id, 'TR', 'Türkiye', 'IC_ANADOLU', 'İç Anadolu Bölgesi', '06', 'Ankara', 'Polatlı', 39.5833, 32.1500, 'DISTRICT', 'Polatli', 133807)
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

-- ============================================
-- İZMİR İLÇELERİ (Örnek detay)
-- ============================================
DO $$
DECLARE
    izmir_id UUID;
BEGIN
    SELECT id INTO izmir_id FROM geographic_locations WHERE city_code = '35' AND location_type = 'CITY' LIMIT 1;
    
    IF izmir_id IS NOT NULL THEN
        INSERT INTO geographic_locations (parent_id, country_code, country_name, region_code, region_name, city_code, city_name, district_name, latitude, longitude, location_type, name_ascii, population) VALUES
        (izmir_id, 'TR', 'Türkiye', 'EGE', 'Ege Bölgesi', '35', 'İzmir', 'Konak', 38.4167, 27.1333, 'DISTRICT', 'Konak', 375644),
        (izmir_id, 'TR', 'Türkiye', 'EGE', 'Ege Bölgesi', '35', 'İzmir', 'Karşıyaka', 38.4564, 27.1094, 'DISTRICT', 'Karsiyaka', 331436),
        (izmir_id, 'TR', 'Türkiye', 'EGE', 'Ege Bölgesi', '35', 'İzmir', 'Bornova', 38.4667, 27.2167, 'DISTRICT', 'Bornova', 447689),
        (izmir_id, 'TR', 'Türkiye', 'EGE', 'Ege Bölgesi', '35', 'İzmir', 'Buca', 38.3833, 27.1833, 'DISTRICT', 'Buca', 510659),
        (izmir_id, 'TR', 'Türkiye', 'EGE', 'Ege Bölgesi', '35', 'İzmir', 'Bayraklı', 38.4667, 27.1667, 'DISTRICT', 'Bayrakli', 315621),
        (izmir_id, 'TR', 'Türkiye', 'EGE', 'Ege Bölgesi', '35', 'İzmir', 'Çiğli', 38.5167, 27.0500, 'DISTRICT', 'Cigli', 206298),
        (izmir_id, 'TR', 'Türkiye', 'EGE', 'Ege Bölgesi', '35', 'İzmir', 'Gaziemir', 38.3167, 27.1333, 'DISTRICT', 'Gaziemir', 138623),
        (izmir_id, 'TR', 'Türkiye', 'EGE', 'Ege Bölgesi', '35', 'İzmir', 'Karabağlar', 38.3667, 27.1167, 'DISTRICT', 'Karabaglar', 486399),
        (izmir_id, 'TR', 'Türkiye', 'EGE', 'Ege Bölgesi', '35', 'İzmir', 'Menemen', 38.6000, 27.0667, 'DISTRICT', 'Menemen', 176762),
        (izmir_id, 'TR', 'Türkiye', 'EGE', 'Ege Bölgesi', '35', 'İzmir', 'Torbalı', 38.1500, 27.3667, 'DISTRICT', 'Torbali', 188680)
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

-- ============================================
-- LOOKUP FONKSİYONLARI (Harita için koordinat bul)
-- ============================================

-- İl adından koordinat bul
CREATE OR REPLACE FUNCTION get_city_coordinates(p_city_name VARCHAR)
RETURNS TABLE(lat DECIMAL, lng DECIMAL, found_name VARCHAR) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        gl.latitude,
        gl.longitude,
        gl.city_name
    FROM geographic_locations gl
    WHERE gl.location_type = 'CITY'
      AND (
          LOWER(gl.city_name) = LOWER(p_city_name)
          OR LOWER(gl.name_ascii) = LOWER(p_city_name)
          OR p_city_name = ANY(gl.name_alternatives)
      )
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- İlçe adından koordinat bul
CREATE OR REPLACE FUNCTION get_district_coordinates(p_city_name VARCHAR, p_district_name VARCHAR)
RETURNS TABLE(lat DECIMAL, lng DECIMAL, found_name VARCHAR) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        gl.latitude,
        gl.longitude,
        gl.district_name
    FROM geographic_locations gl
    WHERE gl.location_type = 'DISTRICT'
      AND (
          LOWER(gl.city_name) = LOWER(p_city_name)
          OR LOWER(gl.name_ascii) = LOWER(p_city_name)
      )
      AND (
          LOWER(gl.district_name) = LOWER(p_district_name)
          OR LOWER(gl.name_ascii) = LOWER(p_district_name)
      )
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Genel lokasyon arama (fuzzy search)
CREATE OR REPLACE FUNCTION search_location(p_search VARCHAR)
RETURNS TABLE(
    location_id UUID,
    location_type VARCHAR,
    city_name VARCHAR,
    district_name VARCHAR,
    neighborhood_name VARCHAR,
    lat DECIMAL,
    lng DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        gl.id,
        gl.location_type,
        gl.city_name,
        gl.district_name,
        gl.neighborhood_name,
        gl.latitude,
        gl.longitude
    FROM geographic_locations gl
    WHERE 
        LOWER(gl.city_name) LIKE LOWER('%' || p_search || '%')
        OR LOWER(gl.district_name) LIKE LOWER('%' || p_search || '%')
        OR LOWER(gl.neighborhood_name) LIKE LOWER('%' || p_search || '%')
        OR LOWER(gl.name_ascii) LIKE LOWER('%' || p_search || '%')
    ORDER BY 
        CASE gl.location_type 
            WHEN 'CITY' THEN 1 
            WHEN 'DISTRICT' THEN 2 
            WHEN 'NEIGHBORHOOD' THEN 3 
            ELSE 4 
        END,
        gl.population DESC NULLS LAST
    LIMIT 20;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- İSTATİSTİKLER VIEW
-- ============================================
CREATE OR REPLACE VIEW v_geographic_stats AS
SELECT 
    location_type,
    COUNT(*) as count,
    SUM(population) as total_population
FROM geographic_locations
WHERE is_active = true
GROUP BY location_type
ORDER BY 
    CASE location_type 
        WHEN 'COUNTRY' THEN 1 
        WHEN 'REGION' THEN 2 
        WHEN 'CITY' THEN 3 
        WHEN 'DISTRICT' THEN 4 
        WHEN 'NEIGHBORHOOD' THEN 5 
    END;

-- ============================================
-- API ENDPOINT İÇİN YARDIMCI VIEW
-- ============================================
CREATE OR REPLACE VIEW v_cities_with_districts AS
SELECT 
    c.id as city_id,
    c.city_code,
    c.city_name,
    c.region_code,
    c.region_name,
    c.latitude as city_lat,
    c.longitude as city_lng,
    c.population as city_population,
    COALESCE(
        json_agg(
            json_build_object(
                'id', d.id,
                'name', d.district_name,
                'lat', d.latitude,
                'lng', d.longitude,
                'population', d.population
            )
            ORDER BY d.population DESC NULLS LAST
        ) FILTER (WHERE d.id IS NOT NULL),
        '[]'::json
    ) as districts
FROM geographic_locations c
LEFT JOIN geographic_locations d ON d.parent_id = c.id AND d.location_type = 'DISTRICT'
WHERE c.location_type = 'CITY' AND c.is_active = true
GROUP BY c.id, c.city_code, c.city_name, c.region_code, c.region_name, c.latitude, c.longitude, c.population
ORDER BY c.population DESC NULLS LAST;

COMMENT ON TABLE geographic_locations IS 'Türkiye mülki idari bölümler master tablosu - Harita görselleştirmesi için koordinat lookup';
COMMENT ON COLUMN geographic_locations.location_type IS 'COUNTRY, REGION, CITY, DISTRICT, NEIGHBORHOOD';
COMMENT ON COLUMN geographic_locations.name_ascii IS 'Türkçe karakter içermeyen versiyon (arama için)';


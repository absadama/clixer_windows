-- =============================================
-- CLIXER DEMO: ÜNİVERSİTE YÖNETİM SİSTEMİ
-- SQL Server Express için
-- =============================================

USE clixer;
GO

-- Mevcut tabloları temizle
IF OBJECT_ID('transactions', 'U') IS NOT NULL DROP TABLE transactions;
IF OBJECT_ID('payments', 'U') IS NOT NULL DROP TABLE payments;
IF OBJECT_ID('student_fees', 'U') IS NOT NULL DROP TABLE student_fees;
IF OBJECT_ID('fee_types', 'U') IS NOT NULL DROP TABLE fee_types;
IF OBJECT_ID('students', 'U') IS NOT NULL DROP TABLE students;
IF OBJECT_ID('departments', 'U') IS NOT NULL DROP TABLE departments;
IF OBJECT_ID('faculties', 'U') IS NOT NULL DROP TABLE faculties;
IF OBJECT_ID('staff', 'U') IS NOT NULL DROP TABLE staff;
IF OBJECT_ID('campuses', 'U') IS NOT NULL DROP TABLE campuses;
IF OBJECT_ID('neighborhoods', 'U') IS NOT NULL DROP TABLE neighborhoods;
IF OBJECT_ID('districts', 'U') IS NOT NULL DROP TABLE districts;
IF OBJECT_ID('cities', 'U') IS NOT NULL DROP TABLE cities;
IF OBJECT_ID('regions', 'U') IS NOT NULL DROP TABLE regions;
GO

-- =============================================
-- 1. BÖLGELER (Denetim Bölgeleri)
-- =============================================
CREATE TABLE regions (
    id INT IDENTITY(1,1) PRIMARY KEY,
    code NVARCHAR(20) NOT NULL UNIQUE,
    name NVARCHAR(100) NOT NULL,
    description NVARCHAR(500),
    created_at DATETIME DEFAULT GETDATE()
);

INSERT INTO regions (code, name, description) VALUES
('MARMARA', N'Marmara Bölgesi', N'İstanbul, Bursa, Kocaeli, Tekirdağ kampüsleri'),
('EGE', N'Ege Bölgesi', N'İzmir, Manisa, Aydın kampüsleri'),
('IC_ANADOLU', N'İç Anadolu Bölgesi', N'Ankara, Konya, Eskişehir kampüsleri'),
('AKDENIZ', N'Akdeniz Bölgesi', N'Antalya, Mersin, Adana kampüsleri'),
('KARADENIZ', N'Karadeniz Bölgesi', N'Samsun, Trabzon kampüsleri');
GO

-- =============================================
-- 2. İLLER
-- =============================================
CREATE TABLE cities (
    id INT IDENTITY(1,1) PRIMARY KEY,
    code NVARCHAR(10) NOT NULL UNIQUE,
    name NVARCHAR(100) NOT NULL,
    region_id INT REFERENCES regions(id),
    plate_code NVARCHAR(5)
);

INSERT INTO cities (code, name, region_id, plate_code) VALUES
('IST', N'İstanbul', 1, '34'),
('ANK', N'Ankara', 3, '06'),
('IZM', N'İzmir', 2, '35'),
('BRS', N'Bursa', 1, '16'),
('ANT', N'Antalya', 4, '07'),
('KOC', N'Kocaeli', 1, '41'),
('KNY', N'Konya', 3, '42'),
('ADN', N'Adana', 4, '01'),
('MRS', N'Mersin', 4, '33'),
('SMS', N'Samsun', 5, '55'),
('TRB', N'Trabzon', 5, '61'),
('ESK', N'Eskişehir', 3, '26'),
('TKD', N'Tekirdağ', 1, '59'),
('MNS', N'Manisa', 2, '45'),
('AYD', N'Aydın', 2, '09');
GO

-- =============================================
-- 3. İLÇELER
-- =============================================
CREATE TABLE districts (
    id INT IDENTITY(1,1) PRIMARY KEY,
    code NVARCHAR(20) NOT NULL,
    name NVARCHAR(100) NOT NULL,
    city_id INT REFERENCES cities(id)
);

-- İstanbul ilçeleri
INSERT INTO districts (code, name, city_id) VALUES
('IST_KDK', N'Kadıköy', 1), ('IST_BSK', N'Beşiktaş', 1), ('IST_SIS', N'Şişli', 1),
('IST_USK', N'Üsküdar', 1), ('IST_ATK', N'Ataşehir', 1), ('IST_MLT', N'Maltepe', 1),
('IST_KRT', N'Kartal', 1), ('IST_PND', N'Pendik', 1), ('IST_BMC', N'Bahçelievler', 1),
('IST_BAK', N'Bakırköy', 1);

-- Ankara ilçeleri
INSERT INTO districts (code, name, city_id) VALUES
('ANK_CNK', N'Çankaya', 2), ('ANK_KZL', N'Kızılay', 2), ('ANK_YNM', N'Yenimahalle', 2),
('ANK_KEÇ', N'Keçiören', 2), ('ANK_ETM', N'Etimesgut', 2);

-- İzmir ilçeleri
INSERT INTO districts (code, name, city_id) VALUES
('IZM_KNK', N'Konak', 3), ('IZM_KRS', N'Karşıyaka', 3), ('IZM_BRN', N'Bornova', 3),
('IZM_BYR', N'Bayraklı', 3), ('IZM_BCA', N'Buca', 3);

-- Diğer şehirler
INSERT INTO districts (code, name, city_id) VALUES
('BRS_NLF', N'Nilüfer', 4), ('BRS_OSM', N'Osmangazi', 4),
('ANT_MRT', N'Muratpaşa', 5), ('ANT_KNY', N'Konyaaltı', 5),
('KOC_IZM', N'İzmit', 6), ('KOC_GBZ', N'Gebze', 6),
('KNY_SLK', N'Selçuklu', 7), ('KNY_MRM', N'Meram', 7),
('ADN_SYH', N'Seyhan', 8), ('ADN_YRG', N'Yüreğir', 8),
('MRS_MZT', N'Mezitli', 9), ('MRS_YNS', N'Yenişehir', 9),
('SMS_ILK', N'İlkadım', 10), ('SMS_ATK', N'Atakum', 10),
('TRB_ORT', N'Ortahisar', 11), ('ESK_ODN', N'Odunpazarı', 12),
('TKD_SLY', N'Süleymanpaşa', 13), ('MNS_YNT', N'Yunusemre', 14),
('AYD_EFE', N'Efeler', 15);
GO

-- =============================================
-- 4. MAHALLELER
-- =============================================
CREATE TABLE neighborhoods (
    id INT IDENTITY(1,1) PRIMARY KEY,
    code NVARCHAR(30) NOT NULL,
    name NVARCHAR(100) NOT NULL,
    district_id INT REFERENCES districts(id),
    postal_code NVARCHAR(10)
);

-- Her ilçeye 3-5 mahalle
INSERT INTO neighborhoods (code, name, district_id, postal_code) VALUES
-- Kadıköy
('KDK_CAD', N'Caferağa', 1, '34710'), ('KDK_MOD', N'Moda', 1, '34710'),
('KDK_FEN', N'Fenerbahçe', 1, '34726'), ('KDK_GZT', N'Göztepe', 1, '34730'),
-- Beşiktaş
('BSK_LEV', N'Levent', 2, '34330'), ('BSK_ETL', N'Etiler', 2, '34337'),
('BSK_BEB', N'Bebek', 2, '34342'), ('BSK_ORT', N'Ortaköy', 2, '34347'),
-- Şişli
('SIS_MEC', N'Mecidiyeköy', 3, '34387'), ('SIS_NIS', N'Nişantaşı', 3, '34365'),
('SIS_GLT', N'Gültepe', 3, '34394'),
-- Üsküdar
('USK_ACB', N'Acıbadem', 4, '34660'), ('USK_CNL', N'Çengelköy', 4, '34680'),
('USK_KZG', N'Kuzguncuk', 4, '34674'),
-- Ataşehir
('ATK_ICR', N'İçerenköy', 5, '34752'), ('ATK_ATS', N'Ataşehir Merkez', 5, '34758'),
-- Çankaya
('CNK_KVK', N'Kavaklıdere', 11, '06690'), ('CNK_GOP', N'GOP', 11, '06700'),
('CNK_CKR', N'Çukurambar', 11, '06520'),
-- Konak
('KNK_ALS', N'Alsancak', 16, '35220'), ('KNK_KRD', N'Kordon', 16, '35210'),
-- Bornova
('BRN_UNV', N'Üniversite', 18, '35040'), ('BRN_EVK', N'Evka', 18, '35050'),
-- Nilüfer
('NLF_FST', N'FSM', 21, '16110'), ('NLF_GRS', N'Görükle', 21, '16285'),
-- Muratpaşa
('MRT_LRA', N'Lara', 23, '07100'), ('MRT_KNY', N'Konyaaltı', 23, '07050');
GO

-- =============================================
-- 5. KAMPÜSLER (Merkez + Franchise)
-- =============================================
CREATE TABLE campuses (
    id INT IDENTITY(1,1) PRIMARY KEY,
    code NVARCHAR(20) NOT NULL UNIQUE,
    name NVARCHAR(200) NOT NULL,
    campus_type NVARCHAR(20) NOT NULL CHECK (campus_type IN ('MERKEZ', 'FRANCHISE')),
    region_id INT REFERENCES regions(id),
    city_id INT REFERENCES cities(id),
    district_id INT REFERENCES districts(id),
    address NVARCHAR(500),
    phone NVARCHAR(20),
    email NVARCHAR(100),
    capacity INT,
    opening_date DATE,
    is_active BIT DEFAULT 1,
    created_at DATETIME DEFAULT GETDATE()
);

INSERT INTO campuses (code, name, campus_type, region_id, city_id, district_id, address, phone, email, capacity, opening_date) VALUES
-- MERKEZ Kampüsler
('IST_KADIKOY', N'İstanbul Kadıköy Kampüsü', 'MERKEZ', 1, 1, 1, N'Caferağa Mah. Moda Cad. No:45', '0216-555-0001', 'kadikoy@universite.edu.tr', 5000, '2010-09-01'),
('ANK_CANKAYA', N'Ankara Çankaya Kampüsü', 'MERKEZ', 3, 2, 11, N'Kavaklıdere Mah. Atatürk Blv. No:120', '0312-555-0001', 'cankaya@universite.edu.tr', 4000, '2008-09-01'),
('IZM_BORNOVA', N'İzmir Bornova Kampüsü', 'MERKEZ', 2, 3, 18, N'Üniversite Mah. Kampüs Cad. No:1', '0232-555-0001', 'bornova@universite.edu.tr', 3500, '2012-09-01'),

-- FRANCHISE Kampüsler
('IST_ATASEHIR', N'İstanbul Ataşehir Kampüsü', 'FRANCHISE', 1, 1, 5, N'Ataşehir Merkez Mah. Finans Cad. No:88', '0216-555-0002', 'atasehir@universite.edu.tr', 2000, '2018-09-01'),
('IST_PENDIK', N'İstanbul Pendik Kampüsü', 'FRANCHISE', 1, 1, 8, N'Pendik Merkez Mah. Sahil Yolu No:200', '0216-555-0003', 'pendik@universite.edu.tr', 1500, '2020-09-01'),
('BRS_NILUFER', N'Bursa Nilüfer Kampüsü', 'FRANCHISE', 1, 4, 21, N'Görükle Mah. Üniversite Cad. No:50', '0224-555-0001', 'nilufer@universite.edu.tr', 2500, '2015-09-01'),
('ANT_MURATPASA', N'Antalya Muratpaşa Kampüsü', 'FRANCHISE', 4, 5, 23, N'Lara Mah. Turizm Cad. No:100', '0242-555-0001', 'antalya@universite.edu.tr', 1800, '2019-09-01'),
('KOC_GEBZE', N'Kocaeli Gebze Kampüsü', 'FRANCHISE', 1, 6, 26, N'Gebze Teknopark Mah. Sanayi Cad. No:25', '0262-555-0001', 'gebze@universite.edu.tr', 1200, '2021-09-01'),
('KNY_SELCUKLU', N'Konya Selçuklu Kampüsü', 'FRANCHISE', 3, 7, 27, N'Selçuklu Mah. Mevlana Cad. No:75', '0332-555-0001', 'konya@universite.edu.tr', 1600, '2017-09-01'),
('ADN_SEYHAN', N'Adana Seyhan Kampüsü', 'FRANCHISE', 4, 8, 29, N'Seyhan Merkez Mah. Toros Cad. No:150', '0322-555-0001', 'adana@universite.edu.tr', 1400, '2016-09-01');
GO

-- =============================================
-- 6. PERSONEL (Bölge Müdürleri dahil)
-- =============================================
CREATE TABLE staff (
    id INT IDENTITY(1,1) PRIMARY KEY,
    employee_code NVARCHAR(20) NOT NULL UNIQUE,
    first_name NVARCHAR(100) NOT NULL,
    last_name NVARCHAR(100) NOT NULL,
    email NVARCHAR(100),
    phone NVARCHAR(20),
    position NVARCHAR(50) NOT NULL,
    department NVARCHAR(100),
    campus_id INT REFERENCES campuses(id),
    region_id INT REFERENCES regions(id),
    salary DECIMAL(12,2),
    hire_date DATE,
    is_active BIT DEFAULT 1
);

-- Bölge Müdürleri
INSERT INTO staff (employee_code, first_name, last_name, email, phone, position, region_id, salary, hire_date) VALUES
('BM001', N'Ahmet', N'Yılmaz', 'ahmet.yilmaz@universite.edu.tr', '0532-001-0001', N'BOLGE_MUDURU', 1, 45000.00, '2010-01-15'),
('BM002', N'Mehmet', N'Kaya', 'mehmet.kaya@universite.edu.tr', '0533-001-0002', N'BOLGE_MUDURU', 2, 42000.00, '2012-03-01'),
('BM003', N'Fatma', N'Demir', 'fatma.demir@universite.edu.tr', '0534-001-0003', N'BOLGE_MUDURU', 3, 44000.00, '2011-06-01'),
('BM004', N'Ali', N'Öztürk', 'ali.ozturk@universite.edu.tr', '0535-001-0004', N'BOLGE_MUDURU', 4, 41000.00, '2014-09-01'),
('BM005', N'Ayşe', N'Çelik', 'ayse.celik@universite.edu.tr', '0536-001-0005', N'BOLGE_MUDURU', 5, 40000.00, '2015-02-01');

-- Kampüs Müdürleri
INSERT INTO staff (employee_code, first_name, last_name, email, phone, position, campus_id, salary, hire_date) VALUES
('KM001', N'Mustafa', N'Arslan', 'mustafa.arslan@universite.edu.tr', '0537-002-0001', N'KAMPUS_MUDURU', 1, 35000.00, '2015-01-01'),
('KM002', N'Zeynep', N'Koç', 'zeynep.koc@universite.edu.tr', '0538-002-0002', N'KAMPUS_MUDURU', 2, 34000.00, '2016-01-01'),
('KM003', N'Hasan', N'Yıldız', 'hasan.yildiz@universite.edu.tr', '0539-002-0003', N'KAMPUS_MUDURU', 3, 33000.00, '2017-01-01'),
('KM004', N'Elif', N'Şahin', 'elif.sahin@universite.edu.tr', '0540-002-0004', N'KAMPUS_MUDURU', 4, 30000.00, '2018-09-01'),
('KM005', N'Emre', N'Aydın', 'emre.aydin@universite.edu.tr', '0541-002-0005', N'KAMPUS_MUDURU', 5, 29000.00, '2020-09-01'),
('KM006', N'Selin', N'Erdoğan', 'selin.erdogan@universite.edu.tr', '0542-002-0006', N'KAMPUS_MUDURU', 6, 31000.00, '2015-09-01'),
('KM007', N'Burak', N'Özdemir', 'burak.ozdemir@universite.edu.tr', '0543-002-0007', N'KAMPUS_MUDURU', 7, 28000.00, '2019-09-01'),
('KM008', N'Merve', N'Korkmaz', 'merve.korkmaz@universite.edu.tr', '0544-002-0008', N'KAMPUS_MUDURU', 8, 27000.00, '2021-09-01'),
('KM009', N'Can', N'Yılmazer', 'can.yilmazer@universite.edu.tr', '0545-002-0009', N'KAMPUS_MUDURU', 9, 29500.00, '2017-09-01'),
('KM010', N'Deniz', N'Aksoy', 'deniz.aksoy@universite.edu.tr', '0546-002-0010', N'KAMPUS_MUDURU', 10, 28500.00, '2016-09-01');
GO

-- =============================================
-- 7. FAKÜLTELER
-- =============================================
CREATE TABLE faculties (
    id INT IDENTITY(1,1) PRIMARY KEY,
    code NVARCHAR(20) NOT NULL,
    name NVARCHAR(200) NOT NULL,
    campus_id INT REFERENCES campuses(id),
    dean_id INT REFERENCES staff(id),
    established_year INT,
    is_active BIT DEFAULT 1
);

INSERT INTO faculties (code, name, campus_id, established_year) VALUES
-- İstanbul Kadıköy
('IST_MUH', N'Mühendislik Fakültesi', 1, 2010),
('IST_TIP', N'Tıp Fakültesi', 1, 2012),
('IST_ISL', N'İşletme Fakültesi', 1, 2010),
('IST_HUK', N'Hukuk Fakültesi', 1, 2011),
('IST_FEN', N'Fen-Edebiyat Fakültesi', 1, 2010),
-- Ankara
('ANK_MUH', N'Mühendislik Fakültesi', 2, 2008),
('ANK_SBF', N'Siyasal Bilgiler Fakültesi', 2, 2008),
('ANK_TIP', N'Tıp Fakültesi', 2, 2009),
-- İzmir
('IZM_MUH', N'Mühendislik Fakültesi', 3, 2012),
('IZM_MIM', N'Mimarlık Fakültesi', 3, 2013),
('IZM_ISL', N'İşletme Fakültesi', 3, 2012),
-- Franchise kampüsler (her birinde 2-3 fakülte)
('ATS_MUH', N'Mühendislik Fakültesi', 4, 2018),
('ATS_ISL', N'İşletme Fakültesi', 4, 2018),
('PND_MUH', N'Mühendislik Fakültesi', 5, 2020),
('NLF_MUH', N'Mühendislik Fakültesi', 6, 2015),
('NLF_ISL', N'İşletme Fakültesi', 6, 2015),
('ANT_TUR', N'Turizm Fakültesi', 7, 2019),
('ANT_ISL', N'İşletme Fakültesi', 7, 2019),
('GBZ_MUH', N'Mühendislik Fakültesi', 8, 2021),
('KNY_MUH', N'Mühendislik Fakültesi', 9, 2017),
('KNY_ILH', N'İlahiyat Fakültesi', 9, 2017),
('ADN_TIP', N'Tıp Fakültesi', 10, 2016),
('ADN_MUH', N'Mühendislik Fakültesi', 10, 2016);
GO

-- =============================================
-- 8. BÖLÜMLER
-- =============================================
CREATE TABLE departments (
    id INT IDENTITY(1,1) PRIMARY KEY,
    code NVARCHAR(30) NOT NULL,
    name NVARCHAR(200) NOT NULL,
    faculty_id INT REFERENCES faculties(id),
    head_id INT REFERENCES staff(id),
    quota INT,
    tuition_fee DECIMAL(12,2),
    is_active BIT DEFAULT 1
);

-- Mühendislik Bölümleri
INSERT INTO departments (code, name, faculty_id, quota, tuition_fee) VALUES
('IST_BLM', N'Bilgisayar Mühendisliği', 1, 120, 85000.00),
('IST_ELK', N'Elektrik-Elektronik Mühendisliği', 1, 100, 80000.00),
('IST_MAK', N'Makine Mühendisliği', 1, 100, 78000.00),
('IST_INS', N'İnşaat Mühendisliği', 1, 80, 75000.00),
('IST_END', N'Endüstri Mühendisliği', 1, 80, 82000.00);

-- Tıp Bölümleri
INSERT INTO departments (code, name, faculty_id, quota, tuition_fee) VALUES
('IST_TIP_G', N'Tıp (Türkçe)', 2, 200, 150000.00),
('IST_TIP_E', N'Tıp (İngilizce)', 2, 100, 200000.00);

-- İşletme Bölümleri
INSERT INTO departments (code, name, faculty_id, quota, tuition_fee) VALUES
('IST_ISL_G', N'İşletme', 3, 150, 65000.00),
('IST_IKT', N'İktisat', 3, 120, 60000.00),
('IST_UTI', N'Uluslararası Ticaret', 3, 100, 70000.00);

-- Hukuk
INSERT INTO departments (code, name, faculty_id, quota, tuition_fee) VALUES
('IST_HUK_G', N'Hukuk', 4, 200, 95000.00);

-- Fen-Edebiyat
INSERT INTO departments (code, name, faculty_id, quota, tuition_fee) VALUES
('IST_MAT', N'Matematik', 5, 60, 45000.00),
('IST_FIZ', N'Fizik', 5, 50, 45000.00),
('IST_KIM', N'Kimya', 5, 50, 48000.00),
('IST_PSK', N'Psikoloji', 5, 100, 70000.00);

-- Ankara Mühendislik
INSERT INTO departments (code, name, faculty_id, quota, tuition_fee) VALUES
('ANK_BLM', N'Bilgisayar Mühendisliği', 6, 100, 80000.00),
('ANK_ELK', N'Elektrik Mühendisliği', 6, 80, 75000.00);

-- Ankara SBF
INSERT INTO departments (code, name, faculty_id, quota, tuition_fee) VALUES
('ANK_KAM', N'Kamu Yönetimi', 7, 120, 55000.00),
('ANK_UIL', N'Uluslararası İlişkiler', 7, 100, 60000.00);

-- İzmir
INSERT INTO departments (code, name, faculty_id, quota, tuition_fee) VALUES
('IZM_BLM', N'Bilgisayar Mühendisliği', 9, 80, 75000.00),
('IZM_YZM', N'Yazılım Mühendisliği', 9, 80, 78000.00),
('IZM_MIM', N'Mimarlık', 10, 60, 72000.00),
('IZM_ISL', N'İşletme', 11, 100, 58000.00);

-- Diğer kampüsler
INSERT INTO departments (code, name, faculty_id, quota, tuition_fee) VALUES
('ATS_BLM', N'Bilgisayar Mühendisliği', 12, 60, 70000.00),
('ATS_ISL', N'İşletme', 13, 80, 55000.00),
('PND_BLM', N'Bilgisayar Mühendisliği', 14, 50, 65000.00),
('NLF_MAK', N'Makine Mühendisliği', 15, 60, 68000.00),
('NLF_ISL', N'İşletme', 16, 80, 52000.00),
('ANT_TUR', N'Turizm İşletmeciliği', 17, 100, 50000.00),
('ANT_GST', N'Gastronomi', 17, 60, 55000.00),
('GBZ_BLM', N'Bilgisayar Mühendisliği', 19, 50, 72000.00),
('KNY_ELK', N'Elektrik Mühendisliği', 20, 60, 65000.00),
('KNY_ILH', N'İlahiyat', 21, 100, 35000.00),
('ADN_TIP', N'Tıp', 22, 80, 120000.00),
('ADN_BIO', N'Biyomedikal Mühendisliği', 23, 50, 75000.00);
GO

-- =============================================
-- 9. ÖĞRENCİLER (2000 öğrenci)
-- =============================================
CREATE TABLE students (
    id INT IDENTITY(1,1) PRIMARY KEY,
    student_no NVARCHAR(20) NOT NULL UNIQUE,
    first_name NVARCHAR(100) NOT NULL,
    last_name NVARCHAR(100) NOT NULL,
    tc_no NVARCHAR(11),
    email NVARCHAR(100),
    phone NVARCHAR(20),
    birth_date DATE,
    gender NVARCHAR(10),
    department_id INT REFERENCES departments(id),
    campus_id INT REFERENCES campuses(id),
    enrollment_year INT,
    current_semester INT,
    gpa DECIMAL(3,2),
    scholarship_rate DECIMAL(5,2) DEFAULT 0,
    -- Adres bilgileri
    city_id INT REFERENCES cities(id),
    district_id INT REFERENCES districts(id),
    neighborhood_id INT REFERENCES neighborhoods(id),
    address_detail NVARCHAR(500),
    -- Durum
    status NVARCHAR(20) DEFAULT 'AKTIF',
    created_at DATETIME DEFAULT GETDATE()
);

-- 2000 öğrenci oluştur
DECLARE @i INT = 1;
DECLARE @first_names TABLE (id INT IDENTITY, name NVARCHAR(50));
DECLARE @last_names TABLE (id INT IDENTITY, name NVARCHAR(50));

INSERT INTO @first_names (name) VALUES 
(N'Ahmet'), (N'Mehmet'), (N'Mustafa'), (N'Ali'), (N'Hüseyin'), (N'Hasan'), (N'İbrahim'), (N'Ömer'), (N'Osman'), (N'Yusuf'),
(N'Emre'), (N'Can'), (N'Burak'), (N'Murat'), (N'Enes'), (N'Berkay'), (N'Kaan'), (N'Eren'), (N'Furkan'), (N'Onur'),
(N'Ayşe'), (N'Fatma'), (N'Zeynep'), (N'Elif'), (N'Merve'), (N'Büşra'), (N'Esra'), (N'Selin'), (N'Deniz'), (N'Gamze'),
(N'Emine'), (N'Hatice'), (N'Hacer'), (N'Gül'), (N'Şeyma'), (N'Beyza'), (N'İrem'), (N'Ece'), (N'Melike'), (N'Sude');

INSERT INTO @last_names (name) VALUES
(N'Yılmaz'), (N'Kaya'), (N'Demir'), (N'Çelik'), (N'Şahin'), (N'Yıldız'), (N'Yıldırım'), (N'Öztürk'), (N'Aydın'), (N'Özdemir'),
(N'Arslan'), (N'Doğan'), (N'Kılıç'), (N'Aslan'), (N'Çetin'), (N'Kara'), (N'Koç'), (N'Kurt'), (N'Özkan'), (N'Şimşek'),
(N'Polat'), (N'Korkmaz'), (N'Erdoğan'), (N'Güneş'), (N'Aksoy'), (N'Aktaş'), (N'Tekin'), (N'Kaplan'), (N'Karaca'), (N'Güler');

WHILE @i <= 2000
BEGIN
    INSERT INTO students (
        student_no, first_name, last_name, tc_no, email, phone, birth_date, gender,
        department_id, campus_id, enrollment_year, current_semester, gpa, scholarship_rate,
        city_id, district_id, neighborhood_id, address_detail, status
    )
    SELECT
        '2' + RIGHT('000000' + CAST(@i AS VARCHAR), 7) AS student_no,
        fn.name AS first_name,
        ln.name AS last_name,
        RIGHT('00000000000' + CAST(10000000000 + @i * 7 AS VARCHAR), 11) AS tc_no,
        LOWER(fn.name) + '.' + LOWER(ln.name) + CAST(@i AS VARCHAR) + '@ogrenci.edu.tr' AS email,
        '05' + RIGHT('000000000' + CAST(300000000 + @i AS VARCHAR), 9) AS phone,
        DATEADD(DAY, -(@i % 3650 + 7300), GETDATE()) AS birth_date,
        CASE WHEN @i % 2 = 0 THEN N'ERKEK' ELSE N'KADIN' END AS gender,
        (@i % 35) + 1 AS department_id,
        (@i % 10) + 1 AS campus_id,
        2020 + (@i % 5) AS enrollment_year,
        (@i % 8) + 1 AS current_semester,
        CAST(1.80 + ((@i % 220) / 100.0) AS DECIMAL(3,2)) AS gpa,
        CASE 
            WHEN @i % 10 = 0 THEN 100.00
            WHEN @i % 7 = 0 THEN 75.00
            WHEN @i % 5 = 0 THEN 50.00
            WHEN @i % 3 = 0 THEN 25.00
            ELSE 0.00
        END AS scholarship_rate,
        (@i % 15) + 1 AS city_id,
        (@i % 35) + 1 AS district_id,
        (@i % 25) + 1 AS neighborhood_id,
        N'Örnek Mahalle, ' + CAST(@i AS NVARCHAR) + N'. Sokak No:' + CAST(@i % 100 AS NVARCHAR) AS address_detail,
        CASE 
            WHEN @i % 50 = 0 THEN N'MEZUN'
            WHEN @i % 30 = 0 THEN N'DONUK'
            ELSE N'AKTIF'
        END AS status
    FROM @first_names fn
    CROSS JOIN @last_names ln
    WHERE fn.id = (@i % 40) + 1 AND ln.id = (@i % 30) + 1;
    
    SET @i = @i + 1;
END
GO

-- =============================================
-- 10. ÜCRET TİPLERİ
-- =============================================
CREATE TABLE fee_types (
    id INT IDENTITY(1,1) PRIMARY KEY,
    code NVARCHAR(20) NOT NULL UNIQUE,
    name NVARCHAR(100) NOT NULL,
    category NVARCHAR(50),
    is_recurring BIT DEFAULT 0
);

INSERT INTO fee_types (code, name, category, is_recurring) VALUES
('OGRNM', N'Öğrenim Ücreti', N'EĞİTİM', 1),
('KAYIT', N'Kayıt Ücreti', N'EĞİTİM', 0),
('YURT', N'Yurt Ücreti', N'BARINMA', 1),
('YEMEK', N'Yemek Kartı', N'YEMEK', 1),
('KUTUP', N'Kütüphane Ücreti', N'HİZMET', 0),
('LABOR', N'Laboratuvar Ücreti', N'EĞİTİM', 0),
('SPOR', N'Spor Tesisi Ücreti', N'HİZMET', 1),
('OGRN_BELGE', N'Öğrenci Belgesi', N'BELGE', 0),
('TRANS_BELGE', N'Transkript', N'BELGE', 0),
('MEZUN', N'Mezuniyet Ücreti', N'BELGE', 0),
('SINAV', N'Sınav Ücreti (Tek Ders)', N'EĞİTİM', 0),
('STAJ', N'Staj Sigortası', N'SİGORTA', 0);
GO

-- =============================================
-- 11. ÖĞRENCİ ÜCRETLERİ
-- =============================================
CREATE TABLE student_fees (
    id INT IDENTITY(1,1) PRIMARY KEY,
    student_id INT REFERENCES students(id),
    fee_type_id INT REFERENCES fee_types(id),
    academic_year NVARCHAR(10),
    semester NVARCHAR(20),
    amount DECIMAL(12,2),
    discount_amount DECIMAL(12,2) DEFAULT 0,
    net_amount DECIMAL(12,2),
    due_date DATE,
    status NVARCHAR(20) DEFAULT 'BEKLIYOR',
    created_at DATETIME DEFAULT GETDATE()
);

-- Her öğrenci için dönemlik ücretler
INSERT INTO student_fees (student_id, fee_type_id, academic_year, semester, amount, discount_amount, net_amount, due_date, status)
SELECT 
    s.id,
    1, -- Öğrenim ücreti
    '2024-2025',
    N'GÜZ',
    d.tuition_fee / 2,
    (d.tuition_fee / 2) * (s.scholarship_rate / 100),
    (d.tuition_fee / 2) - ((d.tuition_fee / 2) * (s.scholarship_rate / 100)),
    '2024-09-15',
    CASE 
        WHEN s.id % 3 = 0 THEN N'ODENDI'
        WHEN s.id % 5 = 0 THEN N'GECIKTI'
        ELSE N'BEKLIYOR'
    END
FROM students s
JOIN departments d ON s.department_id = d.id
WHERE s.status = N'AKTIF';

-- Yurt ücreti (bazı öğrenciler için)
INSERT INTO student_fees (student_id, fee_type_id, academic_year, semester, amount, discount_amount, net_amount, due_date, status)
SELECT 
    s.id,
    3, -- Yurt ücreti
    '2024-2025',
    N'GÜZ',
    15000.00,
    0,
    15000.00,
    '2024-09-01',
    CASE WHEN s.id % 2 = 0 THEN N'ODENDI' ELSE N'BEKLIYOR' END
FROM students s
WHERE s.id % 4 = 0 AND s.status = N'AKTIF';
GO

-- =============================================
-- 12. ÖDEMELER
-- =============================================
CREATE TABLE payments (
    id INT IDENTITY(1,1) PRIMARY KEY,
    payment_no NVARCHAR(20) NOT NULL UNIQUE,
    student_id INT REFERENCES students(id),
    student_fee_id INT REFERENCES student_fees(id),
    amount DECIMAL(12,2),
    payment_method NVARCHAR(50),
    payment_date DATETIME,
    bank_name NVARCHAR(100),
    receipt_no NVARCHAR(50),
    status NVARCHAR(20) DEFAULT 'BASARILI',
    created_at DATETIME DEFAULT GETDATE()
);

-- Ödenen ücretler için ödeme kaydı
INSERT INTO payments (payment_no, student_id, student_fee_id, amount, payment_method, payment_date, bank_name, status)
SELECT 
    'PAY' + RIGHT('00000000' + CAST(ROW_NUMBER() OVER (ORDER BY sf.id) AS VARCHAR), 8),
    sf.student_id,
    sf.id,
    sf.net_amount,
    CASE (sf.id % 4)
        WHEN 0 THEN N'KREDI_KARTI'
        WHEN 1 THEN N'HAVALE'
        WHEN 2 THEN N'NAKİT'
        ELSE N'KREDI_KARTI'
    END,
    DATEADD(DAY, -(sf.id % 60), GETDATE()),
    CASE (sf.id % 5)
        WHEN 0 THEN N'Ziraat Bankası'
        WHEN 1 THEN N'İş Bankası'
        WHEN 2 THEN N'Garanti BBVA'
        WHEN 3 THEN N'Yapı Kredi'
        ELSE N'Akbank'
    END,
    N'BASARILI'
FROM student_fees sf
WHERE sf.status = N'ODENDI';
GO

-- =============================================
-- 13. HAREKETLER (10.000+ kayıt)
-- =============================================
CREATE TABLE transactions (
    id INT IDENTITY(1,1) PRIMARY KEY,
    transaction_no NVARCHAR(30) NOT NULL,
    transaction_date DATETIME NOT NULL,
    transaction_type NVARCHAR(50) NOT NULL,
    category NVARCHAR(50),
    student_id INT REFERENCES students(id),
    campus_id INT REFERENCES campuses(id),
    department_id INT REFERENCES departments(id),
    staff_id INT REFERENCES staff(id),
    amount DECIMAL(12,2),
    description NVARCHAR(500),
    status NVARCHAR(20),
    created_at DATETIME DEFAULT GETDATE()
);

-- Hareket tipleri
DECLARE @tx_types TABLE (type_name NVARCHAR(50), category NVARCHAR(50));
INSERT INTO @tx_types VALUES
(N'KAYIT', N'AKADEMIK'),
(N'ODEME', N'FINANSAL'),
(N'DEVAMSIZLIK', N'AKADEMIK'),
(N'NOT_GIRISI', N'AKADEMIK'),
(N'BELGE_TALEBI', N'IDARI'),
(N'DERS_EKLE', N'AKADEMIK'),
(N'DERS_SIL', N'AKADEMIK'),
(N'STAJ_BASVURU', N'AKADEMIK'),
(N'BURS_BASVURU', N'FINANSAL'),
(N'YURT_BASVURU', N'BARINMA'),
(N'SINAV_ITIRAZ', N'AKADEMIK'),
(N'MAZERETI', N'IDARI'),
(N'IADE', N'FINANSAL'),
(N'CEZA', N'IDARI'),
(N'ODUL', N'AKADEMIK');

-- 12000 hareket oluştur
DECLARE @j INT = 1;
WHILE @j <= 12000
BEGIN
    INSERT INTO transactions (
        transaction_no, transaction_date, transaction_type, category,
        student_id, campus_id, department_id, amount, description, status
    )
    SELECT
        'TRX' + FORMAT(GETDATE(), 'yyyyMMdd') + RIGHT('00000000' + CAST(@j AS VARCHAR), 8),
        DATEADD(MINUTE, -(@j * 5), GETDATE()),
        t.type_name,
        t.category,
        (@j % 2000) + 1,
        (@j % 10) + 1,
        (@j % 35) + 1,
        CASE 
            WHEN t.category = N'FINANSAL' THEN CAST(100 + (@j % 50000) AS DECIMAL(12,2))
            ELSE NULL
        END,
        N'Hareket açıklaması #' + CAST(@j AS NVARCHAR),
        CASE (@j % 4)
            WHEN 0 THEN N'TAMAMLANDI'
            WHEN 1 THEN N'BEKLEMEDE'
            WHEN 2 THEN N'ONAYLANDI'
            ELSE N'TAMAMLANDI'
        END
    FROM @tx_types t
    WHERE t.type_name = (
        SELECT TOP 1 type_name FROM @tx_types ORDER BY NEWID()
    );
    
    SET @j = @j + 1;
END
GO

-- =============================================
-- 14. ÖZET İSTATİSTİKLER
-- =============================================
PRINT '=== VERİTABANI OLUŞTURULDU ===';
PRINT '';

SELECT 'regions' AS tablo, COUNT(*) AS kayit FROM regions
UNION ALL SELECT 'cities', COUNT(*) FROM cities
UNION ALL SELECT 'districts', COUNT(*) FROM districts
UNION ALL SELECT 'neighborhoods', COUNT(*) FROM neighborhoods
UNION ALL SELECT 'campuses', COUNT(*) FROM campuses
UNION ALL SELECT 'staff', COUNT(*) FROM staff
UNION ALL SELECT 'faculties', COUNT(*) FROM faculties
UNION ALL SELECT 'departments', COUNT(*) FROM departments
UNION ALL SELECT 'students', COUNT(*) FROM students
UNION ALL SELECT 'fee_types', COUNT(*) FROM fee_types
UNION ALL SELECT 'student_fees', COUNT(*) FROM student_fees
UNION ALL SELECT 'payments', COUNT(*) FROM payments
UNION ALL SELECT 'transactions', COUNT(*) FROM transactions;

PRINT '';
PRINT '=== CLIXER DEMO HAZIR ===';
GO








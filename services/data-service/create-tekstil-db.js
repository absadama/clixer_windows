/**
 * Tekstil Perakende Veritabanı Oluşturma Scripti
 * H&M / Zara benzeri tekstil perakende firması simülasyonu
 * 10M+ satış hareketi verisi
 */

const sql = require('mssql');

const config = {
  user: 'sa',
  password: 'TestPassword123!',
  server: 'localhost',
  port: 1433,
  database: 'tekstil_retail',
  options: {
    encrypt: false,
    trustServerCertificate: true
  },
  requestTimeout: 300000 // 5 dakika
};

async function createTables(pool) {
  console.log('\n📋 Tablolar oluşturuluyor...');
  
  // 1. BÖLGELER
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'regions')
    CREATE TABLE regions (
      id INT IDENTITY(1,1) PRIMARY KEY,
      code NVARCHAR(20) NOT NULL UNIQUE,
      name NVARCHAR(100) NOT NULL,
      manager_name NVARCHAR(100),
      manager_email NVARCHAR(100),
      created_at DATETIME DEFAULT GETDATE()
    )
  `);
  console.log('  ✅ regions');

  // 2. SAHİPLİK TİPLERİ (Merkez/Franchise)
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ownership_types')
    CREATE TABLE ownership_types (
      id INT IDENTITY(1,1) PRIMARY KEY,
      code NVARCHAR(10) NOT NULL UNIQUE,
      name NVARCHAR(50) NOT NULL,
      description NVARCHAR(200)
    )
  `);
  console.log('  ✅ ownership_types');

  // 3. MAĞAZALAR
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'stores')
    CREATE TABLE stores (
      id INT IDENTITY(1,1) PRIMARY KEY,
      code NVARCHAR(20) NOT NULL UNIQUE,
      name NVARCHAR(100) NOT NULL,
      region_id INT REFERENCES regions(id),
      ownership_type_id INT REFERENCES ownership_types(id),
      city NVARCHAR(50),
      district NVARCHAR(50),
      address NVARCHAR(300),
      phone NVARCHAR(20),
      email NVARCHAR(100),
      manager_name NVARCHAR(100),
      opening_date DATE,
      square_meters INT,
      employee_count INT,
      is_active BIT DEFAULT 1,
      created_at DATETIME DEFAULT GETDATE()
    )
  `);
  console.log('  ✅ stores');

  // 4. POZİSYONLAR
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'positions')
    CREATE TABLE positions (
      id INT IDENTITY(1,1) PRIMARY KEY,
      code NVARCHAR(20) NOT NULL UNIQUE,
      name NVARCHAR(100) NOT NULL,
      level INT,
      filter_level NVARCHAR(20)
    )
  `);
  console.log('  ✅ positions');

  // 5. KULLANICILAR
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'users')
    CREATE TABLE users (
      id INT IDENTITY(1,1) PRIMARY KEY,
      email NVARCHAR(100) NOT NULL UNIQUE,
      name NVARCHAR(100) NOT NULL,
      position_id INT REFERENCES positions(id),
      region_id INT REFERENCES regions(id),
      store_id INT REFERENCES stores(id),
      is_active BIT DEFAULT 1,
      created_at DATETIME DEFAULT GETDATE()
    )
  `);
  console.log('  ✅ users');

  // 6. ANA KATEGORİLER
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'categories')
    CREATE TABLE categories (
      id INT IDENTITY(1,1) PRIMARY KEY,
      code NVARCHAR(20) NOT NULL UNIQUE,
      name NVARCHAR(100) NOT NULL,
      sort_order INT
    )
  `);
  console.log('  ✅ categories');

  // 7. ALT KATEGORİLER
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'subcategories')
    CREATE TABLE subcategories (
      id INT IDENTITY(1,1) PRIMARY KEY,
      code NVARCHAR(20) NOT NULL UNIQUE,
      name NVARCHAR(100) NOT NULL,
      category_id INT REFERENCES categories(id),
      sort_order INT
    )
  `);
  console.log('  ✅ subcategories');

  // 8. ÜRÜNLER
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'products')
    CREATE TABLE products (
      id INT IDENTITY(1,1) PRIMARY KEY,
      code NVARCHAR(30) NOT NULL UNIQUE,
      name NVARCHAR(200) NOT NULL,
      subcategory_id INT REFERENCES subcategories(id),
      brand NVARCHAR(50),
      color NVARCHAR(30),
      size NVARCHAR(10),
      unit_price DECIMAL(10,2),
      cost_price DECIMAL(10,2),
      is_active BIT DEFAULT 1,
      created_at DATETIME DEFAULT GETDATE()
    )
  `);
  console.log('  ✅ products');

  // 9. SATIŞ HAREKETLERİ (Ana tablo - 10M+ veri)
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'sales_transactions')
    CREATE TABLE sales_transactions (
      id BIGINT IDENTITY(1,1) PRIMARY KEY,
      transaction_date DATETIME NOT NULL,
      store_id INT NOT NULL,
      product_id INT NOT NULL,
      quantity INT NOT NULL,
      unit_price DECIMAL(10,2) NOT NULL,
      discount_percent DECIMAL(5,2) DEFAULT 0,
      discount_amount DECIMAL(10,2) DEFAULT 0,
      net_amount DECIMAL(10,2) NOT NULL,
      payment_type NVARCHAR(20),
      cashier_id INT,
      created_at DATETIME DEFAULT GETDATE(),
      INDEX IX_sales_date (transaction_date),
      INDEX IX_sales_store (store_id),
      INDEX IX_sales_product (product_id)
    )
  `);
  console.log('  ✅ sales_transactions');
}

async function insertMasterData(pool) {
  console.log('\n📋 Master veriler ekleniyor...');

  // Bölgeler
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM regions)
    INSERT INTO regions (code, name, manager_name, manager_email) VALUES
    ('MARMARA', 'Marmara Bölgesi', 'Ahmet Yılmaz', 'ahmet.yilmaz@tekstil.com'),
    ('EGE', 'Ege Bölgesi', 'Mehmet Demir', 'mehmet.demir@tekstil.com'),
    ('AKDENIZ', 'Akdeniz Bölgesi', 'Ayşe Kaya', 'ayse.kaya@tekstil.com'),
    ('IC_ANADOLU', 'İç Anadolu Bölgesi', 'Fatma Öz', 'fatma.oz@tekstil.com'),
    ('KARADENIZ', 'Karadeniz Bölgesi', 'Ali Çelik', 'ali.celik@tekstil.com'),
    ('DOGU', 'Doğu Anadolu Bölgesi', 'Veli Şahin', 'veli.sahin@tekstil.com'),
    ('GUNEYDOGU', 'Güneydoğu Anadolu Bölgesi', 'Hasan Yıldız', 'hasan.yildiz@tekstil.com')
  `);
  console.log('  ✅ 7 bölge eklendi');

  // Sahiplik tipleri
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM ownership_types)
    INSERT INTO ownership_types (code, name, description) VALUES
    ('MERKEZ', 'Merkez Mağaza', 'Şirket bünyesinde işletilen mağazalar'),
    ('FRANCHISE', 'Franchise Mağaza', 'Bayilik sistemi ile işletilen mağazalar')
  `);
  console.log('  ✅ 2 sahiplik tipi eklendi');

  // Pozisyonlar
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM positions)
    INSERT INTO positions (code, name, level, filter_level) VALUES
    ('GM', 'Genel Müdür', 1, 'none'),
    ('DIREKTOR', 'Satış Direktörü', 2, 'group'),
    ('BM', 'Bölge Müdürü', 3, 'region'),
    ('MM', 'Mağaza Müdürü', 4, 'store'),
    ('KASASORUMLU', 'Kasa Sorumlusu', 5, 'store'),
    ('SATIS_TEMSILCI', 'Satış Temsilcisi', 6, 'store')
  `);
  console.log('  ✅ 6 pozisyon eklendi');

  // Kategoriler
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM categories)
    INSERT INTO categories (code, name, sort_order) VALUES
    ('KADIN', 'Kadın', 1),
    ('ERKEK', 'Erkek', 2),
    ('COCUK', 'Çocuk', 3),
    ('AKSESUAR', 'Aksesuar', 4),
    ('AYAKKABI', 'Ayakkabı', 5),
    ('SPOR', 'Spor', 6)
  `);
  console.log('  ✅ 6 kategori eklendi');

  // Alt kategoriler
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM subcategories)
    INSERT INTO subcategories (code, name, category_id, sort_order) VALUES
    -- Kadın
    ('K_ELBISE', 'Elbise', 1, 1),
    ('K_BLUZ', 'Bluz', 1, 2),
    ('K_PANTOLON', 'Pantolon', 1, 3),
    ('K_ETEK', 'Etek', 1, 4),
    ('K_CEKET', 'Ceket', 1, 5),
    ('K_KABAN', 'Kaban', 1, 6),
    -- Erkek
    ('E_GOMLEK', 'Gömlek', 2, 1),
    ('E_PANTOLON', 'Pantolon', 2, 2),
    ('E_TSHIRT', 'T-Shirt', 2, 3),
    ('E_CEKET', 'Ceket', 2, 4),
    ('E_KABAN', 'Kaban', 2, 5),
    ('E_TAKIM', 'Takım Elbise', 2, 6),
    -- Çocuk
    ('C_KIZ', 'Kız Çocuk', 3, 1),
    ('C_ERKEK', 'Erkek Çocuk', 3, 2),
    ('C_BEBEK', 'Bebek', 3, 3),
    -- Aksesuar
    ('A_CANTA', 'Çanta', 4, 1),
    ('A_KEMER', 'Kemer', 4, 2),
    ('A_ATKI', 'Atkı & Şal', 4, 3),
    ('A_SAPKA', 'Şapka', 4, 4),
    -- Ayakkabı
    ('AY_KADIN', 'Kadın Ayakkabı', 5, 1),
    ('AY_ERKEK', 'Erkek Ayakkabı', 5, 2),
    ('AY_COCUK', 'Çocuk Ayakkabı', 5, 3),
    -- Spor
    ('S_USTGIYIM', 'Spor Üst Giyim', 6, 1),
    ('S_ALTGIYIM', 'Spor Alt Giyim', 6, 2),
    ('S_AYAKKABI', 'Spor Ayakkabı', 6, 3)
  `);
  console.log('  ✅ 25 alt kategori eklendi');
}

async function insertStores(pool) {
  console.log('\n📋 Mağazalar oluşturuluyor (100 mağaza)...');
  
  const cities = [
    { city: 'İstanbul', districts: ['Kadıköy', 'Beşiktaş', 'Şişli', 'Bakırköy', 'Ümraniye', 'Ataşehir', 'Maltepe', 'Beylikdüzü', 'Esenyurt', 'Pendik'], region: 1 },
    { city: 'İzmir', districts: ['Konak', 'Karşıyaka', 'Bornova', 'Buca', 'Çiğli'], region: 2 },
    { city: 'Ankara', districts: ['Çankaya', 'Keçiören', 'Yenimahalle', 'Etimesgut', 'Mamak'], region: 4 },
    { city: 'Antalya', districts: ['Muratpaşa', 'Konyaaltı', 'Kepez', 'Lara'], region: 3 },
    { city: 'Bursa', districts: ['Nilüfer', 'Osmangazi', 'Yıldırım'], region: 1 },
    { city: 'Adana', districts: ['Seyhan', 'Çukurova', 'Yüreğir'], region: 3 },
    { city: 'Gaziantep', districts: ['Şahinbey', 'Şehitkamil'], region: 7 },
    { city: 'Konya', districts: ['Selçuklu', 'Meram', 'Karatay'], region: 4 },
    { city: 'Trabzon', districts: ['Ortahisar', 'Yomra'], region: 5 },
    { city: 'Samsun', districts: ['Atakum', 'İlkadım'], region: 5 }
  ];

  let storeId = 1;
  for (const cityData of cities) {
    for (const district of cityData.districts) {
      const ownershipType = Math.random() > 0.6 ? 1 : 2; // 60% Merkez, 40% Franchise
      const code = `STR${String(storeId).padStart(3, '0')}`;
      const name = `${cityData.city} ${district} Mağazası`;
      const sqMeters = Math.floor(Math.random() * 800) + 200;
      const employees = Math.floor(sqMeters / 50) + 3;
      
      await pool.request().query(`
        INSERT INTO stores (code, name, region_id, ownership_type_id, city, district, square_meters, employee_count, opening_date)
        VALUES ('${code}', N'${name}', ${cityData.region}, ${ownershipType}, N'${cityData.city}', N'${district}', ${sqMeters}, ${employees}, DATEADD(day, -${Math.floor(Math.random() * 1000)}, GETDATE()))
      `);
      storeId++;
    }
  }
  console.log(`  ✅ ${storeId - 1} mağaza eklendi`);
}

async function insertProducts(pool) {
  console.log('\n📋 Ürünler oluşturuluyor (5000 ürün)...');
  
  const colors = ['Siyah', 'Beyaz', 'Lacivert', 'Gri', 'Kırmızı', 'Mavi', 'Yeşil', 'Bej', 'Kahverengi', 'Pembe'];
  const sizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
  const brands = ['TrendLine', 'UrbanStyle', 'ClassicWear', 'ModaVita', 'StyleZone'];
  
  // Alt kategorileri al
  const subcats = await pool.request().query('SELECT id, code, name FROM subcategories');
  
  let productId = 1;
  const batchSize = 100;
  let batch = [];
  
  for (let i = 0; i < 5000; i++) {
    const subcat = subcats.recordset[Math.floor(Math.random() * subcats.recordset.length)];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const size = sizes[Math.floor(Math.random() * sizes.length)];
    const brand = brands[Math.floor(Math.random() * brands.length)];
    const unitPrice = Math.floor(Math.random() * 1500) + 50;
    const costPrice = Math.floor(unitPrice * (0.4 + Math.random() * 0.2));
    
    const code = `PRD${String(productId).padStart(6, '0')}`;
    const name = `${brand} ${subcat.name} ${color} ${size}`;
    
    batch.push(`('${code}', N'${name}', ${subcat.id}, N'${brand}', N'${color}', '${size}', ${unitPrice}, ${costPrice})`);
    
    if (batch.length >= batchSize) {
      await pool.request().query(`
        INSERT INTO products (code, name, subcategory_id, brand, color, size, unit_price, cost_price)
        VALUES ${batch.join(',')}
      `);
      batch = [];
    }
    productId++;
  }
  
  if (batch.length > 0) {
    await pool.request().query(`
      INSERT INTO products (code, name, subcategory_id, brand, color, size, unit_price, cost_price)
      VALUES ${batch.join(',')}
    `);
  }
  
  console.log(`  ✅ 5000 ürün eklendi`);
}

async function insertSalesTransactions(pool) {
  console.log('\n📋 Satış hareketleri oluşturuluyor (10M+ kayıt)...');
  console.log('  ⏳ Bu işlem birkaç dakika sürebilir...');
  
  const paymentTypes = ['NAKIT', 'KREDI_KARTI', 'BANKA_KARTI', 'HAVALE'];
  const startDate = new Date('2024-01-01');
  const endDate = new Date('2025-12-31');
  const daysDiff = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24));
  
  // Mağaza ve ürün ID'lerini al
  const stores = await pool.request().query('SELECT id FROM stores');
  const products = await pool.request().query('SELECT id, unit_price FROM products');
  
  const storeIds = stores.recordset.map(s => s.id);
  const productData = products.recordset;
  
  const totalRecords = 1000000; // 1M ile başla, sonra artırılabilir
  const batchSize = 900; // MSSQL max 1000 satır limiti
  let inserted = 0;
  
  while (inserted < totalRecords) {
    let batch = [];
    const currentBatchSize = Math.min(batchSize, totalRecords - inserted);
    
    for (let i = 0; i < currentBatchSize; i++) {
      const storeId = storeIds[Math.floor(Math.random() * storeIds.length)];
      const product = productData[Math.floor(Math.random() * productData.length)];
      const daysOffset = Math.floor(Math.random() * daysDiff);
      const transDate = new Date(startDate);
      transDate.setDate(startDate.getDate() + daysOffset);
      transDate.setHours(Math.floor(Math.random() * 12) + 9); // 09:00 - 21:00
      transDate.setMinutes(Math.floor(Math.random() * 60));
      
      const quantity = Math.floor(Math.random() * 3) + 1;
      const unitPrice = product.unit_price;
      const discountPercent = Math.random() > 0.7 ? Math.floor(Math.random() * 30) + 5 : 0;
      const grossAmount = quantity * unitPrice;
      const discountAmount = grossAmount * discountPercent / 100;
      const netAmount = grossAmount - discountAmount;
      const paymentType = paymentTypes[Math.floor(Math.random() * paymentTypes.length)];
      
      const dateStr = transDate.toISOString().slice(0, 19).replace('T', ' ');
      
      batch.push(`('${dateStr}', ${storeId}, ${product.id}, ${quantity}, ${unitPrice}, ${discountPercent}, ${discountAmount.toFixed(2)}, ${netAmount.toFixed(2)}, '${paymentType}')`);
    }
    
    await pool.request().query(`
      INSERT INTO sales_transactions (transaction_date, store_id, product_id, quantity, unit_price, discount_percent, discount_amount, net_amount, payment_type)
      VALUES ${batch.join(',')}
    `);
    
    inserted += currentBatchSize;
    const percent = ((inserted / totalRecords) * 100).toFixed(1);
    process.stdout.write(`\r  ⏳ İlerleme: ${inserted.toLocaleString()} / ${totalRecords.toLocaleString()} (${percent}%)`);
  }
  
  console.log(`\n  ✅ ${totalRecords.toLocaleString()} satış hareketi eklendi`);
}

async function createViews(pool) {
  console.log('\n📋 View\'lar oluşturuluyor...');
  
  // Günlük satış özeti
  await pool.request().query(`
    IF OBJECT_ID('vw_daily_sales', 'V') IS NOT NULL DROP VIEW vw_daily_sales;
  `);
  await pool.request().query(`
    CREATE VIEW vw_daily_sales AS
    SELECT 
      CAST(st.transaction_date AS DATE) as tarih,
      s.city as il,
      r.name as bolge,
      ot.name as sahiplik_tipi,
      COUNT(DISTINCT s.id) as magaza_sayisi,
      COUNT(*) as islem_sayisi,
      SUM(st.quantity) as toplam_adet,
      SUM(st.quantity * st.unit_price) as brut_ciro,
      SUM(st.discount_amount) as toplam_indirim,
      SUM(st.net_amount) as net_ciro
    FROM sales_transactions st
    JOIN stores s ON st.store_id = s.id
    JOIN regions r ON s.region_id = r.id
    JOIN ownership_types ot ON s.ownership_type_id = ot.id
    GROUP BY CAST(st.transaction_date AS DATE), s.city, r.name, ot.name
  `);
  console.log('  ✅ vw_daily_sales');

  // Mağaza performans
  await pool.request().query(`
    IF OBJECT_ID('vw_store_performance', 'V') IS NOT NULL DROP VIEW vw_store_performance;
  `);
  await pool.request().query(`
    CREATE VIEW vw_store_performance AS
    SELECT 
      s.code as magaza_kodu,
      s.name as magaza_adi,
      r.name as bolge,
      s.city as il,
      ot.name as sahiplik_tipi,
      s.square_meters as metrekare,
      s.employee_count as calisan_sayisi,
      COUNT(DISTINCT CAST(st.transaction_date AS DATE)) as aktif_gun_sayisi,
      COUNT(*) as toplam_islem,
      SUM(st.quantity) as toplam_adet,
      SUM(st.net_amount) as toplam_ciro,
      SUM(st.net_amount) / NULLIF(s.square_meters, 0) as metrekare_basi_ciro,
      SUM(st.net_amount) / NULLIF(s.employee_count, 0) as calisan_basi_ciro
    FROM stores s
    JOIN regions r ON s.region_id = r.id
    JOIN ownership_types ot ON s.ownership_type_id = ot.id
    LEFT JOIN sales_transactions st ON s.id = st.store_id
    GROUP BY s.code, s.name, r.name, s.city, ot.name, s.square_meters, s.employee_count
  `);
  console.log('  ✅ vw_store_performance');

  // Kategori analizi
  await pool.request().query(`
    IF OBJECT_ID('vw_category_analysis', 'V') IS NOT NULL DROP VIEW vw_category_analysis;
  `);
  await pool.request().query(`
    CREATE VIEW vw_category_analysis AS
    SELECT 
      c.name as kategori,
      sc.name as alt_kategori,
      COUNT(DISTINCT p.id) as urun_sayisi,
      COUNT(*) as satis_adedi,
      SUM(st.quantity) as toplam_adet,
      SUM(st.net_amount) as toplam_ciro,
      AVG(st.unit_price) as ortalama_fiyat,
      AVG(st.discount_percent) as ortalama_indirim_yuzdesi
    FROM categories c
    JOIN subcategories sc ON c.id = sc.category_id
    JOIN products p ON sc.id = p.subcategory_id
    JOIN sales_transactions st ON p.id = st.product_id
    GROUP BY c.name, sc.name
  `);
  console.log('  ✅ vw_category_analysis');

  // Bölgesel özet
  await pool.request().query(`
    IF OBJECT_ID('vw_regional_summary', 'V') IS NOT NULL DROP VIEW vw_regional_summary;
  `);
  await pool.request().query(`
    CREATE VIEW vw_regional_summary AS
    SELECT 
      r.code as bolge_kodu,
      r.name as bolge_adi,
      r.manager_name as bolge_muduru,
      COUNT(DISTINCT s.id) as magaza_sayisi,
      SUM(s.square_meters) as toplam_metrekare,
      SUM(s.employee_count) as toplam_calisan,
      COUNT(st.id) as toplam_islem,
      SUM(st.net_amount) as toplam_ciro
    FROM regions r
    LEFT JOIN stores s ON r.id = s.region_id
    LEFT JOIN sales_transactions st ON s.id = st.store_id
    GROUP BY r.code, r.name, r.manager_name
  `);
  console.log('  ✅ vw_regional_summary');

  // En çok satanlar
  await pool.request().query(`
    IF OBJECT_ID('vw_top_products', 'V') IS NOT NULL DROP VIEW vw_top_products;
  `);
  await pool.request().query(`
    CREATE VIEW vw_top_products AS
    SELECT TOP 100
      p.code as urun_kodu,
      p.name as urun_adi,
      p.brand as marka,
      c.name as kategori,
      sc.name as alt_kategori,
      SUM(st.quantity) as toplam_adet,
      SUM(st.net_amount) as toplam_ciro,
      COUNT(DISTINCT st.store_id) as satan_magaza_sayisi
    FROM products p
    JOIN subcategories sc ON p.subcategory_id = sc.id
    JOIN categories c ON sc.category_id = c.id
    JOIN sales_transactions st ON p.id = st.product_id
    GROUP BY p.code, p.name, p.brand, c.name, sc.name
    ORDER BY SUM(st.net_amount) DESC
  `);
  console.log('  ✅ vw_top_products');
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  🏪 TEKSTİL PERAKENDE VERİTABANI OLUŞTURUCU');
  console.log('  H&M / Zara Benzeri Simülasyon - 10M+ Kayıt');
  console.log('═══════════════════════════════════════════════════════════════');
  
  try {
    const pool = await sql.connect(config);
    console.log('\n✅ MSSQL bağlantısı başarılı');
    
    await createTables(pool);
    await insertMasterData(pool);
    await insertStores(pool);
    await insertProducts(pool);
    await insertSalesTransactions(pool);
    await createViews(pool);
    
    // Özet
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('  📊 VERİTABANI ÖZETİ');
    console.log('═══════════════════════════════════════════════════════════════');
    
    const tables = [
      'regions', 'ownership_types', 'stores', 'positions', 'users',
      'categories', 'subcategories', 'products', 'sales_transactions'
    ];
    
    for (const table of tables) {
      const result = await pool.request().query(`SELECT COUNT(*) as cnt FROM ${table}`);
      console.log(`  ${table}: ${result.recordset[0].cnt.toLocaleString()} kayıt`);
    }
    
    console.log('\n  VIEW\'LAR:');
    console.log('  - vw_daily_sales (Günlük satış özeti)');
    console.log('  - vw_store_performance (Mağaza performansı)');
    console.log('  - vw_category_analysis (Kategori analizi)');
    console.log('  - vw_regional_summary (Bölgesel özet)');
    console.log('  - vw_top_products (En çok satanlar)');
    
    await pool.close();
    console.log('\n✅ İşlem tamamlandı!');
    
  } catch (err) {
    console.error('\n❌ Hata:', err.message);
    process.exit(1);
  }
}

main();


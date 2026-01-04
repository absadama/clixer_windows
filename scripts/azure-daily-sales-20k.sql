-- =====================================================
-- CLIXER - Azure SQL Daily Sales Test Tablosu
-- 20.000 Satır - Son 2 Ay Verisi
-- TÜM VERİ RASTGELE OLUŞTURULUR (bağımsız tablo)
-- =====================================================

-- Önce tabloyu sil (varsa)
IF OBJECT_ID('dbo.daily_sales', 'U') IS NOT NULL
    DROP TABLE dbo.daily_sales;
GO

-- =====================================================
-- TABLO OLUŞTUR
-- =====================================================

CREATE TABLE dbo.daily_sales (
    id INT IDENTITY(1,1) PRIMARY KEY,
    transaction_date DATE NOT NULL,
    store_id INT NOT NULL,
    store_name NVARCHAR(100),
    region NVARCHAR(50),
    product_id INT NOT NULL,
    product_name NVARCHAR(100),
    category NVARCHAR(50),
    quantity INT NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    discount_amount DECIMAL(10,2) DEFAULT 0,
    line_total DECIMAL(12,2) NOT NULL,
    payment_type NVARCHAR(20),
    customer_count INT DEFAULT 1,
    created_at DATETIME DEFAULT GETDATE()
);
GO

CREATE INDEX IX_daily_sales_date ON daily_sales(transaction_date);
CREATE INDEX IX_daily_sales_store ON daily_sales(store_id);
GO

-- =====================================================
-- 20.000 SATIR RASTGELE VERİ EKLE
-- =====================================================

SET NOCOUNT ON;

DECLARE @i INT = 1;
DECLARE @target INT = 20000;
DECLARE @today DATE = CAST(GETDATE() AS DATE);
DECLARE @days_back INT = 60;

DECLARE @store_id INT;
DECLARE @store_name NVARCHAR(100);
DECLARE @region NVARCHAR(50);
DECLARE @product_id INT;
DECLARE @product_name NVARCHAR(100);
DECLARE @category NVARCHAR(50);
DECLARE @quantity INT;
DECLARE @unit_price DECIMAL(10,2);
DECLARE @discount DECIMAL(10,2);
DECLARE @line_total DECIMAL(12,2);
DECLARE @payment NVARCHAR(20);
DECLARE @trans_date DATE;
DECLARE @rand INT;

PRINT 'Başlangıç: ' + CONVERT(VARCHAR, GETDATE(), 120);
PRINT 'Hedef: ' + CAST(@target AS VARCHAR) + ' satır';

WHILE @i <= @target
BEGIN
    -- Rastgele transaction_date (bugün - 60 gün arası)
    SET @trans_date = DATEADD(DAY, -(ABS(CHECKSUM(NEWID())) % (@days_back + 1)), @today);
    
    -- Rastgele store (1-10)
    SET @rand = (ABS(CHECKSUM(NEWID())) % 10) + 1;
    SET @store_id = @rand;
    SET @store_name = CASE @rand
        WHEN 1 THEN N'İstanbul Kadıköy'
        WHEN 2 THEN N'İstanbul Beşiktaş'
        WHEN 3 THEN N'İstanbul Bakırköy'
        WHEN 4 THEN N'Ankara Çankaya'
        WHEN 5 THEN N'Ankara Kızılay'
        WHEN 6 THEN N'İzmir Alsancak'
        WHEN 7 THEN N'İzmir Karşıyaka'
        WHEN 8 THEN N'Antalya Merkez'
        WHEN 9 THEN N'Bursa Nilüfer'
        ELSE N'Adana Seyhan'
    END;
    SET @region = CASE @rand
        WHEN 1 THEN N'Marmara'
        WHEN 2 THEN N'Marmara'
        WHEN 3 THEN N'Marmara'
        WHEN 4 THEN N'İç Anadolu'
        WHEN 5 THEN N'İç Anadolu'
        WHEN 6 THEN N'Ege'
        WHEN 7 THEN N'Ege'
        WHEN 8 THEN N'Akdeniz'
        WHEN 9 THEN N'Marmara'
        ELSE N'Akdeniz'
    END;
    
    -- Rastgele product (1-15)
    SET @rand = (ABS(CHECKSUM(NEWID())) % 15) + 1;
    SET @product_id = @rand;
    SET @product_name = CASE @rand
        WHEN 1 THEN N'Türk Kahvesi'
        WHEN 2 THEN N'Latte'
        WHEN 3 THEN N'Cappuccino'
        WHEN 4 THEN N'Americano'
        WHEN 5 THEN N'Espresso'
        WHEN 6 THEN N'Cheesecake'
        WHEN 7 THEN N'Brownie'
        WHEN 8 THEN N'Tiramisu'
        WHEN 9 THEN N'Sandviç'
        WHEN 10 THEN N'Tost'
        WHEN 11 THEN N'Salata'
        WHEN 12 THEN N'Makarna'
        WHEN 13 THEN N'Çay'
        WHEN 14 THEN N'Limonata'
        ELSE N'Smoothie'
    END;
    SET @category = CASE @rand
        WHEN 1 THEN N'İçecek'
        WHEN 2 THEN N'İçecek'
        WHEN 3 THEN N'İçecek'
        WHEN 4 THEN N'İçecek'
        WHEN 5 THEN N'İçecek'
        WHEN 6 THEN N'Tatlı'
        WHEN 7 THEN N'Tatlı'
        WHEN 8 THEN N'Tatlı'
        WHEN 9 THEN N'Yiyecek'
        WHEN 10 THEN N'Yiyecek'
        WHEN 11 THEN N'Yiyecek'
        WHEN 12 THEN N'Yiyecek'
        WHEN 13 THEN N'İçecek'
        WHEN 14 THEN N'İçecek'
        ELSE N'İçecek'
    END;
    SET @unit_price = CASE @rand
        WHEN 1 THEN 35.00
        WHEN 2 THEN 55.00
        WHEN 3 THEN 50.00
        WHEN 4 THEN 45.00
        WHEN 5 THEN 30.00
        WHEN 6 THEN 85.00
        WHEN 7 THEN 65.00
        WHEN 8 THEN 90.00
        WHEN 9 THEN 95.00
        WHEN 10 THEN 75.00
        WHEN 11 THEN 85.00
        WHEN 12 THEN 110.00
        WHEN 13 THEN 15.00
        WHEN 14 THEN 40.00
        ELSE 70.00
    END;
    
    -- Rastgele quantity (1-5)
    SET @quantity = (ABS(CHECKSUM(NEWID())) % 5) + 1;
    
    -- Rastgele discount (0-20)
    SET @discount = CAST((ABS(CHECKSUM(NEWID())) % 21) AS DECIMAL(10,2));
    
    -- line_total hesapla
    SET @line_total = (@quantity * @unit_price) - @discount;
    IF @line_total < 0 SET @line_total = @quantity * @unit_price;
    
    -- Rastgele payment type
    SET @payment = CASE (ABS(CHECKSUM(NEWID())) % 4)
        WHEN 0 THEN N'Nakit'
        WHEN 1 THEN N'Kredi Kartı'
        WHEN 2 THEN N'Yemek Kartı'
        ELSE N'Mobil Ödeme'
    END;
    
    -- INSERT
    INSERT INTO daily_sales (
        transaction_date, store_id, store_name, region,
        product_id, product_name, category,
        quantity, unit_price, discount_amount, line_total,
        payment_type, customer_count, created_at
    ) VALUES (
        @trans_date, @store_id, @store_name, @region,
        @product_id, @product_name, @category,
        @quantity, @unit_price, @discount, @line_total,
        @payment, (ABS(CHECKSUM(NEWID())) % 4) + 1,
        DATEADD(HOUR, ABS(CHECKSUM(NEWID())) % 14 + 8, CAST(@trans_date AS DATETIME))
    );
    
    -- Her 5000'de bir bilgi ver
    IF @i % 5000 = 0
        PRINT 'Eklendi: ' + CAST(@i AS VARCHAR) + ' / ' + CAST(@target AS VARCHAR);
    
    SET @i = @i + 1;
END

PRINT '';
PRINT 'TAMAMLANDI!';
PRINT 'Bitiş: ' + CONVERT(VARCHAR, GETDATE(), 120);
GO

-- =====================================================
-- KONTROL
-- =====================================================

SELECT 'ÖZET' as Rapor,
    COUNT(*) as ToplamSatir,
    MIN(transaction_date) as MinTarih,
    MAX(transaction_date) as MaxTarih,
    COUNT(DISTINCT transaction_date) as FarkliGun,
    FORMAT(SUM(line_total), 'N2') as ToplamCiro
FROM daily_sales;

SELECT 'SON 7 GÜN' as Rapor, transaction_date, COUNT(*) as Satir, FORMAT(SUM(line_total), 'N2') as Ciro
FROM daily_sales
WHERE transaction_date >= DATEADD(DAY, -7, CAST(GETDATE() AS DATE))
GROUP BY transaction_date
ORDER BY transaction_date DESC;

SELECT 'BÖLGE' as Rapor, region, COUNT(*) as Satir, FORMAT(SUM(line_total), 'N2') as Ciro
FROM daily_sales
GROUP BY region
ORDER BY SUM(line_total) DESC;
GO

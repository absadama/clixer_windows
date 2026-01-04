-- =====================================================
-- CLIXER - Azure SQL Bulk Data Generator
-- 50 Milyon Transaction Item Kaydı
-- =====================================================
-- UYARI: Bu script uzun sürer (~30-60 dakika)
-- Batch'ler halinde çalıştırın
-- =====================================================

-- Önce mevcut verileri kontrol et
SELECT 'Mevcut Kayıtlar:' as Info;
SELECT 'transactions' as Tablo, COUNT(*) as Kayit FROM transactions;
SELECT 'transaction_items' as Tablo, COUNT(*) as Kayit FROM transaction_items;

-- =====================================================
-- ADIM 1: Daha fazla transaction oluştur (500K transaction)
-- Her transaction ortalama 3-5 item içerecek = 1.5-2.5M item
-- =====================================================

-- Transaction sayısını artır (mevcut ~2000'den 500.000'e)
DECLARE @batch_size INT = 10000;
DECLARE @total_transactions INT = 500000;
DECLARE @current_count INT;
DECLARE @store_count INT;
DECLARE @i INT = 1;

SELECT @current_count = COUNT(*) FROM transactions;
SELECT @store_count = COUNT(*) FROM stores;

PRINT 'Mevcut transaction sayısı: ' + CAST(@current_count AS VARCHAR);
PRINT 'Hedef transaction sayısı: ' + CAST(@total_transactions AS VARCHAR);
PRINT 'Başlangıç: ' + CONVERT(VARCHAR, GETDATE(), 120);

-- Transaction'ları batch halinde ekle
WHILE @current_count < @total_transactions
BEGIN
    INSERT INTO transactions (store_id, transaction_date, total_amount, payment_method, customer_count, notes)
    SELECT TOP (@batch_size)
        -- Rastgele store (1-10)
        (ABS(CHECKSUM(NEWID())) % @store_count) + 1,
        -- Son 2 yıl içinde rastgele tarih
        DATEADD(DAY, -ABS(CHECKSUM(NEWID())) % 730, GETDATE()),
        -- Tutar sonra hesaplanacak
        0,
        -- Rastgele ödeme yöntemi
        CASE ABS(CHECKSUM(NEWID())) % 4
            WHEN 0 THEN 'Nakit'
            WHEN 1 THEN 'Kredi Kartı'
            WHEN 2 THEN 'Yemek Kartı'
            ELSE 'Mobil Ödeme'
        END,
        -- Müşteri sayısı 1-6
        (ABS(CHECKSUM(NEWID())) % 6) + 1,
        NULL
    FROM sys.all_objects a
    CROSS JOIN sys.all_objects b;
    
    SELECT @current_count = COUNT(*) FROM transactions;
    
    IF @i % 10 = 0
        PRINT 'Transaction eklendi: ' + CAST(@current_count AS VARCHAR) + ' / ' + CAST(@total_transactions AS VARCHAR);
    
    SET @i = @i + 1;
END

PRINT 'Transaction ekleme tamamlandı: ' + CONVERT(VARCHAR, GETDATE(), 120);
GO

-- =====================================================
-- ADIM 2: Transaction Items oluştur (50 Milyon)
-- Her transaction için 3-5 item
-- =====================================================

DECLARE @batch_size INT = 100000;  -- Her seferde 100K satır
DECLARE @target_items INT = 50000000;  -- 50 milyon hedef
DECLARE @current_items INT;
DECLARE @transaction_count INT;
DECLARE @product_count INT;
DECLARE @batch_num INT = 1;

SELECT @current_items = COUNT(*) FROM transaction_items;
SELECT @transaction_count = COUNT(*) FROM transactions;
SELECT @product_count = COUNT(*) FROM products;

PRINT '========================================';
PRINT 'Transaction Items Ekleme Başlıyor';
PRINT 'Mevcut item sayısı: ' + CAST(@current_items AS VARCHAR);
PRINT 'Hedef: ' + CAST(@target_items AS VARCHAR);
PRINT 'Transaction sayısı: ' + CAST(@transaction_count AS VARCHAR);
PRINT 'Product sayısı: ' + CAST(@product_count AS VARCHAR);
PRINT 'Başlangıç: ' + CONVERT(VARCHAR, GETDATE(), 120);
PRINT '========================================';

WHILE @current_items < @target_items
BEGIN
    -- Her batch'te 100K satır ekle
    INSERT INTO transaction_items (transaction_id, product_id, quantity, unit_price, discount_percent, line_total, notes)
    SELECT TOP (@batch_size)
        -- Rastgele transaction (1 - transaction_count)
        (ABS(CHECKSUM(NEWID())) % @transaction_count) + 1,
        -- Rastgele product (1-60 arası)
        (ABS(CHECKSUM(NEWID())) % @product_count) + 1,
        -- Miktar 1-5
        (ABS(CHECKSUM(NEWID())) % 5) + 1,
        -- Fiyat 10-500 TL arası
        CAST((ABS(CHECKSUM(NEWID())) % 490 + 10) AS DECIMAL(10,2)),
        -- İndirim 0-20%
        CAST((ABS(CHECKSUM(NEWID())) % 21) AS DECIMAL(5,2)),
        -- line_total sonra hesaplanacak (trigger ile veya update ile)
        0,
        NULL
    FROM sys.all_objects a
    CROSS JOIN sys.all_objects b;
    
    SELECT @current_items = COUNT(*) FROM transaction_items;
    
    -- Her 10 batch'te bir bilgi ver
    IF @batch_num % 10 = 0
    BEGIN
        PRINT 'Batch ' + CAST(@batch_num AS VARCHAR) + ' - Items: ' + 
              CAST(@current_items AS VARCHAR) + ' / ' + CAST(@target_items AS VARCHAR) +
              ' (' + CAST(CAST(@current_items * 100.0 / @target_items AS DECIMAL(5,2)) AS VARCHAR) + '%) - ' +
              CONVERT(VARCHAR, GETDATE(), 120);
    END
    
    SET @batch_num = @batch_num + 1;
    
    -- Her 50 batch'te bir CHECKPOINT (log dosyası şişmesin)
    IF @batch_num % 50 = 0
        CHECKPOINT;
END

PRINT '========================================';
PRINT 'Transaction Items Ekleme Tamamlandı!';
PRINT 'Toplam item: ' + CAST(@current_items AS VARCHAR);
PRINT 'Bitiş: ' + CONVERT(VARCHAR, GETDATE(), 120);
PRINT '========================================';
GO

-- =====================================================
-- ADIM 3: line_total değerlerini hesapla
-- =====================================================

PRINT 'Line total hesaplanıyor...';

UPDATE transaction_items
SET line_total = quantity * unit_price * (1 - discount_percent / 100);

PRINT 'Line total hesaplandı.';
GO

-- =====================================================
-- ADIM 4: Transaction total_amount güncelle
-- =====================================================

PRINT 'Transaction totals hesaplanıyor...';

UPDATE t
SET total_amount = ISNULL(ti.total, 0)
FROM transactions t
LEFT JOIN (
    SELECT transaction_id, SUM(line_total) as total
    FROM transaction_items
    GROUP BY transaction_id
) ti ON t.id = ti.transaction_id;

PRINT 'Transaction totals hesaplandı.';
GO

-- =====================================================
-- SONUÇ
-- =====================================================

SELECT 'SONUÇ - Toplam Kayıtlar:' as Info;
SELECT 'transactions' as Tablo, COUNT(*) as Kayit, 
       SUM(total_amount) as ToplamTutar
FROM transactions;

SELECT 'transaction_items' as Tablo, COUNT(*) as Kayit,
       SUM(line_total) as ToplamTutar,
       AVG(line_total) as OrtTutar
FROM transaction_items;

-- Boyut kontrolü
EXEC sp_spaceused 'transactions';
EXEC sp_spaceused 'transaction_items';
GO





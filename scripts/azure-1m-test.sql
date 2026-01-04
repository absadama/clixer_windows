-- =====================================================
-- CLIXER - Azure SQL 1 Milyon Satır Test
-- Hızlı test için (~5-10 dakika)
-- =====================================================

-- Mevcut durum
SELECT 'BAŞLANGIÇ:' as Info, GETDATE() as Zaman;
SELECT 'transactions' as Tablo, COUNT(*) as Kayit FROM transactions;
SELECT 'transaction_items' as Tablo, COUNT(*) as Kayit FROM transaction_items;
GO

-- =====================================================
-- 1 Milyon Transaction Item Ekle (10 batch x 100K)
-- =====================================================

DECLARE @batch INT = 1;
DECLARE @target INT = 1000000;
DECLARE @batch_size INT = 100000;
DECLARE @current INT = 0;
DECLARE @transaction_max INT;
DECLARE @product_max INT;

SELECT @transaction_max = MAX(id) FROM transactions;
SELECT @product_max = MAX(id) FROM products;

PRINT 'Max Transaction ID: ' + CAST(@transaction_max AS VARCHAR);
PRINT 'Max Product ID: ' + CAST(@product_max AS VARCHAR);

WHILE @current < @target
BEGIN
    PRINT 'Batch ' + CAST(@batch AS VARCHAR) + ' başlıyor... ' + CONVERT(VARCHAR, GETDATE(), 120);
    
    INSERT INTO transaction_items (transaction_id, product_id, quantity, unit_price, discount_percent, line_total)
    SELECT TOP (@batch_size)
        -- Transaction ID: 1 ile max arasında
        (ABS(CHECKSUM(NEWID())) % @transaction_max) + 1,
        -- Product ID: 1 ile max arasında  
        (ABS(CHECKSUM(NEWID())) % @product_max) + 1,
        -- Quantity: 1-5
        (ABS(CHECKSUM(NEWID())) % 5) + 1,
        -- Price: 15-350 TL
        CAST((ABS(CHECKSUM(NEWID())) % 335 + 15) AS DECIMAL(10,2)),
        -- Discount: 0-15%
        CAST((ABS(CHECKSUM(NEWID())) % 16) AS DECIMAL(5,2)),
        -- Line total (hesaplanacak)
        0
    FROM sys.all_objects a
    CROSS JOIN sys.all_objects b;
    
    SET @current = @current + @batch_size;
    SET @batch = @batch + 1;
    
    PRINT 'Eklendi: ' + CAST(@current AS VARCHAR) + ' / ' + CAST(@target AS VARCHAR);
END
GO

-- Line total hesapla (sadece 0 olanlar için)
PRINT 'Line total hesaplanıyor...';
UPDATE transaction_items
SET line_total = quantity * unit_price * (1 - discount_percent / 100)
WHERE line_total = 0;
PRINT 'Tamamlandı!';
GO

-- Transaction totals güncelle
PRINT 'Transaction totals güncelleniyor...';
UPDATE t
SET total_amount = ISNULL(ti.total, 0)
FROM transactions t
INNER JOIN (
    SELECT transaction_id, SUM(line_total) as total
    FROM transaction_items
    GROUP BY transaction_id
) ti ON t.id = ti.transaction_id
WHERE t.total_amount = 0 OR t.total_amount IS NULL;
PRINT 'Tamamlandı!';
GO

-- Sonuç
SELECT 'BİTİŞ:' as Info, GETDATE() as Zaman;
SELECT 'transactions' as Tablo, COUNT(*) as Kayit, SUM(total_amount) as Toplam FROM transactions;
SELECT 'transaction_items' as Tablo, COUNT(*) as Kayit, SUM(line_total) as Toplam FROM transaction_items;

-- Boyut
EXEC sp_spaceused 'transaction_items';
GO





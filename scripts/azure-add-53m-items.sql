-- =====================================================
-- CLIXER - Azure SQL 53 Milyon Ek Transaction Item
-- Mevcut: ~47M → Hedef: 100M
-- =====================================================
-- UYARI: Bu script uzun sürer (~60-90 dakika)
-- Azure SQL'de çalıştırın (SSMS veya Azure Data Studio)
-- =====================================================

-- Mevcut durumu kontrol et
SELECT 'BAŞLANGIÇ DURUMU:' as Info;
SELECT 'transactions' as Tablo, COUNT(*) as Kayit FROM transactions;
SELECT 'transaction_items' as Tablo, COUNT(*) as Kayit FROM transaction_items;
GO

-- =====================================================
-- 53 MİLYON TRANSACTION ITEM EKLE
-- Batch Size: 100.000 (Azure SQL için optimal)
-- =====================================================

SET NOCOUNT ON;

DECLARE @batch_size INT = 100000;  -- Her seferde 100K satır
DECLARE @target_items BIGINT = 100000000;  -- 100 milyon hedef
DECLARE @current_items BIGINT;
DECLARE @transaction_count INT;
DECLARE @product_count INT;
DECLARE @batch_num INT = 1;
DECLARE @start_time DATETIME = GETDATE();

SELECT @current_items = COUNT_BIG(*) FROM transaction_items;
SELECT @transaction_count = COUNT(*) FROM transactions;
SELECT @product_count = ISNULL((SELECT COUNT(*) FROM products), 60);

-- Eğer products tablosu yoksa varsayılan 60 ürün kullan
IF @product_count = 0 SET @product_count = 60;
IF @transaction_count = 0 SET @transaction_count = 100000;

PRINT '========================================';
PRINT 'CLIXER - 53M Transaction Items Ekleme';
PRINT '========================================';
PRINT 'Mevcut item sayisi: ' + CAST(@current_items AS VARCHAR(20));
PRINT 'Hedef: ' + CAST(@target_items AS VARCHAR(20));
PRINT 'Eklenecek: ' + CAST(@target_items - @current_items AS VARCHAR(20));
PRINT 'Transaction sayisi: ' + CAST(@transaction_count AS VARCHAR(20));
PRINT 'Product sayisi: ' + CAST(@product_count AS VARCHAR(20));
PRINT 'Batch size: ' + CAST(@batch_size AS VARCHAR(20));
PRINT 'Baslangic: ' + CONVERT(VARCHAR, @start_time, 120);
PRINT '========================================';

-- Ana döngü
WHILE @current_items < @target_items
BEGIN
    BEGIN TRY
        -- Her batch'te 100K satır ekle
        INSERT INTO transaction_items (transaction_id, product_id, quantity, unit_price, discount_percent, line_total, notes, created_at)
        SELECT TOP (@batch_size)
            -- Rastgele transaction_id (1 - transaction_count)
            (ABS(CHECKSUM(NEWID())) % @transaction_count) + 1,
            -- Rastgele product_id (1-product_count)
            (ABS(CHECKSUM(NEWID())) % @product_count) + 1,
            -- Miktar 1-10
            (ABS(CHECKSUM(NEWID())) % 10) + 1,
            -- Fiyat 15-750 TL arası (daha gerçekçi fiyat aralığı)
            CAST((ABS(CHECKSUM(NEWID())) % 735 + 15) AS DECIMAL(10,2)),
            -- İndirim 0-25%
            CAST((ABS(CHECKSUM(NEWID())) % 26) AS DECIMAL(5,2)),
            -- line_total = quantity * unit_price * (1 - discount/100)
            -- Şimdilik 0, sonra UPDATE ile hesaplanacak
            0,
            -- Notes NULL
            NULL,
            -- created_at: Son 2 yıl içinde rastgele tarih (2024-2026)
            DATEADD(SECOND, -ABS(CHECKSUM(NEWID())) % 63072000, GETDATE())
        FROM sys.all_objects a
        CROSS JOIN sys.all_objects b;
        
        SET @current_items = @current_items + @batch_size;
        
        -- Her 10 batch'te bir (1M satır) bilgi ver
        IF @batch_num % 10 = 0
        BEGIN
            DECLARE @elapsed INT = DATEDIFF(SECOND, @start_time, GETDATE());
            DECLARE @rate DECIMAL(10,2) = CASE WHEN @elapsed > 0 THEN (@current_items - 47000000) / CAST(@elapsed AS DECIMAL) ELSE 0 END;
            DECLARE @remaining BIGINT = @target_items - @current_items;
            DECLARE @eta_seconds INT = CASE WHEN @rate > 0 THEN @remaining / @rate ELSE 0 END;
            
            PRINT 'Batch ' + CAST(@batch_num AS VARCHAR) + 
                  ' | Items: ' + CAST(@current_items / 1000000 AS VARCHAR) + 'M / 100M' +
                  ' (' + CAST(CAST(@current_items * 100.0 / @target_items AS DECIMAL(5,1)) AS VARCHAR) + '%)' +
                  ' | Hiz: ' + CAST(CAST(@rate AS INT) AS VARCHAR) + ' row/sec' +
                  ' | ETA: ' + CAST(@eta_seconds / 60 AS VARCHAR) + ' dk' +
                  ' | ' + CONVERT(VARCHAR, GETDATE(), 108);
        END
        
        SET @batch_num = @batch_num + 1;
        
        -- Her 100 batch'te bir CHECKPOINT (log dosyası şişmesin)
        IF @batch_num % 100 = 0
            CHECKPOINT;
            
    END TRY
    BEGIN CATCH
        PRINT 'HATA Batch ' + CAST(@batch_num AS VARCHAR) + ': ' + ERROR_MESSAGE();
        -- Hata olursa 5 saniye bekle ve devam et
        WAITFOR DELAY '00:00:05';
    END CATCH
END

PRINT '========================================';
PRINT 'TAMAMLANDI!';
PRINT 'Toplam item: ' + CAST(@current_items AS VARCHAR(20));
PRINT 'Sure: ' + CAST(DATEDIFF(MINUTE, @start_time, GETDATE()) AS VARCHAR) + ' dakika';
PRINT 'Bitis: ' + CONVERT(VARCHAR, GETDATE(), 120);
PRINT '========================================';
GO

-- =====================================================
-- LINE_TOTAL HESAPLA (çok satır olduğu için batch'ler halinde)
-- =====================================================

PRINT 'Line total hesaplaniyor (batch halinde)...';

DECLARE @batch INT = 1000000;
DECLARE @offset BIGINT = 0;
DECLARE @total_updated BIGINT = 0;

WHILE EXISTS (SELECT 1 FROM transaction_items WHERE line_total = 0 AND id > @offset)
BEGIN
    UPDATE TOP (@batch) transaction_items
    SET line_total = quantity * unit_price * (1 - discount_percent / 100)
    WHERE line_total = 0 AND id > @offset;
    
    SET @total_updated = @total_updated + @@ROWCOUNT;
    SET @offset = @offset + @batch;
    
    IF @total_updated % 10000000 = 0
        PRINT 'Line total guncellendi: ' + CAST(@total_updated / 1000000 AS VARCHAR) + 'M';
END

PRINT 'Line total hesaplama tamamlandi: ' + CAST(@total_updated AS VARCHAR) + ' satir';
GO

-- =====================================================
-- SONUÇ
-- =====================================================

SELECT '========== SONUC ==========' as Info;
SELECT 'transaction_items' as Tablo, 
       COUNT_BIG(*) as ToplamKayit,
       FORMAT(SUM(line_total), 'N2') as ToplamTutar,
       FORMAT(AVG(line_total), 'N2') as OrtTutar,
       MIN(created_at) as EnEskiTarih,
       MAX(created_at) as EnYeniTarih
FROM transaction_items;

-- Yıllara göre dağılım
SELECT YEAR(created_at) as Yil, 
       COUNT(*) as Kayit,
       FORMAT(SUM(line_total), 'N0') as Tutar
FROM transaction_items
GROUP BY YEAR(created_at)
ORDER BY Yil;

-- Boyut
EXEC sp_spaceused 'transaction_items';
GO


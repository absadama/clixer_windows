-- =====================================================
-- CLIXER - Bugün ve Yarın Test Verisi
-- Her gün için 100.000 kayıt
-- Azure SQL'de çalıştırılacak
-- =====================================================

-- FK kontrollerini geçici olarak kapat
ALTER TABLE transaction_items NOCHECK CONSTRAINT ALL;
GO

-- created_at kolonu yoksa ekle
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('transaction_items') AND name = 'created_at')
BEGIN
    ALTER TABLE transaction_items ADD created_at DATETIME DEFAULT GETDATE();
    PRINT 'created_at kolonu eklendi';
END
GO

DECLARE @MaxId INT;
SELECT @MaxId = ISNULL(MAX(id), 0) FROM transaction_items;
PRINT 'Mevcut Max ID: ' + CAST(@MaxId AS VARCHAR);

-- Mevcut transaction ve product ID'lerini al
DECLARE @MaxTransId INT, @MaxProdId INT;
SELECT @MaxTransId = MAX(id) FROM transactions;
SELECT @MaxProdId = MAX(id) FROM products;
PRINT 'Max Transaction ID: ' + CAST(@MaxTransId AS VARCHAR);
PRINT 'Max Product ID: ' + CAST(@MaxProdId AS VARCHAR);

-- BUGÜN - 100.000 kayıt
PRINT '';
PRINT '=== BUGÜN: ' + CONVERT(VARCHAR, CAST(GETDATE() AS DATE), 23) + ' ===';

DECLARE @BatchSize INT = 10000;
DECLARE @Inserted INT = 0;

SET IDENTITY_INSERT transaction_items ON;

WHILE @Inserted < 100000
BEGIN
    INSERT INTO transaction_items (id, transaction_id, product_id, quantity, unit_price, line_total, created_at)
    SELECT 
        @MaxId + @Inserted + ROW_NUMBER() OVER (ORDER BY (SELECT NULL)),
        (ABS(CHECKSUM(NEWID())) % @MaxTransId) + 1,  -- Mevcut transaction ID'lerinden
        (ABS(CHECKSUM(NEWID())) % @MaxProdId) + 1,   -- Mevcut product ID'lerinden
        ABS(CHECKSUM(NEWID())) % 5 + 1,
        CAST(ABS(CHECKSUM(NEWID())) % 500 + 10 AS DECIMAL(10,2)),
        CAST((ABS(CHECKSUM(NEWID())) % 5 + 1) * (ABS(CHECKSUM(NEWID())) % 500 + 10) AS DECIMAL(10,2)),
        DATEADD(SECOND, ABS(CHECKSUM(NEWID())) % 86400, CAST(CAST(GETDATE() AS DATE) AS DATETIME))
    FROM (SELECT TOP (@BatchSize) 1 as x FROM sys.objects a CROSS JOIN sys.objects b) as nums;
    
    SET @Inserted = @Inserted + @BatchSize;
    IF @Inserted % 50000 = 0 PRINT '  ' + CAST(@Inserted AS VARCHAR) + ' / 100000';
END
PRINT 'Bugün için 100.000 kayıt eklendi';

-- YARIN - 100.000 kayıt
PRINT '';
PRINT '=== YARIN: ' + CONVERT(VARCHAR, DATEADD(DAY, 1, CAST(GETDATE() AS DATE)), 23) + ' ===';

SET @Inserted = 0;

WHILE @Inserted < 100000
BEGIN
    INSERT INTO transaction_items (id, transaction_id, product_id, quantity, unit_price, line_total, created_at)
    SELECT 
        @MaxId + 100000 + @Inserted + ROW_NUMBER() OVER (ORDER BY (SELECT NULL)),
        (ABS(CHECKSUM(NEWID())) % @MaxTransId) + 1,
        (ABS(CHECKSUM(NEWID())) % @MaxProdId) + 1,
        ABS(CHECKSUM(NEWID())) % 5 + 1,
        CAST(ABS(CHECKSUM(NEWID())) % 500 + 10 AS DECIMAL(10,2)),
        CAST((ABS(CHECKSUM(NEWID())) % 5 + 1) * (ABS(CHECKSUM(NEWID())) % 500 + 10) AS DECIMAL(10,2)),
        DATEADD(SECOND, ABS(CHECKSUM(NEWID())) % 86400, CAST(DATEADD(DAY, 1, CAST(GETDATE() AS DATE)) AS DATETIME))
    FROM (SELECT TOP (@BatchSize) 1 as x FROM sys.objects a CROSS JOIN sys.objects b) as nums;
    
    SET @Inserted = @Inserted + @BatchSize;
    IF @Inserted % 50000 = 0 PRINT '  ' + CAST(@Inserted AS VARCHAR) + ' / 100000';
END

SET IDENTITY_INSERT transaction_items OFF;
PRINT 'Yarın için 100.000 kayıt eklendi';

-- FK kontrollerini tekrar aç
ALTER TABLE transaction_items CHECK CONSTRAINT ALL;

-- ÖZET
PRINT '';
PRINT '========================================';
PRINT 'TOPLAM EKLENEN: 200.000 kayıt';
PRINT '========================================';

-- Doğrulama
SELECT 
    CAST(created_at AS DATE) as tarih,
    COUNT(*) as kayit_sayisi
FROM transaction_items
WHERE created_at >= CAST(GETDATE() AS DATE)
GROUP BY CAST(created_at AS DATE)
ORDER BY tarih;

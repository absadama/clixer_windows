-- ============================================
-- CLIXER - Audit Logging Tablosu
-- Kim, ne zaman, ne yaptı kaydı
-- Enterprise güvenlik gereksinimi
-- ============================================

-- Audit log tablosu
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Kim?
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    user_email VARCHAR(255),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Ne?
    action VARCHAR(50) NOT NULL,  -- CREATE, READ, UPDATE, DELETE, LOGIN, LOGOUT, EXPORT, etc.
    resource_type VARCHAR(100) NOT NULL,  -- user, design, dataset, metric, connection, etc.
    resource_id VARCHAR(255),  -- İlgili kaynağın ID'si
    resource_name VARCHAR(255),  -- İlgili kaynağın adı (opsiyonel)
    
    -- Detaylar
    details JSONB,  -- Ek bilgiler (önceki değer, yeni değer, parametreler vs.)
    
    -- Nereden?
    ip_address INET,
    user_agent TEXT,
    
    -- Ne zaman?
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Sonuç
    success BOOLEAN DEFAULT true,
    error_message TEXT
);

-- Index'ler (hızlı sorgulama için)
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at_action ON audit_logs(created_at DESC, action);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_action_date 
ON audit_logs(tenant_id, action, created_at DESC);

-- Action türleri için ENUM (opsiyonel, ama dokümantasyon amaçlı)
COMMENT ON TABLE audit_logs IS 'Kullanıcı aktivite ve sistem olayları kaydı';
COMMENT ON COLUMN audit_logs.action IS 'CREATE, READ, UPDATE, DELETE, LOGIN, LOGOUT, EXPORT, IMPORT, SYNC, ERROR';
COMMENT ON COLUMN audit_logs.resource_type IS 'user, design, dataset, metric, connection, etl_job, system_setting';

-- ============================================
-- Örnek Audit Log Sorguları
-- ============================================

-- Son 24 saatteki login denemeleri
-- SELECT * FROM audit_logs 
-- WHERE action = 'LOGIN' 
-- AND created_at > NOW() - INTERVAL '24 hours'
-- ORDER BY created_at DESC;

-- Belirli kullanıcının aktiviteleri
-- SELECT * FROM audit_logs 
-- WHERE user_id = 'xxx' 
-- ORDER BY created_at DESC 
-- LIMIT 100;

-- Başarısız işlemler
-- SELECT * FROM audit_logs 
-- WHERE success = false 
-- ORDER BY created_at DESC;

-- Silme işlemleri (güvenlik denetimi)
-- SELECT * FROM audit_logs 
-- WHERE action = 'DELETE' 
-- ORDER BY created_at DESC;

-- ============================================
-- Temizlik Politikası (90 gün)
-- ============================================

-- Bu fonksiyon eski logları temizler
-- Cron job ile çalıştırılmalı
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs(days_to_keep INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM audit_logs 
    WHERE created_at < NOW() - (days_to_keep || ' days')::INTERVAL;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_old_audit_logs IS 'Eski audit loglarını temizler. Varsayılan 90 gün.';

-- ============================================
-- İstatistik View
-- ============================================

CREATE OR REPLACE VIEW audit_stats AS
SELECT 
    date_trunc('day', created_at) as date,
    action,
    resource_type,
    count(*) as count,
    count(*) FILTER (WHERE success = true) as success_count,
    count(*) FILTER (WHERE success = false) as failed_count
FROM audit_logs
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY date_trunc('day', created_at), action, resource_type
ORDER BY date DESC, count DESC;

COMMENT ON VIEW audit_stats IS 'Son 30 günlük audit istatistikleri';

-- Başarılı oluşturma mesajı
DO $$
BEGIN
    RAISE NOTICE 'Audit logging tablosu ve indexler oluşturuldu.';
END $$;




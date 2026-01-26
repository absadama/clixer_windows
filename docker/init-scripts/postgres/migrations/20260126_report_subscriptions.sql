-- Migration: Report Subscriptions & Email Settings
-- Date: 26 Ocak 2026
-- Description: Power BI benzeri rapor abonelik sistemi

-- =====================================================
-- EMAIL SETTINGS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS email_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- SMTP Configuration
    smtp_host VARCHAR(255),
    smtp_port INTEGER DEFAULT 587,
    smtp_secure BOOLEAN DEFAULT false,
    smtp_user VARCHAR(255),
    smtp_password_encrypted TEXT,  -- AES encrypted with ENCRYPTION_KEY
    
    -- Sender Info
    from_email VARCHAR(255),
    from_name VARCHAR(255) DEFAULT 'Clixer Analytics',
    
    -- Status
    is_configured BOOLEAN DEFAULT false,
    last_test_at TIMESTAMP,
    last_test_result TEXT,
    
    -- Audit
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    
    -- Constraints
    CONSTRAINT unique_tenant_email_settings UNIQUE (tenant_id)
);

-- Index for tenant lookup
CREATE INDEX IF NOT EXISTS idx_email_settings_tenant ON email_settings(tenant_id);

-- =====================================================
-- REPORT SUBSCRIPTIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS report_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Subscription Info
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Report Reference
    design_id UUID REFERENCES designs(id) ON DELETE SET NULL,
    design_type VARCHAR(50) DEFAULT 'cockpit',  -- 'cockpit' | 'analysis'
    
    -- Recipients (LDAP/Local users)
    recipient_user_ids UUID[] NOT NULL DEFAULT '{}',
    recipient_emails TEXT[] DEFAULT '{}',  -- For external emails if needed
    
    -- Schedule (Cron format)
    schedule_cron VARCHAR(100) NOT NULL,  -- e.g., '0 8 * * 1' (Monday 08:00)
    schedule_timezone VARCHAR(50) DEFAULT 'Europe/Istanbul',
    schedule_description VARCHAR(255),  -- Human readable: 'Her Pazartesi 08:00'
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    -- Execution History
    last_sent_at TIMESTAMP,
    last_error TEXT,
    send_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    
    -- Audit
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    
    -- Constraints
    CONSTRAINT valid_schedule_cron CHECK (
        schedule_cron ~ '^(\*|[0-5]?\d)\s+(\*|[01]?\d|2[0-3])\s+(\*|[1-9]|[12]\d|3[01])\s+(\*|[1-9]|1[0-2])\s+(\*|[0-6])$'
    ),
    CONSTRAINT valid_design_type CHECK (design_type IN ('cockpit', 'analysis')),
    CONSTRAINT has_recipients CHECK (
        array_length(recipient_user_ids, 1) > 0 OR array_length(recipient_emails, 1) > 0
    )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_report_subscriptions_tenant ON report_subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_report_subscriptions_design ON report_subscriptions(design_id);
CREATE INDEX IF NOT EXISTS idx_report_subscriptions_active ON report_subscriptions(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_report_subscriptions_created_by ON report_subscriptions(created_by);

-- =====================================================
-- SUBSCRIPTION LOGS TABLE (Audit)
-- =====================================================
CREATE TABLE IF NOT EXISTS subscription_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL REFERENCES report_subscriptions(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Execution Info
    action VARCHAR(50) NOT NULL,  -- 'SENT', 'FAILED', 'SKIPPED', 'CREATED', 'UPDATED', 'DELETED'
    status VARCHAR(50) NOT NULL,  -- 'SUCCESS', 'ERROR', 'WARNING'
    
    -- Details
    recipient_count INTEGER,
    error_message TEXT,
    execution_time_ms INTEGER,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    -- Audit
    created_at TIMESTAMP DEFAULT NOW(),
    created_by UUID REFERENCES users(id)
);

-- Index for subscription lookup
CREATE INDEX IF NOT EXISTS idx_subscription_logs_subscription ON subscription_logs(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_logs_created_at ON subscription_logs(created_at DESC);

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_subscription_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for email_settings
DROP TRIGGER IF EXISTS trigger_email_settings_updated ON email_settings;
CREATE TRIGGER trigger_email_settings_updated
    BEFORE UPDATE ON email_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_subscription_timestamp();

-- Trigger for report_subscriptions
DROP TRIGGER IF EXISTS trigger_report_subscriptions_updated ON report_subscriptions;
CREATE TRIGGER trigger_report_subscriptions_updated
    BEFORE UPDATE ON report_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_subscription_timestamp();

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON TABLE email_settings IS 'Tenant bazlı SMTP email ayarları';
COMMENT ON TABLE report_subscriptions IS 'Zamanlanmış rapor abonelikleri (Power BI Subscribe benzeri)';
COMMENT ON TABLE subscription_logs IS 'Abonelik işlem logları (audit trail)';

COMMENT ON COLUMN email_settings.smtp_password_encrypted IS 'AES-256 ile şifrelenmiş SMTP password';
COMMENT ON COLUMN report_subscriptions.schedule_cron IS 'Cron format: dakika saat gün ay haftanın_günü';
COMMENT ON COLUMN report_subscriptions.recipient_user_ids IS 'Alıcı kullanıcı UUID listesi (users tablosundan)';

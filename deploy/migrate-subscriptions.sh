#!/bin/bash
# Migration Script: Report Subscriptions & Email Settings
# Date: 26 Ocak 2026
# Usage: sudo bash migrate-subscriptions.sh

set -e

echo "=== Report Subscriptions Migration ==="
echo "Date: $(date)"

# Load environment
if [ -f /opt/clixer/.env ]; then
    source /opt/clixer/.env
fi

# Default values
PG_HOST=${PG_HOST:-localhost}
PG_PORT=${PG_PORT:-5432}
PG_USER=${PG_USER:-postgres}
PG_DATABASE=${PG_DATABASE:-clixer}

# Check if PGPASSWORD is set
if [ -z "$PG_PASSWORD" ] && [ -z "$PGPASSWORD" ]; then
    echo "Warning: PG_PASSWORD not set, using default authentication"
fi

export PGPASSWORD=${PG_PASSWORD:-$PGPASSWORD}

MIGRATION_FILE="/opt/clixer/docker/init-scripts/postgres/migrations/20260126_report_subscriptions.sql"

if [ ! -f "$MIGRATION_FILE" ]; then
    echo "Error: Migration file not found: $MIGRATION_FILE"
    exit 1
fi

echo ""
echo "[1/3] Checking database connection..."
psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DATABASE" -c "SELECT 1" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✓ Database connection OK"
else
    echo "✗ Database connection FAILED"
    exit 1
fi

echo ""
echo "[2/3] Running migration..."
psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DATABASE" -f "$MIGRATION_FILE"

if [ $? -eq 0 ]; then
    echo "✓ Migration completed successfully"
else
    echo "✗ Migration FAILED"
    exit 1
fi

echo ""
echo "[3/3] Verifying tables..."
psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DATABASE" -c "
SELECT 
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
AND table_name IN ('email_settings', 'report_subscriptions', 'subscription_logs')
ORDER BY table_name;
"

echo ""
echo "=== Migration Complete ==="
echo ""
echo "Tables created:"
echo "  - email_settings (SMTP ayarları)"
echo "  - report_subscriptions (Rapor abonelikleri)"
echo "  - subscription_logs (İşlem logları)"
echo ""

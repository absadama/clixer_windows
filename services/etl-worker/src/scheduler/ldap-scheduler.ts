/**
 * LDAP Scheduler
 * Handles scheduled LDAP user synchronization
 */

import { createLogger, db, cache } from '@clixer/shared';

const logger = createLogger({ service: 'etl-worker' });

/**
 * Check and run LDAP schedules
 */
export async function checkLDAPSchedules(): Promise<void> {
  try {
    const ldapConfigs = await db.queryAll(
      `SELECT id, tenant_id, sync_schedule, last_sync_at, name
       FROM ldap_config
       WHERE is_active = true
       AND sync_schedule IS NOT NULL
       AND sync_schedule != 'manual'`
    );

    for (const config of ldapConfigs) {
      let shouldSync = false;
      const lastSync = config.last_sync_at ? new Date(config.last_sync_at) : null;
      const now = new Date();

      if (!lastSync) {
        shouldSync = true;
      } else {
        const hoursSinceLastSync = (now.getTime() - lastSync.getTime()) / (1000 * 60 * 60);
        
        switch (config.sync_schedule) {
          case 'hourly':
            shouldSync = hoursSinceLastSync >= 1;
            break;
          case '6h':
            shouldSync = hoursSinceLastSync >= 6;
            break;
          case 'daily':
            shouldSync = hoursSinceLastSync >= 24;
            break;
          default:
            shouldSync = false;
        }
      }

      if (shouldSync) {
        logger.info('LDAP scheduled sync triggered', { 
          tenantId: config.tenant_id, 
          schedule: config.sync_schedule,
          lastSync: lastSync?.toISOString() || 'never'
        });

        try {
          await cache.publish('ldap:sync', JSON.stringify({
            tenantId: config.tenant_id,
            configId: config.id,
            triggeredBy: 'scheduler'
          }));

          await db.query(
            'UPDATE ldap_config SET last_sync_at = NOW() WHERE id = $1',
            [config.id]
          );

          logger.info('LDAP sync event published', { tenantId: config.tenant_id });
        } catch (syncError: any) {
          logger.error('LDAP scheduled sync failed', { 
            tenantId: config.tenant_id, 
            error: syncError.message 
          });
        }
      }
    }
  } catch (error) {
    logger.error('LDAP scheduler error', { error });
  }
}

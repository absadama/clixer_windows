/**
 * ETL Scheduler
 * Handles scheduled ETL job execution
 */

import { createLogger, db } from '@clixer/shared';
import { checkLDAPSchedules } from './ldap-scheduler';

const logger = createLogger({ service: 'etl-worker' });

// Dependency injection for processETLJob to avoid circular imports
let processETLJob: any;

export function injectDependencies(deps: { processETLJob: any }) {
  processETLJob = deps.processETLJob;
}

/**
 * Check and run scheduled ETL jobs
 */
export async function checkScheduledJobs(): Promise<void> {
  try {
    const schedules = await db.queryAll(
      `SELECT s.*, d.name as dataset_name, d.clickhouse_table
       FROM etl_schedules s
       JOIN datasets d ON s.dataset_id = d.id
       WHERE s.is_active = true
       AND d.status = 'active'
       AND (s.next_run_at IS NULL OR s.next_run_at <= NOW())`
    );

    logger.info('Checking scheduled jobs', { count: schedules.length });
    
    await checkLDAPSchedules();

    for (const schedule of schedules) {
      logger.info('Running scheduled sync', { dataset: schedule.dataset_name, cron: schedule.cron_expression });
      
      try {
        if (!processETLJob) {
          logger.error('processETLJob not injected');
          continue;
        }
        
        await processETLJob({
          datasetId: schedule.dataset_id,
          action: 'incremental_sync'
        });

        let nextRun = new Date();
        const cron = schedule.cron_expression;
        
        if (cron === '* * * * *') nextRun.setMinutes(nextRun.getMinutes() + 1);
        else if (cron === '*/5 * * * *') nextRun.setMinutes(nextRun.getMinutes() + 5);
        else if (cron === '*/15 * * * *') nextRun.setMinutes(nextRun.getMinutes() + 15);
        else if (cron === '*/30 * * * *') nextRun.setMinutes(nextRun.getMinutes() + 30);
        else if (cron === '0 * * * *') nextRun.setHours(nextRun.getHours() + 1, 0, 0, 0);
        else if (cron === '0 */6 * * *') nextRun.setHours(nextRun.getHours() + 6, 0, 0, 0);
        else if (cron === '0 */12 * * *') nextRun.setHours(nextRun.getHours() + 12, 0, 0, 0);
        else if (cron === '0 0 * * *') {
          nextRun.setDate(nextRun.getDate() + 1);
          nextRun.setHours(0, 0, 0, 0);
        }
        else if (cron.match(/^0 \d{1,2} \* \* \*$/)) {
          const hour = parseInt(cron.split(' ')[1]);
          nextRun.setDate(nextRun.getDate() + 1);
          nextRun.setHours(hour, 0, 0, 0);
        }
        else {
          logger.warn('Unknown cron expression, using 24h fallback', { cron, dataset: schedule.dataset_name });
          nextRun.setDate(nextRun.getDate() + 1);
          nextRun.setHours(2, 0, 0, 0);
        }

        await db.query(
          `UPDATE etl_schedules SET next_run_at = $1, last_run_at = NOW() WHERE id = $2`,
          [nextRun, schedule.id]
        );
      } catch (jobError: any) {
        logger.error('Scheduled job failed', { dataset: schedule.dataset_name, error: jobError.message });
      }
    }
  } catch (error) {
    logger.error('Scheduler error', { error });
  }
}

/**
 * Scheduler Service
 * Handles scheduled report subscription execution
 * 
 * Features:
 * - Cron-based scheduling
 * - Timezone support (Europe/Istanbul)
 * - Concurrent execution limiting
 * - Error recovery and logging
 */

import cron from 'node-cron';
import { db, cache, createLogger } from '@clixer/shared';
import { captureScreenshot } from './screenshot.service';
import { sendReportEmail } from './email.service';

const logger = createLogger({ service: 'subscription-scheduler' });

// Active cron jobs
const activeJobs = new Map<string, cron.ScheduledTask>();

// Execution lock to prevent concurrent runs
const executionLock = new Set<string>();

// ============================================
// SUBSCRIPTION PROCESSING
// ============================================

interface Subscription {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  design_id: string;
  design_type: 'cockpit' | 'analysis';
  recipient_user_ids: string[];
  schedule_cron: string;
  schedule_timezone: string;
  is_active: boolean;
}

async function processSubscription(subscription: Subscription): Promise<void> {
  const { id, tenant_id, name, design_id, design_type, recipient_user_ids } = subscription;
  const startTime = Date.now();

  // Check lock
  if (executionLock.has(id)) {
    logger.warn('Subscription already being processed', { subscriptionId: id });
    return;
  }

  executionLock.add(id);

  try {
    logger.info('Processing subscription', { subscriptionId: id, name });

    // Get design info
    const design = await db.queryOne(
      `SELECT id, name, description FROM designs WHERE id = $1`,
      [design_id]
    );

    if (!design) {
      throw new Error(`Design not found: ${design_id}`);
    }

    // Get recipient emails
    const recipients = await db.queryAll(
      `SELECT id, email, name FROM users WHERE id = ANY($1) AND is_active = true`,
      [recipient_user_ids]
    );

    if (recipients.length === 0) {
      throw new Error('No active recipients found');
    }

    const recipientEmails = recipients.map(r => r.email).filter(Boolean);

    if (recipientEmails.length === 0) {
      throw new Error('No valid email addresses found');
    }

    // Capture screenshot
    const screenshotResult = await captureScreenshot({
      tenantId: tenant_id,
      designId: design_id,
      designType: design_type
    });

    if (!screenshotResult.success || !screenshotResult.buffer) {
      throw new Error(`Screenshot failed: ${screenshotResult.error}`);
    }

    // Send email
    const emailResult = await sendReportEmail(
      tenant_id,
      recipientEmails,
      design.name,
      design.description,
      name,
      screenshotResult.buffer
    );

    if (!emailResult.success) {
      throw new Error(`Email failed: ${emailResult.error}`);
    }

    const duration = Date.now() - startTime;

    // Update subscription stats
    await db.query(`
      UPDATE report_subscriptions
      SET last_sent_at = NOW(), 
          last_error = NULL,
          send_count = send_count + 1
      WHERE id = $1
    `, [id]);

    // Log success
    await db.query(`
      INSERT INTO subscription_logs 
      (subscription_id, tenant_id, action, status, recipient_count, execution_time_ms)
      VALUES ($1, $2, 'SENT', 'SUCCESS', $3, $4)
    `, [id, tenant_id, recipientEmails.length, duration]);

    logger.info('Subscription processed successfully', {
      subscriptionId: id,
      recipientCount: recipientEmails.length,
      duration
    });

  } catch (error: any) {
    const duration = Date.now() - startTime;

    logger.error('Subscription processing failed', {
      subscriptionId: id,
      error: error.message,
      duration
    });

    // Update error status
    await db.query(`
      UPDATE report_subscriptions
      SET last_error = $1, error_count = error_count + 1
      WHERE id = $2
    `, [error.message, id]);

    // Log failure
    await db.query(`
      INSERT INTO subscription_logs 
      (subscription_id, tenant_id, action, status, error_message, execution_time_ms)
      VALUES ($1, $2, 'FAILED', 'ERROR', $3, $4)
    `, [id, subscription.tenant_id, error.message, duration]);

  } finally {
    executionLock.delete(id);
  }
}

// ============================================
// CRON JOB MANAGEMENT
// ============================================

function createCronJob(subscription: Subscription): cron.ScheduledTask | null {
  const { id, schedule_cron, schedule_timezone } = subscription;

  try {
    // Validate cron expression
    if (!cron.validate(schedule_cron)) {
      logger.error('Invalid cron expression', { subscriptionId: id, cron: schedule_cron });
      return null;
    }

    const job = cron.schedule(schedule_cron, async () => {
      logger.info('Cron triggered', { subscriptionId: id });
      await processSubscription(subscription);
    }, {
      timezone: schedule_timezone || 'Europe/Istanbul',
      scheduled: true
    });

    logger.info('Cron job created', {
      subscriptionId: id,
      cron: schedule_cron,
      timezone: schedule_timezone
    });

    return job;

  } catch (error: any) {
    logger.error('Failed to create cron job', {
      subscriptionId: id,
      error: error.message
    });
    return null;
  }
}

// ============================================
// SCHEDULER LIFECYCLE
// ============================================

export async function startScheduler(): Promise<void> {
  logger.info('Starting subscription scheduler');

  try {
    // Load all active subscriptions
    const subscriptions = await db.queryAll<Subscription>(`
      SELECT * FROM report_subscriptions WHERE is_active = true
    `);

    logger.info(`Found ${subscriptions.length} active subscriptions`);

    // Create cron jobs for each
    for (const sub of subscriptions) {
      const job = createCronJob(sub);
      if (job) {
        activeJobs.set(sub.id, job);
      }
    }

    // Subscribe to manual trigger events
    cache.subscribe('subscription:send', async (message) => {
      try {
        // Debug: Log raw message to understand structure
        logger.info('Raw message received', { 
          messageStr: JSON.stringify(message), 
          type: typeof message 
        });
        
        // Parse message if it's a string (cache.subscribe may or may not parse)
        const parsedMessage = typeof message === 'string' ? JSON.parse(message) : message;
        
        const { subscriptionId, tenantId, manual } = parsedMessage;
        logger.info('Manual subscription trigger received', { subscriptionId, tenantId, manual });

        const subscription = await db.queryOne<Subscription>(
          `SELECT * FROM report_subscriptions WHERE id = $1 AND tenant_id = $2`,
          [subscriptionId, tenantId]
        );

        if (subscription) {
          await processSubscription(subscription);
        }
      } catch (error: any) {
        logger.error('Failed to process manual trigger', { error: error.message });
      }
    });

    // Subscribe to subscription changes
    cache.subscribe('subscription:changed', async (message) => {
      try {
        // Parse message if it's a string
        const parsedMessage = typeof message === 'string' ? JSON.parse(message) : message;
        const { subscriptionId, action } = parsedMessage;
        logger.info('Subscription change received', { subscriptionId, action });

        if (action === 'deleted' || action === 'deactivated') {
          // Stop and remove job
          const job = activeJobs.get(subscriptionId);
          if (job) {
            job.stop();
            activeJobs.delete(subscriptionId);
            logger.info('Cron job stopped', { subscriptionId });
          }
        } else if (action === 'created' || action === 'updated' || action === 'activated') {
          // Reload subscription and recreate job
          const subscription = await db.queryOne<Subscription>(
            `SELECT * FROM report_subscriptions WHERE id = $1 AND is_active = true`,
            [subscriptionId]
          );

          // Stop existing job if any
          const existingJob = activeJobs.get(subscriptionId);
          if (existingJob) {
            existingJob.stop();
            activeJobs.delete(subscriptionId);
          }

          // Create new job if active
          if (subscription) {
            const job = createCronJob(subscription);
            if (job) {
              activeJobs.set(subscriptionId, job);
            }
          }
        }
      } catch (error: any) {
        logger.error('Failed to process subscription change', { error: error.message });
      }
    });

    logger.info('Subscription scheduler started', {
      activeJobs: activeJobs.size
    });

  } catch (error: any) {
    logger.error('Failed to start scheduler', { error: error.message });
    throw error;
  }
}

export async function stopScheduler(): Promise<void> {
  logger.info('Stopping subscription scheduler');

  // Stop all cron jobs
  for (const [id, job] of activeJobs) {
    try {
      job.stop();
      logger.debug('Stopped cron job', { subscriptionId: id });
    } catch (error) {
      // Ignore stop errors
    }
  }

  activeJobs.clear();

  logger.info('Subscription scheduler stopped');
}

export function getActiveJobsCount(): number {
  return activeJobs.size;
}

// ============================================
// UTILITY: Get next run time
// ============================================

export function getNextRunTime(cronExpression: string, timezone: string = 'Europe/Istanbul'): Date | null {
  try {
    // Use cron-parser for accurate next run calculation
    const cronParser = require('cron-parser');
    const interval = cronParser.parseExpression(cronExpression, {
      tz: timezone
    });
    return interval.next().toDate();
  } catch (error) {
    return null;
  }
}

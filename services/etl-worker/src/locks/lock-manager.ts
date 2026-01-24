/**
 * Dataset Lock Manager
 * Ensures only one job runs per dataset at a time
 */

import { createLogger, cache } from '@clixer/shared';
import { LOCK_TTL } from '../helpers';

const logger = createLogger({ service: 'etl-worker' });

/**
 * Acquire lock for a dataset
 * @returns true if lock acquired, false if already locked
 */
export async function acquireDatasetLock(datasetId: string): Promise<boolean> {
  const lockKey = `etl:lock:${datasetId}`;
  try {
    const result = await cache.setNX(lockKey, JSON.stringify({
      pid: process.pid,
      startedAt: new Date().toISOString()
    }), LOCK_TTL);
    
    if (result) {
      logger.info('Dataset lock acquired', { datasetId });
      return true;
    } else {
      const existing = await cache.get(lockKey);
      logger.warn('Dataset already locked (duplicate job prevention)', { 
        datasetId, 
        existingLock: existing 
      });
      return false;
    }
  } catch (error) {
    logger.error('Failed to acquire dataset lock', { datasetId, error });
    return false;
  }
}

/**
 * Release dataset lock
 */
export async function releaseDatasetLock(datasetId: string): Promise<void> {
  const lockKey = `etl:lock:${datasetId}`;
  try {
    await cache.del(lockKey);
    logger.info('Dataset lock released', { datasetId });
  } catch (error) {
    logger.error('Failed to release dataset lock', { datasetId, error });
  }
}

/**
 * Check if job is cancelled
 */
export async function isJobCancelled(jobId: string): Promise<boolean> {
  const cancelKey = `etl:cancel:${jobId}`;
  const cancelled = await cache.get(cancelKey);
  return cancelled === 'true';
}

/**
 * Send kill signal to job
 */
export async function sendKillSignal(jobId: string): Promise<void> {
  const cancelKey = `etl:cancel:${jobId}`;
  await cache.set(cancelKey, 'true', 3600);
  logger.info('Kill signal sent', { jobId });
}

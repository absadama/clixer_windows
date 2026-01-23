/**
 * Memory Manager Helper
 * Memory usage monitoring and garbage collection
 */

import { createLogger } from '@clixer/shared';
import { MAX_MEMORY_MB } from './constants';

const logger = createLogger({ service: 'etl-worker' });

/**
 * Memory kullanımını kontrol et
 */
export function checkMemory(): { usedMB: number; ok: boolean } {
  const used = process.memoryUsage();
  const usedMB = Math.round(used.heapUsed / 1024 / 1024);
  const ok = usedMB < MAX_MEMORY_MB;
  if (!ok) {
    logger.warn('High memory usage detected', { usedMB, maxMB: MAX_MEMORY_MB });
  }
  return { usedMB, ok };
}

/**
 * Garbage collector'ı manual tetikle (varsa)
 */
export function forceGC(): void {
  if (global.gc) {
    global.gc();
    logger.debug('Manual garbage collection triggered');
  }
}

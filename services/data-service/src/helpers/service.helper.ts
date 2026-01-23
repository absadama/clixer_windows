/**
 * Service Management Helpers
 * Service list and health check utilities
 */

/**
 * Service list for admin panel
 */
export const SERVICE_LIST = [
  { id: 'gateway', name: 'API Gateway', port: 4000, critical: true },
  { id: 'auth', name: 'Auth Service', port: 4001, critical: true },
  { id: 'core', name: 'Core Service', port: 4002, critical: true },
  { id: 'data', name: 'Data Service', port: 4003, critical: true },
  { id: 'notification', name: 'Notification Service', port: 4004, critical: false },
  { id: 'analytics', name: 'Analytics Service', port: 4005, critical: true },
  { id: 'etl-worker', name: 'ETL Worker', port: null, critical: true }
] as const;

export type ServiceInfo = typeof SERVICE_LIST[number];

/**
 * Ping a service health endpoint
 */
export async function pingService(url: string, timeout = 3000): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}

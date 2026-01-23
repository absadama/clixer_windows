/**
 * Enterprise Service Manager
 * Platform-agnostic service lifecycle management
 * 
 * Müşteri UI'dan servisleri yönetebilir - terminal/SSH'ye gerek yok
 */

import { spawn, exec, ChildProcess } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';
import createLogger from './logger';

const execAsync = promisify(exec);
const logger = createLogger({ service: 'service-manager' });

// ============================================
// TYPES
// ============================================

export enum ServiceStatus {
  RUNNING = 'running',
  STOPPED = 'stopped',
  STARTING = 'starting',
  STOPPING = 'stopping',
  ERROR = 'error',
  UNKNOWN = 'unknown'
}

export enum Platform {
  WINDOWS_DEV = 'windows_dev',
  LINUX_SYSTEMD = 'linux_systemd',
  DOCKER = 'docker',
  PM2 = 'pm2'
}

export interface ServiceConfig {
  id: string;
  name: string;
  type: 'node' | 'gateway' | 'frontend';
  port?: number;
  workDir: string;
  startCommand: string;
  healthCheckUrl?: string;
  env?: Record<string, string>;
}

export interface ServiceInfo {
  id: string;
  name: string;
  status: ServiceStatus;
  pid?: number;
  port?: number;
  uptime?: number;
  memory?: number;
  cpu?: number;
  restartCount?: number;
  lastRestart?: Date;
  error?: string;
}

// ============================================
// SERVICE MANAGER INTERFACE
// ============================================

export interface IServiceManager {
  start(serviceId: string): Promise<ServiceInfo>;
  stop(serviceId: string): Promise<ServiceInfo>;
  restart(serviceId: string): Promise<ServiceInfo>;
  getStatus(serviceId: string): Promise<ServiceInfo>;
  getAll(): Promise<ServiceInfo[]>;
}

// ============================================
// PLATFORM DETECTION
// ============================================

export function detectPlatform(): Platform {
  const platform = process.platform;
  
  // PM2 check
  if (process.env.PM2_HOME || process.env.pm_id) {
    return Platform.PM2;
  }
  
  // Docker check
  if (fs.existsSync('/.dockerenv') || process.env.KUBERNETES_SERVICE_HOST) {
    return Platform.DOCKER;
  }
  
  // Linux systemd check
  if (platform === 'linux' && fs.existsSync('/run/systemd/system')) {
    return Platform.LINUX_SYSTEMD;
  }
  
  // Windows development
  if (platform === 'win32') {
    return Platform.WINDOWS_DEV;
  }
  
  logger.warn('Unknown platform, defaulting to Windows Dev', { platform });
  return Platform.WINDOWS_DEV;
}

// ============================================
// SERVICE REGISTRY
// ============================================

export const SERVICE_CONFIGS: Record<string, ServiceConfig> = {
  'auth-service': {
    id: 'auth-service',
    name: 'Auth Service',
    type: 'node',
    port: 4001,
    workDir: 'services/auth-service',
    startCommand: 'npx ts-node-dev --respawn --transpile-only src/index.ts',
    healthCheckUrl: 'http://localhost:4001/health'
  },
  'core-service': {
    id: 'core-service',
    name: 'Core Service',
    type: 'node',
    port: 4002,
    workDir: 'services/core-service',
    startCommand: 'npx ts-node-dev --respawn --transpile-only src/index.ts',
    healthCheckUrl: 'http://localhost:4002/health'
  },
  'data-service': {
    id: 'data-service',
    name: 'Data Service',
    type: 'node',
    port: 4003,
    workDir: 'services/data-service',
    startCommand: 'npx ts-node-dev --respawn --transpile-only src/index.ts',
    healthCheckUrl: 'http://localhost:4003/health'
  },
  'notification-service': {
    id: 'notification-service',
    name: 'Notification Service',
    type: 'node',
    port: 4004,
    workDir: 'services/notification-service',
    startCommand: 'npx ts-node-dev --respawn --transpile-only src/index.ts',
    healthCheckUrl: 'http://localhost:4004/health'
  },
  'analytics-service': {
    id: 'analytics-service',
    name: 'Analytics Service',
    type: 'node',
    port: 4005,
    workDir: 'services/analytics-service',
    startCommand: 'npx ts-node-dev --respawn --transpile-only src/index.ts',
    healthCheckUrl: 'http://localhost:4005/health'
  },
  'etl-worker': {
    id: 'etl-worker',
    name: 'ETL Worker',
    type: 'node',
    port: undefined,
    workDir: 'services/etl-worker',
    startCommand: 'npx ts-node-dev --respawn --transpile-only src/index.ts'
  },
  'gateway': {
    id: 'gateway',
    name: 'API Gateway',
    type: 'gateway',
    port: 3000,
    workDir: 'gateway',
    startCommand: 'npx ts-node-dev --respawn --transpile-only src/index.ts',
    healthCheckUrl: 'http://localhost:3000/health'
  }
};

// ============================================
// WINDOWS PROCESS MANAGER
// ============================================

export class WindowsProcessManager implements IServiceManager {
  private processes: Map<string, ChildProcess> = new Map();
  private projectRoot: string;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
  }

  async start(serviceId: string): Promise<ServiceInfo> {
    const config = SERVICE_CONFIGS[serviceId];
    if (!config) {
      throw new Error(`Service not found: ${serviceId}`);
    }

    // Check if already running
    const existing = await this.getStatus(serviceId);
    if (existing.status === ServiceStatus.RUNNING) {
      logger.info('Service already running', { serviceId });
      return existing;
    }

    return new Promise((resolve, reject) => {
      const workDir = path.join(this.projectRoot, config.workDir);
      
      logger.info('Starting service', { serviceId, workDir, command: config.startCommand });

      // Windows: Use shell: true for proper PATH resolution
      const child = spawn(config.startCommand, [], {
        cwd: workDir,
        env: { ...process.env, ...config.env },
        detached: false,
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: true  // Let Node.js handle shell spawning - fixes npm ENOENT
      });

      this.processes.set(serviceId, child);

      let startupOutput = '';
      let startupError = '';
      let resolved = false;

      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          logger.warn('Service startup timeout, but process started', { serviceId, pid: child.pid });
          resolve({
            id: serviceId,
            name: config.name,
            status: ServiceStatus.STARTING,
            pid: child.pid,
            port: config.port
          });
        }
      }, 15000); // 15 saniye timeout

      child.stdout?.on('data', (data) => {
        const output = data.toString();
        startupOutput += output;
        
        // Success patterns
        if (output.includes('running on port') || 
            output.includes('started') || 
            output.includes('listening')) {
          if (!resolved) {
            clearTimeout(timeout);
            resolved = true;
            logger.info('Service started successfully', { serviceId, pid: child.pid });
            resolve({
              id: serviceId,
              name: config.name,
              status: ServiceStatus.RUNNING,
              pid: child.pid,
              port: config.port
            });
          }
        }
      });

      child.stderr?.on('data', (data) => {
        startupError += data.toString();
        logger.error('Service startup error', { serviceId, error: data.toString() });
      });

      child.on('error', (error) => {
        clearTimeout(timeout);
        this.processes.delete(serviceId);
        if (!resolved) {
          resolved = true;
          logger.error('Failed to start service', { serviceId, error: error.message });
          reject(new Error(`Failed to start ${config.name}: ${error.message}`));
        }
      });

      child.on('exit', (code) => {
        this.processes.delete(serviceId);
        if (!resolved && code !== 0) {
          clearTimeout(timeout);
          resolved = true;
          logger.error('Service exited during startup', { serviceId, code, stderr: startupError });
          reject(new Error(`${config.name} exited with code ${code}`));
        }
      });
    });
  }

  async stop(serviceId: string): Promise<ServiceInfo> {
    const config = SERVICE_CONFIGS[serviceId];
    if (!config) {
      throw new Error(`Service not found: ${serviceId}`);
    }

    const process = this.processes.get(serviceId);
    
    if (process) {
      // Graceful shutdown
      logger.info('Stopping service (graceful)', { serviceId, pid: process.pid });
      
      return new Promise((resolve) => {
        process.on('exit', () => {
          this.processes.delete(serviceId);
          logger.info('Service stopped', { serviceId });
          resolve({
            id: serviceId,
            name: config.name,
            status: ServiceStatus.STOPPED
          });
        });

        // Try graceful shutdown first
        process.kill('SIGTERM');

        // Force kill after 10 seconds
        setTimeout(() => {
          if (this.processes.has(serviceId)) {
            logger.warn('Force killing service', { serviceId });
            process.kill('SIGKILL');
          }
        }, 10000);
      });
    }

    // Not in our process map, try to find by port
    if (config.port) {
      try {
        await this.killByPort(config.port);
        logger.info('Service stopped by port', { serviceId, port: config.port });
      } catch (error: any) {
        logger.warn('Failed to stop by port', { serviceId, port: config.port, error: error.message });
      }
    }

    return {
      id: serviceId,
      name: config.name,
      status: ServiceStatus.STOPPED
    };
  }

  async restart(serviceId: string): Promise<ServiceInfo> {
    logger.info('Restarting service', { serviceId });
    await this.stop(serviceId);
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
    return await this.start(serviceId);
  }

  async getStatus(serviceId: string): Promise<ServiceInfo> {
    const config = SERVICE_CONFIGS[serviceId];
    if (!config) {
      return {
        id: serviceId,
        name: serviceId,
        status: ServiceStatus.UNKNOWN,
        error: 'Service not found'
      };
    }

    // Check our process map
    const process = this.processes.get(serviceId);
    if (process && !process.killed) {
      return {
        id: serviceId,
        name: config.name,
        status: ServiceStatus.RUNNING,
        pid: process.pid,
        port: config.port
      };
    }

    // Check by port
    if (config.port) {
      const isRunning = await this.isPortInUse(config.port);
      if (isRunning) {
        return {
          id: serviceId,
          name: config.name,
          status: ServiceStatus.RUNNING,
          port: config.port
        };
      }
    }

    return {
      id: serviceId,
      name: config.name,
      status: ServiceStatus.STOPPED,
      port: config.port
    };
  }

  async getAll(): Promise<ServiceInfo[]> {
    const services = Object.keys(SERVICE_CONFIGS);
    return Promise.all(services.map(id => this.getStatus(id)));
  }

  // Helper: Check if port is in use
  private async isPortInUse(port: number): Promise<boolean> {
    try {
      const { stdout } = await execAsync(`netstat -ano | findstr :${port}`);
      return stdout.trim().length > 0;
    } catch {
      return false;
    }
  }

  // Helper: Kill process by port
  private async killByPort(port: number): Promise<void> {
    try {
      const { stdout } = await execAsync(`netstat -ano | findstr :${port}`);
      const lines = stdout.trim().split('\n');
      
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        
        if (pid && !isNaN(Number(pid))) {
          try {
            await execAsync(`taskkill /F /PID ${pid}`);
            logger.info('Killed process by port', { port, pid });
          } catch (error: any) {
            logger.warn('Failed to kill process', { port, pid, error: error.message });
          }
        }
      }
    } catch (error: any) {
      logger.warn('Failed to find process by port', { port, error: error.message });
    }
  }
}

// ============================================
// LINUX SYSTEMD MANAGER
// ============================================

export class SystemdManager implements IServiceManager {
  async start(serviceId: string): Promise<ServiceInfo> {
    const config = SERVICE_CONFIGS[serviceId];
    if (!config) throw new Error(`Service not found: ${serviceId}`);

    try {
      await execAsync(`sudo systemctl start clixer-${serviceId}`);
      logger.info('Systemd service started', { serviceId });
      return await this.getStatus(serviceId);
    } catch (error: any) {
      logger.error('Failed to start systemd service', { serviceId, error: error.message });
      throw new Error(`Failed to start ${config.name}: ${error.message}`);
    }
  }

  async stop(serviceId: string): Promise<ServiceInfo> {
    const config = SERVICE_CONFIGS[serviceId];
    if (!config) throw new Error(`Service not found: ${serviceId}`);

    try {
      await execAsync(`sudo systemctl stop clixer-${serviceId}`);
      logger.info('Systemd service stopped', { serviceId });
      return await this.getStatus(serviceId);
    } catch (error: any) {
      logger.error('Failed to stop systemd service', { serviceId, error: error.message });
      throw new Error(`Failed to stop ${config.name}: ${error.message}`);
    }
  }

  async restart(serviceId: string): Promise<ServiceInfo> {
    const config = SERVICE_CONFIGS[serviceId];
    if (!config) throw new Error(`Service not found: ${serviceId}`);

    try {
      await execAsync(`sudo systemctl restart clixer-${serviceId}`);
      logger.info('Systemd service restarted', { serviceId });
      await new Promise(resolve => setTimeout(resolve, 2000));
      return await this.getStatus(serviceId);
    } catch (error: any) {
      logger.error('Failed to restart systemd service', { serviceId, error: error.message });
      throw new Error(`Failed to restart ${config.name}: ${error.message}`);
    }
  }

  async getStatus(serviceId: string): Promise<ServiceInfo> {
    const config = SERVICE_CONFIGS[serviceId];
    if (!config) {
      return {
        id: serviceId,
        name: serviceId,
        status: ServiceStatus.UNKNOWN,
        error: 'Service not found'
      };
    }

    try {
      const { stdout } = await execAsync(`systemctl status clixer-${serviceId}`);
      const isActive = stdout.includes('Active: active (running)');
      
      return {
        id: serviceId,
        name: config.name,
        status: isActive ? ServiceStatus.RUNNING : ServiceStatus.STOPPED,
        port: config.port
      };
    } catch {
      return {
        id: serviceId,
        name: config.name,
        status: ServiceStatus.STOPPED,
        port: config.port
      };
    }
  }

  async getAll(): Promise<ServiceInfo[]> {
    const services = Object.keys(SERVICE_CONFIGS);
    return Promise.all(services.map(id => this.getStatus(id)));
  }
}

// ============================================
// PM2 MANAGER
// ============================================

export class PM2Manager implements IServiceManager {
  async start(serviceId: string): Promise<ServiceInfo> {
    const config = SERVICE_CONFIGS[serviceId];
    if (!config) throw new Error(`Service not found: ${serviceId}`);

    try {
      await execAsync(`pm2 start clixer-${serviceId}`);
      logger.info('PM2 service started', { serviceId });
      return await this.getStatus(serviceId);
    } catch (error: any) {
      logger.error('Failed to start PM2 service', { serviceId, error: error.message });
      throw new Error(`Failed to start ${config.name}: ${error.message}`);
    }
  }

  async stop(serviceId: string): Promise<ServiceInfo> {
    const config = SERVICE_CONFIGS[serviceId];
    if (!config) throw new Error(`Service not found: ${serviceId}`);

    try {
      await execAsync(`pm2 stop clixer-${serviceId}`);
      logger.info('PM2 service stopped', { serviceId });
      return await this.getStatus(serviceId);
    } catch (error: any) {
      logger.error('Failed to stop PM2 service', { serviceId, error: error.message });
      throw new Error(`Failed to stop ${config.name}: ${error.message}`);
    }
  }

  async restart(serviceId: string): Promise<ServiceInfo> {
    const config = SERVICE_CONFIGS[serviceId];
    if (!config) throw new Error(`Service not found: ${serviceId}`);

    try {
      await execAsync(`pm2 restart clixer-${serviceId}`);
      logger.info('PM2 service restarted', { serviceId });
      await new Promise(resolve => setTimeout(resolve, 2000));
      return await this.getStatus(serviceId);
    } catch (error: any) {
      logger.error('Failed to restart PM2 service', { serviceId, error: error.message });
      throw new Error(`Failed to restart ${config.name}: ${error.message}`);
    }
  }

  async getStatus(serviceId: string): Promise<ServiceInfo> {
    const config = SERVICE_CONFIGS[serviceId];
    if (!config) {
      return {
        id: serviceId,
        name: serviceId,
        status: ServiceStatus.UNKNOWN,
        error: 'Service not found'
      };
    }

    try {
      const { stdout } = await execAsync(`pm2 jlist`);
      const processes = JSON.parse(stdout);
      const process = processes.find((p: any) => p.name === `clixer-${serviceId}`);
      
      if (process) {
        return {
          id: serviceId,
          name: config.name,
          status: process.pm2_env.status === 'online' ? ServiceStatus.RUNNING : ServiceStatus.STOPPED,
          pid: process.pid,
          port: config.port,
          uptime: Date.now() - process.pm2_env.pm_uptime,
          memory: process.monit.memory,
          cpu: process.monit.cpu,
          restartCount: process.pm2_env.restart_time
        };
      }
    } catch (error: any) {
      logger.warn('Failed to get PM2 status', { serviceId, error: error.message });
    }

    return {
      id: serviceId,
      name: config.name,
      status: ServiceStatus.STOPPED,
      port: config.port
    };
  }

  async getAll(): Promise<ServiceInfo[]> {
    const services = Object.keys(SERVICE_CONFIGS);
    return Promise.all(services.map(id => this.getStatus(id)));
  }
}

// ============================================
// FACTORY
// ============================================

let managerInstance: IServiceManager | null = null;

export function getServiceManager(): IServiceManager {
  if (!managerInstance) {
    const platform = detectPlatform();
    
    logger.info('Initializing service manager', { platform });
    
    switch (platform) {
      case Platform.WINDOWS_DEV:
        managerInstance = new WindowsProcessManager();
        break;
      case Platform.LINUX_SYSTEMD:
        managerInstance = new SystemdManager();
        break;
      case Platform.PM2:
        managerInstance = new PM2Manager();
        break;
      default:
        logger.warn('Unsupported platform, falling back to Windows manager');
        managerInstance = new WindowsProcessManager();
    }
  }
  
  return managerInstance;
}

export default {
  getServiceManager,
  detectPlatform,
  ServiceStatus,
  Platform,
  SERVICE_CONFIGS
};

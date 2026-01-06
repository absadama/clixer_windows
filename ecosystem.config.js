/**
 * Clixer - PM2 Ecosystem Configuration
 * Cluster mode ile 4x kapasite artışı
 * 
 * Kullanım:
 *   pm2 start ecosystem.config.js
 *   pm2 status
 *   pm2 logs
 *   pm2 restart all
 */

module.exports = {
  apps: [
    // ============================================
    // API GATEWAY - Ana giriş noktası
    // En çok istek buraya gelir, 4 instance
    // ============================================
    {
      name: 'gateway',
      script: './gateway/dist/index.js',
      instances: 4,
      exec_mode: 'cluster',
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 4000
      },
      error_file: './logs/gateway-error.log',
      out_file: './logs/gateway-out.log',
      merge_logs: true,
      time: true
    },

    // ============================================
    // ANALYTICS SERVICE - Ağır sorgular
    // Dashboard ve KPI hesaplamaları, 4 instance
    // ============================================
    {
      name: 'analytics',
      script: './services/analytics-service/dist/index.js',
      instances: 4,
      exec_mode: 'cluster',
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 4005
      },
      error_file: './logs/analytics-error.log',
      out_file: './logs/analytics-out.log',
      merge_logs: true,
      time: true
    },

    // ============================================
    // AUTH SERVICE - Login/Logout
    // Daha az yoğun, 2 instance yeterli
    // ============================================
    {
      name: 'auth',
      script: './services/auth-service/dist/index.js',
      instances: 2,
      exec_mode: 'cluster',
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        PORT: 4001
      },
      error_file: './logs/auth-error.log',
      out_file: './logs/auth-out.log',
      merge_logs: true,
      time: true
    },

    // ============================================
    // CORE SERVICE - CRUD işlemleri
    // Orta yoğunluk, 2 instance
    // ============================================
    {
      name: 'core',
      script: './services/core-service/dist/index.js',
      instances: 2,
      exec_mode: 'cluster',
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 4002
      },
      error_file: './logs/core-error.log',
      out_file: './logs/core-out.log',
      merge_logs: true,
      time: true
    },

    // ============================================
    // DATA SERVICE - Veri bağlantıları
    // Orta yoğunluk, 2 instance
    // ============================================
    {
      name: 'data',
      script: './services/data-service/dist/index.js',
      instances: 2,
      exec_mode: 'cluster',
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 4003
      },
      error_file: './logs/data-error.log',
      out_file: './logs/data-out.log',
      merge_logs: true,
      time: true
    },

    // ============================================
    // NOTIFICATION SERVICE - Bildirimler
    // Düşük yoğunluk, 1 instance
    // ============================================
    {
      name: 'notification',
      script: './services/notification-service/dist/index.js',
      instances: 1,
      exec_mode: 'fork',  // Tek instance, fork mode
      max_memory_restart: '200M',
      env: {
        NODE_ENV: 'production',
        PORT: 4004
      },
      error_file: './logs/notification-error.log',
      out_file: './logs/notification-out.log',
      merge_logs: true,
      time: true
    },

    // ============================================
    // ETL WORKER - Arka plan işleri
    // Ayrı process, memory yoğun, 1 instance
    // ============================================
    {
      name: 'etl-worker',
      script: './services/etl-worker/dist/index.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '2G',  // ETL için daha fazla memory
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/etl-worker-error.log',
      out_file: './logs/etl-worker-out.log',
      merge_logs: true,
      time: true,
      // ETL crash olursa 5 saniye bekle, sonra restart
      restart_delay: 5000,
      max_restarts: 10
    }
  ]
};




/**
 * Clixer - PM2 Ecosystem Configuration
 * 400+ Eşzamanlı Kullanıcı için Production Ayarları
 * 
 * Kullanım:
 *   pm2 start ecosystem.config.js
 *   pm2 stop all
 *   pm2 restart all
 *   pm2 reload all    # Zero-downtime restart
 *   pm2 status
 *   pm2 logs
 *   pm2 monit         # Real-time monitoring
 */

module.exports = {
  apps: [
    // ============================================
    // API Gateway - Ana giriş noktası
    // 400+ kullanıcı için 4 instance (cluster mode)
    // ============================================
    {
      name: 'clixer-gateway',
      script: 'dist/index.js',
      cwd: './gateway',
      instances: 4,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        GATEWAY_PORT: 4000
      },
      max_memory_restart: '500M',
      error_file: './logs/gateway-error.log',
      out_file: './logs/gateway-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      // Graceful shutdown
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000
    },

    // ============================================
    // Auth Service - Kimlik doğrulama
    // JWT işlemleri için 2 instance yeterli
    // ============================================
    {
      name: 'clixer-auth',
      script: 'dist/index.js',
      cwd: './services/auth-service',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        AUTH_SERVICE_PORT: 4001
      },
      max_memory_restart: '300M',
      error_file: './logs/auth-error.log',
      out_file: './logs/auth-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000
    },

    // ============================================
    // Core Service - Kullanıcı/Tenant/Design yönetimi
    // CRUD işlemleri için 2 instance
    // ============================================
    {
      name: 'clixer-core',
      script: 'dist/index.js',
      cwd: './services/core-service',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        CORE_SERVICE_PORT: 4002
      },
      max_memory_restart: '400M',
      error_file: './logs/core-error.log',
      out_file: './logs/core-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000
    },

    // ============================================
    // Data Service - Veri bağlantıları ve ETL yönetimi
    // ============================================
    {
      name: 'clixer-data',
      script: 'dist/index.js',
      cwd: './services/data-service',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        DATA_SERVICE_PORT: 4003
      },
      max_memory_restart: '600M',
      error_file: './logs/data-error.log',
      out_file: './logs/data-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000
    },

    // ============================================
    // Notification Service + WebSocket
    // Fork mode (tek instance) - Socket.IO için gerekli
    // WebSocket state paylaşımı için Redis adapter kullanılacak
    // ============================================
    {
      name: 'clixer-notification',
      script: 'dist/index.js',
      cwd: './services/notification-service',
      instances: 1,
      exec_mode: 'fork',  // WebSocket için fork mode
      env: {
        NODE_ENV: 'production',
        NOTIFICATION_SERVICE_PORT: 4004
      },
      max_memory_restart: '500M',  // WebSocket bağlantıları için artırıldı
      error_file: './logs/notification-error.log',
      out_file: './logs/notification-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000
    },

    // ============================================
    // Analytics Service - KPI ve metrik hesaplama
    // En yoğun servis - 4 instance (cluster mode)
    // ============================================
    {
      name: 'clixer-analytics',
      script: 'dist/index.js',
      cwd: './services/analytics-service',
      instances: 4,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        ANALYTICS_SERVICE_PORT: 4005
      },
      max_memory_restart: '1G',  // Büyük sorgular için artırıldı
      error_file: './logs/analytics-error.log',
      out_file: './logs/analytics-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000
    },

    // ============================================
    // ETL Worker - Veri senkronizasyonu
    // Fork mode (tek instance) - Ağır işler için ayrı process
    // ============================================
    {
      name: 'clixer-etl',
      script: 'dist/index.js',
      cwd: './services/etl-worker',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production'
      },
      max_memory_restart: '2G',  // Büyük ETL işleri için
      error_file: './logs/etl-error.log',
      out_file: './logs/etl-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      watch: false,
      autorestart: true,
      max_restarts: 5,
      restart_delay: 5000,
      // ETL için cron job desteği
      cron_restart: '0 3 * * *'  // Her gece 03:00'te restart (bellek temizliği)
    }
  ],

  // ============================================
  // PM2 Deploy Configuration
  // SSH ile uzaktan deploy için
  // ============================================
  deploy: {
    production: {
      user: 'clixer',
      host: ['production-server'],
      ref: 'origin/main',
      repo: 'git@github.com:absadama/clixer_windows.git',
      path: '/opt/clixer',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    }
  }
};

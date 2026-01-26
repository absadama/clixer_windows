/**
 * Clixer - Data Service
 * Data Connections, Datasets, ETL Configuration
 */

// CRITICAL: Load environment FIRST
import './env';

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';

// NOT: SSL sertifika doğrulaması artık connection bazlı yapılıyor
// Her bağlantı için ssl_verify alanı kullanılarak kontrol edilir
// Global NODE_TLS_REJECT_UNAUTHORIZED kullanımı güvenlik riski oluşturur

import {
  createLogger,
  requestLogger,
  db,
  clickhouse,
  cache,
  authenticate,
  authorize,
  tenantIsolation,
  AppError,
  formatError,
  ValidationError,
  NotFoundError,
  ROLES,
  sanitizeTableName,  // SQL Injection koruması
  decrypt,  // SECURITY: Password decryption
  validateExternalUrl,  // SECURITY: SSRF koruması
  safeFetch  // SECURITY: SSRF korumalı fetch
} from '@clixer/shared';

// Import modular routes
import routes from './routes';

// Import helpers (modularized)
import { 
  sqlToClickHouseType, 
  SQL_TO_CLICKHOUSE_TYPE, 
  isDateType, 
  isNumericType,
  isDateTimeColumn,
  isNumericColumn,
  SERVICE_LIST,
  pingService
} from './helpers';

const logger = createLogger({ service: 'data-service' });
const app = express();
const PORT = process.env.DATA_SERVICE_PORT || 4003;

// Middleware
app.use(helmet());

// CORS - Servisler gateway arkasında, sadece internal erişim
const corsOrigins = process.env.NODE_ENV === 'production' 
  ? ['http://localhost:3000', 'http://127.0.0.1:3000'] // Gateway
  : true; // Development'ta tüm originler
app.use(cors({ origin: corsOrigins, credentials: true }));

app.use(compression());
app.use(express.json());
app.use(requestLogger(logger));

// Mount modular routes
app.use(routes);

// ============================================
// ROUTES
// ============================================
// NOTE: Admin routes moved to routes/admin.routes.ts
// Modular routes are mounted via app.use(routes)

// ============================================
// DATA CONNECTIONS
// ============================================

app.get('/connections', authenticate, tenantIsolation, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const connections = await db.queryAll(
      'SELECT id, name, type, host, port, database_name, status, created_at FROM data_connections WHERE tenant_id = $1 ORDER BY created_at DESC',
      [req.user!.tenantId]
    );
    res.json({ success: true, data: connections });
  } catch (error) {
    next(error);
  }
});

app.post('/connections', authenticate, authorize(ROLES.ADMIN, ROLES.MANAGER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, type, host, port, databaseName, username, password, apiBaseUrl, apiAuthType, apiAuthConfig, description } = req.body;

    if (!name || !type) {
      throw new ValidationError('Bağlantı adı ve tipi gerekli');
    }

    // API bağlantısı için apiBaseUrl'i host olarak kullan
    const connectionHost = type === 'api' ? apiBaseUrl : host;
    
    // API config oluştur
    const apiConfig = type === 'api' ? {
      authType: apiAuthType || 'none',
      ...apiAuthConfig
    } : null;

    // SECURITY FIX: Password'u encrypt et
    const { encrypt } = require('@clixer/shared');
    const encryptedPassword = password ? encrypt(password) : null;
    
    const result = await db.queryOne(
      `INSERT INTO data_connections (tenant_id, name, type, host, port, database_name, username, password_encrypted, api_config, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active')
       RETURNING id`,
      [req.user!.tenantId, name, type, connectionHost, port || null, databaseName || null, username || null, encryptedPassword, apiConfig ? JSON.stringify(apiConfig) : null]
    );

    logger.info('Data connection created', { connectionId: result.id, name, type });
    res.json({ success: true, data: { id: result.id } });
  } catch (error) {
    next(error);
  }
});

// Update connection
app.put('/connections/:id', authenticate, authorize(ROLES.ADMIN, ROLES.MANAGER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name, host, port, databaseName, username, password, apiConfig } = req.body;
    
    const connection = await db.queryOne(
      'SELECT * FROM data_connections WHERE id = $1 AND tenant_id = $2',
      [id, req.user!.tenantId]
    );
    
    if (!connection) {
      throw new NotFoundError('Bağlantı');
    }
    
    // SECURITY FIX: Password'u encrypt et
    const { encrypt } = require('@clixer/shared');
    const encryptedPassword = password ? encrypt(password) : null;
    
    await db.query(
      // SECURITY: Defense-in-depth - tenant_id dahil et
      `UPDATE data_connections SET 
        name = COALESCE($1, name),
        host = COALESCE($2, host),
        port = COALESCE($3, port),
        database_name = COALESCE($4, database_name),
        username = COALESCE($5, username),
        password_encrypted = COALESCE($6, password_encrypted),
        api_config = COALESCE($7, api_config),
        updated_at = NOW()
       WHERE id = $8 AND tenant_id = $9`,
      [name, host, port, databaseName, username, encryptedPassword, apiConfig ? JSON.stringify(apiConfig) : null, id, req.user!.tenantId]
    );
    
    logger.info('Connection updated', { connectionId: id });
    res.json({ success: true, message: 'Bağlantı güncellendi' });
  } catch (error) {
    next(error);
  }
});

// Delete connection
app.delete('/connections/:id', authenticate, authorize(ROLES.ADMIN, ROLES.MANAGER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    const connection = await db.queryOne(
      'SELECT * FROM data_connections WHERE id = $1 AND tenant_id = $2',
      [id, req.user!.tenantId]
    );
    
    if (!connection) {
      throw new NotFoundError('Bağlantı');
    }
    
    // Bu bağlantıya ait dataset var mı kontrol et
    const linkedDatasets = await db.queryOne(
      'SELECT COUNT(*) as count FROM datasets WHERE connection_id = $1',
      [id]
    );
    
    if (parseInt(linkedDatasets.count) > 0) {
      throw new ValidationError(`Bu bağlantıya ait ${linkedDatasets.count} dataset var. Önce datasetleri silin.`);
    }
    
    // SECURITY: Defense-in-depth - tenant_id dahil et
    await db.query('DELETE FROM data_connections WHERE id = $1 AND tenant_id = $2', [id, req.user!.tenantId]);
    
    logger.info('Connection deleted', { connectionId: id, tenantId: req.user!.tenantId });
    res.json({ success: true, message: 'Bağlantı silindi' });
  } catch (error) {
    next(error);
  }
});

// Test NEW connection (before saving)
app.post('/connections/test', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { category, type, host, port, databaseName, username, password, apiBaseUrl, apiAuthType, apiAuthConfig } = req.body;

    if (category === 'database' || type === 'postgresql' || type === 'mssql' || type === 'mysql') {
      // Database bağlantısı test et
      if (type === 'postgresql') {
        const { Client } = require('pg');
        const client = new Client({
          host,
          port: port || 5432,
          database: databaseName,
          user: username,
          password,
          connectionTimeoutMillis: 10000
        });
        
        await client.connect();
        await client.query('SELECT 1');
        await client.end();
        
        res.json({ success: true, data: { message: 'PostgreSQL bağlantısı başarılı!' } });
      } else if (type === 'mssql') {
        // MSSQL test (Azure SQL için encrypt: true gerekli)
        const sql = require('mssql');
        const isAzure = host.includes('.database.windows.net');
        const config = {
          user: username,
          password: password,
          server: host,
          port: port || 1433,
          database: databaseName,
          options: {
            encrypt: isAzure ? true : false,  // Azure SQL için şifreleme zorunlu
            trustServerCertificate: !isAzure   // Azure'da false olmalı
          },
          connectionTimeout: 15000
        };
        
        try {
          const pool = await sql.connect(config);
          await pool.request().query('SELECT 1 as test');
          await pool.close();
          res.json({ success: true, data: { message: 'MSSQL bağlantısı başarılı!' } });
        } catch (mssqlError: any) {
          throw new AppError(`MSSQL bağlantı hatası: ${mssqlError.message}`, 400);
        }
      } else if (type === 'mysql') {
        // MySQL test
        const mysql = require('mysql2/promise');
        const connection = await mysql.createConnection({
          host: host,
          port: port || 3306,
          user: username,
          password: password,
          database: databaseName,
          connectTimeout: 10000,
          charset: 'utf8mb4',
          dateStrings: true,  // Tarihleri string olarak al (YYYY-MM-DD HH:MM:SS)
          timezone: '+03:00'  // Türkiye saat dilimi
        });
        
        await connection.execute('SELECT 1');
        await connection.end();
        
        res.json({ success: true, data: { message: 'MySQL bağlantısı başarılı!' } });
      } else {
        res.json({ success: true, data: { message: 'Bağlantı tipi desteklenmiyor' } });
      }
    } else if (category === 'api' || type === 'api') {
      // API bağlantısı test et
      const url = apiBaseUrl;
      if (!url) {
        throw new ValidationError('API Base URL gerekli');
      }

      const testUrl = url.replace(/\/$/, '');
      
      // SECURITY: SSRF koruması - internal/private adreslere erişimi engelle
      const urlValidation = validateExternalUrl(testUrl);
      if (!urlValidation.valid) {
        throw new ValidationError(`Güvenlik hatası: ${urlValidation.error}`);
      }
      
      logger.info('Testing API connection', { url: testUrl });
      
      // SECURITY: safeFetch kullan (SSRF korumalı)
      const response = await safeFetch(testUrl, {
        method: 'HEAD',
        signal: AbortSignal.timeout(10000)
      }).catch(() => safeFetch(testUrl, { 
        method: 'GET',
        signal: AbortSignal.timeout(10000)
      }));

      if (response.ok || response.status === 401 || response.status === 403) {
        // 401/403 bile olsa sunucu yanıt veriyor demek
        res.json({ success: true, data: { message: `API erişilebilir! (Status: ${response.status})` } });
      } else {
        throw new AppError(`API yanıt vermiyor: ${response.status} ${response.statusText}`, 400);
      }
    } else {
      res.json({ success: true, data: { message: 'Test başarılı' } });
    }
  } catch (error: any) {
    logger.error('Connection test failed', { error: error.message });
    res.status(400).json({ success: false, message: error.message || 'Bağlantı testi başarısız' });
  }
});

// Test EXISTING connection by ID
app.post('/connections/:id/test', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const connection = await db.queryOne(
      'SELECT * FROM data_connections WHERE id = $1 AND tenant_id = $2',
      [id, req.user!.tenantId]
    );

    if (!connection) {
      throw new NotFoundError('Bağlantı');
    }

    let testResult = { success: false, message: '' };

    if (connection.type === 'postgresql') {
      const { Client } = require('pg');
      const client = new Client({
        host: connection.host,
        port: connection.port || 5432,
        database: connection.database_name,
        user: connection.username,
        password: decrypt(connection.password_encrypted),
        connectionTimeoutMillis: 10000,
      });
      
      try {
        await client.connect();
        await client.query('SELECT 1');
        await client.end();
        testResult = { success: true, message: 'PostgreSQL bağlantısı başarılı' };
      } catch (dbError: any) {
        testResult = { success: false, message: `Bağlantı hatası: ${dbError.message}` };
      }
    } else if (connection.type === 'mssql') {
      const sql = require('mssql');
      const isAzure = connection.host.includes('.database.windows.net');
      const config = {
        server: connection.host,
        port: connection.port || 1433,
        database: connection.database_name,
        user: connection.username,
        password: decrypt(connection.password_encrypted),
        options: { encrypt: isAzure, trustServerCertificate: !isAzure },
        connectionTimeout: 15000,
      };
      
      try {
        await sql.connect(config);
        await sql.query('SELECT 1');
        await sql.close();
        testResult = { success: true, message: 'MSSQL bağlantısı başarılı' };
      } catch (dbError: any) {
        testResult = { success: false, message: `Bağlantı hatası: ${dbError.message}` };
      }
    } else if (connection.type === 'mysql') {
      // MySQL test
      const mysql = require('mysql2/promise');
      try {
        const conn = await mysql.createConnection({
          host: connection.host,
          port: connection.port || 3306,
          user: connection.username,
          password: decrypt(connection.password_encrypted),
          database: connection.database_name,
          connectTimeout: 10000,
          charset: 'utf8mb4',
          dateStrings: true,
          timezone: '+03:00'
        });
        await conn.execute('SELECT 1');
        await conn.end();
        testResult = { success: true, message: 'MySQL bağlantısı başarılı' };
      } catch (dbError: any) {
        testResult = { success: false, message: `Bağlantı hatası: ${dbError.message}` };
      }
    } else if (connection.type === 'api') {
      // API test - SECURITY: SSRF korumalı fetch kullan
      try {
        // SSRF koruması - internal/private adreslere erişimi engelle
        const urlValidation = validateExternalUrl(connection.host);
        if (!urlValidation.valid) {
          testResult = { success: false, message: `Güvenlik hatası: ${urlValidation.error}` };
        } else {
          const response = await safeFetch(connection.host, { method: 'HEAD', signal: AbortSignal.timeout(10000) });
          testResult = { success: response.ok, message: response.ok ? 'API erişilebilir' : `API hatası: ${response.status}` };
        }
      } catch (apiError: any) {
        testResult = { success: false, message: `API hatası: ${apiError.message}` };
      }
    } else {
      testResult = { success: false, message: `Desteklenmeyen bağlantı tipi: ${connection.type}` };
    }

    // Status güncelle
    await db.query(
      `UPDATE data_connections SET 
        status = $1, 
        status_message = $2,
        last_tested_at = NOW() 
      WHERE id = $3`,
      [testResult.success ? 'active' : 'error', testResult.message, id]
    );

    res.json({ success: true, data: testResult });
  } catch (error) {
    next(error);
  }
});

// Get tables from source connection
app.get('/connections/:id/tables', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const connection = await db.queryOne(
      'SELECT * FROM data_connections WHERE id = $1 AND tenant_id = $2',
      [id, req.user!.tenantId]
    );

    if (!connection) {
      throw new NotFoundError('Bağlantı');
    }

    let tables: { name: string; schema?: string; rowCount?: number }[] = [];

    if (connection.type === 'postgresql') {
      // PostgreSQL tabloları çek
      const { Client } = require('pg');
      const client = new Client({
        host: connection.host,
        port: connection.port || 5432,
        database: connection.database_name,
        user: connection.username,
        password: decrypt(connection.password_encrypted),
      });
      
      try {
        await client.connect();
        const result = await client.query(`
          SELECT table_name as name, table_schema as schema
          FROM information_schema.tables 
          WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
          ORDER BY table_name
        `);
        tables = result.rows;
        await client.end();
      } catch (dbError: any) {
        logger.error('PostgreSQL connection error', { error: dbError.message });
        throw new AppError(`Veritabanına bağlanılamadı: ${dbError.message}`, 500, 'DB_CONNECTION_ERROR');
      }
    } else if (connection.type === 'mssql') {
      // MSSQL tabloları çek (Azure SQL desteği)
      const sql = require('mssql');
      const isAzure = connection.host.includes('.database.windows.net');
      const config = {
        server: connection.host,
        port: connection.port || 1433,
        database: connection.database_name,
        user: connection.username,
        password: decrypt(connection.password_encrypted),
        options: { encrypt: isAzure, trustServerCertificate: !isAzure }
      };
      
      try {
        await sql.connect(config);
        const result = await sql.query(`
          SELECT TABLE_NAME as name, TABLE_SCHEMA as [schema]
          FROM INFORMATION_SCHEMA.TABLES 
          WHERE TABLE_TYPE = 'BASE TABLE'
          ORDER BY TABLE_NAME
        `);
        tables = result.recordset;
        await sql.close();
      } catch (dbError: any) {
        logger.error('MSSQL connection error', { error: dbError.message });
        throw new AppError(`Veritabanına bağlanılamadı: ${dbError.message}`, 500, 'DB_CONNECTION_ERROR');
      }
    } else if (connection.type === 'mysql') {
      // MySQL tabloları çek
      const mysql = require('mysql2/promise');
      
      try {
        const mysqlConn = await mysql.createConnection({
          host: connection.host,
          port: connection.port || 3306,
          database: connection.database_name,
          user: connection.username,
          password: decrypt(connection.password_encrypted),
          charset: 'utf8mb4'
        });
        
        const [rows] = await mysqlConn.query(`
          SELECT TABLE_NAME as name, TABLE_SCHEMA as \`schema\`
          FROM INFORMATION_SCHEMA.TABLES 
          WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'
          ORDER BY TABLE_NAME
        `, [connection.database_name]);
        
        tables = rows as { name: string; schema: string }[];
        await mysqlConn.end();
      } catch (dbError: any) {
        logger.error('MySQL connection error', { error: dbError.message });
        throw new AppError(`MySQL veritabanına bağlanılamadı: ${dbError.message}`, 500, 'DB_CONNECTION_ERROR');
      }
    } else if (connection.type === 'api') {
      // API bağlantıları için tablo listesi yok, endpoint listesi gösterilebilir
      tables = [{ name: 'api_response', schema: 'default' }];
    } else {
      throw new ValidationError(`Desteklenmeyen bağlantı tipi: ${connection.type}`);
    }

    res.json({ success: true, data: tables });
  } catch (error) {
    next(error);
  }
});

// Get columns from a specific table
app.get('/connections/:id/tables/:tableName/columns', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id, tableName } = req.params;
    const { schema = 'dbo' } = req.query;

    const connection = await db.queryOne(
      'SELECT * FROM data_connections WHERE id = $1 AND tenant_id = $2',
      [id, req.user!.tenantId]
    );

    if (!connection) {
      throw new NotFoundError('Bağlantı');
    }

    let columns: { name: string; type: string; nullable: boolean }[] = [];

    if (connection.type === 'postgresql') {
      const { Client } = require('pg');
      const client = new Client({
        host: connection.host,
        port: connection.port || 5432,
        database: connection.database_name,
        user: connection.username,
        password: decrypt(connection.password_encrypted),
      });
      
      try {
        await client.connect();
        const result = await client.query(`
          SELECT column_name as name, data_type as type, 
                 is_nullable = 'YES' as nullable
          FROM information_schema.columns 
          WHERE table_name = $1 AND table_schema = $2
          ORDER BY ordinal_position
        `, [tableName, schema || 'public']);
        columns = result.rows;
        await client.end();
      } catch (dbError: any) {
        throw new AppError(`Kolon bilgisi alınamadı: ${dbError.message}`, 500, 'DB_ERROR');
      }
    } else if (connection.type === 'mssql') {
      const sql = require('mssql');
      const isAzure = connection.host.includes('.database.windows.net');
      const config = {
        server: connection.host,
        port: connection.port || 1433,
        database: connection.database_name,
        user: connection.username,
        password: decrypt(connection.password_encrypted),
        options: { encrypt: isAzure, trustServerCertificate: !isAzure }
      };
      
      try {
        await sql.connect(config);
        const result = await sql.query`
          SELECT COLUMN_NAME as name, DATA_TYPE as type, 
                 CASE WHEN IS_NULLABLE = 'YES' THEN 1 ELSE 0 END as nullable
          FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_NAME = ${tableName} AND TABLE_SCHEMA = ${schema || 'dbo'}
          ORDER BY ORDINAL_POSITION
        `;
        columns = result.recordset;
        await sql.close();
      } catch (dbError: any) {
        await sql.close().catch(() => {});
        throw new AppError(`Kolon bilgisi alınamadı: ${dbError.message}`, 500, 'DB_ERROR');
      }
    } else if (connection.type === 'mysql') {
      const mysql = require('mysql2/promise');
      
      try {
        const mysqlConn = await mysql.createConnection({
          host: connection.host,
          port: connection.port || 3306,
          database: connection.database_name,
          user: connection.username,
          password: decrypt(connection.password_encrypted),
          charset: 'utf8mb4'
        });
        
        const [rows] = await mysqlConn.query(`
          SELECT COLUMN_NAME as name, DATA_TYPE as type, 
                 IS_NULLABLE = 'YES' as nullable
          FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_NAME = ? AND TABLE_SCHEMA = ?
          ORDER BY ORDINAL_POSITION
        `, [tableName, connection.database_name]);
        
        columns = rows as any[];
        await mysqlConn.end();
      } catch (dbError: any) {
        throw new AppError(`Kolon bilgisi alınamadı: ${dbError.message}`, 500, 'DB_ERROR');
      }
    } else {
      throw new ValidationError(`Bu bağlantı tipi için kolon listesi desteklenmiyor: ${connection.type}`);
    }

    res.json({ success: true, data: columns });
  } catch (error) {
    next(error);
  }
});

// Run SQL query on source connection
app.post('/connections/:id/query', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { sql, limit = 100 } = req.body;

    if (!sql) {
      throw new ValidationError('SQL sorgusu gerekli');
    }

    const connection = await db.queryOne(
      'SELECT * FROM data_connections WHERE id = $1 AND tenant_id = $2',
      [id, req.user!.tenantId]
    );

    if (!connection) {
      throw new NotFoundError('Bağlantı');
    }

    let rows: any[] = [];
    let columns: { name: string; type: string }[] = [];
    const startTime = Date.now();

    // Güvenlik: Sadece SELECT
    const trimmedSql = sql.trim().toUpperCase();
    if (!trimmedSql.startsWith('SELECT')) {
      throw new ValidationError('Sadece SELECT sorguları çalıştırılabilir');
    }

    // Limit handling - DB tipine göre farklı syntax
    let finalSql = sql.trim();
    const maxRows = Math.min(limit, 1000);

    if (connection.type === 'postgresql') {
      const { Client } = require('pg');
      const client = new Client({
        host: connection.host,
        port: connection.port || 5432,
        database: connection.database_name,
        user: connection.username,
        password: decrypt(connection.password_encrypted),
      });
      
      // PostgreSQL: LIMIT ekle
      let pgSql = finalSql;
      if (!trimmedSql.includes('LIMIT')) {
        pgSql += ` LIMIT ${maxRows}`;
      }
      
      try {
        await client.connect();
        const result = await client.query(pgSql);
        
        // Date objelerini PostgreSQL formatına çevir
        const formatPgDate = (date: Date): string => {
          const pad = (n: number, len = 2) => n.toString().padStart(len, '0');
          const year = date.getFullYear();
          const month = pad(date.getMonth() + 1);
          const day = pad(date.getDate());
          const hours = pad(date.getHours());
          const minutes = pad(date.getMinutes());
          const seconds = pad(date.getSeconds());
          const ms = pad(date.getMilliseconds(), 3);
          return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${ms}`;
        };
        
        rows = result.rows.map((row: any) => {
          const newRow: any = {};
          for (const key in row) {
            if (row[key] instanceof Date) {
              newRow[key] = formatPgDate(row[key]);
            } else {
              newRow[key] = row[key];
            }
          }
          return newRow;
        });
        
        // PostgreSQL OID → Tip adı mapping
        const pgTypeMap: Record<number, string> = {
          16: 'boolean', 17: 'bytea', 18: 'char', 19: 'name', 20: 'int8', 21: 'int2',
          23: 'int4', 24: 'regproc', 25: 'text', 26: 'oid', 700: 'float4', 701: 'float8',
          702: 'abstime', 703: 'reltime', 704: 'tinterval', 718: 'circle', 790: 'money',
          829: 'macaddr', 869: 'inet', 650: 'cidr', 1000: 'bool[]', 1005: 'int2[]',
          1007: 'int4[]', 1016: 'int8[]', 1021: 'float4[]', 1022: 'float8[]', 1042: 'bpchar',
          1043: 'varchar', 1082: 'date', 1083: 'time', 1114: 'timestamp', 1184: 'timestamptz',
          1186: 'interval', 1266: 'timetz', 1560: 'bit', 1562: 'varbit', 1700: 'numeric',
          2249: 'record', 2278: 'void', 2950: 'uuid', 3802: 'jsonb', 114: 'json'
        };
        
        columns = result.fields?.map((f: any) => {
          const oid = f.dataTypeID;
          const typeName = pgTypeMap[oid] || `pg_type_${oid}`;
          return { name: f.name, type: typeName };
        }) || [];
        await client.end();
      } catch (dbError: any) {
        throw new AppError(`Sorgu hatası: ${dbError.message}`, 500, 'QUERY_ERROR');
      }
    } else if (connection.type === 'mssql') {
      const mssql = require('mssql');
      const isAzure = connection.host.includes('.database.windows.net');
      const config = {
        server: connection.host,
        port: connection.port || 1433,
        database: connection.database_name,
        user: connection.username,
        password: decrypt(connection.password_encrypted),
        options: { encrypt: isAzure, trustServerCertificate: !isAzure }
      };
      
      // MSSQL: TOP kullan (LIMIT yok!)
      let mssqlSql = finalSql;
      if (!trimmedSql.includes('TOP ') && !trimmedSql.includes('TOP(')) {
        // SELECT'ten sonra TOP ekle
        mssqlSql = finalSql.replace(/^SELECT\s+/i, `SELECT TOP ${maxRows} `);
      }
      
      try {
        await mssql.connect(config);
        const result = await mssql.query(mssqlSql);
        
        // Date objelerini SQL Server formatına çevir (ISO 'T' yerine ' ')
        const formatSqlServerDate = (date: Date): string => {
          const pad = (n: number, len = 2) => n.toString().padStart(len, '0');
          const year = date.getFullYear();
          const month = pad(date.getMonth() + 1);
          const day = pad(date.getDate());
          const hours = pad(date.getHours());
          const minutes = pad(date.getMinutes());
          const seconds = pad(date.getSeconds());
          const ms = pad(date.getMilliseconds(), 3);
          return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${ms}0000`;
        };
        
        rows = (result.recordset || []).map((row: any) => {
          const newRow: any = {};
          for (const key in row) {
            if (row[key] instanceof Date) {
              newRow[key] = formatSqlServerDate(row[key]);
            } else {
              newRow[key] = row[key];
            }
          }
          return newRow;
        });
        
        // MSSQL kolon metadata'sından tip bilgisi al
        // result.recordset.columns içinde kolon bilgileri var
        const columnMeta = result.recordset?.columns || {};
        columns = Object.keys(columnMeta).map(colName => {
          const colInfo = columnMeta[colName];
          // MSSQL type mapping
          const mssqlTypeMap: Record<number, string> = {
            // Numeric types
            48: 'tinyint', 52: 'smallint', 56: 'int', 127: 'bigint',
            59: 'real', 62: 'float', 106: 'decimal', 108: 'numeric', 60: 'money',
            // String types
            167: 'varchar', 175: 'char', 231: 'nvarchar', 239: 'nchar', 35: 'text', 99: 'ntext',
            // Date/Time types
            40: 'date', 41: 'time', 42: 'datetime2', 43: 'datetimeoffset',
            58: 'smalldatetime', 61: 'datetime',
            // Other
            36: 'uniqueidentifier', 104: 'bit', 165: 'varbinary', 173: 'binary', 34: 'image'
          };
          const typeId = colInfo?.type?.id || colInfo?.type;
          const typeName = mssqlTypeMap[typeId] || colInfo?.type?.name || 'varchar';
          return { name: colName, type: typeName };
        });
        
        // Fallback: Eğer columns boşsa, Object.keys'den al
        if (columns.length === 0 && rows.length > 0) {
          columns = Object.keys(rows[0]).map(k => ({ name: k, type: 'varchar' }));
        }
        
        await mssql.close();
      } catch (dbError: any) {
        await mssql.close().catch(() => {});
        throw new AppError(`Sorgu hatası: ${dbError.message}`, 500, 'QUERY_ERROR');
      }
    } else if (connection.type === 'mysql') {
      const mysql = require('mysql2/promise');
      
      // MySQL: LIMIT ekle
      let mysqlSql = finalSql;
      if (!trimmedSql.includes('LIMIT')) {
        mysqlSql += ` LIMIT ${maxRows}`;
      }
      
      try {
        const mysqlConn = await mysql.createConnection({
          host: connection.host,
          port: connection.port || 3306,
          database: connection.database_name,
          user: connection.username,
          password: decrypt(connection.password_encrypted),
          charset: 'utf8mb4',
          dateStrings: true
        });
        
        const [queryRows, fields] = await mysqlConn.query(mysqlSql);
        rows = queryRows as any[];
        
        // MySQL Type ID → Tip adı mapping
        const mysqlTypeMap: Record<number, string> = {
          0: 'decimal', 1: 'tinyint', 2: 'smallint', 3: 'int', 4: 'float', 5: 'double',
          6: 'null', 7: 'timestamp', 8: 'bigint', 9: 'mediumint', 10: 'date', 11: 'time',
          12: 'datetime', 13: 'year', 14: 'newdate', 15: 'varchar', 16: 'bit',
          245: 'json', 246: 'newdecimal', 247: 'enum', 248: 'set', 249: 'tinyblob',
          250: 'mediumblob', 251: 'longblob', 252: 'blob', 253: 'varchar', 254: 'char',
          255: 'geometry'
        };
        
        columns = (fields as any[])?.map((f: any) => {
          const typeId = f.type || f.columnType;
          const typeName = mysqlTypeMap[typeId] || f.typeName || `mysql_type_${typeId}`;
          return { name: f.name, type: typeName };
        }) || [];
        await mysqlConn.end();
      } catch (dbError: any) {
        throw new AppError(`Sorgu hatası: ${dbError.message}`, 500, 'QUERY_ERROR');
      }
    } else {
      throw new ValidationError(`Bu bağlantı tipi için SQL sorgusu desteklenmiyor: ${connection.type}`);
    }

    const executionTime = Date.now() - startTime;

    res.json({ 
      success: true, 
      data: { 
        rows, 
        columns,
        rowCount: rows.length,
        executionTime 
      }
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// ETL routes moved to routes/etl.routes.ts
// - GET /etl/status
// - POST /etl/trigger-all
// - ETL Worker endpoints in routes/etl-worker.routes.ts

// Get ETL schedules
app.get('/schedules', authenticate, tenantIsolation, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schedules = await db.queryAll(
      `SELECT s.*, d.name as dataset_name 
       FROM etl_schedules s
       LEFT JOIN datasets d ON s.dataset_id = d.id
       WHERE s.tenant_id = $1
       ORDER BY s.created_at DESC`,
      [req.user!.tenantId]
    );
    res.json({ success: true, data: schedules });
  } catch (error) {
    next(error);
  }
});

// Update schedule
app.put('/schedules/:id', authenticate, authorize(ROLES.ADMIN, ROLES.MANAGER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { isActive, cronExpression, interval } = req.body;

    // Önce schedule'ın var olduğunu ve tenant'a ait olduğunu kontrol et
    const schedule = await db.queryOne(
      'SELECT s.*, d.tenant_id FROM etl_schedules s JOIN datasets d ON s.dataset_id = d.id WHERE s.id = $1',
      [id]
    );

    if (!schedule) {
      throw new NotFoundError('Schedule');
    }

    if (schedule.tenant_id !== req.user!.tenantId) {
      throw new AppError('Yetkisiz erişim', 403, 'FORBIDDEN');
    }

    // SECURITY: Defense-in-depth - tenant_id dahil et
    await db.query(`
      UPDATE etl_schedules SET
        is_active = COALESCE($1, is_active),
        cron_expression = COALESCE($2, cron_expression),
        updated_at = NOW()
      WHERE id = $3 AND tenant_id = $4
    `, [isActive, cronExpression || interval, id, req.user!.tenantId]);

    logger.info('Schedule updated', { scheduleId: id, isActive, tenantId: req.user!.tenantId });

    res.json({ success: true, message: 'Schedule güncellendi' });
  } catch (error) {
    next(error);
  }
});

// Update dataset schedule
app.put('/datasets/:id/schedule', authenticate, authorize(ROLES.ADMIN, ROLES.MANAGER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { interval, isActive } = req.body;

    // Dataset kontrolü
    const dataset = await db.queryOne(
      'SELECT * FROM datasets WHERE id = $1 AND tenant_id = $2',
      [id, req.user!.tenantId]
    );

    if (!dataset) {
      throw new NotFoundError('Dataset');
    }

    // Mevcut schedule var mı?
    const existingSchedule = await db.queryOne(
      'SELECT * FROM etl_schedules WHERE dataset_id = $1',
      [id]
    );

    if (existingSchedule) {
      // SECURITY: Defense-in-depth - tenant_id dahil et
      await db.query(`
        UPDATE etl_schedules SET
          cron_expression = COALESCE($1, cron_expression),
          is_active = COALESCE($2, is_active),
          updated_at = NOW()
        WHERE dataset_id = $3 AND tenant_id = $4
      `, [interval, isActive, id, req.user!.tenantId]);
    } else if (interval) {
      // Yeni oluştur
      await db.query(`
        INSERT INTO etl_schedules (tenant_id, dataset_id, cron_expression, is_active)
        VALUES ($1, $2, $3, COALESCE($4, true))
      `, [req.user!.tenantId, id, interval, isActive]);
    }

    // SECURITY: Defense-in-depth - tenant_id dahil et
    await db.query(
      'UPDATE datasets SET sync_schedule = $1 WHERE id = $2 AND tenant_id = $3',
      [interval, id, req.user!.tenantId]
    );

    res.json({ success: true, message: 'Schedule güncellendi' });
  } catch (error) {
    next(error);
  }
});

// API Preview - Moved to routes/api-preview.routes.ts

// ClickHouse dataset aggregates - TÜM dataset için toplamlar (footer için)
app.get('/datasets/:id/aggregates', authenticate, tenantIsolation, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    // columns parametresi: virgülle ayrılmış kolon adları ve aggregation tipleri
    // Örnek: columns=ToplamTutar:sum,Adet:sum,BirimFiyat:avg
    const columnsParam = req.query.columns as string;

    const dataset = await db.queryOne(
      'SELECT * FROM datasets WHERE id = $1 AND tenant_id = $2',
      [id, req.user!.tenantId]
    );

    if (!dataset) {
      throw new NotFoundError('Dataset');
    }

    if (!dataset.clickhouse_table) {
      throw new ValidationError('Dataset henüz ClickHouse tablosu oluşturulmamış');
    }
    
    // SQL Injection koruması - tablo adını sanitize et
    const safeTable = sanitizeTableName(dataset.clickhouse_table);

    // Aggregate sorgusunu oluştur
    const aggregates: Record<string, { sum?: number; avg?: number; count?: number; min?: number; max?: number }> = {};
    
    if (columnsParam) {
      // Kullanıcının belirttiği kolonları hesapla
      const columnDefs = columnsParam.split(',').map(c => {
        const [colName, aggType] = c.split(':');
        return { column: colName.trim(), aggregation: aggType?.trim() || 'sum' };
      });

      // Her kolon için aggregate hesapla
      const selectParts: string[] = ['count() as _total_count'];
      columnDefs.forEach(({ column, aggregation }) => {
        const safeCol = column.replace(/[^a-zA-Z0-9_]/g, ''); // SQL injection koruması
        switch (aggregation) {
          case 'sum':
            selectParts.push(`sum(${safeCol}) as ${safeCol}_sum`);
            break;
          case 'avg':
            selectParts.push(`avg(${safeCol}) as ${safeCol}_avg`);
            break;
          case 'count':
            selectParts.push(`count(${safeCol}) as ${safeCol}_count`);
            break;
          case 'min':
            selectParts.push(`min(${safeCol}) as ${safeCol}_min`);
            break;
          case 'max':
            selectParts.push(`max(${safeCol}) as ${safeCol}_max`);
            break;
        }
      });

      // Tarih filtresi parametreleri
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      const dateColumnParam = req.query.dateColumn as string;
      
      let sql = `SELECT ${selectParts.join(', ')} FROM clixer_analytics.${safeTable}`;
      
      // Tarih filtresi ekle
      if (startDate && endDate && dateColumnParam) {
        // Güvenlik kontrolü
        if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(dateColumnParam) && /^\d{4}-\d{2}-\d{2}$/.test(startDate) && /^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
          sql += ` WHERE toDate(${dateColumnParam}) >= '${startDate}' AND toDate(${dateColumnParam}) <= '${endDate}'`;
        }
      }
      
      const result = await clickhouse.query(sql);
      
      let totalCount = 0;
      if (result.length > 0) {
        const row = result[0];
        totalCount = Number(row._total_count) || 0;
        columnDefs.forEach(({ column, aggregation }) => {
          const safeCol = column.replace(/[^a-zA-Z0-9_]/g, '');
          if (!aggregates[column]) aggregates[column] = {};
          aggregates[column][aggregation as keyof typeof aggregates[typeof column]] = Number(row[`${safeCol}_${aggregation}`]) || 0;
        });
      }

      res.json({ 
        success: true, 
        data: {
          datasetId: id,
          tableName: safeTable,
          totalCount,
          aggregates
        }
      });
    } else {
      // Kolon belirtilmemişse sadece count dön
      const countResult = await clickhouse.query(`SELECT count() as cnt FROM clixer_analytics.${safeTable}`);
      const totalCount = Number(countResult[0]?.cnt) || 0;

      res.json({ 
        success: true, 
        data: {
          datasetId: id,
          tableName: safeTable,
          totalCount,
          aggregates
        }
      });
    }
  } catch (error) {
    next(error);
  }
});

// ClickHouse dataset preview
app.get('/datasets/:id/preview', authenticate, tenantIsolation, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit as string) || 100;
    const orderByParam = req.query.orderBy as string || ''; // İsteğe bağlı sıralama
    const sortOrder = req.query.sortOrder as string || 'DESC'; // Varsayılan DESC (en yeni önce)

    const dataset = await db.queryOne(
      'SELECT * FROM datasets WHERE id = $1 AND tenant_id = $2',
      [id, req.user!.tenantId]
    );

    if (!dataset) {
      throw new NotFoundError('Dataset');
    }

    if (!dataset.clickhouse_table) {
      throw new ValidationError('Dataset henüz ClickHouse tablosu oluşturulmamış');
    }
    
    // SQL Injection koruması
    const safeTable = sanitizeTableName(dataset.clickhouse_table);

    // ORDER BY kolon belirleme (tarih kolonu öncelikli)
    let orderByColumn = '';
    
    // 1. Query parameter'dan gelen sıralama
    if (orderByParam) {
      // Güvenlik: Sadece alfanumerik ve underscore kabul et
      if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(orderByParam)) {
        orderByColumn = orderByParam;
      }
    }
    
    // 2. Dataset'in tarih kolonunu kullan (partition_column veya reference_column)
    if (!orderByColumn) {
      if (dataset.partition_column && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(dataset.partition_column)) {
        orderByColumn = dataset.partition_column;
      } else if (dataset.reference_column && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(dataset.reference_column)) {
        orderByColumn = dataset.reference_column;
      }
    }
    
    // 3. Yaygın tarih kolon isimlerini dene (tablo yapısından)
    if (!orderByColumn) {
      try {
        const columnsResult = await clickhouse.query(
          `SELECT name, type FROM system.columns WHERE database = 'clixer_analytics' AND table = '${safeTable}'`
        );
        
        // Tarih/DateTime tipindeki kolonları bul
        const dateColumns = columnsResult.filter((col: any) => 
          col.type.includes('Date') || col.type.includes('DateTime')
        );
        
        if (dateColumns.length > 0) {
          // Yaygın tarih kolon isimleri öncelikli
          const priorityNames = ['ReportDay', 'report_day', 'date', 'tarih', 'created_at', 'transaction_date', '_synced_at'];
          for (const name of priorityNames) {
            const found = dateColumns.find((col: any) => col.name.toLowerCase() === name.toLowerCase());
            if (found) {
              orderByColumn = found.name;
              break;
            }
          }
          // Bulunamadıysa ilk tarih kolonunu kullan
          if (!orderByColumn && dateColumns.length > 0) {
            orderByColumn = dateColumns[0].name;
          }
        }
      } catch (e) {
        // Kolon sorgusu başarısız olursa devam et
      }
    }

    // Tarih filtresi parametreleri
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    const dateColumnParam = req.query.dateColumn as string;
    
    // ClickHouse'dan veri çek - ORDER BY ile (en yeni veriler önce)
    const startTime = Date.now();
    const maxLimit = Math.min(limit, 10000); // Max 10K satır
    const validSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    
    let sql = `SELECT * FROM clixer_analytics.${safeTable}`;
    
    // Tarih filtresi ekle
    const whereConditions: string[] = [];
    if (startDate && endDate && dateColumnParam) {
      // Güvenlik kontrolü
      if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(dateColumnParam) && /^\d{4}-\d{2}-\d{2}$/.test(startDate) && /^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
        whereConditions.push(`toDate(${dateColumnParam}) >= '${startDate}' AND toDate(${dateColumnParam}) <= '${endDate}'`);
      }
    }
    
    if (whereConditions.length > 0) {
      sql += ` WHERE ${whereConditions.join(' AND ')}`;
    }
    
    if (orderByColumn) {
      sql += ` ORDER BY ${orderByColumn} ${validSortOrder}`;
    }
    sql += ` LIMIT ${maxLimit}`;
    
    const rows = await clickhouse.query(sql);
    const executionTime = Date.now() - startTime;

    // Kolon bilgilerini al
    const columns = rows.length > 0 
      ? Object.keys(rows[0]).map(name => ({ name, type: typeof rows[0][name] }))
      : [];

    // Toplam satır sayısı (tarih filtresi dahil)
    let countSql = `SELECT count() as cnt FROM clixer_analytics.${safeTable}`;
    if (whereConditions.length > 0) {
      countSql += ` WHERE ${whereConditions.join(' AND ')}`;
    }
    const countResult = await clickhouse.query(countSql);
    const totalRows = countResult[0]?.cnt || 0;

    res.json({ 
      success: true, 
      data: { 
        rows,
        columns,
        rowCount: rows.length,
        totalRows,
        executionTime
      }
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// DATASET EXPORT - Büyük Veri Export
// ============================================

// Excel export için dataset verisi çekme (pagination ile)
app.get('/datasets/:id/export', authenticate, tenantIsolation, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit as string) || 100000; // Varsayılan 100K
    const offset = parseInt(req.query.offset as string) || 0;
    const orderBy = req.query.orderBy as string || '';
    const sortOrder = req.query.sortOrder as string || 'ASC';

    const dataset = await db.queryOne(
      'SELECT * FROM datasets WHERE id = $1 AND tenant_id = $2',
      [id, req.user!.tenantId]
    );

    if (!dataset) {
      throw new NotFoundError('Dataset');
    }

    if (!dataset.clickhouse_table) {
      throw new ValidationError('Dataset henüz ClickHouse tablosu oluşturulmamış');
    }
    
    // SQL Injection koruması
    const safeTable = sanitizeTableName(dataset.clickhouse_table);

    // Sıralama
    let orderClause = '';
    if (orderBy) {
      const safeOrderBy = orderBy.replace(/[^a-zA-Z0-9_]/g, ''); // SQL injection önleme
      orderClause = ` ORDER BY ${safeOrderBy} ${sortOrder === 'DESC' ? 'DESC' : 'ASC'}`;
    }

    // Veri çek - LIMIT ve OFFSET ile
    const sql = `SELECT * FROM clixer_analytics.${safeTable}${orderClause} LIMIT ${limit} OFFSET ${offset}`;
    const rows = await clickhouse.query(sql);

    // Toplam satır sayısı
    const countResult = await clickhouse.query(`SELECT count() as cnt FROM clixer_analytics.${safeTable}`);
    const totalRows = countResult[0]?.cnt || 0;

    res.json({ 
      success: true, 
      data: { 
        rows,
        rowCount: rows.length,
        totalRows,
        offset,
        limit,
        hasMore: offset + rows.length < totalRows
      }
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// DATASETS
// ============================================

app.get('/datasets', authenticate, tenantIsolation, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const datasets = await db.queryAll(
      `SELECT d.*, c.name as connection_name, c.type as connection_type
       FROM datasets d
       LEFT JOIN data_connections c ON d.connection_id = c.id
       WHERE d.tenant_id = $1
       ORDER BY d.created_at DESC`,
      [req.user!.tenantId]
    );
    res.json({ success: true, data: datasets });
  } catch (error) {
    next(error);
  }
});

app.post('/datasets', authenticate, authorize(ROLES.ADMIN, ROLES.MANAGER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      name,
      connectionId,
      sourceTable,
      sourceQuery, // API bağlantıları için
      columnMapping,
      syncStrategy,
      syncSchedule,
      scheduledHour, // Günlük schedule için saat seçimi
      referenceColumn,
      rowLimit,
      // Yeni partition ve refresh ayarları
      partitionColumn,
      partitionType,
      refreshWindowDays,
      archiveAfterDays,
      detectModified,
      modifiedColumn,
      weeklyFullRefresh,
      engineType,
      customWhere,  // Full Refresh için opsiyonel WHERE koşulu
      // RLS (Row-Level Security) kolonları
      storeColumn,   // Mağaza seviyesi filtre kolonu
      regionColumn,  // Bölge seviyesi filtre kolonu
      groupColumn    // Grup seviyesi filtre kolonu (franchise/merkez)
    } = req.body;

    if (!name || !connectionId) {
      throw new ValidationError('Dataset adı ve bağlantı gerekli');
    }

    if (!sourceTable && !sourceQuery) {
      throw new ValidationError('Kaynak tablo veya sorgu gerekli');
    }

    // ============================================
    // AKILLI KOLON TİP DÖNÜŞÜMÜ
    // ============================================
    const normalizedMapping = (columnMapping || []).map((col: any) => {
      const colName = col.source || col.sourceName;
      const targetName = (col.target || col.targetName || col.source).replace(/[^a-zA-Z0-9_]/g, '_');
      const sqlType = col.sqlType || col.dataType || col.sourceType || col.type || ''; // Kaynak DB'den gelen tip
      
      // 1. Önce kaynak DB tipinden dönüştür
      let chType = col.clickhouseType;
      
      if (!chType || chType === 'String') {
        // SQL tipinden dönüştür
        if (sqlType) {
          chType = sqlToClickHouseType(sqlType);
        }
        // Kolon adından tahmin et
        else if (isDateTimeColumn(colName)) {
          chType = 'DateTime';
        }
        else if (isNumericColumn(colName)) {
          chType = 'Float64';
        }
        // UI'dan gelen type'a bak
        else if (col.type === 'number' || col.type === 'integer' || col.type === 'float') {
          chType = 'Float64';
        }
        else if (col.type === 'date' || col.type === 'datetime' || col.type === 'timestamp') {
          chType = 'DateTime';
        }
        else {
          chType = 'String';
        }
      }
      
      // 2. Partition kolonu özel işlem - Date veya DateTime olmalı
      if (partitionColumn && (colName === partitionColumn || targetName === partitionColumn)) {
        // Partition için Date daha performanslı
        chType = 'Date';
      }
      
      // 3. ID kolonları - SADECE sqlType yoksa veya UUID/GUID ise String yap
      // Integer ID'ler (int, bigint) korunmalı!
      if (targetName.toLowerCase() === 'id' && !colName.toLowerCase().includes('_id')) {
        // Eğer sqlType'dan Int olarak belirlenmişse, değiştirme!
        if (chType.startsWith('Int')) {
          // Int32, Int64 olarak kalsın - doğru tip
          logger.info('ID column keeping integer type from source', { column: targetName, type: chType });
        } else if (!sqlType || sqlType.toLowerCase().includes('uuid') || sqlType.toLowerCase().includes('uniqueidentifier')) {
          // UUID/GUID ise String yap
          chType = 'String';
        }
        // Diğer durumlarda mevcut tip korunsun
      }
      
      return {
        source: colName,
        target: targetName,
        type: col.type || 'string',
        sqlType: sqlType,
        clickhouseType: chType
      };
    });
    
    logger.info('Column mapping normalized', { 
      columns: normalizedMapping.map((c: any) => `${c.source}:${c.clickhouseType}`)
    });

    // Dataset oluştur (yeni kolonlarla + RLS kolonları)
    const { deleteDays } = req.body;
    const result = await db.queryOne(
      `INSERT INTO datasets (
        tenant_id, name, connection_id, source_table, source_query, 
        column_mapping, sync_strategy, sync_schedule, reference_column, row_limit, status,
        partition_column, partition_type, refresh_window_days, archive_after_days,
        detect_modified, modified_column, weekly_full_refresh, engine_type, custom_where, delete_days,
        store_column, region_column, group_column
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending', $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
       RETURNING id`,
      [
        req.user!.tenantId, name, connectionId, sourceTable || null, sourceQuery || null, 
        JSON.stringify(normalizedMapping), syncStrategy || 'full_refresh', syncSchedule, referenceColumn, rowLimit || 100000,
        partitionColumn || null,
        partitionType || 'monthly',
        refreshWindowDays || 0,
        archiveAfterDays || 0,
        detectModified || false,
        modifiedColumn || null,
        weeklyFullRefresh || false,
        engineType || 'MergeTree',
        customWhere || null,  // Full Refresh için WHERE koşulu
        deleteDays ?? null,   // Tarih Bazlı Sil-Yaz için
        storeColumn || null,  // RLS: Mağaza kolonu
        regionColumn || null, // RLS: Bölge kolonu
        groupColumn || null   // RLS: Grup kolonu
      ]
    );

    // ============================================
    // CLICKHOUSE TABLO OLUŞTURMA
    // KRİTİK KURALLAR:
    // 1. ReplacingMergeTree varsayılan (duplicate önleme)
    // 2. Partition kolonu Date tipinde olmalı
    // 3. ORDER BY'da unique key (uniqueColumn) ZORUNLU!
    // ============================================
    const tableName = `ds_${result.id.replace(/-/g, '_')}`;
    const columns = normalizedMapping.map((col: any) => `${col.target} ${col.clickhouseType}`).join(',\n        ');
    
    // Unique Kolon (ORDER BY için ZORUNLU!) - Frontend'den gelen veya otomatik algılanan
    const { uniqueColumn } = req.body;
    let orderByColumn: string | null = null;
    
    // 1. Frontend'den gelen uniqueColumn
    if (uniqueColumn) {
      const uniqueCol = normalizedMapping.find((col: any) => 
        col.source === uniqueColumn || col.target === uniqueColumn
      );
      if (uniqueCol) {
        orderByColumn = uniqueCol.target;
        logger.info('Using user-selected unique column for ORDER BY', { column: orderByColumn });
      }
    }
    
    // 2. Fallback: id, code, uuid, pk ara
    if (!orderByColumn) {
      const uniqueCandidates = ['id', 'code', 'uuid', 'pk', 'primary_key', '_id'];
      for (const candidate of uniqueCandidates) {
        const found = normalizedMapping.find((col: any) => 
          col.target.toLowerCase() === candidate || col.source.toLowerCase() === candidate
        );
        if (found) {
          orderByColumn = found.target;
          logger.info('Auto-detected unique column for ORDER BY', { column: orderByColumn });
          break;
        }
      }
    }
    
    // 3. Unique kolon bulunamadı - VIEW'lar için composite ORDER BY kullan
    // KRİTİK: Tarih kolonu (partitionColumn, referenceColumn) MUTLAKA dahil edilmeli!
    // Aksi halde ReplacingMergeTree farklı tarihleri merge eder (1M satır → 3500 satır!)
    if (!orderByColumn) {
      // View veya aggregate sorgularda unique kolon olmayabilir
      // Önce tarih/partition kolonu ara - bu ZORUNLU!
      let dateColumn: string | null = null;
      
      // partitionColumn varsa onu kullan
      if (partitionColumn) {
        const partCol = normalizedMapping.find((col: any) => 
          col.source === partitionColumn || col.target === partitionColumn
        );
        if (partCol) dateColumn = partCol.target;
      }
      
      // referenceColumn varsa onu kullan
      if (!dateColumn && referenceColumn) {
        const refCol = normalizedMapping.find((col: any) => 
          col.source === referenceColumn || col.target === referenceColumn
        );
        if (refCol) dateColumn = refCol.target;
      }
      
      // Date/DateTime tipi kolon ara
      if (!dateColumn) {
        const dateCol = normalizedMapping.find((col: any) => 
          col.clickhouseType === 'Date' || col.clickhouseType === 'DateTime'
        );
        if (dateCol) dateColumn = dateCol.target;
      }
      
      // Tüm kolonları al (tarih kolonu hariç, onu en başa koyacağız)
      const allColumns = normalizedMapping
        .filter((col: any) => col.target !== dateColumn)
        .slice(0, 4)
        .map((col: any) => col.target);
      
      // Tarih kolonu varsa EN BAŞA ekle - bu kritik!
      if (dateColumn) {
        orderByColumn = [dateColumn, ...allColumns].join(', ');
        logger.warn('No unique column found - using DATE + composite ORDER BY for VIEW', { 
          dateColumn,
          columns: orderByColumn,
          note: 'Date column added to ORDER BY to prevent merge across dates'
        });
      } else {
        orderByColumn = allColumns.length > 0 ? allColumns.join(', ') : '_synced_at';
        logger.warn('No unique or date column found - using composite ORDER BY for VIEW', { 
          columns: orderByColumn,
          note: 'ID-Based sync will not work, use Full Refresh or Timestamp-Based'
        });
      }
    }
    
    // Engine seçimi - VARSAYILAN: ReplacingMergeTree (duplicate önleme!)
    const selectedEngine = engineType || 'ReplacingMergeTree';
    let engineClause = '';
    if (selectedEngine === 'ReplacingMergeTree' || selectedEngine === 'MergeTree') {
      // ReplacingMergeTree duplicate'ları önler - _synced_at en yeni olan kalır
      engineClause = 'ENGINE = ReplacingMergeTree(_synced_at)';
    } else {
      engineClause = `ENGINE = ${selectedEngine}()`;
    }
    
    // Partition clause - SADECE Date/DateTime kolonlarında çalışır
    let partitionClause = '';
    if (partitionColumn) {
      const partitionCol = normalizedMapping.find((col: any) => 
        col.source === partitionColumn || col.target === partitionColumn
      );
      
      if (partitionCol) {
        const partitionFunc = partitionType === 'daily' ? 'toYYYYMMDD' : 'toYYYYMM';
        
        // Tip kontrolü
        if (partitionCol.clickhouseType === 'Date') {
          partitionClause = `PARTITION BY ${partitionFunc}(${partitionCol.target})`;
        } else if (partitionCol.clickhouseType === 'DateTime') {
          partitionClause = `PARTITION BY ${partitionFunc}(toDate(${partitionCol.target}))`;
        } else {
          // String ise parseDateTime ile dönüştür
          logger.warn('Partition column is not Date/DateTime, will try conversion', { 
            column: partitionCol.target, 
            type: partitionCol.clickhouseType 
          });
          partitionClause = `PARTITION BY ${partitionFunc}(toDateOrNull(${partitionCol.target}))`;
        }
      }
    }
    
    // ORDER BY - Kritik: Unique key veya Date + composite ZORUNLU!
    // KRİTİK: partitionColumn VEYA referenceColumn varsa MUTLAKA ORDER BY'da olmalı!
    // Aksi halde ReplacingMergeTree farklı tarihleri merge eder!
    let orderByColumns: string;
    
    // orderByColumn zaten tarih içeriyorsa (composite durumunda) direkt kullan
    const orderByParts = orderByColumn!.split(',').map(s => s.trim());
    const hasDateInOrderBy = partitionColumn && orderByParts.includes(partitionColumn);
    
    if (partitionColumn && !hasDateInOrderBy) {
      // Partition kolonu ORDER BY'da yok, ekle!
      orderByColumns = `${partitionColumn}, ${orderByColumn}`;
      logger.info('Adding partition column to ORDER BY', { partitionColumn, orderByColumns });
    } else {
      orderByColumns = orderByColumn!;
    }
    
    logger.info('ORDER BY columns', { orderByColumns });

    const createTableSql = `
      CREATE TABLE IF NOT EXISTS clixer_analytics.${tableName} (
        ${columns},
        _synced_at DateTime DEFAULT now()
      )
      ${engineClause}
      ${partitionClause}
      ORDER BY (${orderByColumns})
    `;

    logger.info('Creating ClickHouse table', { tableName, engine: selectedEngine, partition: partitionColumn });
    await clickhouse.execute(createTableSql);

    // SECURITY: Defense-in-depth - tenant_id dahil et
    await db.query(
      "UPDATE datasets SET clickhouse_table = $1, status = 'active' WHERE id = $2 AND tenant_id = $3",
      [tableName, result.id, req.user!.tenantId]
    );

    logger.info('Dataset created', { datasetId: result.id, name, tableName });

    // ✅ INITIAL_SYNC - Test verisi yaz (LIMIT korunarak!)
    // Dataset oluşturulduğunda:
    // 1. ClickHouse tablosu oluşturulur ✅
    // 2. initial_sync tetiklenir → LIMIT 10 ile sadece test verisi yazılır
    // 3. Bu sayede ID-Based/Time-Based sync için referans noktası olur
    // 4. Kullanıcı "Sync" butonuna basınca → LIMIT kaldırılır, TÜM veri çekilir
    await cache.publish('etl:trigger', { datasetId: result.id, action: 'initial_sync' });

    res.json({ success: true, data: { id: result.id, tableName } });
  } catch (error) {
    next(error);
  }
});

// Get single dataset
app.get('/datasets/:id', authenticate, tenantIsolation, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const dataset = await db.queryOne(
      `SELECT d.*, c.name as connection_name, c.type as connection_type
       FROM datasets d
       LEFT JOIN data_connections c ON d.connection_id = c.id
       WHERE d.id = $1 AND d.tenant_id = $2`,
      [id, req.user!.tenantId]
    );
    
    if (!dataset) {
      throw new NotFoundError('Dataset');
    }
    
    res.json({ success: true, data: dataset });
  } catch (error) {
    next(error);
  }
});

// Update dataset
app.put('/datasets/:id', authenticate, authorize(ROLES.ADMIN, ROLES.MANAGER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { 
      name, syncStrategy, syncSchedule, scheduledHour, rowLimit, status, referenceColumn,
      // Partition ayarları
      partitionColumn, partitionType, refreshWindowDays, 
      detectModified, modifiedColumn, weeklyFullRefresh, engineType, customWhere,
      deleteDays,  // Tarih Bazlı Sil-Yaz için
      // RLS (Row-Level Security) kolonları
      storeColumn, regionColumn, groupColumn
    } = req.body;
    
    const dataset = await db.queryOne(
      'SELECT * FROM datasets WHERE id = $1 AND tenant_id = $2',
      [id, req.user!.tenantId]
    );
    
    if (!dataset) {
      throw new NotFoundError('Dataset');
    }
    
    // rowLimit: null = sınırsız, undefined = değiştirme
    const newRowLimit = rowLimit !== undefined ? rowLimit : dataset.row_limit;
    const newDeleteDays = deleteDays !== undefined ? deleteDays : dataset.delete_days;
    
    // SECURITY: Defense-in-depth - tenant_id dahil et
    await db.query(
      `UPDATE datasets SET 
        name = COALESCE($1, name),
        sync_strategy = COALESCE($2, sync_strategy),
        sync_schedule = COALESCE($3, sync_schedule),
        row_limit = $4,
        status = COALESCE($5, status),
        reference_column = COALESCE($6, reference_column),
        partition_column = COALESCE($7, partition_column),
        partition_type = COALESCE($8, partition_type),
        refresh_window_days = COALESCE($9, refresh_window_days),
        detect_modified = COALESCE($10, detect_modified),
        modified_column = COALESCE($11, modified_column),
        weekly_full_refresh = COALESCE($12, weekly_full_refresh),
        engine_type = COALESCE($13, engine_type),
        custom_where = $14,
        delete_days = $15,
        store_column = COALESCE($16, store_column),
        region_column = COALESCE($17, region_column),
        group_column = COALESCE($18, group_column),
        updated_at = NOW()
       WHERE id = $19 AND tenant_id = $20`,
      [name, syncStrategy, syncSchedule, newRowLimit, status, referenceColumn,
       partitionColumn, partitionType, refreshWindowDays,
       detectModified, modifiedColumn, weeklyFullRefresh, engineType, 
       customWhere !== undefined ? customWhere : null, newDeleteDays,
       storeColumn, regionColumn, groupColumn, id, req.user!.tenantId]
    );
    
    logger.info('Dataset updated', { id, partitionColumn, partitionType });
    
    // etl_schedules tablosunu da güncelle veya oluştur
    if (syncSchedule && syncSchedule !== 'manual') {
      // Cron expression oluştur
      let cronExpression = '* * * * *'; // default: her dakika
      if (syncSchedule === '1m') cronExpression = '* * * * *';
      else if (syncSchedule === '5m') cronExpression = '*/5 * * * *';
      else if (syncSchedule === '15m') cronExpression = '*/15 * * * *';
      else if (syncSchedule === '30m') cronExpression = '*/30 * * * *';
      else if (syncSchedule === '1h') cronExpression = '0 * * * *';
      else if (syncSchedule === '6h') cronExpression = '0 */6 * * *';
      else if (syncSchedule === '12h') cronExpression = '0 */12 * * *';
      else if (syncSchedule === '1d') cronExpression = '0 0 * * *';
      else if (syncSchedule === 'daily') {
        // Günlük - kullanıcının seçtiği saatte çalışır
        const hour = typeof scheduledHour === 'number' ? scheduledHour : 2; // Varsayılan: 02:00
        cronExpression = `0 ${hour} * * *`; // Her gün seçilen saatte
      }
      
      // Schedule var mı kontrol et
      const existingSchedule = await db.queryOne(
        'SELECT id FROM etl_schedules WHERE dataset_id = $1 AND tenant_id = $2',
        [id, req.user!.tenantId]
      );
      
      // Bir sonraki çalışma zamanını hesapla (cron_expression'a göre)
      const calculateNextRunTime = (cron: string, hour?: number): Date => {
        const now = new Date();
        const nextRun = new Date(now);
        
        // Günlük schedule: "0 H * * *" formatı
        if (cron.match(/^0 \d{1,2} \* \* \*$/)) {
          const scheduledHourValue = parseInt(cron.split(' ')[1]);
          // Bugün seçilen saat geçmiş mi?
          if (now.getHours() >= scheduledHourValue) {
            // Yarın çalışacak
            nextRun.setDate(nextRun.getDate() + 1);
          }
          nextRun.setHours(scheduledHourValue, 0, 0, 0);
        }
        // Saatlik: "0 * * * *"
        else if (cron === '0 * * * *') {
          nextRun.setHours(nextRun.getHours() + 1, 0, 0, 0);
        }
        // 6 saatlik: "0 */6 * * *"
        else if (cron === '0 */6 * * *') {
          nextRun.setHours(nextRun.getHours() + 6, 0, 0, 0);
        }
        // Her dakika, 5, 15, 30 dakika
        else if (cron === '* * * * *') {
          nextRun.setMinutes(nextRun.getMinutes() + 1, 0, 0);
        }
        else if (cron === '*/5 * * * *') {
          nextRun.setMinutes(nextRun.getMinutes() + 5, 0, 0);
        }
        else if (cron === '*/15 * * * *') {
          nextRun.setMinutes(nextRun.getMinutes() + 15, 0, 0);
        }
        else if (cron === '*/30 * * * *') {
          nextRun.setMinutes(nextRun.getMinutes() + 30, 0, 0);
        }
        // Varsayılan: yarın 02:00 (güvenli fallback)
        else {
          nextRun.setDate(nextRun.getDate() + 1);
          nextRun.setHours(2, 0, 0, 0);
        }
        
        return nextRun;
      };
      
      const nextRunTime = calculateNextRunTime(cronExpression, scheduledHour);
      
      if (existingSchedule) {
        // SECURITY: Defense-in-depth - tenant_id dahil et
        await db.query(
          `UPDATE etl_schedules SET 
            cron_expression = $1, 
            is_active = true, 
            next_run_at = $2,
            updated_at = NOW() 
           WHERE id = $3 AND tenant_id = $4`,
          [cronExpression, nextRunTime, existingSchedule.id, req.user!.tenantId]
        );
      } else {
        // Yeni oluştur - next_run_at'ı doğru hesaplanmış zamana ayarla
        await db.query(
          `INSERT INTO etl_schedules (tenant_id, dataset_id, cron_expression, is_active, next_run_at)
           VALUES ($1, $2, $3, true, $4)`,
          [req.user!.tenantId, id, cronExpression, nextRunTime]
        );
      }
      
      logger.info('Schedule updated', { datasetId: id, cron: cronExpression });
    } else if (syncSchedule === 'manual') {
      // SECURITY: Defense-in-depth - tenant_id dahil et
      await db.query(
        `UPDATE etl_schedules SET is_active = false, updated_at = NOW() WHERE dataset_id = $1 AND tenant_id = $2`,
        [id, req.user!.tenantId]
      );
    }
    
    res.json({ success: true, message: 'Dataset güncellendi' });
  } catch (error) {
    next(error);
  }
});

// Delete dataset
app.delete('/datasets/:id', authenticate, authorize(ROLES.ADMIN, ROLES.MANAGER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    const dataset = await db.queryOne(
      'SELECT * FROM datasets WHERE id = $1 AND tenant_id = $2',
      [id, req.user!.tenantId]
    );
    
    if (!dataset) {
      throw new NotFoundError('Dataset');
    }
    
    // ClickHouse tablosunu sil
    if (dataset.clickhouse_table) {
      try {
        const safeTable = sanitizeTableName(dataset.clickhouse_table);
        await clickhouse.execute(`DROP TABLE IF EXISTS clixer_analytics.${safeTable}`);
        logger.info('ClickHouse table dropped', { table: safeTable });
      } catch (e: any) {
        logger.warn('Could not drop ClickHouse table', { error: e.message });
      }
    }
    
    // SECURITY: Defense-in-depth - tenant_id dahil et
    // İlgili ETL job'ları sil (tenant_id dahil)
    await db.query('DELETE FROM etl_jobs WHERE dataset_id = $1 AND tenant_id = $2', [id, req.user!.tenantId]);
    
    // İlgili schedule'ları sil (tenant_id dahil)
    await db.query('DELETE FROM etl_schedules WHERE dataset_id = $1 AND tenant_id = $2', [id, req.user!.tenantId]);
    
    // Dataset'i sil (tenant_id dahil)
    await db.query('DELETE FROM datasets WHERE id = $1 AND tenant_id = $2', [id, req.user!.tenantId]);
    
    logger.info('Dataset deleted', { datasetId: id, tenantId: req.user!.tenantId });
    res.json({ success: true, message: 'Dataset silindi' });
  } catch (error) {
    next(error);
  }
});

// Source table preview (kolonları ve örnek veri göster)
app.post('/connections/:id/preview', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { tableName, limit = 10 } = req.body;

    if (!tableName) {
      throw new ValidationError('Tablo adı gerekli');
    }
    
    // SECURITY: Table name SQL injection koruması
    const safeTableName = sanitizeTableName(tableName);
    const safeLimit = Math.min(Math.max(1, parseInt(limit) || 10), 100);

    const connection = await db.queryOne(
      'SELECT * FROM data_connections WHERE id = $1 AND tenant_id = $2',
      [id, req.user!.tenantId]
    );

    if (!connection) {
      throw new NotFoundError('Bağlantı');
    }

    let columns: { name: string; type: string; nullable?: boolean }[] = [];
    let sampleData: any[] = [];

    if (connection.type === 'postgresql') {
      const { Client } = require('pg');
      const client = new Client({
        host: connection.host,
        port: connection.port || 5432,
        database: connection.database_name,
        user: connection.username,
        password: decrypt(connection.password_encrypted),
      });
      
      try {
        await client.connect();
        
        // Kolonları çek (parameterized query)
        const colResult = await client.query(`
          SELECT column_name as name, data_type as type, is_nullable
          FROM information_schema.columns 
          WHERE table_name = $1
          ORDER BY ordinal_position
        `, [safeTableName]);
        columns = colResult.rows.map((c: any) => ({
          name: c.name,
          type: c.type,
          nullable: c.is_nullable === 'YES'
        }));
        
        // Örnek veri çek - SECURITY: sanitized table name kullanılıyor
        const dataResult = await client.query(`SELECT * FROM "${safeTableName}" LIMIT ${safeLimit}`);
        sampleData = dataResult.rows;
        
        await client.end();
      } catch (dbError: any) {
        logger.error('PostgreSQL preview error', { error: dbError.message, table: safeTableName });
        throw new AppError(`Tablo önizleme hatası: ${dbError.message}`, 500, 'PREVIEW_ERROR');
      }
    } else if (connection.type === 'mssql') {
      const sql = require('mssql');
      const isAzure = connection.host.includes('.database.windows.net');
      const config = {
        server: connection.host,
        port: connection.port || 1433,
        database: connection.database_name,
        user: connection.username,
        password: decrypt(connection.password_encrypted),
        options: { encrypt: isAzure, trustServerCertificate: !isAzure }
      };
      
      try {
        await sql.connect(config);
        
        // Kolonları çek - SECURITY: parameterized query kullanılıyor
        const request = new sql.Request();
        request.input('tableName', sql.VarChar, safeTableName);
        const colResult = await request.query(`
          SELECT COLUMN_NAME as name, DATA_TYPE as type, IS_NULLABLE as is_nullable
          FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_NAME = @tableName
          ORDER BY ORDINAL_POSITION
        `);
        columns = colResult.recordset.map((c: any) => ({
          name: c.name,
          type: c.type,
          nullable: c.is_nullable === 'YES'
        }));
        
        // Örnek veri çek - SECURITY: sanitized table name kullanılıyor
        const dataResult = await sql.query(`SELECT TOP ${safeLimit} * FROM [${safeTableName}]`);
        sampleData = dataResult.recordset;
        
        await sql.close();
      } catch (dbError: any) {
        logger.error('MSSQL preview error', { error: dbError.message, table: safeTableName });
        throw new AppError(`Tablo önizleme hatası: ${dbError.message}`, 500, 'PREVIEW_ERROR');
      }
    } else if (connection.type === 'api') {
      // API preview - endpoint'e istek at
      columns = [{ name: 'response', type: 'json', nullable: false }];
      sampleData = [{ response: 'API yanıtı burada görünecek' }];
    }

    res.json({ success: true, data: { columns, sampleData, rowCount: sampleData.length } });
  } catch (error) {
    next(error);
  }
});

// ============================================
// ETL JOBS
// ============================================

// ETL Jobs routes moved to routes/etl.routes.ts
// - POST /etl-jobs/:jobId/kill
// - GET /etl-jobs/running
// - GET /etl-jobs

// Manual ETL trigger
app.post('/datasets/:id/sync', authenticate, authorize(ROLES.ADMIN, ROLES.MANAGER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const dataset = await db.queryOne(
      'SELECT * FROM datasets WHERE id = $1 AND tenant_id = $2',
      [id, req.user!.tenantId]
    );

    if (!dataset) {
      throw new NotFoundError('Dataset');
    }

    // ⚠️ DUPLICATE PREVENTION: Aynı dataset için zaten çalışan veya bekleyen job var mı?
    const existingJob = await db.queryOne(
      `SELECT id, status FROM etl_jobs 
       WHERE dataset_id = $1 AND status IN ('pending', 'running')
       ORDER BY created_at DESC LIMIT 1`,
      [id]
    );
    
    if (existingJob) {
      logger.warn('Duplicate sync attempt blocked', { 
        datasetId: id, 
        existingJobId: existingJob.id, 
        existingStatus: existingJob.status 
      });
      return res.status(409).json({ 
        success: false, 
        error: `Bu dataset için zaten ${existingJob.status === 'running' ? 'çalışan' : 'bekleyen'} bir sync işlemi var.`,
        existingJobId: existingJob.id,
        existingStatus: existingJob.status
      });
    }

    // Yeni pending job oluştur
    const newJob = await db.queryOne(
      `INSERT INTO etl_jobs (tenant_id, dataset_id, action, status, started_at)
       VALUES ($1, $2, 'manual_sync', 'pending', NOW())
       RETURNING id`,
      [req.user!.tenantId, id]
    );

    // Worker'ı bilgilendir (pub/sub)
    await cache.publish('etl:trigger', { 
      datasetId: id, 
      jobId: newJob.id,
      action: 'manual_sync', 
      triggeredBy: req.user!.userId 
    });

    logger.info('Manual ETL triggered', { datasetId: id, jobId: newJob.id, userId: req.user!.userId });
    res.json({ 
      success: true, 
      message: 'Sync başlatıldı',
      jobId: newJob.id
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// PARTIAL REFRESH - Tarih bazlı kısmi yenileme
// ============================================
app.post('/datasets/:id/partial-refresh', authenticate, authorize(ROLES.ADMIN, ROLES.MANAGER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { days } = req.body; // Son X gün

    if (!days || days < 1 || days > 365) {
      return res.status(400).json({ success: false, error: 'Geçersiz gün sayısı (1-365 arası olmalı)' });
    }

    const dataset = await db.queryOne(
      'SELECT * FROM datasets WHERE id = $1 AND tenant_id = $2',
      [id, req.user!.tenantId]
    );

    if (!dataset) {
      throw new NotFoundError('Dataset');
    }

    if (!dataset.partition_column) {
      return res.status(400).json({ 
        success: false, 
        error: 'Bu dataset için partition kolonu tanımlanmamış. Kısmi yenileme yapılamaz.' 
      });
    }

    // Aynı dataset için çalışan job var mı?
    const existingJob = await db.queryOne(
      `SELECT id, status FROM etl_jobs 
       WHERE dataset_id = $1 AND status IN ('pending', 'running')
       ORDER BY created_at DESC LIMIT 1`,
      [id]
    );
    
    if (existingJob) {
      return res.status(409).json({ 
        success: false, 
        error: `Bu dataset için zaten ${existingJob.status === 'running' ? 'çalışan' : 'bekleyen'} bir sync işlemi var.`,
      });
    }

    // SECURITY: Defense-in-depth - tenant_id dahil et
    await db.query(
      `UPDATE datasets SET refresh_window_days = $1 WHERE id = $2 AND tenant_id = $3`,
      [days, id, req.user!.tenantId]
    );

    // Yeni partial_refresh job oluştur
    const newJob = await db.queryOne(
      `INSERT INTO etl_jobs (tenant_id, dataset_id, action, status, started_at)
       VALUES ($1, $2, 'partial_refresh', 'pending', NOW())
       RETURNING id`,
      [req.user!.tenantId, id]
    );

    // Worker'ı bilgilendir
    await cache.publish('etl:trigger', { 
      datasetId: id, 
      jobId: newJob.id,
      action: 'partial_refresh',
      days: days,
      triggeredBy: req.user!.userId 
    });

    logger.info('Partial refresh triggered', { 
      datasetId: id, 
      jobId: newJob.id, 
      days: days,
      partitionColumn: dataset.partition_column 
    });

    res.json({ 
      success: true, 
      message: `Son ${days} gün yenileme başlatıldı`,
      jobId: newJob.id
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// SYSTEM ROUTES - Moved to routes/system.routes.ts
// ============================================
// /system/locks, /system/stuck-jobs, /system/running-jobs,
// /system/jobs/:id/cancel, /system/etl-health, /system/jobs/:id/progress

// ============================================
// CLICKHOUSE TABLE MANAGEMENT
// ============================================

// List all ClickHouse tables with details
app.get('/clickhouse/tables', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await clickhouse.query(`
      SELECT 
        name,
        engine,
        partition_key,
        sorting_key,
        total_rows,
        total_bytes,
        formatReadableSize(total_bytes) as readable_size
      FROM system.tables 
      WHERE database = 'clixer_analytics'
      ORDER BY total_rows DESC
    `);
    
    // Dataset bilgilerini de al
    const datasets = await db.queryAll(`
      SELECT clickhouse_table, name, connection_id, sync_strategy, last_sync_at
      FROM datasets
    `);
    
    const datasetMap: Record<string, any> = {};
    datasets.forEach((d: any) => {
      datasetMap[d.clickhouse_table] = d;
    });
    
    const tables = (result as any[]).map((table: any) => ({
      ...table,
      datasetName: datasetMap[table.name]?.name || null,
      syncStrategy: datasetMap[table.name]?.sync_strategy || null,
      lastSyncAt: datasetMap[table.name]?.last_sync_at || null,
      isOrphan: !datasetMap[table.name] // Dataset olmadan tablo varsa orphan
    }));
    
    res.json({ success: true, data: tables });
  } catch (error) {
    next(error);
  }
});

// Get specific ClickHouse table details
app.get('/clickhouse/tables/:name', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name } = req.params;
    
    // Tablo bilgisi
    const tableInfo = await clickhouse.query(`
      SELECT 
        name,
        engine,
        partition_key,
        sorting_key,
        primary_key,
        total_rows,
        total_bytes,
        formatReadableSize(total_bytes) as readable_size,
        metadata_modification_time,
        create_table_query
      FROM system.tables 
      WHERE database = 'clixer_analytics' AND name = '${name}'
    `);
    
    if (!tableInfo || (tableInfo as any[]).length === 0) {
      throw new NotFoundError('Tablo');
    }
    
    // Partition bilgisi
    const partitions = await clickhouse.query(`
      SELECT 
        partition,
        sum(rows) as rows,
        formatReadableSize(sum(bytes_on_disk)) as size
      FROM system.parts
      WHERE database = 'clixer_analytics' AND table = '${name}' AND active = 1
      GROUP BY partition
      ORDER BY partition DESC
      LIMIT 12
    `);
    
    // SECURITY: SQL Injection koruması
    const safeName = sanitizeTableName(name);
    
    // Kolon bilgisi
    const columns = await clickhouse.query(`
      SELECT name, type, default_kind, comment
      FROM system.columns
      WHERE database = 'clixer_analytics' AND table = '${safeName}'
      ORDER BY position
    `);
    
    // Örnek veri (ilk 5 satır)
    const sampleData = await clickhouse.query(`
      SELECT * FROM clixer_analytics.${safeName} LIMIT 5
    `);
    
    res.json({
      success: true,
      data: {
        table: (tableInfo as any[])[0],
        partitions,
        columns,
        sampleData
      }
    });
  } catch (error) {
    next(error);
  }
});

// Delete ClickHouse table
app.delete('/clickhouse/tables/:name', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name } = req.params;
    // SECURITY: SQL Injection koruması
    const safeName = sanitizeTableName(name);
    
    // İlgili dataset var mı kontrol et
    const dataset = await db.queryOne(
      'SELECT id, name FROM datasets WHERE clickhouse_table = $1',
      [safeName]
    );
    
    if (dataset) {
      throw new ValidationError(`Bu tablo "${dataset.name}" dataset'ine bağlı. Önce dataset'i silin.`);
    }
    
    // Tabloyu sil
    await clickhouse.execute(`DROP TABLE IF EXISTS clixer_analytics.${safeName}`);
    
    logger.info('ClickHouse table deleted by admin', { table: safeName, userId: req.user!.userId });
    res.json({ success: true, message: `Tablo "${safeName}" silindi` });
  } catch (error) {
    next(error);
  }
});

// Truncate ClickHouse table (verileri sil, tabloyu koru)
app.post('/clickhouse/tables/:name/truncate', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name } = req.params;
    // SECURITY: SQL Injection koruması
    const safeName = sanitizeTableName(name);
    
    await clickhouse.execute(`TRUNCATE TABLE clixer_analytics.${safeName}`);
    
    logger.info('ClickHouse table truncated by admin', { table: safeName, userId: req.user!.userId });
    res.json({ success: true, message: `Tablo "${safeName}" temizlendi` });
  } catch (error) {
    next(error);
  }
});

// Optimize ClickHouse table (duplicate temizliği)
app.post('/clickhouse/tables/:name/optimize', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name } = req.params;
    // SECURITY: SQL Injection koruması
    const safeName = sanitizeTableName(name);
    
    await clickhouse.execute(`OPTIMIZE TABLE clixer_analytics.${safeName} FINAL`);
    
    logger.info('ClickHouse table optimized by admin', { table: safeName, userId: req.user!.userId });
    res.json({ success: true, message: `Tablo "${safeName}" optimize edildi` });
  } catch (error) {
    next(error);
  }
});

// ============================================
// PERFORMANS DANIŞMANI ENDPOINTLERİ
// ============================================

/**
 * PostgreSQL Performans Analizi
 * - Kullanılmayan index'ler
 * - Dead tuple'lar (VACUUM gerekli)
 * - Tablo boyutları
 * - Bağlantı sayısı
 */
app.get('/performance/postgres', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 1. Kullanılmayan Index'ler
    const unusedIndexes = await db.queryAll(`
      SELECT 
        schemaname,
        relname as table_name,
        indexrelname as index_name,
        idx_scan as index_scans,
        pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
        -- Constraint'e bağlı mı kontrol et
        CASE WHEN EXISTS (
          SELECT 1 FROM pg_constraint c 
          WHERE c.conindid = i.indexrelid
        ) THEN true ELSE false END as is_constraint
      FROM pg_stat_user_indexes i
      WHERE idx_scan = 0 
        AND indexrelname NOT LIKE '%_pkey'
        AND indexrelname NOT LIKE '%_pk'
        AND indexrelname NOT LIKE '%_key'
        -- Constraint index'leri hariç tut
        AND NOT EXISTS (
          SELECT 1 FROM pg_constraint c 
          WHERE c.conindid = i.indexrelid
        )
      ORDER BY pg_relation_size(indexrelid) DESC
      LIMIT 20
    `);

    // 2. Dead Tuple'lar (VACUUM gerekli)
    const deadTuples = await db.queryAll(`
      SELECT 
        relname as table_name,
        n_live_tup as live_tuples,
        n_dead_tup as dead_tuples,
        ROUND(100.0 * n_dead_tup / NULLIF(n_live_tup + n_dead_tup, 0), 2) as dead_pct,
        last_vacuum,
        last_autovacuum,
        last_analyze
      FROM pg_stat_user_tables
      WHERE n_dead_tup > 1000
      ORDER BY n_dead_tup DESC
      LIMIT 20
    `);

    // 3. Seq Scan fazla olan tablolar (index eksik olabilir)
    const seqScanTables = await db.queryAll(`
      SELECT 
        relname as table_name,
        seq_scan,
        idx_scan,
        ROUND(100.0 * seq_scan / NULLIF(seq_scan + idx_scan, 0), 2) as seq_pct,
        n_live_tup as row_count,
        -- Index önerisi: Eğer %80'den fazla seq scan varsa ve 10K+ satır varsa
        CASE 
          WHEN ROUND(100.0 * seq_scan / NULLIF(seq_scan + idx_scan, 0), 2) > 80 AND n_live_tup > 10000 
          THEN 'Bu tabloda sık kullanılan WHERE/JOIN kolonlarına index eklenmeli'
          WHEN ROUND(100.0 * seq_scan / NULLIF(seq_scan + idx_scan, 0), 2) > 50 
          THEN 'Bu tablo gözlemlenmeli, gerekirse index eklenebilir'
          ELSE NULL
        END as recommendation
      FROM pg_stat_user_tables
      WHERE seq_scan > 100 AND n_live_tup > 500
      ORDER BY seq_scan DESC
      LIMIT 20
    `);

    // 4. En büyük tablolar
    const largestTables = await db.queryAll(`
      SELECT 
        schemaname,
        relname as table_name,
        pg_size_pretty(pg_total_relation_size(relid)) as total_size,
        pg_size_pretty(pg_relation_size(relid)) as table_size,
        pg_size_pretty(pg_total_relation_size(relid) - pg_relation_size(relid)) as index_size,
        n_live_tup as row_count
      FROM pg_stat_user_tables
      ORDER BY pg_total_relation_size(relid) DESC
      LIMIT 20
    `);

    // 5. Bağlantı durumu
    const connectionStats = await db.queryOne(`
      SELECT 
        (SELECT count(*) FROM pg_stat_activity) as active_connections,
        (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max_connections,
        (SELECT count(*) FROM pg_stat_activity WHERE state = 'idle') as idle_connections,
        (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') as busy_connections
    `);

    // 6. Veritabanı boyutu
    const dbSize = await db.queryOne(`
      SELECT pg_size_pretty(pg_database_size(current_database())) as database_size
    `);

    res.json({
      success: true,
      data: {
        unusedIndexes,
        deadTuples,
        seqScanTables,
        largestTables,
        connectionStats,
        dbSize: dbSize?.database_size || 'N/A',
        summary: {
          unusedIndexCount: unusedIndexes.length,
          vacuumNeededCount: deadTuples.length,
          missingIndexHintCount: seqScanTables.filter((t: any) => t.seq_pct > 80).length
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PostgreSQL VACUUM çalıştır
 */
app.post('/performance/postgres/vacuum/:table', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { table } = req.params;
    const { analyze } = req.query;
    
    // Güvenlik: Tablo adı kontrolü
    const validTable = await db.queryOne(
      'SELECT tablename FROM pg_tables WHERE schemaname = $1 AND tablename = $2',
      ['public', table]
    );
    
    if (!validTable) {
      throw new NotFoundError(`Tablo bulunamadı: ${table}`);
    }
    
    const command = analyze === 'true' ? `VACUUM ANALYZE ${table}` : `VACUUM ${table}`;
    await db.query(command);
    
    logger.info('VACUUM executed', { table, analyze: analyze === 'true', userId: req.user!.userId });
    res.json({ success: true, message: `VACUUM ${analyze === 'true' ? 'ANALYZE ' : ''}${table} tamamlandı` });
  } catch (error) {
    next(error);
  }
});

/**
 * PostgreSQL REINDEX çalıştır
 */
app.post('/performance/postgres/reindex/:table', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { table } = req.params;
    
    // Güvenlik: Tablo adı kontrolü
    const validTable = await db.queryOne(
      'SELECT tablename FROM pg_tables WHERE schemaname = $1 AND tablename = $2',
      ['public', table]
    );
    
    if (!validTable) {
      throw new NotFoundError(`Tablo bulunamadı: ${table}`);
    }
    
    await db.query(`REINDEX TABLE ${table}`);
    
    logger.info('REINDEX executed', { table, userId: req.user!.userId });
    res.json({ success: true, message: `REINDEX TABLE ${table} tamamlandı` });
  } catch (error) {
    next(error);
  }
});

/**
 * PostgreSQL kullanılmayan index sil
 */
app.delete('/performance/postgres/index/:indexName', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { indexName } = req.params;
    
    // Güvenlik: Index adı kontrolü
    const validIndex = await db.queryOne(
      'SELECT indexname FROM pg_indexes WHERE schemaname = $1 AND indexname = $2',
      ['public', indexName]
    );
    
    if (!validIndex) {
      throw new NotFoundError(`Index bulunamadı: ${indexName}`);
    }
    
    await db.query(`DROP INDEX IF EXISTS ${indexName}`);
    
    logger.info('Index dropped', { indexName, userId: req.user!.userId });
    res.json({ success: true, message: `Index "${indexName}" silindi` });
  } catch (error) {
    next(error);
  }
});

/**
 * ClickHouse Performans Analizi
 * - Partition durumu
 * - Yavaş sorgular
 * - Part sayısı (merge gerekli mi)
 * - Tablo boyutları
 */
app.get('/performance/clickhouse', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 1. Tablo boyutları ve part sayısı
    const tableStats = await clickhouse.query(`
      SELECT 
        table,
        count() as parts_count,
        sum(rows) as total_rows,
        formatReadableSize(sum(bytes_on_disk)) as disk_size,
        formatReadableSize(sum(data_compressed_bytes)) as compressed_size,
        formatReadableSize(sum(data_uncompressed_bytes)) as uncompressed_size,
        round(sum(data_compressed_bytes) / sum(data_uncompressed_bytes) * 100, 2) as compression_ratio
      FROM system.parts
      WHERE active AND database = 'clixer_analytics'
      GROUP BY table
      ORDER BY sum(bytes_on_disk) DESC
    `);

    // 2. Çok fazla part olan tablolar (OPTIMIZE gerekli)
    const tablesNeedOptimize = await clickhouse.query(`
      SELECT 
        table,
        count() as parts_count,
        sum(rows) as total_rows
      FROM system.parts
      WHERE active AND database = 'clixer_analytics'
      GROUP BY table
      HAVING parts_count > 50
      ORDER BY parts_count DESC
    `);

    // 3. Partition dağılımı
    const partitionStats = await clickhouse.query(`
      SELECT 
        table,
        partition,
        count() as parts_count,
        sum(rows) as rows,
        formatReadableSize(sum(bytes_on_disk)) as size
      FROM system.parts
      WHERE active AND database = 'clixer_analytics'
      GROUP BY table, partition
      ORDER BY table, partition DESC
      LIMIT 50
    `);

    // 4. Yavaş sorgular (son 24 saat, >3 saniye)
    let slowQueries: any[] = [];
    try {
      slowQueries = await clickhouse.query(`
        SELECT 
          query_start_time,
          query_duration_ms,
          read_rows,
          read_bytes,
          memory_usage,
          substring(query, 1, 200) as query_preview
        FROM system.query_log
        WHERE type = 'QueryFinish'
          AND query_duration_ms > 3000
          AND event_date >= today() - 1
          AND query NOT LIKE '%system.%'
        ORDER BY query_duration_ms DESC
        LIMIT 20
      `);
    } catch (e) {
      // query_log disabled olabilir
      logger.warn('Could not fetch slow queries from query_log');
    }

    // 5. Merge durumu
    let mergeStatus: any[] = [];
    try {
      mergeStatus = await clickhouse.query(`
        SELECT 
          database,
          table,
          elapsed,
          progress,
          num_parts,
          formatReadableSize(total_size_bytes_compressed) as size
        FROM system.merges
        WHERE database = 'clixer_analytics'
      `);
    } catch (e) {
      // Aktif merge yoksa hata verebilir
    }

    // 6. Toplam veritabanı boyutu
    const dbSize = await clickhouse.query(`
      SELECT formatReadableSize(sum(bytes_on_disk)) as total_size
      FROM system.parts
      WHERE active AND database = 'clixer_analytics'
    `);

    res.json({
      success: true,
      data: {
        tableStats,
        tablesNeedOptimize,
        partitionStats,
        slowQueries,
        mergeStatus,
        dbSize: (dbSize as any[])[0]?.total_size || '0 B',
        summary: {
          tableCount: (tableStats as any[]).length,
          optimizeNeededCount: (tablesNeedOptimize as any[]).length,
          slowQueryCount: slowQueries.length
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * ClickHouse tüm tabloları optimize et
 */
app.post('/performance/clickhouse/optimize-all', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Önce optimize edilmesi gereken tabloları bul
    const tables = await clickhouse.query(`
      SELECT table
      FROM system.parts
      WHERE active AND database = 'clixer_analytics'
      GROUP BY table
      HAVING count() > 10
    `);

    const results: { table: string; status: string }[] = [];
    
    for (const row of tables as any[]) {
      try {
        await clickhouse.execute(`OPTIMIZE TABLE clixer_analytics.${row.table} FINAL`);
        results.push({ table: row.table, status: 'success' });
      } catch (e: any) {
        results.push({ table: row.table, status: `error: ${e.message}` });
      }
    }

    logger.info('ClickHouse optimize-all executed', { userId: req.user!.userId, tableCount: results.length });
    res.json({ success: true, data: results, message: `${results.filter(r => r.status === 'success').length} tablo optimize edildi` });
  } catch (error) {
    next(error);
  }
});

/**
 * Müşteri Veri Kaynağı Performans Analizi
 * MSSQL, MySQL, PostgreSQL destekler
 */
app.get('/performance/connections/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const tenantId = req.user!.tenantId;

    // Bağlantı bilgilerini al
    const connection = await db.queryOne(
      'SELECT * FROM data_connections WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    if (!connection) {
      throw new NotFoundError('Bağlantı bulunamadı');
    }

    let analysis: any = { type: connection.type };

    if (connection.type === 'mssql') {
      // MSSQL bağlantısı kur
      const sql = require('mssql');
      const config = {
        server: connection.host,
        port: connection.port || 1433,
        database: connection.database_name,
        user: connection.username,
        password: decrypt(connection.password_encrypted),
        options: {
          encrypt: connection.host?.includes('.database.windows.net') || false,
          trustServerCertificate: true
        }
      };

      const pool = await sql.connect(config);

      try {
        // Missing Index önerileri (SQL Server kendi önerir!)
        const missingIndexes = await pool.request().query(`
          SELECT TOP 10
            ROUND(migs.avg_total_user_cost * migs.avg_user_impact * (migs.user_seeks + migs.user_scans), 0) AS improvement_measure,
            OBJECT_NAME(mid.object_id) AS table_name,
            mid.equality_columns,
            mid.inequality_columns,
            mid.included_columns
          FROM sys.dm_db_missing_index_groups mig
          JOIN sys.dm_db_missing_index_group_stats migs ON migs.group_handle = mig.index_group_handle
          JOIN sys.dm_db_missing_index_details mid ON mig.index_handle = mid.index_handle
          WHERE mid.database_id = DB_ID()
          ORDER BY improvement_measure DESC
        `);

        // Fragmented Index'ler
        const fragmentedIndexes = await pool.request().query(`
          SELECT TOP 10
            OBJECT_NAME(ips.object_id) AS table_name,
            i.name AS index_name,
            ips.avg_fragmentation_in_percent,
            ips.page_count
          FROM sys.dm_db_index_physical_stats(DB_ID(), NULL, NULL, NULL, 'LIMITED') ips
          JOIN sys.indexes i ON i.object_id = ips.object_id AND i.index_id = ips.index_id
          WHERE ips.avg_fragmentation_in_percent > 30 AND ips.page_count > 100
          ORDER BY ips.avg_fragmentation_in_percent DESC
        `);

        // En büyük tablolar
        const largestTables = await pool.request().query(`
          SELECT TOP 10
            t.name AS table_name,
            s.row_count,
            CAST(ROUND(((SUM(a.total_pages) * 8) / 1024.00), 2) AS DECIMAL(18,2)) AS total_mb,
            CAST(ROUND(((SUM(a.used_pages) * 8) / 1024.00), 2) AS DECIMAL(18,2)) AS used_mb
          FROM sys.tables t
          JOIN sys.indexes i ON t.object_id = i.object_id
          JOIN sys.partitions p ON i.object_id = p.object_id AND i.index_id = p.index_id
          JOIN sys.allocation_units a ON p.partition_id = a.container_id
          LEFT JOIN sys.dm_db_partition_stats s ON s.object_id = t.object_id AND s.index_id <= 1
          GROUP BY t.name, s.row_count
          ORDER BY SUM(a.total_pages) DESC
        `);

        analysis = {
          type: 'mssql',
          missingIndexes: missingIndexes.recordset,
          fragmentedIndexes: fragmentedIndexes.recordset,
          largestTables: largestTables.recordset,
          summary: {
            missingIndexCount: missingIndexes.recordset.length,
            fragmentedIndexCount: fragmentedIndexes.recordset.length
          }
        };
      } finally {
        await pool.close();
      }

    } else if (connection.type === 'mysql') {
      // MySQL bağlantısı
      const mysql = require('mysql2/promise');
      const conn = await mysql.createConnection({
        host: connection.host,
        port: connection.port || 3306,
        database: connection.database_name,
        user: connection.username,
        password: connection.password_encrypted
      });

      try {
        // Tablo boyutları
        const [tables] = await conn.execute(`
          SELECT 
            table_name,
            table_rows as row_count,
            ROUND(data_length / 1024 / 1024, 2) as data_mb,
            ROUND(index_length / 1024 / 1024, 2) as index_mb
          FROM information_schema.tables
          WHERE table_schema = ?
          ORDER BY data_length DESC
          LIMIT 20
        `, [connection.database_name]);

        // Index bilgileri
        const [indexes] = await conn.execute(`
          SELECT 
            table_name,
            index_name,
            column_name,
            cardinality
          FROM information_schema.statistics
          WHERE table_schema = ?
          ORDER BY table_name, index_name
          LIMIT 50
        `, [connection.database_name]);

        analysis = {
          type: 'mysql',
          largestTables: tables,
          indexes: indexes,
          summary: {
            tableCount: (tables as any[]).length
          }
        };
      } finally {
        await conn.end();
      }

    } else if (connection.type === 'postgresql') {
      // PostgreSQL bağlantısı
      const { Pool } = require('pg');
      const pool = new Pool({
        host: connection.host,
        port: connection.port || 5432,
        database: connection.database_name,
        user: connection.username,
        password: connection.password_encrypted
      });

      try {
        // Tablo boyutları
        const tablesResult = await pool.query(`
          SELECT 
            relname as table_name,
            pg_size_pretty(pg_total_relation_size(relid)) as total_size,
            n_live_tup as row_count
          FROM pg_stat_user_tables
          ORDER BY pg_total_relation_size(relid) DESC
          LIMIT 20
        `);

        // Kullanılmayan index'ler
        const unusedResult = await pool.query(`
          SELECT 
            relname as table_name,
            indexrelname as index_name,
            idx_scan as index_scans
          FROM pg_stat_user_indexes
          WHERE idx_scan = 0 AND indexrelname NOT LIKE '%_pkey'
          ORDER BY pg_relation_size(indexrelid) DESC
          LIMIT 20
        `);

        analysis = {
          type: 'postgresql',
          largestTables: tablesResult.rows,
          unusedIndexes: unusedResult.rows,
          summary: {
            tableCount: tablesResult.rows.length,
            unusedIndexCount: unusedResult.rows.length
          }
        };
      } finally {
        await pool.end();
      }
    }

    res.json({ success: true, data: analysis });
  } catch (error) {
    next(error);
  }
});

/**
 * ETL Performans Analizi
 * - Sync süreleri
 * - Başarı/başarısızlık oranları
 * - Veri büyüme trendi
 */
app.get('/performance/etl', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;

    // 1. Dataset bazlı ETL performansı
    const datasetPerformance = await db.queryAll(`
      SELECT 
        d.name as dataset_name,
        COUNT(j.id) as total_jobs,
        COUNT(CASE WHEN j.status = 'completed' THEN 1 END) as successful_jobs,
        COUNT(CASE WHEN j.status = 'failed' THEN 1 END) as failed_jobs,
        ROUND(AVG(EXTRACT(EPOCH FROM (j.completed_at - j.started_at)))::numeric, 2) as avg_duration_seconds,
        MAX(j.rows_processed) as max_rows,
        MAX(j.completed_at) as last_sync
      FROM datasets d
      LEFT JOIN etl_jobs j ON d.id = j.dataset_id
      WHERE d.tenant_id = $1
      GROUP BY d.id, d.name
      ORDER BY total_jobs DESC
    `, [tenantId]);

    // 2. Son 7 gün ETL trendi
    const dailyTrend = await db.queryAll(`
      SELECT 
        DATE(started_at) as date,
        COUNT(*) as total_jobs,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
        SUM(rows_processed) as total_rows
      FROM etl_jobs j
      JOIN datasets d ON j.dataset_id = d.id
      WHERE d.tenant_id = $1 AND j.started_at >= NOW() - INTERVAL '7 days'
      GROUP BY DATE(started_at)
      ORDER BY date
    `, [tenantId]);

    // 3. En uzun süren sync'ler
    const slowestSyncs = await db.queryAll(`
      SELECT 
        d.name as dataset_name,
        j.started_at,
        j.completed_at,
        EXTRACT(EPOCH FROM (j.completed_at - j.started_at)) as duration_seconds,
        j.rows_processed
      FROM etl_jobs j
      JOIN datasets d ON j.dataset_id = d.id
      WHERE d.tenant_id = $1 AND j.status = 'completed'
      ORDER BY (j.completed_at - j.started_at) DESC
      LIMIT 10
    `, [tenantId]);

    // 4. Hata patternleri
    const errorPatterns = await db.queryAll(`
      SELECT 
        d.name as dataset_name,
        j.error_message,
        COUNT(*) as occurrence_count,
        MAX(j.started_at) as last_occurrence
      FROM etl_jobs j
      JOIN datasets d ON j.dataset_id = d.id
      WHERE d.tenant_id = $1 AND j.status = 'failed' AND j.error_message IS NOT NULL
      GROUP BY d.name, j.error_message
      ORDER BY occurrence_count DESC
      LIMIT 10
    `, [tenantId]);

    // 5. Genel istatistikler
    const overallStats = await db.queryOne(`
      SELECT 
        COUNT(*) as total_jobs,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_jobs,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_jobs,
        ROUND(100.0 * COUNT(CASE WHEN status = 'completed' THEN 1 END) / NULLIF(COUNT(*), 0), 2) as success_rate,
        SUM(rows_processed) as total_rows_processed
      FROM etl_jobs j
      JOIN datasets d ON j.dataset_id = d.id
      WHERE d.tenant_id = $1
    `, [tenantId]);

    res.json({
      success: true,
      data: {
        datasetPerformance,
        dailyTrend,
        slowestSyncs,
        errorPatterns,
        overallStats,
        summary: {
          totalJobs: overallStats?.total_jobs || 0,
          successRate: overallStats?.success_rate || 0,
          totalRowsProcessed: overallStats?.total_rows_processed || 0
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// CACHE YÖNETİMİ (Admin Panel için)
// ============================================

// Redis bilgilerini getir
app.get('/performance/redis', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const client = cache.getClient();
    if (!client) {
      return res.json({ success: true, data: null });
    }

    // Redis INFO komutu
    const info = await client.info();
    const memoryInfo = await client.info('memory');
    const statsInfo = await client.info('stats');
    
    // Parse et
    const usedMemory = memoryInfo.match(/used_memory_human:([^\r\n]+)/)?.[1] || 'N/A';
    const maxMemory = memoryInfo.match(/maxmemory_human:([^\r\n]+)/)?.[1] || 'Limitsiz';
    const uptimeSeconds = info.match(/uptime_in_seconds:(\d+)/)?.[1] || '0';
    const keyspaceHits = statsInfo.match(/keyspace_hits:(\d+)/)?.[1] || '0';
    const keyspaceMisses = statsInfo.match(/keyspace_misses:(\d+)/)?.[1] || '0';
    
    // Key sayısı
    const dbInfo = info.match(/db0:keys=(\d+)/)?.[1] || '0';
    
    // Hit rate hesapla
    const hits = parseInt(keyspaceHits);
    const misses = parseInt(keyspaceMisses);
    const hitRate = hits + misses > 0 ? ((hits / (hits + misses)) * 100).toFixed(1) + '%' : 'N/A';
    
    // Uptime formatla
    const uptime = parseInt(uptimeSeconds);
    const days = Math.floor(uptime / 86400);
    const hours = Math.floor((uptime % 86400) / 3600);
    const uptimeStr = days > 0 ? `${days}g ${hours}s` : `${hours}s`;

    res.json({
      success: true,
      data: {
        usedMemory,
        maxMemory,
        keys: parseInt(dbInfo),
        hitRate,
        uptime: uptimeStr,
        rawInfo: {
          keyspaceHits: hits,
          keyspaceMisses: misses
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// Cache temizle
app.post('/cache/clear', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type } = req.body; // 'all', 'dashboard', 'metrics'
    const client = cache.getClient();
    
    if (!client) {
      throw new AppError('Redis bağlantısı yok', 500);
    }

    let deletedCount = 0;

    if (type === 'all') {
      // Tüm cache'i temizle
      await client.flushdb();
      deletedCount = -1; // Tümü silindi
      logger.info('Tüm cache temizlendi (Admin)');
    } else {
      // Belirli pattern'e göre temizle
      let pattern = '';
      if (type === 'dashboard') {
        pattern = 'dashboard:*';
      } else if (type === 'metrics') {
        pattern = 'metric:*';
      } else {
        pattern = `${type}:*`;
      }

      // KEYS ile key'leri bul ve sil (küçük veri setleri için OK)
      const keys = await client.keys(pattern);
      if (keys.length > 0) {
        await client.del(...keys);
        deletedCount = keys.length;
      }
      
      logger.info(`Cache temizlendi: ${pattern}, ${deletedCount} key silindi`);
    }

    res.json({
      success: true,
      data: {
        type,
        deletedCount: deletedCount === -1 ? 'Tümü' : deletedCount
      }
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// CLICKHOUSE VERİ YÖNETİMİ (Admin Only)
// Tarih bazlı silme, partition silme, truncate
// ============================================

// Silinecek satır sayısını önizle
app.get('/clickhouse/tables/:table/preview-delete', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { table } = req.params;
    const { dateColumn, startDate, endDate, days } = req.query;
    
    // SECURITY: SQL Injection koruması
    const safeTable = sanitizeTableName(table);
    const safeDateColumn = sanitizeTableName(dateColumn as string || '');
    
    if (!dateColumn) {
      throw new ValidationError('dateColumn parametresi zorunlu');
    }
    
    let whereClause = '';
    
    if (days) {
      // Son X gün
      const safeDays = parseInt(days as string) || 0;
      whereClause = `toDate(${safeDateColumn}) >= today() - ${safeDays}`;
    } else if (startDate && endDate) {
      // Tarih aralığı - sanitize date strings
      const safeStartDate = String(startDate).replace(/[^0-9-]/g, '');
      const safeEndDate = String(endDate).replace(/[^0-9-]/g, '');
      whereClause = `toDate(${safeDateColumn}) >= '${safeStartDate}' AND toDate(${safeDateColumn}) <= '${safeEndDate}'`;
    } else {
      throw new ValidationError('days veya startDate/endDate parametresi gerekli');
    }
    
    const countResult = await clickhouse.queryOne(`
      SELECT count() as cnt FROM clixer_analytics.${safeTable} WHERE ${whereClause}
    `);
    
    const totalResult = await clickhouse.queryOne(`
      SELECT count() as cnt FROM clixer_analytics.${safeTable}
    `);
    
    res.json({
      success: true,
      data: {
        table,
        dateColumn,
        whereClause,
        rowsToDelete: Number(countResult?.cnt || 0),
        totalRows: Number(totalResult?.cnt || 0),
        percentageToDelete: totalResult?.cnt ? ((Number(countResult?.cnt || 0) / Number(totalResult.cnt)) * 100).toFixed(2) : 0
      }
    });
  } catch (error) {
    next(error);
  }
});

// Tarih bazlı silme
app.delete('/clickhouse/tables/:table/rows', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { table } = req.params;
    const { dateColumn, startDate, endDate, days } = req.body;
    
    // SECURITY: SQL Injection koruması
    const safeTable = sanitizeTableName(table);
    const safeDateColumn = sanitizeTableName(dateColumn || '');
    
    if (!dateColumn) {
      throw new ValidationError('dateColumn parametresi zorunlu');
    }
    
    let whereClause = '';
    
    if (days !== undefined) {
      const safeDays = parseInt(days) || 0;
      whereClause = `toDate(${safeDateColumn}) >= today() - ${safeDays}`;
    } else if (startDate && endDate) {
      const safeStartDate = String(startDate).replace(/[^0-9-]/g, '');
      const safeEndDate = String(endDate).replace(/[^0-9-]/g, '');
      whereClause = `toDate(${safeDateColumn}) >= '${safeStartDate}' AND toDate(${safeDateColumn}) <= '${safeEndDate}'`;
    } else {
      throw new ValidationError('days veya startDate/endDate parametresi gerekli');
    }
    
    // Önce kaç satır silineceğini say
    const countBefore = await clickhouse.queryOne(`
      SELECT count() as cnt FROM clixer_analytics.${safeTable} WHERE ${whereClause}
    `);
    const rowsToDelete = Number(countBefore?.cnt || 0);
    
    if (rowsToDelete === 0) {
      return res.json({
        success: true,
        data: { message: 'Silinecek veri bulunamadı', rowsDeleted: 0 }
      });
    }
    
    // DELETE işlemi (async, arka planda çalışır)
    await clickhouse.execute(`
      ALTER TABLE clixer_analytics.${safeTable} DELETE WHERE ${whereClause}
    `);
    
    // Audit log
    logger.info('ClickHouse rows deleted', {
      table,
      dateColumn,
      whereClause,
      rowsDeleted: rowsToDelete,
      userId: (req as any).user?.userId,
      tenantId: (req as any).user?.tenantId
    });
    
    res.json({
      success: true,
      data: {
        message: `${rowsToDelete.toLocaleString('tr-TR')} satır silme işlemi başlatıldı`,
        rowsDeleted: rowsToDelete,
        table,
        whereClause,
        note: 'ClickHouse DELETE işlemi arka planda tamamlanır. Birkaç dakika sürebilir.'
      }
    });
  } catch (error) {
    next(error);
  }
});

// Partition sil
app.post('/clickhouse/tables/:table/delete-partition', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { table } = req.params;
    const { partition } = req.body; // Format: '202601' veya '2026-01'
    
    // SECURITY: SQL Injection koruması
    const safeTable = sanitizeTableName(table);
    
    if (!partition) {
      throw new ValidationError('partition parametresi zorunlu (örn: 202601 veya 2026-01)');
    }
    
    // Partition formatını normalize et ve sanitize et (sadece rakam ve tire)
    const normalizedPartition = String(partition).replace(/[^0-9]/g, '');
    
    await clickhouse.execute(`
      ALTER TABLE clixer_analytics.${safeTable} DROP PARTITION '${normalizedPartition}'
    `);
    
    logger.info('ClickHouse partition deleted', {
      table: safeTable,
      partition: normalizedPartition,
      userId: (req as any).user?.userId
    });
    
    res.json({
      success: true,
      data: {
        message: `Partition ${normalizedPartition} silindi`,
        table: safeTable,
        partition: normalizedPartition
      }
    });
  } catch (error) {
    next(error);
  }
});

// Tabloyu truncate et (tüm verileri sil)
app.post('/clickhouse/tables/:table/truncate', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { table } = req.params;
    const { confirm } = req.body;
    
    // SECURITY: SQL Injection koruması
    const safeTable = sanitizeTableName(table);
    
    if (confirm !== 'TRUNCATE') {
      throw new ValidationError('Güvenlik için body içinde { confirm: "TRUNCATE" } göndermelisiniz');
    }
    
    // Önce satır sayısını al
    const countResult = await clickhouse.queryOne(`
      SELECT count() as cnt FROM clixer_analytics.${safeTable}
    `);
    const totalRows = Number(countResult?.cnt || 0);
    
    await clickhouse.execute(`TRUNCATE TABLE clixer_analytics.${safeTable}`);
    
    logger.warn('ClickHouse table truncated', {
      table: safeTable,
      rowsDeleted: totalRows,
      userId: (req as any).user?.userId,
      tenantId: (req as any).user?.tenantId
    });
    
    res.json({
      success: true,
      data: {
        message: `Tablo truncate edildi`,
        table: safeTable,
        rowsDeleted: totalRows
      }
    });
  } catch (error) {
    next(error);
  }
});

// Duplicate temizle (OPTIMIZE FINAL)
app.post('/clickhouse/tables/:table/optimize', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { table } = req.params;
    // SECURITY: SQL Injection koruması
    const safeTable = sanitizeTableName(table);
    
    // Part sayısını al (öncesi)
    const partsBefore = await clickhouse.queryOne(`
      SELECT count() as cnt FROM system.parts 
      WHERE database = 'clixer_analytics' AND table = '${safeTable}' AND active = 1
    `);
    
    await clickhouse.execute(`OPTIMIZE TABLE clixer_analytics.${safeTable} FINAL`);
    
    // Part sayısını al (sonrası) - biraz bekle
    await new Promise(resolve => setTimeout(resolve, 2000));
    const partsAfter = await clickhouse.queryOne(`
      SELECT count() as cnt FROM system.parts 
      WHERE database = 'clixer_analytics' AND table = '${safeTable}' AND active = 1
    `);
    
    logger.info('ClickHouse table optimized', {
      table,
      partsBefore: partsBefore?.cnt,
      partsAfter: partsAfter?.cnt,
      userId: (req as any).user?.userId
    });
    
    res.json({
      success: true,
      data: {
        message: 'OPTIMIZE FINAL tamamlandı',
        table,
        partsBefore: Number(partsBefore?.cnt || 0),
        partsAfter: Number(partsAfter?.cnt || 0)
      }
    });
  } catch (error) {
    next(error);
  }
});

// Tablo partition bilgilerini getir
app.get('/clickhouse/tables/:table/partitions', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { table } = req.params;
    
    const partitions = await clickhouse.query(`
      SELECT 
        partition,
        sum(rows) as rows,
        formatReadableSize(sum(bytes_on_disk)) as size,
        count() as parts,
        min(min_date) as min_date,
        max(max_date) as max_date
      FROM system.parts
      WHERE database = 'clixer_analytics' AND table = '${table}' AND active = 1
      GROUP BY partition
      ORDER BY partition DESC
    `);
    
    res.json({
      success: true,
      data: partitions
    });
  } catch (error) {
    next(error);
  }
});

// Tablo kolon bilgilerini getir (tarih kolonları için)
app.get('/clickhouse/tables/:table/columns', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { table } = req.params;
    
    const columns = await clickhouse.query(`
      SELECT name, type 
      FROM system.columns 
      WHERE database = 'clixer_analytics' AND table = '${table}'
      ORDER BY position
    `);
    
    // Tarih kolonlarını işaretle
    const columnsWithMeta = columns.map((col: any) => ({
      ...col,
      isDateColumn: col.type.includes('Date') || col.type.includes('DateTime')
    }));
    
    res.json({
      success: true,
      data: columnsWithMeta
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// KAYNAK-HEDEF KARŞILAŞTIRMA (Data Reconciliation)
// ============================================

// Dataset karşılaştırma - Kaynak vs ClickHouse
app.get('/datasets/:id/compare', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    // ⚠️ KULLANICI PK KOLONUNU SEÇEBİLİR - hardcoded değil!
    // SECURITY: SQL Injection koruması
    const pkColumn = sanitizeTableName((req.query.pkColumn as string) || 'id');
    
    // Dataset bilgilerini al
    const dataset = await db.queryOne(`
      SELECT d.*, c.type as connection_type, c.host, c.port, c.database_name, c.username, c.password_encrypted
      FROM datasets d
      JOIN data_connections c ON d.connection_id = c.id
      WHERE d.id = $1
    `, [id]);
    
    if (!dataset) {
      throw new NotFoundError('Dataset bulunamadı');
    }
    
    // SECURITY: SQL Injection koruması - dataset.clickhouse_table de sanitize edilmeli
    const safeClickhouseTable = sanitizeTableName(dataset.clickhouse_table);
    
    // ClickHouse istatistikleri - DİNAMİK KOLON
    const chStats = await clickhouse.queryOne(`
      SELECT 
        count() as total_rows,
        min(${pkColumn}) as min_id,
        max(${pkColumn}) as max_id
      FROM clixer_analytics.${safeClickhouseTable}
    `);
    
    // Kaynak DB'den istatistik çek
    let sourceStats: any = { total_rows: 0, min_id: 0, max_id: 0 };
    let sourceError: string | null = null;
    let debugInfo: any = {};
    
    try {
      // Kaynak sorgudan tablo adını çıkar
      const sourceQuery = dataset.source_query || '';
      
      // Geliştirilmiş regex: [dbo].[table], dbo.table, [table], table formatlarını destekler
      let tableName: string | null = null;
      
      // Format 1: FROM [schema].[table]
      const schemaTableMatch = sourceQuery.match(/FROM\s+\[?(\w+)\]?\.\[?(\w+)\]?/i);
      if (schemaTableMatch) {
        tableName = schemaTableMatch[2];
      }
      
      // Format 2: FROM table (schema olmadan)
      if (!tableName) {
        const simpleMatch = sourceQuery.match(/FROM\s+\[?(\w+)\]?(?:\s|$|WHERE|ORDER|GROUP|LIMIT|TOP)/i);
        if (simpleMatch) {
          tableName = simpleMatch[1];
        }
      }
      
      // Format 3: Fallback - herhangi bir FROM pattern
      if (!tableName) {
        const fallbackMatch = sourceQuery.match(/FROM\s+(\S+)/i);
        if (fallbackMatch) {
          tableName = fallbackMatch[1].replace(/[\[\]]/g, '');
        }
      }
      
      debugInfo = { sourceQuery, tableName, connectionType: dataset.connection_type };
      
      if (tableName && dataset.connection_type === 'mssql') {
        const mssql = require('mssql');
        const config = {
          server: dataset.host,
          port: parseInt(dataset.port) || 1433,
          database: dataset.database_name,
          user: dataset.username,
          password: dataset.password_encrypted,
          options: {
            encrypt: dataset.host?.includes('.database.windows.net'),
            trustServerCertificate: true,
            connectTimeout: 30000,
            requestTimeout: 60000
          }
        };
        
        const pool = await mssql.connect(config);
        
        // Büyük tablolar için sistem tablolarından hızlı sayım (yaklaşık ama anlık)
        const countResult = await pool.request().query(`
          SELECT SUM(p.rows) as total_rows
          FROM sys.tables t
          INNER JOIN sys.partitions p ON t.object_id = p.object_id
          WHERE t.name = '${tableName}' AND p.index_id IN (0, 1)
        `);
        
        // Min/Max için index kullanır - hızlı - DİNAMİK KOLON
        const minMaxResult = await pool.request().query(`
          SELECT MIN([${pkColumn}]) as min_id, MAX([${pkColumn}]) as max_id
          FROM [${tableName}] WITH (NOLOCK)
        `);
        
        sourceStats = {
          total_rows: countResult.recordset[0]?.total_rows || 0,
          min_id: minMaxResult.recordset[0]?.min_id || 0,
          max_id: minMaxResult.recordset[0]?.max_id || 0
        };
        await pool.close();
      } else if (!tableName) {
        sourceError = 'Tablo adı source_query\'den çıkarılamadı';
      } else {
        sourceError = `Desteklenmeyen bağlantı tipi: ${dataset.connection_type}`;
      }
    } catch (err: any) {
      sourceError = err.message;
      logger.warn('Source stats fetch failed', { error: err.message, debugInfo });
    }
    
    // Karşılaştırma sonuçları
    const comparison = {
      dataset: {
        id: dataset.id,
        name: dataset.name,
        clickhouse_table: dataset.clickhouse_table,
        connection_type: dataset.connection_type
      },
      source: {
        total_rows: Number(sourceStats.total_rows) || 0,
        min_id: Number(sourceStats.min_id) || 0,
        max_id: Number(sourceStats.max_id) || 0,
        error: sourceError
      },
      clickhouse: {
        total_rows: Number(chStats?.total_rows) || 0,
        min_id: Number(chStats?.min_id) || 0,
        max_id: Number(chStats?.max_id) || 0
      },
      diff: {
        row_difference: (Number(sourceStats.total_rows) || 0) - (Number(chStats?.total_rows) || 0),
        missing_estimate: Math.max(0, (Number(sourceStats.max_id) || 0) - (Number(chStats?.max_id) || 0)),
        has_duplicates: (Number(chStats?.total_rows) || 0) > (Number(chStats?.max_id) - Number(chStats?.min_id) + 1)
      },
      debug: debugInfo // Debug bilgisi
    };
    
    res.json({ success: true, data: comparison });
  } catch (error) {
    next(error);
  }
});

// Eksik ID aralıklarını bul (sampling ile - memory friendly)
app.get('/datasets/:id/missing-ranges', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    // ⚠️ KULLANICI PK KOLONUNU SEÇEBİLİR - hardcoded değil!
    // SECURITY: SQL Injection koruması
    const pkColumn = sanitizeTableName((req.query.pkColumn as string) || 'id');
    // 100M+ satır için optimizasyon parametreleri
    const blockSize = parseInt(req.query.blockSize as string) || 100000; // 100K blok (10K yerine)
    const maxBlocks = parseInt(req.query.maxBlocks as string) || 100; // Max 100 blok tarama
    const mode = (req.query.mode as string) || 'smart'; // 'smart' | 'quick' | 'full'
    
    const dataset = await db.queryOne('SELECT * FROM datasets WHERE id = $1', [id]);
    if (!dataset) throw new NotFoundError('Dataset bulunamadı');
    
    // SECURITY: SQL Injection koruması
    const safeClickhouseTable = sanitizeTableName(dataset.clickhouse_table);
    
    // ClickHouse'dan min/max ve count al - TEK SORGU
    const chStats = await clickhouse.queryOne(`
      SELECT 
        min(${pkColumn}) as min_id, 
        max(${pkColumn}) as max_id,
        count() as total_rows
      FROM clixer_analytics.${safeClickhouseTable}
    `);
    
    const chMinId = Number(chStats?.min_id) || 0;
    const chMaxId = Number(chStats?.max_id) || 0;
    const chTotalRows = Number(chStats?.total_rows) || 0;
    const chRange = chMaxId - chMinId + 1;
    
    // QUICK MODE: Sadece son ID'lerden eksik olanları bul
    // 100M tabloda en hızlı yöntem!
    if (mode === 'quick') {
      // ClickHouse'daki max ID'den sonrası eksik
      const missingAfterMax = {
        start: chMaxId + 1,
        end: chMaxId + 1, // Kaynak max_id bilinmiyor, sadece işaret
        missing_count: 0, // Kaynak sorgulanınca dolacak
        type: 'after_max'
      };
      
      // Kaynak max_id'yi compare endpoint'ten almak daha iyi
      // Burada sadece ClickHouse tarafını döndürüyoruz
      return res.json({
        success: true,
        data: {
          mode: 'quick',
          clickhouse: { min_id: chMinId, max_id: chMaxId, total_rows: chTotalRows },
          message: 'Quick mode: Sadece max ID karşılaştırması yapıldı. Detay için "compare" endpoint kullanın.',
          recommendation: chTotalRows < chRange 
            ? `⚠️ ${chRange - chTotalRows} satır ortada eksik olabilir (gaps). Full scan önerilir.`
            : '✅ Sürekli ID aralığı, ortada boşluk yok.'
        }
      });
    }
    
    // SMART MODE: Önce hızlı kontrol, sonra gerekirse chunk tarama
    const missingRanges: Array<{start: number, end: number, missing_count: number}> = [];
    let blocksScanned = 0;
    let scanStopped = false;
    
    // Büyük tablolar için: Sadece şüpheli bölgeleri tara
    // 1. Baştan birkaç blok
    // 2. Ortadan birkaç blok (sampling)
    // 3. Sondan birkaç blok
    
    const scanPoints: number[] = [];
    
    if (mode === 'smart' && chRange > 1000000) {
      // 100M+ için akıllı sampling
      // Baştan 10 blok
      for (let i = 0; i < 10; i++) {
        scanPoints.push(chMinId + i * blockSize);
      }
      // Ortadan 10 blok (eşit aralıklı)
      const middleStep = Math.floor(chRange / 12);
      for (let i = 1; i <= 10; i++) {
        scanPoints.push(chMinId + i * middleStep);
      }
      // Sondan 10 blok
      for (let i = 10; i >= 1; i--) {
        scanPoints.push(chMaxId - i * blockSize);
      }
    } else {
      // Küçük tablolar: Sıralı tarama
      for (let blockStart = chMinId; blockStart <= chMaxId && blocksScanned < maxBlocks; blockStart += blockSize) {
        scanPoints.push(blockStart);
      }
    }
    
    // Unique scan points (duplicate'ları kaldır ve sırala)
    const uniqueScanPoints = [...new Set(scanPoints)].sort((a, b) => a - b);
    
    for (const blockStart of uniqueScanPoints) {
      if (blocksScanned >= maxBlocks) {
        scanStopped = true;
        break;
      }
      
      const blockEnd = Math.min(blockStart + blockSize - 1, chMaxId);
      if (blockStart > chMaxId || blockEnd < chMinId) continue;
      
      const blockStats = await clickhouse.queryOne(`
        SELECT count() as actual_count
        FROM clixer_analytics.${safeClickhouseTable}
        WHERE ${pkColumn} >= ${blockStart} AND ${pkColumn} <= ${blockEnd}
      `);
      
      const actualCount = Number(blockStats?.actual_count) || 0;
      const expectedCount = blockEnd - blockStart + 1;
      
      if (actualCount < expectedCount) {
        missingRanges.push({
          start: blockStart,
          end: blockEnd,
          missing_count: expectedCount - actualCount
        });
      }
      
      blocksScanned++;
      
      // 20 eksik bölge bulduktan sonra dur
      if (missingRanges.length >= 20) {
        scanStopped = true;
        break;
      }
    }
    
    const totalMissing = missingRanges.reduce((acc, r) => acc + r.missing_count, 0);
    
    res.json({
      success: true,
      data: {
        mode,
        clickhouse: { min_id: chMinId, max_id: chMaxId, total_rows: chTotalRows },
        expected_if_continuous: chRange,
        gaps_in_middle: chTotalRows < chRange,
        missing_ranges: missingRanges,
        total_missing_estimate: totalMissing,
        blocks_scanned: blocksScanned,
        block_size: blockSize,
        scan_stopped_early: scanStopped,
        recommendation: missingRanges.length === 0 
          ? '✅ Taranan bloklarda eksik yok. ID-based sync ile yeni kayıtları çekin.'
          : `⚠️ ${missingRanges.length} bölgede ~${totalMissing} eksik satır tespit edildi.`
      }
    });
  } catch (error) {
    next(error);
  }
});

// Sadece eksik verileri sync et
app.post('/datasets/:id/sync-missing', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    // ⚠️ KULLANICI PK KOLONUNU SEÇEBİLİR - hardcoded değil!
    const { ranges, pkColumn = 'id' } = req.body; // [{start: 1000, end: 2000}, ...]
    
    const dataset = await db.queryOne(`
      SELECT d.*, c.type as connection_type
      FROM datasets d
      JOIN data_connections c ON d.connection_id = c.id
      WHERE d.id = $1
    `, [id]);
    
    if (!dataset) throw new NotFoundError('Dataset bulunamadı');
    
    // ETL trigger - pub/sub ile ETL worker'a gönder - pkColumn dahil
    await cache.publish('etl:trigger', {
      datasetId: id,
      action: 'missing_sync',
      ranges: ranges || [],
      pkColumn // DİNAMİK KOLON
    });
    
    res.json({
      success: true,
      data: {
        message: 'Eksik veri sync işlemi başlatıldı',
        ranges_count: ranges?.length || 0
      }
    });
  } catch (error) {
    next(error);
  }
});

// 🚀 HIZLI SYNC: Sadece max ID'den sonraki yeni kayıtları çek
// 100M+ tablolar için en verimli yöntem!
app.post('/datasets/:id/sync-new-records', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    // SECURITY: SQL Injection koruması
    const safePkColumn = sanitizeTableName(req.body.pkColumn || 'id');
    const { limit } = req.body;
    
    const dataset = await db.queryOne(`
      SELECT d.*, c.type as connection_type, c.host, c.port, c.database_name, c.username, c.password_encrypted
      FROM datasets d
      JOIN data_connections c ON d.connection_id = c.id
      WHERE d.id = $1
    `, [id]);
    
    if (!dataset) throw new NotFoundError('Dataset bulunamadı');
    
    // SECURITY: SQL Injection koruması
    const safeClickhouseTable = sanitizeTableName(dataset.clickhouse_table);
    
    // ClickHouse'daki max ID'yi al
    const chStats = await clickhouse.queryOne(`
      SELECT max(${safePkColumn}) as max_id FROM clixer_analytics.${safeClickhouseTable}
    `);
    const chMaxId = Number(chStats?.max_id) || 0;
    
    // ETL job oluştur - tenant_id ve triggered_by dahil
    const tenantId = req.user?.tenantId || null;
    const userId = (req.user as any)?.id || null;
    const jobResult = await db.queryOne(`
      INSERT INTO etl_jobs (tenant_id, dataset_id, status, action, triggered_by, started_at)
      VALUES ($1, $2, 'pending', 'new_records_sync', $3, NOW())
      RETURNING id
    `, [tenantId, id, userId]);
    
    // ETL trigger
    await cache.publish('etl:trigger', {
      datasetId: id,
      jobId: jobResult.id,
      action: 'new_records_sync',
      pkColumn: safePkColumn,
      afterId: chMaxId,
      limit: limit || null
    });
    
    res.json({
      success: true,
      data: {
        message: `Max ID: ${chMaxId}'den sonraki kayıtlar çekilecek`,
        jobId: jobResult.id,
        clickhouse_max_id: chMaxId
      }
    });
  } catch (error) {
    next(error);
  }
});

// Duplicate analizi (sampling ile)
app.get('/datasets/:id/duplicate-analysis', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    const dataset = await db.queryOne('SELECT * FROM datasets WHERE id = $1', [id]);
    if (!dataset) throw new NotFoundError('Dataset bulunamadı');
    
    // SECURITY: SQL Injection koruması
    const safeClickhouseTable = sanitizeTableName(dataset.clickhouse_table);
    
    // Toplam ve unique sayısı - sampling ile
    const stats = await clickhouse.queryOne(`
      SELECT 
        count() as total_rows,
        min(id) as min_id,
        max(id) as max_id
      FROM clixer_analytics.${safeClickhouseTable}
    `);
    
    const totalRows = Number(stats?.total_rows) || 0;
    const minId = Number(stats?.min_id) || 0;
    const maxId = Number(stats?.max_id) || 0;
    const expectedUnique = maxId - minId + 1;
    const duplicateEstimate = Math.max(0, totalRows - expectedUnique);
    
    // İlk 1M ID'de sample duplicate kontrolü
    let sampleDuplicates = 0;
    try {
      const sampleResult = await clickhouse.queryOne(`
        SELECT count() - countDistinct(id) as dup_count
        FROM clixer_analytics.${safeClickhouseTable}
        WHERE id <= 1000000
      `);
      sampleDuplicates = Number(sampleResult?.dup_count) || 0;
    } catch (e) {
      // Memory hatası olabilir, devam et
    }
    
    res.json({
      success: true,
      data: {
        total_rows: totalRows,
        min_id: minId,
        max_id: maxId,
        expected_unique: expectedUnique,
        duplicate_estimate: duplicateEstimate,
        duplicate_percentage: totalRows > 0 ? ((duplicateEstimate / totalRows) * 100).toFixed(2) : '0',
        sample_duplicates: sampleDuplicates,
        can_optimize: duplicateEstimate > 0
      }
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// ERROR HANDLER
// ============================================

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  const isDev = process.env.NODE_ENV !== 'production';
  const errorResponse = formatError(err, isDev);
  const statusCode = err instanceof AppError ? err.statusCode : 500;
  logger.error('Request error', { error: err.message, path: req.path });
  res.status(statusCode).json(errorResponse);
});

// ============================================
// START SERVER
// ============================================

let server: any;

async function start() {
  try {
    db.createPool();
    await db.checkHealth();
    logger.info('PostgreSQL connected');

    clickhouse.createClickHouseClient();
    await clickhouse.checkHealth();
    logger.info('ClickHouse connected');

    cache.createRedisClient();
    await cache.checkHealth();
    logger.info('Redis connected');

    server = app.listen(PORT, () => {
      logger.info(`🔌 Data Service running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start data-service', { error });
    process.exit(1);
  }
}

// ============================================
// GRACEFUL SHUTDOWN
// ============================================

async function gracefulShutdown(signal: string) {
  logger.info(`${signal} received, starting graceful shutdown...`);
  
  if (server) {
    server.close(async () => {
      logger.info('HTTP server closed');
      
      try {
        await db.closePool();
        logger.info('Database pool closed');
        
        await cache.close();
        logger.info('Redis connection closed');
        
        logger.info('Graceful shutdown completed');
        process.exit(0);
      } catch (error: any) {
        logger.error('Error during shutdown', { error: error.message });
        process.exit(1);
      }
    });
  }
  
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

start();

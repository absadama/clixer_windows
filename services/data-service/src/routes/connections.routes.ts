/**
 * Connections Routes
 * Database connection management
 */

import { Router, Request, Response, NextFunction } from 'express';
import { db, authenticate, authorize, tenantIsolation, ROLES, createLogger, NotFoundError, ValidationError } from '@clixer/shared';

const router = Router();
const logger = createLogger({ service: 'data-service' });

/**
 * GET /connections
 * List all connections
 */
router.get('/', authenticate, tenantIsolation, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const connections = await db.queryAll(
      `SELECT id, tenant_id, name, type, host, port, database_name, username, status, last_tested_at, created_at
       FROM data_connections 
       WHERE tenant_id = $1
       ORDER BY name`,
      [req.user!.tenantId]
    );
    
    res.json({ success: true, data: connections });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /connections
 * Create new connection
 */
router.post('/', authenticate, authorize(ROLES.ADMIN, ROLES.MANAGER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, type, host, port, databaseName, username, password, apiConfig, sslEnabled } = req.body;
    
    if (!name || !type) {
      throw new ValidationError('name ve type zorunlu');
    }
    
    // Şifreyi encrypt et
    const { encrypt } = require('@clixer/shared');
    const encryptedPassword = password ? encrypt(password) : null;
    
    const result = await db.queryOne(
      `INSERT INTO data_connections (tenant_id, name, type, host, port, database_name, username, password_encrypted, api_config, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'inactive')
       RETURNING id, name, type, host, port, database_name, status`,
      [req.user!.tenantId, name, type, host, port, databaseName, username, encryptedPassword, apiConfig ? JSON.stringify(apiConfig) : null]
    );
    
    logger.info('Connection created', { connectionId: result.id, user: req.user?.email });
    
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /connections/:id
 * Update connection
 */
router.put('/:id', authenticate, authorize(ROLES.ADMIN, ROLES.MANAGER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name, host, port, databaseName, username, password, apiConfig } = req.body;
    
    // Şifre varsa encrypt et, yoksa null gönder (COALESCE mevcut değeri korur)
    const { encrypt } = require('@clixer/shared');
    const encryptedPassword = password && password.trim() ? encrypt(password) : null;
    
    const result = await db.queryOne(
      `UPDATE data_connections SET
         name = COALESCE($1, name),
         host = COALESCE($2, host),
         port = COALESCE($3, port),
         database_name = COALESCE($4, database_name),
         username = COALESCE($5, username),
         password_encrypted = COALESCE($6, password_encrypted),
         api_config = COALESCE($7, api_config),
         updated_at = NOW()
       WHERE id = $8 AND tenant_id = $9
       RETURNING id, name, type, host, port, database_name, status`,
      [name, host, port, databaseName, username, encryptedPassword, apiConfig ? JSON.stringify(apiConfig) : null, id, req.user!.tenantId]
    );
    
    if (!result) {
      throw new NotFoundError('Connection');
    }
    
    logger.info('Connection updated', { connectionId: id, user: req.user?.email });
    
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /connections/:id
 * Delete connection
 */
router.delete('/:id', authenticate, authorize(ROLES.ADMIN, ROLES.MANAGER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    // Check if any datasets use this connection
    const datasets = await db.queryAll(
      'SELECT id, name FROM datasets WHERE connection_id = $1',
      [id]
    );
    
    if (datasets.length > 0) {
      throw new ValidationError(`Bu bağlantı ${datasets.length} dataset tarafından kullanılıyor`);
    }
    
    const result = await db.query(
      'DELETE FROM data_connections WHERE id = $1 AND tenant_id = $2',
      [id, req.user!.tenantId]
    );
    
    if (result.rowCount === 0) {
      throw new NotFoundError('Connection');
    }
    
    logger.info('Connection deleted', { connectionId: id, user: req.user?.email });
    
    res.json({ success: true, message: 'Bağlantı silindi' });
  } catch (error) {
    next(error);
  }
});

// NOTE: Complex endpoints (test, tables, columns, query, preview) remain in index.ts
// due to heavy database driver dependencies

export default router;

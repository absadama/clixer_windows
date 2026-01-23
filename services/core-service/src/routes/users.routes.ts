/**
 * User Management Routes
 */

import { Router, Request, Response, NextFunction } from 'express';
import { db, authenticate, authorize, ROLES, createLogger, NotFoundError, ValidationError, validatePassword } from '@clixer/shared';
import bcrypt from 'bcryptjs';

const router = Router();
const logger = createLogger({ service: 'core-service' });

/**
 * GET /users
 * Get all users for tenant (Admin/Manager only)
 */
router.get('/', authenticate, authorize(ROLES.ADMIN, ROLES.MANAGER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await db.queryAll(
      `SELECT u.id, u.email, u.name, u.role, u.position_code, u.tenant_id, u.is_active, u.created_at,
              u.filter_value,
              p.name as position_name, p.filter_level,
              (SELECT COUNT(*) FROM user_stores WHERE user_id = u.id) as store_count
       FROM users u
       LEFT JOIN positions p ON u.position_code = p.code
       WHERE u.tenant_id = $1 
       ORDER BY u.created_at DESC`,
      [req.user!.tenantId]
    );
    res.json({ success: true, data: users });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /users/:id
 * Get a specific user by ID
 */
router.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await db.queryOne(
      `SELECT u.id, u.email, u.name, u.role, u.position_code, u.tenant_id, u.is_active, u.created_at,
              u.filter_value,
              p.name as position_name, p.filter_level
       FROM users u
       LEFT JOIN positions p ON u.position_code = p.code
       WHERE u.id = $1 AND u.tenant_id = $2`,
      [req.params.id, req.user!.tenantId]
    );
    if (!user) throw new NotFoundError('Kullanıcı');
    
    // Get user stores
    const stores = await db.queryAll(
      'SELECT store_id, store_name, assigned_at FROM user_stores WHERE user_id = $1',
      [req.params.id]
    );
    
    res.json({ success: true, data: { ...user, stores } });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /users
 * Create a new user (Admin only)
 */
router.post('/', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, name, password, role, position_code, stores } = req.body;
    
    if (!email || !name || !password) {
      throw new ValidationError('Email, isim ve şifre zorunludur');
    }
    
    // Password strength check
    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) {
      throw new ValidationError(passwordCheck.errors.join('. '));
    }
    
    // Email uniqueness check
    const existing = await db.queryOne('SELECT id FROM users WHERE email = $1', [email]);
    if (existing) {
      throw new ValidationError('Bu email zaten kullanımda');
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);
    
    // Create user
    const result = await db.queryOne(
      `INSERT INTO users (tenant_id, email, name, password_hash, role, position_code, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE)
       RETURNING id, email, name, role, position_code`,
      [req.user!.tenantId, email, name, hashedPassword, role || 'VIEWER', position_code || 'VIEWER']
    );
    
    // Assign stores
    if (stores && stores.length > 0) {
      for (const store of stores) {
        await db.query(
          'INSERT INTO user_stores (user_id, store_id, store_name, assigned_by) VALUES ($1, $2, $3, $4)',
          [result.id, store.store_id, store.store_name, req.user!.userId]
        );
      }
    }
    
    logger.info('User created', { email, role, position_code, user: req.user!.email });
    res.status(201).json({ success: true, data: result, message: 'Kullanıcı oluşturuldu' });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /users/:id
 * Update a user (Admin only)
 */
router.put('/:id', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { email, name, role, position_code, is_active, stores, filter_value } = req.body;
    
    // Check email uniqueness if changed
    if (email) {
      const existingUser = await db.queryOne(
        'SELECT id FROM users WHERE email = $1 AND tenant_id = $2 AND id != $3',
        [email.toLowerCase().trim(), req.user!.tenantId, id]
      );
      if (existingUser) {
        throw new ValidationError('Bu email adresi başka bir kullanıcı tarafından kullanılıyor.');
      }
    }
    
    const result = await db.queryOne(
      `UPDATE users SET 
         email = COALESCE($1, email),
         name = COALESCE($2, name),
         role = COALESCE($3, role),
         position_code = COALESCE($4, position_code),
         is_active = COALESCE($5, is_active),
         filter_value = $6,
         updated_at = NOW()
       WHERE id = $7 AND tenant_id = $8
       RETURNING id, email, name, role, position_code, is_active, filter_value`,
      [email ? email.toLowerCase().trim() : null, name, role, position_code, is_active, filter_value || null, id, req.user!.tenantId]
    );
    
    if (!result) throw new NotFoundError('Kullanıcı');
    
    // Update stores
    if (stores !== undefined) {
      await db.query('DELETE FROM user_stores WHERE user_id = $1', [id]);
      for (const store of stores) {
        await db.query(
          'INSERT INTO user_stores (user_id, store_id, store_name, assigned_by) VALUES ($1, $2, $3, $4)',
          [id, store.store_id, store.store_name, req.user!.userId]
        );
      }
    }
    
    logger.info('User updated', { id, user: req.user!.email });
    res.json({ success: true, data: result, message: 'Kullanıcı güncellendi' });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /users/:id
 * Delete a user (Admin only)
 */
router.delete('/:id', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await db.query(
      'DELETE FROM users WHERE id = $1 AND tenant_id = $2 RETURNING id',
      [req.params.id, req.user!.tenantId]
    );
    
    if (result.rowCount === 0) throw new NotFoundError('Kullanıcı');
    
    logger.info('User deleted', { id: req.params.id, user: req.user!.email });
    res.json({ success: true, message: 'Kullanıcı silindi' });
  } catch (error) {
    next(error);
  }
});

export default router;

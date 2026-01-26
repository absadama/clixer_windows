/**
 * User Management Routes
 * SECURITY: Role assignment whitelist ile Mass Assignment koruması
 * SECURITY: Token blacklist ile anında oturum sonlandırma
 */

import { Router, Request, Response, NextFunction } from 'express';
import { db, authenticate, authorize, ROLES, createLogger, NotFoundError, ValidationError, validatePassword, ForbiddenError, blacklistUser, removeFromBlacklist } from '@clixer/shared';
import bcrypt from 'bcryptjs';

const router = Router();
const logger = createLogger({ service: 'core-service' });

// ============================================
// SECURITY: Role Assignment Whitelist
// ============================================
const ASSIGNABLE_ROLES = ['VIEWER', 'USER', 'MANAGER', 'ADMIN'] as const;
const ADMIN_ONLY_ROLES = ['ADMIN', 'SUPER_ADMIN'] as const;

/**
 * SECURITY: Validate and sanitize role assignment
 * Prevents privilege escalation via mass assignment
 */
function validateRoleAssignment(requestedRole: string | undefined, currentUserRole: string): string {
  // Varsayılan rol VIEWER
  if (!requestedRole) return 'VIEWER';
  
  const role = requestedRole.toUpperCase();
  
  // SUPER_ADMIN sadece sistem tarafından atanabilir
  if (role === 'SUPER_ADMIN') {
    logger.warn('Attempted SUPER_ADMIN role assignment blocked');
    throw new ForbiddenError('SUPER_ADMIN rolü atanamaz');
  }
  
  // Geçerli bir rol mü?
  if (!ASSIGNABLE_ROLES.includes(role as any)) {
    throw new ValidationError(`Geçersiz rol: ${role}. İzin verilen roller: ${ASSIGNABLE_ROLES.join(', ')}`);
  }
  
  // ADMIN rolü sadece ADMIN kullanıcılar tarafından atanabilir
  if ((ADMIN_ONLY_ROLES as readonly string[]).includes(role) && currentUserRole !== 'ADMIN' && currentUserRole !== 'SUPER_ADMIN') {
    throw new ForbiddenError('Sadece Admin kullanıcılar Admin rolü atayabilir');
  }
  
  return role;
}

/**
 * GET /users
 * Get all users for tenant (Admin/Manager only)
 */
router.get('/', authenticate, authorize(ROLES.ADMIN, ROLES.MANAGER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await db.queryAll(
      `SELECT u.id, u.email, u.name, u.role, u.position_code, u.tenant_id, u.is_active, u.created_at,
              u.filter_value, u.phone_number, u.phone_active,
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
              u.filter_value, u.phone_number, u.phone_active,
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
 * SECURITY: Role whitelist validation applied
 */
router.post('/', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, name, password, role, position_code, stores } = req.body;
    
    if (!email || !name || !password) {
      throw new ValidationError('Email, isim ve şifre zorunludur');
    }
    
    // SECURITY: Validate role assignment (prevents privilege escalation)
    const validatedRole = validateRoleAssignment(role, req.user!.role);
    
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
    
    // Phone number ve active from request body
    const { phone_number, phone_active } = req.body;
    
    // Create user with validated role
    const result = await db.queryOne(
      `INSERT INTO users (tenant_id, email, name, password_hash, role, position_code, is_active, phone_number, phone_active)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE, $7, COALESCE($8, TRUE))
       RETURNING id, email, name, role, position_code, phone_number, phone_active`,
      [req.user!.tenantId, email, name, hashedPassword, validatedRole, position_code || 'VIEWER', phone_number || null, phone_active]
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
 * SECURITY: Role whitelist validation applied
 * SECURITY: Blacklist kullanıcı pasife alındığında, whitelist aktife alındığında
 */
router.put('/:id', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { email, name, role, position_code, is_active, stores, filter_value, phone_number, phone_active } = req.body;
    
    // SECURITY: Validate role assignment if provided (prevents privilege escalation)
    const validatedRole = role ? validateRoleAssignment(role, req.user!.role) : null;
    
    // Mevcut durumu al (blacklist kararı için)
    const currentUser = await db.queryOne(
      'SELECT is_active, phone_active FROM users WHERE id = $1 AND tenant_id = $2',
      [id, req.user!.tenantId]
    );
    if (!currentUser) throw new NotFoundError('Kullanıcı');
    
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
         phone_number = $7,
         phone_active = COALESCE($8, phone_active),
         updated_at = NOW()
       WHERE id = $9 AND tenant_id = $10
       RETURNING id, email, name, role, position_code, is_active, filter_value, phone_number, phone_active`,
      [email ? email.toLowerCase().trim() : null, name, validatedRole, position_code, is_active, filter_value || null, phone_number || null, phone_active, id, req.user!.tenantId]
    );
    
    if (!result) throw new NotFoundError('Kullanıcı');
    
    // SECURITY: Kullanıcı pasife alındıysa token'ları hemen geçersiz kıl
    if (is_active === false && currentUser.is_active === true) {
      await blacklistUser(id, 'deactivated');
      logger.info('User deactivated and blacklisted', { userId: id, by: req.user!.email });
    }
    
    // Kullanıcı tekrar aktif edildiyse blacklist'ten kaldır
    if (is_active === true && currentUser.is_active === false) {
      await removeFromBlacklist(id);
      logger.info('User reactivated and removed from blacklist', { userId: id, by: req.user!.email });
    }
    
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
 * SECURITY: Silinen kullanıcının token'ları anında geçersiz olur
 */
router.delete('/:id', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(
      'DELETE FROM users WHERE id = $1 AND tenant_id = $2 RETURNING id',
      [id, req.user!.tenantId]
    );
    
    if (result.rowCount === 0) throw new NotFoundError('Kullanıcı');
    
    // SECURITY: Silinen kullanıcının token'larını hemen geçersiz kıl
    await blacklistUser(id, 'deleted');
    
    logger.info('User deleted and blacklisted', { id, user: req.user!.email });
    res.json({ success: true, message: 'Kullanıcı silindi' });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /users/:id/preferences
 * Update user's own preferences (theme, language, etc.)
 * Users can only update their own preferences
 */
router.put('/:id/preferences', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { theme, language, emailNotifications, pushNotifications, weeklyReport } = req.body;
    
    // Kullanıcı sadece kendi tercihlerini güncelleyebilir (veya admin herkesin tercihlerini)
    const userId = (req.user as any).userId || (req.user as any).id;
    if (id !== userId && (req.user as any).role !== 'ADMIN') {
      throw new ForbiddenError('Sadece kendi tercihlerinizi güncelleyebilirsiniz');
    }
    
    // Mevcut preferences'ı al
    const currentResult = await db.query(
      'SELECT preferences FROM users WHERE id = $1',
      [id]
    );
    
    if (currentResult.rows.length === 0) {
      throw new NotFoundError('Kullanıcı');
    }
    
    const currentPrefs = currentResult.rows[0].preferences || {};
    
    // Yeni tercihleri mevcut tercihlerle birleştir
    const newPrefs = {
      ...currentPrefs,
      ...(theme && { theme }),
      ...(language && { language }),
      ...(typeof emailNotifications === 'boolean' && { emailNotifications }),
      ...(typeof pushNotifications === 'boolean' && { pushNotifications }),
      ...(typeof weeklyReport === 'boolean' && { weeklyReport }),
    };
    
    // Güncelle
    await db.query(
      'UPDATE users SET preferences = $1, updated_at = NOW() WHERE id = $2',
      [JSON.stringify(newPrefs), id]
    );
    
    logger.info('User preferences updated', { userId: id, preferences: newPrefs });
    res.json({ success: true, data: newPrefs });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /users/:id/reset-2fa
 * Reset 2FA for a user (Admin only)
 * Clears 2FA secret so user can set it up again on next login
 */
router.post('/:id/reset-2fa', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    // Check if user exists in tenant
    const user = await db.queryOne(
      'SELECT id, email, two_factor_enabled FROM users WHERE id = $1 AND tenant_id = $2',
      [id, req.user!.tenantId]
    );
    
    if (!user) throw new NotFoundError('Kullanıcı');
    
    // Reset 2FA
    await db.query(
      `UPDATE users SET 
         two_factor_secret = NULL, 
         two_factor_enabled = false,
         updated_at = NOW()
       WHERE id = $1`,
      [id]
    );
    
    logger.info('2FA reset for user', { userId: id, email: user.email, by: req.user!.email });
    res.json({ success: true, message: '2FA sıfırlandı. Kullanıcı tekrar kurulum yapabilir.' });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /users/:id/preferences
 * Get user's preferences
 * Users can only get their own preferences
 */
router.get('/:id/preferences', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    // Kullanıcı sadece kendi tercihlerini görebilir (veya admin tüm kullanıcıları)
    const userId = (req.user as any).userId || (req.user as any).id;
    if (id !== userId && (req.user as any).role !== 'ADMIN') {
      throw new ForbiddenError('Bu kullanıcının tercihlerine erişim yetkiniz yok');
    }
    
    const result = await db.query(
      'SELECT preferences FROM users WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      throw new NotFoundError('Kullanıcı');
    }
    
    res.json({ success: true, data: result.rows[0].preferences || {} });
  } catch (error) {
    next(error);
  }
});

export default router;

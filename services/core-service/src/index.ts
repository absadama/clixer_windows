/**
 * Clixer - Core Service
 * Users, Tenants, Designs, Components, Settings
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';

dotenv.config({ path: '../../.env' });

import {
  createLogger,
  requestLogger,
  db,
  cache,
  authenticate,
  authorize,
  tenantIsolation,
  AppError,
  formatError,
  NotFoundError,
  ValidationError,
  ROLES
} from '@clixer/shared';

import bcrypt from 'bcryptjs';

const logger = createLogger({ service: 'core-service' });
const app = express();
const PORT = process.env.CORE_SERVICE_PORT || 4002;

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(requestLogger(logger));

// ============================================
// ROUTES
// ============================================

// Health check
app.get('/health', async (req: Request, res: Response) => {
  const dbHealthy = await db.checkHealth();
  res.json({
    service: 'core-service',
    status: dbHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString()
  });
});

// ============================================
// POSITIONS (Pozisyon Yönetimi)
// ============================================

app.get('/positions', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const positions = await db.queryAll(
      'SELECT code, name, hierarchy_level, can_see_all_stores, description, filter_level FROM positions ORDER BY hierarchy_level'
    );
    res.json({ success: true, data: positions });
  } catch (error) {
    next(error);
  }
});

app.get('/positions/:code/permissions', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const permissions = await db.queryAll(
      'SELECT menu_key, can_view, can_edit FROM menu_permissions WHERE position_code = $1',
      [req.params.code]
    );
    res.json({ success: true, data: permissions });
  } catch (error) {
    next(error);
  }
});

app.put('/positions/:code/permissions', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code } = req.params;
    const { permissions } = req.body; // [{ menu_key, can_view, can_edit }]
    
    // Önce mevcut izinleri sil
    await db.query('DELETE FROM menu_permissions WHERE position_code = $1', [code]);
    
    // Yeni izinleri ekle
    for (const perm of permissions) {
      await db.query(
        'INSERT INTO menu_permissions (position_code, menu_key, can_view, can_edit) VALUES ($1, $2, $3, $4)',
        [code, perm.menu_key, perm.can_view, perm.can_edit]
      );
    }
    
    logger.info('Position permissions updated', { code, user: req.user!.email });
    res.json({ success: true, message: 'İzinler güncellendi' });
  } catch (error) {
    next(error);
  }
});

// ============================================
// USERS (Kullanıcı Yönetimi)
// ============================================

app.get('/users', authenticate, authorize(ROLES.ADMIN, ROLES.MANAGER), async (req: Request, res: Response, next: NextFunction) => {
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

app.get('/users/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
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
    
    // Kullanıcının mağazalarını da getir
    const stores = await db.queryAll(
      'SELECT store_id, store_name, assigned_at FROM user_stores WHERE user_id = $1',
      [req.params.id]
    );
    
    res.json({ success: true, data: { ...user, stores } });
  } catch (error) {
    next(error);
  }
});

// Kullanıcı oluştur
app.post('/users', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, name, password, role, position_code, stores } = req.body;
    
    if (!email || !name || !password) {
      throw new ValidationError('Email, isim ve şifre zorunludur');
    }
    
    // Güçlü şifre politikası kontrolü
    const { validatePassword } = require('@clixer/shared');
    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) {
      throw new ValidationError(passwordCheck.errors.join('. '));
    }
    
    // Email kontrolü
    const existing = await db.queryOne('SELECT id FROM users WHERE email = $1', [email]);
    if (existing) {
      throw new ValidationError('Bu email zaten kullanımda');
    }
    
    // Şifreyi hashle
    const hashedPassword = await bcrypt.hash(password, 12);
    
    // Kullanıcı oluştur
    const result = await db.queryOne(
      `INSERT INTO users (tenant_id, email, name, password_hash, role, position_code, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE)
       RETURNING id, email, name, role, position_code`,
      [req.user!.tenantId, email, name, hashedPassword, role || 'VIEWER', position_code || 'VIEWER']
    );
    
    // Mağazaları ata
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

// Kullanıcı güncelle
app.put('/users/:id', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { email, name, role, position_code, is_active, stores, filter_value } = req.body;
    
    // Email değişikliği varsa duplicate kontrolü yap
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
    
    // Mağazaları güncelle
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

// Kullanıcı sil
app.delete('/users/:id', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
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

// ============================================
// USER STORES (Kullanıcı-Mağaza Ataması)
// ============================================

app.get('/users/:id/stores', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stores = await db.queryAll(
      'SELECT store_id, store_name, assigned_at FROM user_stores WHERE user_id = $1',
      [req.params.id]
    );
    res.json({ success: true, data: stores });
  } catch (error) {
    next(error);
  }
});

app.post('/users/:id/stores', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { stores } = req.body; // [{ store_id, store_name }]
    
    for (const store of stores) {
      await db.query(
        `INSERT INTO user_stores (user_id, store_id, store_name, assigned_by) 
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, store_id) DO NOTHING`,
        [req.params.id, store.store_id, store.store_name, req.user!.userId]
      );
    }
    
    res.json({ success: true, message: 'Mağazalar atandı' });
  } catch (error) {
    next(error);
  }
});

app.delete('/users/:id/stores/:storeId', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await db.query(
      'DELETE FROM user_stores WHERE user_id = $1 AND store_id = $2',
      [req.params.id, req.params.storeId]
    );
    res.json({ success: true, message: 'Mağaza ataması kaldırıldı' });
  } catch (error) {
    next(error);
  }
});

// ============================================
// STORE FINANCE SETTINGS (Mağaza Finansal Ayarları)
// ============================================

app.get('/store-finance', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { store_id } = req.query;
    
    if (store_id) {
      const settings = await db.queryOne(
        'SELECT * FROM store_finance_settings WHERE tenant_id = $1 AND store_id = $2',
        [req.user!.tenantId, store_id]
      );
      res.json({ success: true, data: settings });
    } else {
      const settings = await db.queryAll(
        'SELECT * FROM store_finance_settings WHERE tenant_id = $1 ORDER BY store_name',
        [req.user!.tenantId]
      );
      res.json({ success: true, data: settings });
    }
  } catch (error) {
    next(error);
  }
});

app.post('/store-finance', authenticate, authorize(ROLES.ADMIN, ROLES.MANAGER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { 
      store_id, store_name,
      fixed_rent, revenue_share_percent, common_area_cost, target_cogs_percent,
      royalty_percent, marketing_percent, electricity_budget, water_budget,
      manager_count, manager_salary, kitchen_count, kitchen_salary,
      service_count, service_salary, courier_count, courier_salary,
      initial_investment, opening_date
    } = req.body;
    
    if (!store_id) {
      throw new ValidationError('Mağaza ID zorunludur');
    }
    
    // Upsert
    const result = await db.queryOne(
      `INSERT INTO store_finance_settings (
         tenant_id, store_id, store_name,
         fixed_rent, revenue_share_percent, common_area_cost, target_cogs_percent,
         royalty_percent, marketing_percent, electricity_budget, water_budget,
         manager_count, manager_salary, kitchen_count, kitchen_salary,
         service_count, service_salary, courier_count, courier_salary,
         initial_investment, opening_date
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
       ON CONFLICT (tenant_id, store_id) DO UPDATE SET
         store_name = EXCLUDED.store_name,
         fixed_rent = EXCLUDED.fixed_rent,
         revenue_share_percent = EXCLUDED.revenue_share_percent,
         common_area_cost = EXCLUDED.common_area_cost,
         target_cogs_percent = EXCLUDED.target_cogs_percent,
         royalty_percent = EXCLUDED.royalty_percent,
         marketing_percent = EXCLUDED.marketing_percent,
         electricity_budget = EXCLUDED.electricity_budget,
         water_budget = EXCLUDED.water_budget,
         manager_count = EXCLUDED.manager_count,
         manager_salary = EXCLUDED.manager_salary,
         kitchen_count = EXCLUDED.kitchen_count,
         kitchen_salary = EXCLUDED.kitchen_salary,
         service_count = EXCLUDED.service_count,
         service_salary = EXCLUDED.service_salary,
         courier_count = EXCLUDED.courier_count,
         courier_salary = EXCLUDED.courier_salary,
         initial_investment = EXCLUDED.initial_investment,
         opening_date = EXCLUDED.opening_date,
         updated_at = NOW()
       RETURNING *`,
      [
        req.user!.tenantId, store_id, store_name,
        fixed_rent || 0, revenue_share_percent || 0, common_area_cost || 0, target_cogs_percent || 35,
        royalty_percent || 0, marketing_percent || 0, electricity_budget || 0, water_budget || 0,
        manager_count || 1, manager_salary || 0, kitchen_count || 0, kitchen_salary || 0,
        service_count || 0, service_salary || 0, courier_count || 0, courier_salary || 0,
        initial_investment || 0, opening_date || null
      ]
    );
    
    logger.info('Store finance settings saved', { store_id, user: req.user!.email });
    res.json({ success: true, data: result, message: 'Mağaza finansal ayarları kaydedildi' });
  } catch (error) {
    next(error);
  }
});

// ============================================
// REGIONS (Bölgeler)
// ============================================

app.get('/regions', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const regions = await db.queryAll(
      'SELECT id, code, name, description, manager_name, manager_email, sort_order, is_active FROM regions WHERE tenant_id = $1 AND is_active = TRUE ORDER BY sort_order, name',
      [req.user!.tenantId]
    );
    res.json({ success: true, data: regions });
  } catch (error) {
    next(error);
  }
});

// ============================================
// STORES (Mağazalar)
// ============================================

app.get('/stores', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { region_id, store_type } = req.query;
    
    let sql = `
      SELECT s.id, s.code, s.name, s.store_type, s.ownership_group, s.region_id, s.city, s.district, s.address, s.phone, s.email, s.manager_name, s.manager_email, s.opening_date, s.square_meters, s.employee_count, s.is_active,
             r.name as region_name
      FROM stores s
      LEFT JOIN regions r ON s.region_id = r.id
      WHERE s.tenant_id = $1 AND s.is_active = TRUE
    `;
    const params: any[] = [req.user!.tenantId];
    
    if (region_id) {
      params.push(region_id);
      sql += ` AND s.region_id = $${params.length}`;
    }
    
    if (store_type && store_type !== 'ALL') {
      params.push(store_type);
      sql += ` AND s.store_type = $${params.length}`;
    }
    
    sql += ' ORDER BY r.name, s.name';
    
    const stores = await db.queryAll(sql, params);
    res.json({ success: true, data: stores });
  } catch (error) {
    next(error);
  }
});

app.get('/stores/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const store = await db.queryOne(
      `SELECT s.*, r.name as region_name 
       FROM stores s 
       LEFT JOIN regions r ON s.region_id = r.id 
       WHERE s.id = $1 AND s.tenant_id = $2`,
      [req.params.id, req.user!.tenantId]
    );
    if (!store) throw new NotFoundError('Mağaza');
    res.json({ success: true, data: store });
  } catch (error) {
    next(error);
  }
});

// Mağaza Ekle
app.post('/stores', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, name, store_type, ownership_group, region_id, city, district, address, phone, email, manager_name, manager_email, opening_date, square_meters, employee_count, rent_amount, target_revenue } = req.body;
    
    if (!code || !name) {
      throw new ValidationError('Mağaza kodu ve adı zorunludur');
    }
    
    const result = await db.queryOne(
      `INSERT INTO stores (tenant_id, code, name, store_type, ownership_group, region_id, city, district, address, phone, email, manager_name, manager_email, opening_date, square_meters, employee_count, rent_amount, target_revenue)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
       RETURNING *`,
      [req.user!.tenantId, code, name, store_type || 'MAGAZA', ownership_group || 'MERKEZ', region_id, city, district, address, phone, email, manager_name, manager_email, opening_date, square_meters, employee_count, rent_amount, target_revenue]
    );
    
    logger.info('Store created', { code, user: req.user!.email });
    res.status(201).json({ success: true, data: result });
  } catch (error: any) {
    if (error.code === '23505') {
      next(new ValidationError('Bu mağaza kodu zaten kullanılıyor'));
    } else {
      next(error);
    }
  }
});

// Mağaza Güncelle
app.put('/stores/:id', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { code, name, store_type, ownership_group, region_id, city, district, address, phone, email, manager_name, manager_email, opening_date, closing_date, square_meters, employee_count, rent_amount, target_revenue, is_active } = req.body;
    
    const result = await db.queryOne(
      `UPDATE stores SET 
        code = COALESCE($3, code),
        name = COALESCE($4, name),
        store_type = COALESCE($5, store_type),
        ownership_group = COALESCE($6, ownership_group),
        region_id = $7,
        city = COALESCE($8, city),
        district = COALESCE($9, district),
        address = COALESCE($10, address),
        phone = COALESCE($11, phone),
        email = COALESCE($12, email),
        manager_name = COALESCE($13, manager_name),
        manager_email = COALESCE($14, manager_email),
        opening_date = COALESCE($15, opening_date),
        closing_date = $16,
        square_meters = COALESCE($17, square_meters),
        employee_count = COALESCE($18, employee_count),
        rent_amount = COALESCE($19, rent_amount),
        target_revenue = COALESCE($20, target_revenue),
        is_active = COALESCE($21, is_active),
        updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2
       RETURNING *`,
      [id, req.user!.tenantId, code, name, store_type, ownership_group, region_id, city, district, address, phone, email, manager_name, manager_email, opening_date, closing_date, square_meters, employee_count, rent_amount, target_revenue, is_active]
    );
    
    if (!result) throw new NotFoundError('Mağaza');
    logger.info('Store updated', { id, user: req.user!.email });
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// Mağaza Sil
app.delete('/stores/:id', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    const result = await db.queryOne(
      'DELETE FROM stores WHERE id = $1 AND tenant_id = $2 RETURNING id',
      [id, req.user!.tenantId]
    );
    
    if (!result) throw new NotFoundError('Mağaza');
    logger.info('Store deleted', { id, user: req.user!.email });
    res.json({ success: true, message: 'Mağaza silindi' });
  } catch (error) {
    next(error);
  }
});

// ============================================
// REGIONS CRUD (Bölge Yönetimi)
// ============================================

// Bölge Ekle
app.post('/regions', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, name, description, manager_name, manager_email } = req.body;
    
    if (!code || !name) {
      throw new ValidationError('Bölge kodu ve adı zorunludur');
    }
    
    const result = await db.queryOne(
      `INSERT INTO regions (tenant_id, code, name, description, manager_name, manager_email)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [req.user!.tenantId, code, name, description, manager_name, manager_email]
    );
    
    logger.info('Region created', { code, user: req.user!.email });
    res.status(201).json({ success: true, data: result });
  } catch (error: any) {
    if (error.code === '23505') {
      next(new ValidationError('Bu bölge kodu zaten kullanılıyor'));
    } else {
      next(error);
    }
  }
});

// Bölge Güncelle
app.put('/regions/:id', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { code, name, description, manager_name, manager_email, is_active } = req.body;
    
    const result = await db.queryOne(
      `UPDATE regions SET 
        code = COALESCE($3, code),
        name = COALESCE($4, name),
        description = COALESCE($5, description),
        manager_name = COALESCE($6, manager_name),
        manager_email = COALESCE($7, manager_email),
        is_active = COALESCE($8, is_active),
        updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2
       RETURNING *`,
      [id, req.user!.tenantId, code, name, description, manager_name, manager_email, is_active]
    );
    
    if (!result) throw new NotFoundError('Bölge');
    logger.info('Region updated', { id, user: req.user!.email });
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// Bölge Sil
app.delete('/regions/:id', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    // Bağlı mağaza var mı kontrol et
    const storeCount = await db.queryOne(
      'SELECT COUNT(*) as count FROM stores WHERE region_id = $1',
      [id]
    );
    
    if (storeCount && storeCount.count > 0) {
      throw new ValidationError(`Bu bölgeye bağlı ${storeCount.count} mağaza var. Önce mağazaları farklı bölgeye taşıyın.`);
    }
    
    const result = await db.queryOne(
      'DELETE FROM regions WHERE id = $1 AND tenant_id = $2 RETURNING id',
      [id, req.user!.tenantId]
    );
    
    if (!result) throw new NotFoundError('Bölge');
    logger.info('Region deleted', { id, user: req.user!.email });
    res.json({ success: true, message: 'Bölge silindi' });
  } catch (error) {
    next(error);
  }
});

// ============================================
// OWNERSHIP GROUPS (Sahiplik Grupları)
// ============================================

app.get('/ownership-groups', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const groups = await db.queryAll(
      'SELECT id, code, name, description, color, icon, is_active FROM ownership_groups WHERE tenant_id = $1 AND is_active = TRUE ORDER BY sort_order, name',
      [req.user!.tenantId]
    );
    res.json({ success: true, data: groups });
  } catch (error) {
    next(error);
  }
});

app.post('/ownership-groups', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, name, description, color, icon } = req.body;
    
    if (!code || !name) {
      throw new ValidationError('Grup kodu ve adı zorunludur');
    }
    
    const result = await db.queryOne(
      `INSERT INTO ownership_groups (tenant_id, code, name, description, color, icon)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [req.user!.tenantId, code, name, description, color, icon]
    );
    
    logger.info('Ownership group created', { code, user: req.user!.email });
    res.status(201).json({ success: true, data: result });
  } catch (error: any) {
    if (error.code === '23505') {
      next(new ValidationError('Bu grup kodu zaten kullanılıyor'));
    } else {
      next(error);
    }
  }
});

app.put('/ownership-groups/:id', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { code, name, description, color, icon, is_active } = req.body;
    
    const result = await db.queryOne(
      `UPDATE ownership_groups SET 
        code = COALESCE($3, code),
        name = COALESCE($4, name),
        description = COALESCE($5, description),
        color = COALESCE($6, color),
        icon = COALESCE($7, icon),
        is_active = COALESCE($8, is_active),
        updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2
       RETURNING *`,
      [id, req.user!.tenantId, code, name, description, color, icon, is_active]
    );
    
    if (!result) throw new NotFoundError('Sahiplik grubu');
    logger.info('Ownership group updated', { id, user: req.user!.email });
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

app.delete('/ownership-groups/:id', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    const result = await db.queryOne(
      'DELETE FROM ownership_groups WHERE id = $1 AND tenant_id = $2 RETURNING id',
      [id, req.user!.tenantId]
    );
    
    if (!result) throw new NotFoundError('Sahiplik grubu');
    logger.info('Ownership group deleted', { id, user: req.user!.email });
    res.json({ success: true, message: 'Sahiplik grubu silindi' });
  } catch (error) {
    next(error);
  }
});

// ============================================
// EXCEL IMPORT (Master Veriler için)
// ============================================

app.post('/stores/import', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { data } = req.body; // [{ code, name, store_type, region_code, city, ... }]
    
    if (!Array.isArray(data) || data.length === 0) {
      throw new ValidationError('Veri dizisi boş veya geçersiz');
    }
    
    let imported = 0;
    let errors: string[] = [];
    
    for (const row of data) {
      try {
        // Region code'dan ID bul
        let regionId = null;
        if (row.region_code) {
          const region = await db.queryOne(
            'SELECT id FROM regions WHERE code = $1 AND tenant_id = $2',
            [row.region_code, req.user!.tenantId]
          );
          regionId = region?.id;
        }
        
        await db.query(
          `INSERT INTO stores (tenant_id, code, name, store_type, ownership_group, region_id, city, district, address, phone, email, manager_name, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true)
           ON CONFLICT (tenant_id, code) DO UPDATE SET
             name = EXCLUDED.name,
             store_type = EXCLUDED.store_type,
             ownership_group = EXCLUDED.ownership_group,
             region_id = EXCLUDED.region_id,
             city = EXCLUDED.city,
             district = EXCLUDED.district,
             address = EXCLUDED.address,
             phone = EXCLUDED.phone,
             email = EXCLUDED.email,
             manager_name = EXCLUDED.manager_name,
             updated_at = NOW()`,
          [req.user!.tenantId, row.code, row.name, row.store_type || 'MAGAZA', row.ownership_group || 'MERKEZ', regionId, row.city, row.district, row.address, row.phone, row.email, row.manager_name]
        );
        imported++;
      } catch (err: any) {
        errors.push(`${row.code}: ${err.message}`);
      }
    }
    
    logger.info('Stores imported', { imported, errors: errors.length, user: req.user!.email });
    res.json({ success: true, imported, errors });
  } catch (error) {
    next(error);
  }
});

app.post('/regions/import', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { data } = req.body; // [{ code, name, description }]
    
    if (!Array.isArray(data) || data.length === 0) {
      throw new ValidationError('Veri dizisi boş veya geçersiz');
    }
    
    let imported = 0;
    let errors: string[] = [];
    
    for (const row of data) {
      try {
        await db.query(
          `INSERT INTO regions (tenant_id, code, name, description, is_active)
           VALUES ($1, $2, $3, $4, true)
           ON CONFLICT (tenant_id, code) DO UPDATE SET
             name = EXCLUDED.name,
             description = EXCLUDED.description,
             updated_at = NOW()`,
          [req.user!.tenantId, row.code, row.name, row.description]
        );
        imported++;
      } catch (err: any) {
        errors.push(`${row.code}: ${err.message}`);
      }
    }
    
    logger.info('Regions imported', { imported, errors: errors.length, user: req.user!.email });
    res.json({ success: true, imported, errors });
  } catch (error) {
    next(error);
  }
});

// ============================================
// TENANTS
// ============================================

app.get('/tenants', authenticate, authorize(ROLES.SUPER_ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenants = await db.queryAll('SELECT * FROM tenants ORDER BY created_at DESC');
    res.json({ success: true, data: tenants });
  } catch (error) {
    next(error);
  }
});

// ============================================
// DESIGNS
// ============================================

app.get('/designs', authenticate, tenantIsolation, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const designs = await db.queryAll(
      'SELECT * FROM designs WHERE tenant_id = $1 ORDER BY updated_at DESC',
      [req.user!.tenantId]
    );
    res.json({ success: true, data: designs });
  } catch (error) {
    next(error);
  }
});

app.get('/designs/:id', authenticate, tenantIsolation, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const design = await db.queryOne(
      'SELECT * FROM designs WHERE id = $1 AND tenant_id = $2',
      [req.params.id, req.user!.tenantId]
    );
    if (!design) throw new NotFoundError('Tasarım');
    res.json({ success: true, data: design });
  } catch (error) {
    next(error);
  }
});

// ============================================
// COMPONENTS
// ============================================

app.get('/components', authenticate, tenantIsolation, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { designId } = req.query;
    let query = 'SELECT * FROM components WHERE tenant_id = $1';
    const params: any[] = [req.user!.tenantId];

    if (designId) {
      query += ' AND design_id = $2';
      params.push(designId);
    }

    query += ' ORDER BY position';
    const components = await db.queryAll(query, params);
    res.json({ success: true, data: components });
  } catch (error) {
    next(error);
  }
});

// ============================================
// SYSTEM SETTINGS
// ============================================

// GET - Tüm ayarları getir
app.get('/settings', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = await db.queryAll(
      `SELECT id, key, value, category, created_at, updated_at 
       FROM system_settings 
       WHERE tenant_id = $1 OR tenant_id IS NULL
       ORDER BY category, key`,
      [req.user!.tenantId]
    );
    
    // JSON value'ları parse et
    const parsed = settings.map((s: any) => ({
      ...s,
      value: typeof s.value === 'string' ? s.value : s.value
    }));
    
    res.json({ success: true, data: parsed });
  } catch (error) {
    next(error);
  }
});

// POST - Yeni ayar oluştur
app.post('/settings', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { key, value, category, label, description, type } = req.body;
    
    if (!key || !category) {
      throw new ValidationError('Anahtar ve kategori zorunludur');
    }
    
    // Aynı key varsa hata ver
    const existing = await db.queryOne(
      'SELECT id FROM system_settings WHERE (tenant_id = $1 OR tenant_id IS NULL) AND key = $2',
      [req.user!.tenantId, key]
    );
    
    if (existing) {
      throw new ValidationError('Bu anahtar zaten mevcut');
    }
    
    const result = await db.queryOne(
      `INSERT INTO system_settings (tenant_id, key, value, category)
       VALUES ($1, $2, $3, $4)
       RETURNING id, key, value, category`,
      [req.user!.tenantId, key, JSON.stringify({ value, label, description, type }), category]
    );
    
    logger.info('System setting created', { key, category, user: req.user!.email });
    
    res.status(201).json({ success: true, data: result, message: 'Ayar başarıyla oluşturuldu' });
  } catch (error) {
    next(error);
  }
});

// PUT - Ayar güncelle (key ile)
app.put('/settings/:key', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { key } = req.params;
    const { value, label, description, type, category } = req.body;
    
    // Performans ayarları için: value zaten obje ise direkt kullan
    // Diğer ayarlar için: { value, label, description, type } formatında sakla
    let valueToStore: string;
    if (category === 'performance' && typeof value === 'object') {
      // Performans ayarları - objeyi direkt stringify
      valueToStore = JSON.stringify(value);
    } else if (typeof value === 'object') {
      // Diğer obje değerler - direkt stringify
      valueToStore = JSON.stringify(value);
    } else {
      // String değerler - eski format
      valueToStore = JSON.stringify({ value, label, description, type });
    }
    
    // Önce mevcut kaydı bul
    const existing = await db.queryOne(
      'SELECT id, value FROM system_settings WHERE (tenant_id = $1 OR tenant_id IS NULL) AND key = $2',
      [req.user!.tenantId, key]
    );
    
    if (!existing) {
      // Yoksa oluştur (upsert)
      const result = await db.queryOne(
        `INSERT INTO system_settings (tenant_id, key, value, category)
         VALUES ($1, $2, $3, $4)
         RETURNING id, key, value, category`,
        [req.user!.tenantId, key, valueToStore, category || 'general']
      );
      
      logger.info('System setting created (upsert)', { key, user: req.user!.email });
      return res.json({ success: true, data: result, message: 'Ayar oluşturuldu' });
    }
    
    // Varsa güncelle
    const result = await db.queryOne(
      `UPDATE system_settings 
       SET value = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, key, value, category`,
      [valueToStore, existing.id]
    );
    
    logger.info('System setting updated', { key, user: req.user!.email });
    
    res.json({ success: true, data: result, message: 'Ayar güncellendi' });
  } catch (error) {
    next(error);
  }
});

// DELETE - Ayar sil
app.delete('/settings/:key', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { key } = req.params;
    
    const result = await db.query(
      'DELETE FROM system_settings WHERE (tenant_id = $1 OR tenant_id IS NULL) AND key = $2 RETURNING id',
      [req.user!.tenantId, key]
    );
    
    if (result.rowCount === 0) {
      throw new NotFoundError('Ayar');
    }
    
    logger.info('System setting deleted', { key, user: req.user!.email });
    
    res.json({ success: true, message: 'Ayar silindi' });
  } catch (error) {
    next(error);
  }
});

// ============================================
// ADMIN - SİSTEM SAĞLIK MERKEZİ
// ============================================

// Servis URL'leri
const SERVICE_ENDPOINTS = {
  gateway: { name: 'API Gateway', url: 'http://localhost:4000/health', port: 4000, critical: true },
  auth: { name: 'Auth Service', url: 'http://localhost:4001/health', port: 4001, critical: true },
  core: { name: 'Core Service', url: 'http://localhost:4002/health', port: 4002, critical: true },
  data: { name: 'Data Service', url: 'http://localhost:4003/health', port: 4003, critical: true },
  notification: { name: 'Notification Service', url: 'http://localhost:4004/health', port: 4004, critical: false },
  analytics: { name: 'Analytics Service', url: 'http://localhost:4005/health', port: 4005, critical: true }
};

// Türkçe hata mesajları
const ERROR_MESSAGES: Record<string, string> = {
  'SERVICE_DOWN': '{service} servisi yanıt vermiyor. Yeniden başlatmayı deneyin.',
  'CH_CONN_FAILED': 'ClickHouse bağlantısı kurulamadı. Container çalışıyor mu kontrol edin.',
  'PG_CONN_FAILED': 'PostgreSQL bağlantısı kesildi. Container\'ı yeniden başlatın.',
  'REDIS_CONN_FAILED': 'Redis bağlantısı yok. Cache çalışmayacak.',
  'ETL_TIMEOUT': 'ETL işlemi zaman aşımına uğradı. Veri kaynağını kontrol edin.',
  'SLOW_QUERY': 'Yavaş sorgu tespit edildi ({duration}). Optimizasyon gerekebilir.',
  'CIRCUIT_OPEN': 'ClickHouse koruma modunda. 30 saniye bekleyin.',
  'CONTAINER_STOPPED': '{container} container\'ı durmuş. Başlatmak için butona tıklayın.',
  'ALL_HEALTHY': 'Tüm sistemler çalışıyor. Sorun yok.',
  'CACHE_CLEARED': 'Önbellek başarıyla temizlendi.',
  'ETL_TRIGGERED': 'ETL işlemi başlatıldı. Sonuçları birkaç dakika içinde göreceksiniz.',
  'SERVICE_RESTARTED': '{service} başarıyla yeniden başlatıldı.'
};

// Helper: Servise ping at
async function checkService(id: string, config: any): Promise<any> {
  const startTime = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(config.url, { signal: controller.signal });
    clearTimeout(timeout);
    
    const responseTime = Date.now() - startTime;
    const data = await response.json().catch(() => ({}));
    
    return {
      id,
      name: config.name,
      port: config.port,
      status: response.ok ? 'healthy' : 'degraded',
      statusText: response.ok ? 'Çalışıyor' : 'Sorunlu',
      responseTime,
      critical: config.critical,
      lastCheck: new Date().toISOString(),
      details: data
    };
  } catch (error: any) {
    return {
      id,
      name: config.name,
      port: config.port,
      status: 'down',
      statusText: 'Durdu',
      responseTime: Date.now() - startTime,
      critical: config.critical,
      lastCheck: new Date().toISOString(),
      error: error.message,
      errorMessage: ERROR_MESSAGES['SERVICE_DOWN'].replace('{service}', config.name)
    };
  }
}

// Helper: ClickHouse durumu
async function checkClickHouse(): Promise<any> {
  try {
    const startTime = Date.now();
    const chUser = process.env.CLICKHOUSE_USER || 'clixer';
    const chPassword = process.env.CLICKHOUSE_PASSWORD || 'clixer_click_2025';
    const authHeader = 'Basic ' + Buffer.from(`${chUser}:${chPassword}`).toString('base64');
    
    const versionRes = await fetch('http://localhost:8123/?query=SELECT%20version()', {
      headers: { 'Authorization': authHeader }
    });
    const version = await versionRes.text();
    
    // Hata kontrolü
    if (version.includes('Code:')) {
      throw new Error(version);
    }
    
    const tablesRes = await fetch('http://localhost:8123/', {
      method: 'POST',
      headers: { 'Authorization': authHeader },
      body: 'SELECT name, total_rows, total_bytes FROM system.tables WHERE database=\'clixer_analytics\' FORMAT JSON'
    });
    const tablesData: any = await tablesRes.json();
    
    const totalRows = tablesData.data?.reduce((sum: number, t: any) => sum + parseInt(t.total_rows || 0), 0) || 0;
    
    return {
      status: 'healthy',
      statusText: 'Bağlı',
      version: version.trim(),
      tables: tablesData.data?.length || 0,
      totalRows,
      responseTime: Date.now() - startTime,
      lastCheck: new Date().toISOString()
    };
  } catch (error: any) {
    return {
      status: 'down',
      statusText: 'Bağlantı Yok',
      error: error.message,
      errorMessage: ERROR_MESSAGES['CH_CONN_FAILED'],
      lastCheck: new Date().toISOString()
    };
  }
}

// Helper: Redis durumu
async function checkRedis(): Promise<any> {
  try {
    const { cache } = await import('@clixer/shared');
    const isHealthy = await cache.checkHealth();
    const client = cache.getClient();
    const info = await client.info('memory');
    const dbsize = await client.dbsize();
    
    const memMatch = info.match(/used_memory_human:(\S+)/);
    const memory = memMatch ? memMatch[1] : 'N/A';
    
    return {
      status: isHealthy ? 'healthy' : 'down',
      statusText: isHealthy ? 'Bağlı' : 'Bağlantı Yok',
      memory,
      keys: dbsize,
      lastCheck: new Date().toISOString()
    };
  } catch (error: any) {
    return {
      status: 'down',
      statusText: 'Bağlantı Yok',
      error: error.message,
      errorMessage: ERROR_MESSAGES['REDIS_CONN_FAILED'],
      lastCheck: new Date().toISOString()
    };
  }
}

// Helper: PostgreSQL durumu
async function checkPostgres(): Promise<any> {
  try {
    const startTime = Date.now();
    const result = await db.queryOne('SELECT count(*) as tables FROM information_schema.tables WHERE table_schema = $1', ['public']);
    const poolStats = (db as any).getPoolStats ? (db as any).getPoolStats() : null;
    
    return {
      status: 'healthy',
      statusText: 'Bağlı',
      tables: parseInt(result?.tables || '0'),
      pool: poolStats,
      responseTime: Date.now() - startTime,
      lastCheck: new Date().toISOString()
    };
  } catch (error: any) {
    return {
      status: 'down',
      statusText: 'Bağlantı Yok',
      error: error.message,
      errorMessage: ERROR_MESSAGES['PG_CONN_FAILED'],
      lastCheck: new Date().toISOString()
    };
  }
}

// Helper: ETL durumu
async function checkETL(): Promise<any> {
  try {
    // Son ETL job'ları (dataset adıyla birlikte)
    const jobs = await db.queryAll(`
      SELECT 
        e.id, e.dataset_id, e.action, e.status, e.rows_processed, 
        e.started_at, e.completed_at, e.error_message,
        d.name as dataset_name
      FROM etl_jobs e
      LEFT JOIN datasets d ON e.dataset_id = d.id
      ORDER BY e.started_at DESC 
      LIMIT 10
    `);
    
    // Son 24 saat içindeki istatistikler (pending dahil)
    const stats = await db.queryOne(`
      SELECT 
        count(*) FILTER (WHERE status = 'completed') as successful,
        count(*) FILTER (WHERE status = 'failed') as failed,
        count(*) FILTER (WHERE status = 'running') as running,
        count(*) FILTER (WHERE status = 'pending') as pending,
        max(completed_at) FILTER (WHERE status = 'completed') as last_sync
      FROM etl_jobs
      WHERE started_at > NOW() - INTERVAL '24 hours'
    `);
    
    // Tüm pending job sayısı (son 24 saatle sınırlanmadan)
    const pendingCount = await db.queryOne(`
      SELECT count(*) as count FROM etl_jobs WHERE status = 'pending'
    `);
    
    const totalPending = parseInt(pendingCount?.count || '0');
    const hasRunning = parseInt(stats?.running || '0') > 0;
    const hasPending = totalPending > 0;
    
    // ETL durumu belirleme
    let etlStatus = 'healthy';
    if (hasPending && !hasRunning) {
      // Pending var ama hiç running yok = ETL Worker çalışmıyor olabilir
      etlStatus = 'warning';
    }
    
    return {
      status: etlStatus,
      statusText: etlStatus === 'healthy' ? 'Çalışıyor' : 'ETL Worker kontrol edin',
      lastSync: stats?.last_sync,
      lastSyncText: stats?.last_sync ? getTimeAgo(new Date(stats.last_sync)) : 'Henüz tamamlanmadı',
      successful: parseInt(stats?.successful || '0'),
      failed: parseInt(stats?.failed || '0'),
      running: parseInt(stats?.running || '0'),
      pendingJobs: totalPending,
      recentJobs: jobs.map((j: any) => ({
        id: j.id,
        datasetId: j.dataset_id,
        datasetName: j.dataset_name || 'Bilinmeyen Dataset',
        action: j.action === 'manual_sync' ? 'Manuel Senkronizasyon' : j.action,
        status: j.status,
        statusText: j.status === 'completed' ? 'Başarılı' : 
                   j.status === 'failed' ? 'Başarısız' : 
                   j.status === 'running' ? 'Çalışıyor' : 
                   j.status === 'pending' ? 'Bekliyor' : j.status,
        rowsProcessed: j.rows_processed || 0,
        startedAt: j.started_at,
        completedAt: j.completed_at,
        error: j.error_message
      })),
      lastCheck: new Date().toISOString()
    };
  } catch (error: any) {
    return {
      status: 'degraded',
      statusText: 'ETL bilgisi alınamadı',
      error: error.message,
      lastCheck: new Date().toISOString()
    };
  }
}

// Helper: Zaman farkı
function getTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds} saniye önce`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} dakika önce`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} saat önce`;
  return `${Math.floor(seconds / 86400)} gün önce`;
}

// Helper: ETL Worker durumunu kontrol et (Redis heartbeat'ten)
async function checkETLWorker(): Promise<{ isAlive: boolean; lastHeartbeat: string | null; message: string }> {
  try {
    const client = cache.getClient();
    const heartbeatRaw = await client.get('etl:worker:heartbeat');
    
    if (!heartbeatRaw) {
      return { isAlive: false, lastHeartbeat: null, message: 'ETL Worker hiç sinyal göndermedi' };
    }
    
    // JSON.parse gerekli çünkü cache.set JSON.stringify yapıyor
    let heartbeatTime: number;
    try {
      heartbeatTime = parseInt(JSON.parse(heartbeatRaw), 10);
    } catch {
      heartbeatTime = parseInt(heartbeatRaw, 10);
    }
    const now = Date.now();
    const diffSeconds = Math.floor((now - heartbeatTime) / 1000);
    
    // 60 saniyeden fazla sinyal yoksa worker durmuş demektir
    const lastHeartbeatStr = new Date(heartbeatTime).toISOString();
    if (isNaN(heartbeatTime) || diffSeconds > 60) {
      return { 
        isAlive: false, 
        lastHeartbeat: lastHeartbeatStr, 
        message: `ETL Worker ${Math.floor(diffSeconds / 60)} dakikadır sinyal göndermedi` 
      };
    }
    
    return { isAlive: true, lastHeartbeat: lastHeartbeatStr, message: 'ETL Worker çalışıyor' };
  } catch (error: any) {
    return { isAlive: false, lastHeartbeat: null, message: 'Redis bağlantı hatası' };
  }
}

/**
 * 🏥 Tüm sistem sağlık durumu - Ana endpoint
 */
app.get('/admin/health', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Paralel olarak tüm kontrolleri yap
    const [services, clickhouse, redis, postgres, etl, etlWorker] = await Promise.all([
      Promise.all(Object.entries(SERVICE_ENDPOINTS).map(([id, config]) => checkService(id, config))),
      checkClickHouse(),
      checkRedis(),
      checkPostgres(),
      checkETL(),
      checkETLWorker()
    ]);
    
    // Genel durum hesapla
    const criticalDown = services.filter(s => s.critical && s.status === 'down').length;
    const anyDown = services.filter(s => s.status === 'down').length;
    const dbDown = [clickhouse, redis, postgres].filter(d => d.status === 'down').length;
    
    let overallStatus = 'healthy';
    let overallMessage = ERROR_MESSAGES['ALL_HEALTHY'];
    
    if (criticalDown > 0 || dbDown > 0) {
      overallStatus = 'critical';
      overallMessage = `${criticalDown + dbDown} kritik bileşen çalışmıyor!`;
    } else if (anyDown > 0 || !etlWorker.isAlive) {
      overallStatus = 'warning';
      if (!etlWorker.isAlive) {
        overallMessage = `⚠️ ETL Worker durduruldu! ${etlWorker.message}`;
      } else {
        overallMessage = `${anyDown} servis çalışmıyor.`;
      }
    }
    
    res.json({
      success: true,
      data: {
        overall: {
          status: overallStatus,
          statusText: overallStatus === 'healthy' ? 'Sağlıklı' : overallStatus === 'warning' ? 'Uyarı' : 'Kritik',
          message: overallMessage,
          timestamp: new Date().toISOString()
        },
        services,
        databases: {
          clickhouse,
          redis,
          postgres
        },
        etl,
        etlWorker
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 🔄 Cache temizle (Sadece KPI/Veri cache - Session token'ları KORUNUR)
 */
app.post('/admin/cache/clear', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { cache } = await import('@clixer/shared');
    const client = cache.getClient();
    
    // ⚠️ FLUSHDB YAPMA! Session token'ları silinir ve kullanıcılar logout olur.
    // Sadece belirli pattern'leri temizle:
    
    const patternsToDelete = [
      'kpi:*',           // KPI cache
      'dashboard:*',     // Dashboard cache
      'analytics:*',     // Analytics cache
      'query:*',         // Query cache
      'metrics:*',       // Metrics cache
    ];
    
    const protectedPatterns = [
      'refresh:*',       // Refresh token'ları KORU
      'session:*',       // Session'ları KORU
      'etl:worker:*',    // ETL Worker durumunu KORU
    ];
    
    let deletedCount = 0;
    
    for (const pattern of patternsToDelete) {
      const keys = await client.keys(pattern);
      if (keys.length > 0) {
        await client.del(...keys);
        deletedCount += keys.length;
      }
    }
    
    logger.info('Cache cleared by admin (sessions preserved)', { 
      user: req.user!.userId, 
      deletedKeys: deletedCount,
      protectedPatterns 
    });
    
    res.json({
      success: true,
      message: `Önbellek temizlendi (${deletedCount} kayıt silindi). Oturumlar korundu.`,
      data: {
        deletedCount,
        protectedPatterns
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 🔄 Servis Yeniden Başlatma (No-Code Yönetim)
 * Müşteri UI'dan duran servisleri başlatabilir
 */
const SERVICE_SCRIPTS: Record<string, { name: string, path: string, port: number }> = {
  'auth': { name: 'Auth Service', path: 'services/auth-service', port: 4001 },
  'core': { name: 'Core Service', path: 'services/core-service', port: 4002 },
  'data': { name: 'Data Service', path: 'services/data-service', port: 4003 },
  'notification': { name: 'Notification Service', path: 'services/notification-service', port: 4004 },
  'analytics': { name: 'Analytics Service', path: 'services/analytics-service', port: 4005 },
  'gateway': { name: 'API Gateway', path: 'gateway', port: 4000 },
  'etl-worker': { name: 'ETL Worker', path: 'services/etl-worker', port: 0 }
};

app.post('/admin/service/restart', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { serviceId } = req.body;
    
    if (!serviceId || !SERVICE_SCRIPTS[serviceId]) {
      throw new ValidationError('Geçersiz servis ID: ' + serviceId);
    }
    
    const service = SERVICE_SCRIPTS[serviceId];
    const { spawn } = require('child_process');
    const path = require('path');
    
    // Proje kök dizini
    const projectRoot = path.resolve(__dirname, '../../../');
    const servicePath = path.join(projectRoot, service.path);
    
    logger.info('Restarting service', { serviceId, servicePath, user: req.user!.email });
    
    // Önce mevcut process'i durdur (port üzerinden)
    if (service.port > 0) {
      try {
        const kill = spawn('sh', ['-c', `lsof -ti:${service.port} | xargs kill -9 2>/dev/null || true`], {
          cwd: projectRoot,
          shell: true
        });
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (e) {
        // Port'ta process yoksa devam et
      }
    }
    
    // Servisi arka planda başlat
    const logFile = `/tmp/${serviceId}-service.log`;
    
    // npm'in tam yolunu al ve servisi başlat
    const npmPath = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const startCommand = `cd "${servicePath}" && ${npmPath} run dev > "${logFile}" 2>&1 &`;
    
    logger.info('Starting service with command', { command: startCommand, servicePath });
    
    const child = spawn('bash', ['-c', startCommand], {
      cwd: servicePath,
      detached: true,
      stdio: 'ignore',
      env: { ...process.env, PATH: process.env.PATH }
    });
    child.unref();
    
    // Başlamasını bekle (ts-node-dev için 5 saniye)
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Durumu kontrol et
    let isRunning = false;
    if (service.port > 0) {
      try {
        const response = await fetch(`http://localhost:${service.port}/health`, { 
          signal: AbortSignal.timeout(3000) 
        });
        isRunning = response.ok;
      } catch (e) {
        isRunning = false;
      }
    } else {
      isRunning = true; // ETL Worker için varsayılan
    }
    
    logger.info('Service restart completed', { serviceId, isRunning, user: req.user!.email });
    
    res.json({
      success: true,
      message: isRunning 
        ? `✅ ${service.name} başarıyla yeniden başlatıldı!`
        : `⚠️ ${service.name} başlatıldı ama henüz yanıt vermiyor. Birkaç saniye bekleyin.`,
      data: {
        serviceId,
        serviceName: service.name,
        isRunning,
        logFile
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 🚀 ETL tetikle
 */
app.post('/admin/etl/trigger', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { datasetId } = req.body;
    
    if (datasetId) {
      // Tek dataset
      await db.query(`
        INSERT INTO etl_jobs (tenant_id, dataset_id, action, status, started_at)
        VALUES ($1, $2, 'manual_sync', 'pending', NOW())
      `, [req.user!.tenantId, datasetId]);
    } else {
      // Tüm aktif dataset'ler
      await db.query(`
        INSERT INTO etl_jobs (tenant_id, dataset_id, action, status, started_at)
        SELECT tenant_id, id, 'manual_sync', 'pending', NOW()
        FROM datasets
        WHERE tenant_id = $1 AND status = 'active'
      `, [req.user!.tenantId]);
    }
    
    // ETL Worker'a sinyal gönder
    const { cache } = await import('@clixer/shared');
    await cache.publish('etl:trigger', { triggeredBy: req.user!.userId, datasetId });
    
    logger.info('ETL triggered by admin', { user: req.user!.userId, datasetId });
    
    res.json({
      success: true,
      message: ERROR_MESSAGES['ETL_TRIGGERED'],
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 🔄 Redis bağlantısını yeniden başlat
 */
app.post('/admin/redis/reconnect', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Mevcut bağlantıyı kapat ve yeniden bağlan
    try {
      const client = cache.getClient();
      await client.quit();
    } catch (e) {
      // Ignore disconnect errors
    }
    
    // Yeniden bağlan
    cache.createRedisClient();
    await cache.checkHealth();
    
    logger.info('Redis reconnected by admin', { user: req.user!.userId });
    
    res.json({
      success: true,
      message: 'Redis bağlantısı yenilendi'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Redis bağlantısı kurulamadı: ' + error.message
    });
  }
});

/**
 * 🔄 Tüm servisleri yeniden kontrol et
 */
app.post('/admin/services/refresh', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Tüm servisleri tekrar kontrol et
    const services = await Promise.all(
      Object.entries(SERVICE_ENDPOINTS).map(([id, config]) => checkService(id, config))
    );
    
    const healthyCount = services.filter(s => s.status === 'healthy').length;
    
    res.json({
      success: true,
      message: `${healthyCount}/${services.length} servis çalışıyor`,
      data: services
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 🛑 Tüm bekleyen ETL job'ları iptal et
 */
app.post('/admin/etl/cancel-all', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Pending ve running job'ları cancelled yap
    const result = await db.query(`
      UPDATE etl_jobs 
      SET status = 'cancelled', 
          completed_at = NOW(), 
          error_message = 'Admin tarafından toplu iptal edildi'
      WHERE tenant_id = $1 
        AND status IN ('pending', 'running')
    `, [req.user!.tenantId]);
    
    // Redis lock'ları temizle
    const { cache } = await import('@clixer/shared');
    await cache.del('etl:lock:*');
    await cache.del('etl:cancel:*');
    
    const cancelledCount = result.rowCount || 0;
    
    logger.info('All pending ETL jobs cancelled', { 
      user: req.user!.userId, 
      cancelledCount 
    });
    
    res.json({
      success: true,
      message: `${cancelledCount} job iptal edildi`,
      cancelledCount
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 📋 Son hata logları
 */
app.get('/admin/logs', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    
    // Audit logs'tan hataları çek
    const logs = await db.queryAll(`
      SELECT id, action, entity_type, entity_id, details, created_at, user_id
      FROM audit_logs
      WHERE tenant_id = $1 
        AND (action LIKE '%error%' OR action LIKE '%fail%' OR details::text LIKE '%error%')
      ORDER BY created_at DESC
      LIMIT $2
    `, [req.user!.tenantId, limit]);
    
    // ETL hatalarını da ekle
    const etlErrors = await db.queryAll(`
      SELECT 
        e.id,
        'etl_error' as action,
        'etl_job' as entity_type,
        e.id as entity_id,
        json_build_object('error', e.error_message, 'dataset', d.name) as details,
        e.completed_at as created_at
      FROM etl_jobs e
      JOIN datasets d ON e.dataset_id = d.id
      WHERE e.status = 'failed' AND d.tenant_id = $1
      ORDER BY e.completed_at DESC
      LIMIT $2
    `, [req.user!.tenantId, limit]);
    
    // Birleştir ve sırala
    const allLogs = [...logs, ...etlErrors]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit)
      .map(log => ({
        ...log,
        timeAgo: getTimeAgo(new Date(log.created_at)),
        severity: log.action?.includes('error') ? 'error' : 'warning'
      }));
    
    res.json({
      success: true,
      data: allLogs
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 🔧 Servis bilgisi
 */
app.get('/admin/services/:serviceId', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { serviceId } = req.params;
    const config = SERVICE_ENDPOINTS[serviceId as keyof typeof SERVICE_ENDPOINTS];
    
    if (!config) {
      return res.status(404).json({ success: false, message: 'Servis bulunamadı' });
    }
    
    const status = await checkService(serviceId, config);
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 🔄 Servis yeniden başlat
 * NOT: Bu endpoint development ortamında npm ile çalışır
 * Production'da Docker veya PM2 gibi process manager kullanılır
 */
app.post('/admin/service/:serviceId/restart', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { serviceId } = req.params;
    const config = SERVICE_ENDPOINTS[serviceId as keyof typeof SERVICE_ENDPOINTS];
    
    if (!config) {
      return res.status(404).json({ 
        success: false, 
        message: `Servis bulunamadı: ${serviceId}` 
      });
    }
    
    // Servisin durumunu kontrol et
    const status = await checkService(serviceId, config);
    
    // Development ortamında servis yeniden başlatma
    // Production'da Docker Compose veya Kubernetes kullanılır
    const isDocker = process.env.DOCKER_ENV === 'true';
    
    if (isDocker) {
      // Docker ortamı - docker-compose kullan
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      try {
        const containerName = `clixer-${serviceId.replace('-service', '')}`;
        await execAsync(`docker restart ${containerName}`);
        logger.info(`Docker container restarted: ${containerName}`, { user: req.user!.userId });
      } catch (dockerError: any) {
        logger.warn(`Docker restart failed, trying docker-compose: ${dockerError.message}`);
        // docker-compose dene
        try {
          const serviceName = serviceId.replace('-service', '');
          await execAsync(`docker-compose restart ${serviceName}`);
        } catch (composeError: any) {
          return res.json({
            success: false,
            message: `Servis yeniden başlatılamadı. Manuel olarak başlatın: npm run dev (${config.name})`
          });
        }
      }
    } else {
      // Development ortamı - kullanıcıya bilgi ver
      logger.info(`Service restart requested: ${serviceId}`, { user: req.user!.userId, currentStatus: status.status });
      
      // Eğer servis çalışıyorsa
      if (status.status === 'healthy') {
        return res.json({
          success: true,
          message: `${config.name} çalışıyor. Yeniden başlatmak için terminalde ilgili servisi durdurup başlatın.`,
          instructions: `cd services/${serviceId} && npm run dev`
        });
      }
      
      // Servis durmuşsa
      return res.json({
        success: true,
        message: `${config.name} durmuş. Başlatmak için terminalde şu komutu çalıştırın:`,
        instructions: `cd services/${serviceId} && npm run dev`,
        status: 'requires_manual_action'
      });
    }
    
    // Audit log
    await db.query(`
      INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id, details)
      VALUES ($1, $2, 'service_restart', 'service', $3, $4)
    `, [req.user!.tenantId, req.user!.userId, serviceId, JSON.stringify({ serviceName: config.name })]);
    
    res.json({
      success: true,
      message: `${config.name} yeniden başlatılıyor...`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// LDAP ENTEGRASYONU
// ============================================

// LDAP Config - Ayarları getir
app.get('/ldap/config', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const config = await db.queryOne(
      `SELECT id, name, server_url, base_dn, bind_dn, user_search_base, user_filter, 
              group_search_base, group_filter, sync_schedule, is_active, last_sync_at, created_at
       FROM ldap_config 
       WHERE tenant_id = $1`,
      [req.user!.tenantId]
    );
    res.json({ success: true, data: config || null });
  } catch (error) {
    next(error);
  }
});

// LDAP Config - Kaydet/Güncelle
app.post('/ldap/config', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { 
      name, server_url, base_dn, bind_dn, bind_password,
      user_search_base, user_filter, group_search_base, group_filter,
      sync_schedule, is_active 
    } = req.body;
    
    if (!server_url || !base_dn || !bind_dn) {
      throw new ValidationError('Sunucu URL, Base DN ve Bind DN zorunludur');
    }
    
    // Şifreyi basit encrypt et (production'da KMS kullanılmalı)
    const encryptedPassword = bind_password ? 
      Buffer.from(bind_password).toString('base64') : undefined;
    
    // Mevcut config var mı?
    const existing = await db.queryOne(
      'SELECT id, bind_password_encrypted FROM ldap_config WHERE tenant_id = $1',
      [req.user!.tenantId]
    );
    
    let result;
    if (existing) {
      // Güncelle
      result = await db.queryOne(
        `UPDATE ldap_config SET
           name = $1, server_url = $2, base_dn = $3, bind_dn = $4,
           bind_password_encrypted = COALESCE($5, bind_password_encrypted),
           user_search_base = $6, user_filter = $7,
           group_search_base = $8, group_filter = $9,
           sync_schedule = $10, is_active = $11, updated_at = NOW()
         WHERE tenant_id = $12
         RETURNING id, name, server_url, base_dn, is_active`,
        [
          name || 'Default LDAP', server_url, base_dn, bind_dn,
          encryptedPassword, user_search_base, user_filter,
          group_search_base, group_filter, sync_schedule || 'manual', is_active ?? false,
          req.user!.tenantId
        ]
      );
    } else {
      // Yeni oluştur
      if (!bind_password) {
        throw new ValidationError('İlk kurulumda Bind Password zorunludur');
      }
      
      result = await db.queryOne(
        `INSERT INTO ldap_config (
           tenant_id, name, server_url, base_dn, bind_dn, bind_password_encrypted,
           user_search_base, user_filter, group_search_base, group_filter,
           sync_schedule, is_active
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING id, name, server_url, base_dn, is_active`,
        [
          req.user!.tenantId, name || 'Default LDAP', server_url, base_dn, bind_dn, encryptedPassword,
          user_search_base, user_filter || '(&(objectClass=user)(mail=*))',
          group_search_base, group_filter || '(objectClass=group)',
          sync_schedule || 'manual', is_active ?? false
        ]
      );
    }
    
    logger.info('LDAP config saved', { user: req.user!.email, serverUrl: server_url });
    res.json({ success: true, data: result, message: 'LDAP ayarları kaydedildi' });
  } catch (error) {
    next(error);
  }
});

// LDAP Bağlantı Testi
app.post('/ldap/test', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    let { server_url, base_dn, bind_dn, bind_password } = req.body;
    
    if (!server_url || !bind_dn) {
      throw new ValidationError('Sunucu URL ve Bind DN zorunludur');
    }
    
    // server_url'e ldap:// prefix ekle (yoksa)
    if (!server_url.startsWith('ldap://') && !server_url.startsWith('ldaps://')) {
      // Port varsa ldap:// ekle, yoksa ldap://host:389 yap
      if (server_url.includes(':')) {
        server_url = `ldap://${server_url}`;
      } else {
        server_url = `ldap://${server_url}:389`;
      }
    }
    
    // Şifre gönderilmediyse veritabanından al
    let password = bind_password;
    if (!password) {
      const config = await db.queryOne(
        'SELECT bind_password_encrypted FROM ldap_config WHERE tenant_id = $1',
        [req.user!.tenantId]
      );
      if (config?.bind_password_encrypted) {
        password = Buffer.from(config.bind_password_encrypted, 'base64').toString('utf-8');
      }
    }
    
    if (!password) {
      throw new ValidationError('Şifre gerekli');
    }
    
    // LDAP bağlantı testi
    const { Client } = await import('ldapts');
    const client = new Client({ url: server_url });
    
    try {
      await client.bind(bind_dn, password);
      
      // Basit bir arama yap
      const { searchEntries } = await client.search(base_dn, {
        scope: 'sub',
        filter: '(objectClass=*)',
        sizeLimit: 1
      });
      
      await client.unbind();
      
      res.json({ 
        success: true, 
        message: 'LDAP bağlantısı başarılı!',
        data: {
          connected: true,
          baseDnAccessible: searchEntries.length > 0
        }
      });
    } catch (ldapError: any) {
      await client.unbind().catch(() => {});
      
      let errorMessage = 'LDAP bağlantısı başarısız';
      if (ldapError.message.includes('Invalid credentials')) {
        errorMessage = 'Geçersiz kullanıcı adı veya şifre';
      } else if (ldapError.message.includes('ECONNREFUSED')) {
        errorMessage = 'LDAP sunucusuna bağlanılamadı. Sunucu adresi ve portu kontrol edin.';
      } else if (ldapError.message.includes('ETIMEDOUT')) {
        errorMessage = 'LDAP sunucusu yanıt vermiyor. Firewall ayarlarını kontrol edin.';
      }
      
      res.json({
        success: false,
        message: errorMessage,
        error: ldapError.message
      });
    }
  } catch (error) {
    next(error);
  }
});

// LDAP Grupları Getir (canlı çekme)
app.get('/ldap/groups', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Config'i al
    const config = await db.queryOne(
      'SELECT * FROM ldap_config WHERE tenant_id = $1',
      [req.user!.tenantId]
    );
    
    if (!config) {
      throw new NotFoundError('LDAP yapılandırması');
    }
    
    // Şifreyi decode et
    const password = Buffer.from(config.bind_password_encrypted, 'base64').toString('utf-8');
    
    // LDAP'a bağlan
    const { Client } = await import('ldapts');
    const client = new Client({ url: config.server_url });
    
    try {
      await client.bind(config.bind_dn, password);
      
      // Grupları ara
      const searchBase = config.group_search_base || config.base_dn;
      const { searchEntries } = await client.search(searchBase, {
        scope: 'sub',
        filter: config.group_filter || '(objectClass=group)',
        attributes: ['cn', 'distinguishedName', 'description', 'member']
      });
      
      await client.unbind();
      
      const groups = searchEntries.map((entry: any) => ({
        dn: entry.dn,
        name: entry.cn,
        description: entry.description,
        memberCount: Array.isArray(entry.member) ? entry.member.length : (entry.member ? 1 : 0)
      }));
      
      res.json({ success: true, data: groups });
    } catch (ldapError: any) {
      await client.unbind().catch(() => {});
      throw new AppError(`LDAP grup araması başarısız: ${ldapError.message}`, 500);
    }
  } catch (error) {
    next(error);
  }
});

// Pozisyon Eşlemeleri - Listele
app.get('/ldap/position-mappings', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const mappings = await db.queryAll(
      `SELECT m.id, m.ldap_group_dn, m.ldap_group_name, m.position_code, m.priority,
              p.name as position_name, p.hierarchy_level
       FROM ldap_position_mappings m
       JOIN positions p ON m.position_code = p.code
       WHERE m.tenant_id = $1
       ORDER BY m.priority, p.hierarchy_level`,
      [req.user!.tenantId]
    );
    res.json({ success: true, data: mappings });
  } catch (error) {
    next(error);
  }
});

// Pozisyon Eşlemesi - Ekle/Güncelle
app.post('/ldap/position-mappings', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { ldap_group_dn, ldap_group_name, position_code, priority } = req.body;
    
    if (!ldap_group_dn || !position_code) {
      throw new ValidationError('LDAP grup DN ve pozisyon kodu zorunludur');
    }
    
    const result = await db.queryOne(
      `INSERT INTO ldap_position_mappings (tenant_id, ldap_group_dn, ldap_group_name, position_code, priority)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (tenant_id, ldap_group_dn) DO UPDATE SET
         ldap_group_name = EXCLUDED.ldap_group_name,
         position_code = EXCLUDED.position_code,
         priority = EXCLUDED.priority,
         updated_at = NOW()
       RETURNING *`,
      [req.user!.tenantId, ldap_group_dn, ldap_group_name, position_code, priority || 100]
    );
    
    logger.info('LDAP position mapping saved', { ldapGroup: ldap_group_name, position: position_code, user: req.user!.email });
    res.json({ success: true, data: result, message: 'Pozisyon eşlemesi kaydedildi' });
  } catch (error) {
    next(error);
  }
});

// Pozisyon Eşlemesi - Sil
app.delete('/ldap/position-mappings/:id', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await db.query(
      'DELETE FROM ldap_position_mappings WHERE id = $1 AND tenant_id = $2 RETURNING id',
      [req.params.id, req.user!.tenantId]
    );
    
    if (result.rowCount === 0) throw new NotFoundError('Pozisyon eşlemesi');
    
    res.json({ success: true, message: 'Eşleme silindi' });
  } catch (error) {
    next(error);
  }
});

// Mağaza Eşlemeleri - Listele
app.get('/ldap/store-mappings', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const mappings = await db.queryAll(
      `SELECT id, ldap_group_dn, ldap_group_name, store_id, store_name, grants_all_stores, created_at
       FROM ldap_store_mappings
       WHERE tenant_id = $1
       ORDER BY ldap_group_name`,
      [req.user!.tenantId]
    );
    res.json({ success: true, data: mappings });
  } catch (error) {
    next(error);
  }
});

// Mağaza Eşlemesi - Ekle/Güncelle
app.post('/ldap/store-mappings', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { ldap_group_dn, ldap_group_name, store_id, store_name, grants_all_stores } = req.body;
    
    if (!ldap_group_dn) {
      throw new ValidationError('LDAP grup DN zorunludur');
    }
    
    if (!grants_all_stores && !store_id) {
      throw new ValidationError('Mağaza ID veya tüm mağazalar seçeneği gereklidir');
    }
    
    const result = await db.queryOne(
      `INSERT INTO ldap_store_mappings (tenant_id, ldap_group_dn, ldap_group_name, store_id, store_name, grants_all_stores)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (tenant_id, ldap_group_dn) DO UPDATE SET
         ldap_group_name = EXCLUDED.ldap_group_name,
         store_id = EXCLUDED.store_id,
         store_name = EXCLUDED.store_name,
         grants_all_stores = EXCLUDED.grants_all_stores,
         updated_at = NOW()
       RETURNING *`,
      [req.user!.tenantId, ldap_group_dn, ldap_group_name, store_id || '', store_name || '', grants_all_stores || false]
    );
    
    logger.info('LDAP store mapping saved', { ldapGroup: ldap_group_name, storeId: store_id, user: req.user!.email });
    res.json({ success: true, data: result, message: 'Mağaza eşlemesi kaydedildi' });
  } catch (error) {
    next(error);
  }
});

// Mağaza Eşlemesi - Sil
app.delete('/ldap/store-mappings/:id', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await db.query(
      'DELETE FROM ldap_store_mappings WHERE id = $1 AND tenant_id = $2 RETURNING id',
      [req.params.id, req.user!.tenantId]
    );
    
    if (result.rowCount === 0) throw new NotFoundError('Mağaza eşlemesi');
    
    res.json({ success: true, message: 'Eşleme silindi' });
  } catch (error) {
    next(error);
  }
});

// LDAP Sync - Kullanıcıları senkronize et
app.post('/ldap/sync', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Config'i al
    const config = await db.queryOne(
      'SELECT * FROM ldap_config WHERE tenant_id = $1',
      [req.user!.tenantId]
    );
    
    if (!config) {
      throw new NotFoundError('LDAP yapılandırması');
    }
    
    if (!config.is_active) {
      throw new ValidationError('LDAP entegrasyonu aktif değil');
    }
    
    // Eşlemeleri al
    const positionMappings = await db.queryAll(
      'SELECT * FROM ldap_position_mappings WHERE tenant_id = $1 ORDER BY priority',
      [req.user!.tenantId]
    );
    
    const storeMappings = await db.queryAll(
      'SELECT * FROM ldap_store_mappings WHERE tenant_id = $1',
      [req.user!.tenantId]
    );
    
    // Sync log başlat
    const syncLog = await db.queryOne(
      `INSERT INTO ldap_sync_logs (tenant_id, status) VALUES ($1, 'running') RETURNING id`,
      [req.user!.tenantId]
    );
    
    const stats = {
      found: 0,
      created: 0,
      updated: 0,
      deactivated: 0,
      skipped: 0,
      errors: [] as any[]
    };
    
    try {
      // Şifreyi decode et
      const password = Buffer.from(config.bind_password_encrypted, 'base64').toString('utf-8');
      
      // LDAP'a bağlan
      const { Client } = await import('ldapts');
      const client = new Client({ url: config.server_url });
      
      await client.bind(config.bind_dn, password);
      
      // Kullanıcıları ara
      const searchBase = config.user_search_base || config.base_dn;
      const { searchEntries } = await client.search(searchBase, {
        scope: 'sub',
        filter: config.user_filter || '(&(objectClass=user)(mail=*))',
        attributes: ['sAMAccountName', 'mail', 'displayName', 'title', 'department', 'memberOf', 'distinguishedName']
      });
      
      await client.unbind();
      
      stats.found = searchEntries.length;
      
      const ldapUserDns: string[] = [];
      
      // Her kullanıcı için
      for (const entry of searchEntries) {
        try {
          const email = entry.mail as string;
          const name = (entry.displayName || entry.sAMAccountName) as string;
          const dn = entry.dn;
          const memberOf = (Array.isArray(entry.memberOf) ? entry.memberOf : [entry.memberOf].filter(Boolean)) as string[];
          
          if (!email) {
            stats.skipped++;
            continue;
          }
          
          ldapUserDns.push(dn);
          
          // Pozisyon belirle (öncelik sırasına göre)
          let positionCode = 'VIEWER'; // Varsayılan
          for (const mapping of positionMappings) {
            if (memberOf.some((g: string) => g.toLowerCase() === mapping.ldap_group_dn.toLowerCase())) {
              positionCode = mapping.position_code;
              break;
            }
          }
          
          // Mağazaları belirle
          const storeIds: string[] = [];
          for (const mapping of storeMappings) {
            if (memberOf.some((g: string) => g.toLowerCase() === mapping.ldap_group_dn.toLowerCase())) {
              if (mapping.grants_all_stores) {
                // Tüm mağazalar - özel işaret
                storeIds.push('*');
                break;
              } else if (mapping.store_id) {
                storeIds.push(mapping.store_id);
              }
            }
          }
          
          // Mevcut kullanıcı var mı?
          const existingUser = await db.queryOne(
            'SELECT id FROM users WHERE email = $1 AND tenant_id = $2',
            [email, req.user!.tenantId]
          );
          
          if (existingUser) {
            // Güncelle
            await db.query(
              `UPDATE users SET 
                 name = $1, position_code = $2, ldap_dn = $3, ldap_synced = TRUE,
                 ldap_last_sync_at = NOW(), ldap_groups = $4, is_active = TRUE, updated_at = NOW()
               WHERE id = $5`,
              [name, positionCode, dn, JSON.stringify(memberOf), existingUser.id]
            );
            
            // Mağaza atamalarını güncelle
            await db.query('DELETE FROM user_stores WHERE user_id = $1', [existingUser.id]);
            for (const storeId of storeIds) {
              if (storeId === '*') {
                // Tüm mağazalar için can_see_all_stores pozisyon özelliğinden yönetilir
                continue;
              }
              const storeMapping = storeMappings.find((m: any) => m.store_id === storeId);
              await db.query(
                'INSERT INTO user_stores (user_id, store_id, store_name) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
                [existingUser.id, storeId, storeMapping?.store_name || storeId]
              );
            }
            
            stats.updated++;
          } else {
            // Yeni oluştur (şifresiz - LDAP ile login olacak)
            const newUser = await db.queryOne(
              `INSERT INTO users (tenant_id, email, name, password_hash, role, position_code, ldap_dn, ldap_synced, ldap_last_sync_at, ldap_groups, is_active)
               VALUES ($1, $2, $3, '', 'USER', $4, $5, TRUE, NOW(), $6, TRUE)
               RETURNING id`,
              [req.user!.tenantId, email, name, positionCode, dn, JSON.stringify(memberOf)]
            );
            
            // Mağaza atamalarını ekle
            for (const storeId of storeIds) {
              if (storeId === '*') continue;
              const storeMapping = storeMappings.find((m: any) => m.store_id === storeId);
              await db.query(
                'INSERT INTO user_stores (user_id, store_id, store_name) VALUES ($1, $2, $3)',
                [newUser.id, storeId, storeMapping?.store_name || storeId]
              );
            }
            
            stats.created++;
          }
        } catch (userError: any) {
          stats.errors.push({ user: entry.mail, error: userError.message });
        }
      }
      
      // LDAP'ta olmayan kullanıcıları deaktive et (LDAP synced olanları)
      if (ldapUserDns.length > 0) {
        const deactivated = await db.query(
          `UPDATE users SET is_active = FALSE, updated_at = NOW()
           WHERE tenant_id = $1 AND ldap_synced = TRUE AND ldap_dn IS NOT NULL
             AND ldap_dn NOT IN (${ldapUserDns.map((_, i) => `$${i + 2}`).join(', ')})
           RETURNING id`,
          [req.user!.tenantId, ...ldapUserDns]
        );
        stats.deactivated = deactivated.rowCount || 0;
      }
      
      // Sync log güncelle
      await db.query(
        `UPDATE ldap_sync_logs SET 
           status = $1, completed_at = NOW(),
           users_found = $2, users_created = $3, users_updated = $4, users_deactivated = $5, users_skipped = $6,
           errors = $7, summary = $8
         WHERE id = $9`,
        [
          stats.errors.length > 0 ? 'partial' : 'success',
          stats.found, stats.created, stats.updated, stats.deactivated, stats.skipped,
          JSON.stringify(stats.errors),
          `${stats.found} kullanıcı bulundu, ${stats.created} oluşturuldu, ${stats.updated} güncellendi, ${stats.deactivated} deaktive edildi`,
          syncLog.id
        ]
      );
      
      // LDAP config last_sync güncelle
      await db.query('UPDATE ldap_config SET last_sync_at = NOW() WHERE tenant_id = $1', [req.user!.tenantId]);
      
      logger.info('LDAP sync completed', { 
        user: req.user!.email, 
        found: stats.found, 
        created: stats.created, 
        updated: stats.updated 
      });
      
      res.json({
        success: true,
        message: `LDAP senkronizasyonu tamamlandı: ${stats.found} kullanıcı bulundu, ${stats.created} oluşturuldu, ${stats.updated} güncellendi`,
        data: stats
      });
      
    } catch (ldapError: any) {
      // Sync log hata ile güncelle
      await db.query(
        `UPDATE ldap_sync_logs SET 
           status = 'failed', completed_at = NOW(),
           errors = $1, summary = $2
         WHERE id = $3`,
        [
          JSON.stringify([{ error: ldapError.message }]),
          `Senkronizasyon başarısız: ${ldapError.message}`,
          syncLog.id
        ]
      );
      
      throw new AppError(`LDAP senkronizasyonu başarısız: ${ldapError.message}`, 500);
    }
  } catch (error) {
    next(error);
  }
});

// LDAP Sync Geçmişi
app.get('/ldap/sync-logs', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    
    const logs = await db.queryAll(
      `SELECT id, started_at, completed_at, status, 
              users_found, users_created, users_updated, users_deactivated, users_skipped,
              errors, summary
       FROM ldap_sync_logs
       WHERE tenant_id = $1
       ORDER BY started_at DESC
       LIMIT $2`,
      [req.user!.tenantId, limit]
    );
    
    res.json({ success: true, data: logs });
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
// STUCK JOB CLEANUP (Her 2 dakikada bir)
// ============================================

// Son kontrol edilen rows_processed değerlerini sakla
const lastKnownProgress: Map<string, { rows: number; checkTime: number }> = new Map();

async function cleanupStuckJobs() {
  try {
    const client = cache.getClient();
    
    // 1. Önce aktif running job'ları kontrol et
    const runningJobs = await db.queryAll(`
      SELECT id, dataset_id, rows_processed, started_at 
      FROM etl_jobs 
      WHERE status = 'running'
    `);
    
    if (runningJobs.length === 0) {
      // Aktif job yok, temizlik yap
      lastKnownProgress.clear();
      return;
    }
    
    // 2. Worker heartbeat kontrolü
    const heartbeatRaw = await client.get('etl:worker:heartbeat');
    let workerAlive = false;
    if (heartbeatRaw) {
      // JSON.parse gerekli çünkü cache.set JSON.stringify yapıyor
      let heartbeatTime: number;
      try {
        heartbeatTime = parseInt(JSON.parse(heartbeatRaw), 10);
      } catch {
        heartbeatTime = parseInt(heartbeatRaw, 10);
      }
      workerAlive = !isNaN(heartbeatTime) && (Date.now() - heartbeatTime) < 60000; // 60 saniye içinde sinyal var mı
    }
    
    const stuckJobIds: string[] = [];
    const stuckDatasetIds: string[] = [];
    
    for (const job of runningJobs) {
      const jobId = job.id;
      const currentRows = job.rows_processed || 0;
      const startedAt = new Date(job.started_at).getTime();
      const jobAge = Date.now() - startedAt;
      
      // Job en az 3 dakika eski olmalı
      if (jobAge < 3 * 60 * 1000) {
        continue;
      }
      
      const lastProgress = lastKnownProgress.get(jobId);
      
      if (lastProgress) {
        const timeSinceLastCheck = Date.now() - lastProgress.checkTime;
        const rowsChanged = currentRows !== lastProgress.rows;
        
        // Worker ölü VE 2 dakikadır ilerleme yok → stuck
        if (!workerAlive && !rowsChanged && timeSinceLastCheck > 2 * 60 * 1000) {
          stuckJobIds.push(jobId);
          stuckDatasetIds.push(job.dataset_id);
          logger.warn('Job stuck detected', { 
            jobId, 
            lastRows: lastProgress.rows, 
            currentRows,
            workerAlive 
          });
        }
      }
      
      // Güncel ilerlemeyi kaydet
      lastKnownProgress.set(jobId, { rows: currentRows, checkTime: Date.now() });
    }
    
    // 3. Stuck job'ları fail yap
    if (stuckJobIds.length > 0) {
      await db.query(`
        UPDATE etl_jobs 
        SET status = 'failed', 
            completed_at = NOW(),
            error_message = 'ETL Worker yanıt vermiyor ve ilerleme yok (crash veya durdurulmuş)'
        WHERE id = ANY($1::uuid[])
          AND status = 'running'
      `, [stuckJobIds]);
      
      logger.warn('Stuck jobs marked as failed', { 
        count: stuckJobIds.length,
        jobIds: stuckJobIds
      });
      
      // Lock'ları temizle
      for (const datasetId of stuckDatasetIds) {
        await client.del(`etl:lock:${datasetId}`);
        lastKnownProgress.delete(datasetId);
      }
    }
    
    // 4. Tamamlanan job'ları temizle
    for (const [jobId] of lastKnownProgress) {
      if (!runningJobs.find((j: any) => j.id === jobId)) {
        lastKnownProgress.delete(jobId);
      }
    }
    
  } catch (error: any) {
    logger.error('Stuck job cleanup failed', { error: error.message });
  }
}

// ============================================
// GEOGRAPHIC LOCATIONS (Harita için koordinat lookup)
// ============================================

// Tüm illeri listele
app.get('/geographic/cities', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const region = req.query.region as string;
    
    let query = `
      SELECT id, city_code, city_name, region_code, region_name, 
             latitude, longitude, population, name_ascii
      FROM geographic_locations 
      WHERE location_type = 'CITY' AND is_active = true
    `;
    const params: any[] = [];
    
    if (region) {
      query += ' AND region_code = $1';
      params.push(region);
    }
    
    query += ' ORDER BY population DESC NULLS LAST';
    
    const cities = await db.queryAll(query, params);
    res.json({ success: true, data: cities });
  } catch (error) {
    next(error);
  }
});

// İl detayı ve ilçeleri
app.get('/geographic/cities/:code', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cityCode = req.params.code;
    
    // İl bilgisi
    const city = await db.queryOne(
      `SELECT * FROM geographic_locations WHERE city_code = $1 AND location_type = 'CITY' LIMIT 1`,
      [cityCode]
    );
    
    if (!city) {
      throw new NotFoundError('İl bulunamadı');
    }
    
    // İlçeler
    const districts = await db.queryAll(
      `SELECT id, district_name, latitude, longitude, population, name_ascii
       FROM geographic_locations 
       WHERE city_code = $1 AND location_type = 'DISTRICT' AND is_active = true
       ORDER BY population DESC NULLS LAST`,
      [cityCode]
    );
    
    res.json({ 
      success: true, 
      data: { 
        ...city, 
        districts 
      } 
    });
  } catch (error) {
    next(error);
  }
});

// İlçe detayı ve mahalleleri
app.get('/geographic/cities/:cityCode/districts/:districtName', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { cityCode, districtName } = req.params;
    
    // İlçe bilgisi
    const district = await db.queryOne(
      `SELECT * FROM geographic_locations 
       WHERE city_code = $1 AND LOWER(district_name) = LOWER($2) AND location_type = 'DISTRICT' 
       LIMIT 1`,
      [cityCode, districtName]
    );
    
    if (!district) {
      throw new NotFoundError('İlçe bulunamadı');
    }
    
    // Mahalleler (varsa)
    const neighborhoods = await db.queryAll(
      `SELECT id, neighborhood_name, latitude, longitude, population
       FROM geographic_locations 
       WHERE parent_id = $1 AND location_type = 'NEIGHBORHOOD' AND is_active = true
       ORDER BY neighborhood_name`,
      [district.id]
    );
    
    res.json({ 
      success: true, 
      data: { 
        ...district, 
        neighborhoods 
      } 
    });
  } catch (error) {
    next(error);
  }
});

// Lokasyon arama (fuzzy search)
app.get('/geographic/search', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = req.query.q as string;
    const limit = parseInt(req.query.limit as string) || 20;
    
    if (!q || q.length < 2) {
      return res.json({ success: true, data: [] });
    }
    
    const results = await db.queryAll(
      `SELECT id, location_type, city_code, city_name, district_name, neighborhood_name,
              latitude, longitude, population, name_ascii
       FROM geographic_locations
       WHERE is_active = true AND (
           LOWER(city_name) LIKE LOWER($1)
           OR LOWER(district_name) LIKE LOWER($1)
           OR LOWER(neighborhood_name) LIKE LOWER($1)
           OR LOWER(name_ascii) LIKE LOWER($1)
       )
       ORDER BY 
           CASE location_type 
               WHEN 'CITY' THEN 1 
               WHEN 'DISTRICT' THEN 2 
               WHEN 'NEIGHBORHOOD' THEN 3 
               ELSE 4 
           END,
           population DESC NULLS LAST
       LIMIT $2`,
      [`%${q}%`, limit]
    );
    
    res.json({ success: true, data: results });
  } catch (error) {
    next(error);
  }
});

// Koordinat lookup - İsimden koordinat bul
app.post('/geographic/lookup', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { locations } = req.body;
    
    if (!Array.isArray(locations) || locations.length === 0) {
      return res.json({ success: true, data: [] });
    }
    
    const results: any[] = [];
    
    for (const loc of locations) {
      const { name, city, district, neighborhood } = loc;
      
      let result = null;
      
      // 1. Mahalle varsa mahalle ara
      if (neighborhood && district && city) {
        result = await db.queryOne(
          `SELECT latitude, longitude, neighborhood_name as matched_name, 'NEIGHBORHOOD' as match_level
           FROM geographic_locations 
           WHERE location_type = 'NEIGHBORHOOD' 
             AND LOWER(city_name) = LOWER($1) 
             AND LOWER(district_name) = LOWER($2)
             AND LOWER(neighborhood_name) = LOWER($3)
           LIMIT 1`,
          [city, district, neighborhood]
        );
      }
      
      // 2. İlçe ara
      if (!result && district && city) {
        result = await db.queryOne(
          `SELECT latitude, longitude, district_name as matched_name, 'DISTRICT' as match_level
           FROM geographic_locations 
           WHERE location_type = 'DISTRICT' 
             AND (LOWER(city_name) = LOWER($1) OR LOWER(name_ascii) = LOWER($1))
             AND (LOWER(district_name) = LOWER($2) OR LOWER(name_ascii) = LOWER($2))
           LIMIT 1`,
          [city, district]
        );
      }
      
      // 3. İl ara
      if (!result && (city || name)) {
        const searchName = city || name;
        result = await db.queryOne(
          `SELECT latitude, longitude, city_name as matched_name, 'CITY' as match_level
           FROM geographic_locations 
           WHERE location_type = 'CITY' 
             AND (LOWER(city_name) = LOWER($1) OR LOWER(name_ascii) = LOWER($1))
           LIMIT 1`,
          [searchName]
        );
      }
      
      // 4. Genel arama (fuzzy)
      if (!result && name) {
        result = await db.queryOne(
          `SELECT latitude, longitude, 
                  COALESCE(neighborhood_name, district_name, city_name) as matched_name,
                  location_type as match_level
           FROM geographic_locations 
           WHERE is_active = true AND (
               LOWER(city_name) LIKE LOWER($1)
               OR LOWER(district_name) LIKE LOWER($1)
               OR LOWER(neighborhood_name) LIKE LOWER($1)
               OR LOWER(name_ascii) LIKE LOWER($1)
           )
           ORDER BY population DESC NULLS LAST
           LIMIT 1`,
          [`%${name}%`]
        );
      }
      
      results.push({
        input: loc,
        found: result !== null,
        latitude: result?.latitude || null,
        longitude: result?.longitude || null,
        matched_name: result?.matched_name || null,
        match_level: result?.match_level || null
      });
    }
    
    res.json({ success: true, data: results });
  } catch (error) {
    next(error);
  }
});

// Bölgeleri listele (7 coğrafi bölge)
app.get('/geographic/regions', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const regions = await db.queryAll(
      `SELECT DISTINCT region_code, region_name, 
              COUNT(*) as city_count,
              SUM(population) as total_population
       FROM geographic_locations 
       WHERE location_type = 'CITY' AND is_active = true
       GROUP BY region_code, region_name
       ORDER BY total_population DESC`
    );
    
    res.json({ success: true, data: regions });
  } catch (error) {
    next(error);
  }
});

// İstatistikler
app.get('/geographic/stats', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await db.queryAll(
      `SELECT location_type, COUNT(*) as count, SUM(population) as total_population
       FROM geographic_locations 
       WHERE is_active = true
       GROUP BY location_type
       ORDER BY 
           CASE location_type 
               WHEN 'CITY' THEN 1 
               WHEN 'DISTRICT' THEN 2 
               WHEN 'NEIGHBORHOOD' THEN 3 
           END`
    );
    
    res.json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
});

// ============================================
// LABELS (Dinamik Etiketler)
// ============================================

// Tüm etiketleri getir (opsiyonel type filtresi)
app.get('/labels', authenticate, tenantIsolation, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type } = req.query;
    const tenantId = req.user!.tenantId;
    
    let query = `
      SELECT id, label_type, label_key, label_value, description, is_active, created_at, updated_at
      FROM labels 
      WHERE tenant_id = $1
    `;
    const params: any[] = [tenantId];
    
    if (type) {
      query += ' AND label_type = $2';
      params.push(type);
    }
    
    query += ' ORDER BY label_type, label_key';
    
    const labels = await db.queryAll(query, params);
    res.json({ success: true, data: labels });
  } catch (error) {
    next(error);
  }
});

// Belirli tip için etiketleri getir (public - cache'lenebilir)
app.get('/labels/:type', authenticate, tenantIsolation, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type } = req.params;
    const tenantId = req.user!.tenantId;
    
    // Cache kontrolü
    const cacheKey = `labels:${tenantId}:${type}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.json({ success: true, data: JSON.parse(cached), cached: true });
    }
    
    const labels = await db.queryAll(
      `SELECT label_key, label_value, description
       FROM labels 
       WHERE tenant_id = $1 AND label_type = $2 AND is_active = true
       ORDER BY label_key`,
      [tenantId, type]
    );
    
    // Key-value map olarak dönüştür
    const labelMap: Record<string, string> = {};
    labels.forEach((l: any) => {
      labelMap[l.label_key] = l.label_value;
    });
    
    // Cache'e kaydet (1 saat)
    await cache.set(cacheKey, JSON.stringify(labelMap), 3600);
    
    res.json({ success: true, data: labelMap });
  } catch (error) {
    next(error);
  }
});

// Etiket oluştur
app.post('/labels', authenticate, authorize(ROLES.ADMIN), tenantIsolation, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { label_type, label_key, label_value, description } = req.body;
    const tenantId = req.user!.tenantId;
    
    if (!label_type || !label_key || !label_value) {
      throw new ValidationError('label_type, label_key ve label_value zorunludur');
    }
    
    const result = await db.queryOne(
      `INSERT INTO labels (tenant_id, label_type, label_key, label_value, description)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, label_type, label_key, label_value, description`,
      [tenantId, label_type, label_key, label_value, description || null]
    );
    
    // Cache'i temizle
    await cache.del(`labels:${tenantId}:${label_type}`);
    
    logger.info('Label created', { label_type, label_key, user: req.user!.email });
    res.status(201).json({ success: true, data: result });
  } catch (error: any) {
    if (error.code === '23505') { // Unique constraint violation
      return next(new ValidationError('Bu etiket zaten mevcut'));
    }
    next(error);
  }
});

// Toplu etiket güncelleme (Admin Panel için) - ÖNEMLİ: :id route'undan ÖNCE olmalı!
app.put('/labels/batch', authenticate, authorize(ROLES.ADMIN), tenantIsolation, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { labels } = req.body; // [{ label_type, label_key, label_value }]
    const tenantId = req.user!.tenantId;
    
    if (!Array.isArray(labels) || labels.length === 0) {
      throw new ValidationError('labels array zorunludur');
    }
    
    const typesToClear = new Set<string>();
    
    for (const label of labels) {
      if (!label.label_type || !label.label_key || !label.label_value) {
        continue;
      }
      
      await db.query(
        `INSERT INTO labels (tenant_id, label_type, label_key, label_value)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (tenant_id, label_type, label_key) 
         DO UPDATE SET label_value = $4, updated_at = NOW()`,
        [tenantId, label.label_type, label.label_key, label.label_value]
      );
      typesToClear.add(label.label_type);
    }
    
    // İlgili cache'leri temizle
    for (const type of typesToClear) {
      try {
        await cache.del(`labels:${tenantId}:${type}`);
      } catch {
        // Cache temizleme hatası önemsiz
      }
    }
    
    logger.info('Labels batch updated', { count: labels.length, user: req.user!.email });
    res.json({ success: true, message: `${labels.length} etiket güncellendi` });
  } catch (error) {
    next(error);
  }
});

// Etiket güncelle
app.put('/labels/:id', authenticate, authorize(ROLES.ADMIN), tenantIsolation, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { label_value, description, is_active } = req.body;
    const tenantId = req.user!.tenantId;
    
    // Önce mevcut etiketi bul (label_type için cache temizliği)
    const existing = await db.queryOne(
      'SELECT label_type FROM labels WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    
    if (!existing) {
      throw new NotFoundError('Etiket bulunamadı');
    }
    
    const result = await db.queryOne(
      `UPDATE labels 
       SET label_value = COALESCE($1, label_value),
           description = COALESCE($2, description),
           is_active = COALESCE($3, is_active),
           updated_at = NOW()
       WHERE id = $4 AND tenant_id = $5
       RETURNING id, label_type, label_key, label_value, description, is_active`,
      [label_value, description, is_active, id, tenantId]
    );
    
    // Cache'i temizle
    await cache.del(`labels:${tenantId}:${existing.label_type}`);
    
    logger.info('Label updated', { id, user: req.user!.email });
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// Etiket sil
app.delete('/labels/:id', authenticate, authorize(ROLES.ADMIN), tenantIsolation, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const tenantId = req.user!.tenantId;
    
    // Önce mevcut etiketi bul
    const existing = await db.queryOne(
      'SELECT label_type FROM labels WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    
    if (!existing) {
      throw new NotFoundError('Etiket bulunamadı');
    }
    
    await db.query('DELETE FROM labels WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    
    // Cache'i temizle
    await cache.del(`labels:${tenantId}:${existing.label_type}`);
    
    logger.info('Label deleted', { id, user: req.user!.email });
    res.json({ success: true, message: 'Etiket silindi' });
  } catch (error) {
    next(error);
  }
});

// ============================================
// START SERVER
// ============================================

async function start() {
  try {
    db.createPool();
    await db.checkHealth();
    logger.info('PostgreSQL connected');
    
    // Redis bağlantısı
    cache.createRedisClient();
    await cache.checkHealth();
    logger.info('Redis connected');
    
    // Stuck job cleanup - her 2 dakikada bir
    setInterval(cleanupStuckJobs, 2 * 60 * 1000);
    // İlk kontrol 30 saniye sonra
    setTimeout(cleanupStuckJobs, 30 * 1000);

    app.listen(PORT, () => {
      logger.info(`📦 Core Service running on port ${PORT}`);
      logger.info('🔄 Stuck job cleanup scheduled (every 2 minutes)');
    });
  } catch (error) {
    logger.error('Failed to start core-service', { error });
    process.exit(1);
  }
}

start();

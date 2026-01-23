/**
 * Store Management Routes
 */

import { Router, Request, Response, NextFunction } from 'express';
import { db, authenticate, authorize, ROLES, createLogger, NotFoundError, ValidationError } from '@clixer/shared';

const router = Router();
const logger = createLogger({ service: 'core-service' });

/**
 * GET /stores
 * Get all stores for tenant with optional filters
 */
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
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

/**
 * GET /stores/:id
 * Get a specific store by ID
 */
router.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
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

/**
 * POST /stores
 * Create a new store (Admin only)
 */
router.post('/', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
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

/**
 * PUT /stores/:id
 * Update a store (Admin only)
 */
router.put('/:id', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
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

/**
 * DELETE /stores/:id
 * Delete a store (Admin only)
 */
router.delete('/:id', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
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

export default router;

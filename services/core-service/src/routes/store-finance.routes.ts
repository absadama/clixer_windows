/**
 * Store Finance Settings Routes
 */

import { Router, Request, Response, NextFunction } from 'express';
import { db, authenticate, authorize, ROLES, createLogger, ValidationError } from '@clixer/shared';

const router = Router();
const logger = createLogger({ service: 'core-service' });

/**
 * GET /store-finance
 * Get store finance settings (optionally filtered by store_id)
 */
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
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

/**
 * POST /store-finance
 * Create or update store finance settings (Admin/Manager only)
 */
router.post('/', authenticate, authorize(ROLES.ADMIN, ROLES.MANAGER), async (req: Request, res: Response, next: NextFunction) => {
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

export default router;

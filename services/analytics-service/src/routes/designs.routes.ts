/**
 * Designs Routes
 * Dashboard/Report design CRUD and widget management
 * 
 * NOTE: Complex endpoints remain in index.ts for now.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { db, authenticate, tenantIsolation, createLogger, NotFoundError, ValidationError } from '@clixer/shared';

const router = Router();
const logger = createLogger({ service: 'analytics-service' });

/**
 * GET /designs
 * List all designs
 */
router.get('/', authenticate, tenantIsolation, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type, isActive } = req.query;

    let sql = `
      SELECT d.*, 
             (SELECT COUNT(*) FROM design_widgets dw WHERE dw.design_id = d.id) as widget_count
      FROM designs d
      WHERE d.tenant_id = $1
    `;
    const params: any[] = [req.user!.tenantId];

    if (type) {
      sql += ` AND d.type = $${params.length + 1}`;
      params.push(type);
    }

    if (isActive !== undefined) {
      sql += ` AND d.is_active = $${params.length + 1}`;
      params.push(isActive === 'true');
    }

    sql += ' ORDER BY d.name ASC';

    const designs = await db.queryAll(sql, params);

    res.json({ success: true, data: designs });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /designs/:designId
 * Get design details with widgets
 */
router.get('/:designId', authenticate, tenantIsolation, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { designId } = req.params;

    const design = await db.queryOne(
      'SELECT * FROM designs WHERE id = $1 AND tenant_id = $2',
      [designId, req.user!.tenantId]
    );

    if (!design) {
      throw new NotFoundError('Tasarım');
    }

    // Get widgets
    const widgets = await db.queryAll(
      `SELECT dw.*, m.name as metric_name, m.label as metric_label
       FROM design_widgets dw
       LEFT JOIN metrics m ON dw.metric_id = m.id
       WHERE dw.design_id = $1
       ORDER BY dw.position`,
      [designId]
    );

    res.json({ 
      success: true, 
      data: { 
        ...design, 
        widgets 
      } 
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /designs/:designId
 * Delete a design
 */
router.delete('/:designId', authenticate, tenantIsolation, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { designId } = req.params;

    // Delete widgets first
    await db.query('DELETE FROM design_widgets WHERE design_id = $1', [designId]);

    // Delete design
    const result = await db.query(
      'DELETE FROM designs WHERE id = $1 AND tenant_id = $2',
      [designId, req.user!.tenantId]
    );

    if (result.rowCount === 0) {
      throw new NotFoundError('Tasarım');
    }

    logger.info('Design deleted', { designId, user: req.user!.userId });

    res.json({ success: true, message: 'Tasarım silindi' });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /designs/:designId/widgets/:widgetId
 * Delete a widget from design
 */
router.delete('/:designId/widgets/:widgetId', authenticate, tenantIsolation, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { designId, widgetId } = req.params;

    // Verify design ownership
    const design = await db.queryOne(
      'SELECT id FROM designs WHERE id = $1 AND tenant_id = $2',
      [designId, req.user!.tenantId]
    );

    if (!design) {
      throw new NotFoundError('Tasarım');
    }

    const result = await db.query(
      'DELETE FROM design_widgets WHERE id = $1 AND design_id = $2',
      [widgetId, designId]
    );

    if (result.rowCount === 0) {
      throw new NotFoundError('Widget');
    }

    res.json({ success: true, message: 'Widget silindi' });
  } catch (error) {
    next(error);
  }
});

// NOTE: Complex endpoints (POST/PUT designs, widget management) remain in index.ts

export default router;

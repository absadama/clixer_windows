/**
 * Clixer - Navigation Routes
 * Dinamik navigasyon öğeleri için API
 * GET /api/core/navigation - Tüm navigasyon öğelerini getir
 */

import { Router, Request, Response, NextFunction } from 'express';
import { db, authenticate, createLogger, cache } from '@clixer/shared';

const router = Router();
const logger = createLogger({ service: 'core-service' });

// Cache key ve TTL
const NAVIGATION_CACHE_KEY = 'navigation:items';
const NAVIGATION_CACHE_TTL = 300; // 5 dakika

interface NavigationItem {
  id: string;
  item_type: 'page' | 'tab' | 'command' | 'setting' | 'sidebar_group' | 'sidebar_item';
  code: string;
  label: string;
  description?: string;
  path?: string;
  icon?: string;
  parent_code?: string;
  keywords?: string[];
  search_priority: number;
  sort_order: number;
  required_roles?: string[];
  is_searchable: boolean;
  is_visible_in_menu: boolean;
}

/**
 * GET /navigation
 * Kullanıcının erişebileceği tüm navigasyon öğelerini getirir
 * Cache'lenir, rol bazlı filtreleme yapar
 */
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const userRole = req.user!.role;
    
    // Cache kontrolü - tenant + role bazlı
    const cacheKey = `${NAVIGATION_CACHE_KEY}:${tenantId}:${userRole}`;
    const cached = await cache.get(cacheKey);
    
    if (cached) {
      res.json({
        success: true,
        data: cached,
        cached: true
      });
      return;
    }
    
    // Veritabanından çek
    // Global (tenant_id IS NULL) + Tenant-specific öğeler
    const result = await db.query(`
      SELECT 
        id,
        item_type,
        code,
        label,
        description,
        path,
        icon,
        parent_code,
        keywords,
        search_priority,
        sort_order,
        required_roles,
        is_searchable,
        is_visible_in_menu
      FROM navigation_items
      WHERE is_active = true
        AND (tenant_id IS NULL OR tenant_id = $1)
      ORDER BY search_priority DESC, sort_order ASC
    `, [tenantId]);
    
    // Rol bazlı filtreleme
    const filteredItems: NavigationItem[] = result.rows.filter((item: any) => {
      // required_roles boş veya null ise herkese açık
      if (!item.required_roles || item.required_roles.length === 0) {
        return true;
      }
      // Kullanıcının rolü required_roles içinde mi?
      return item.required_roles.includes(userRole);
    });
    
    // Cache'e kaydet
    await cache.set(cacheKey, filteredItems, NAVIGATION_CACHE_TTL);
    
    res.json({
      success: true,
      data: filteredItems,
      cached: false
    });
    
  } catch (error: any) {
    logger.error('Navigation fetch error', { error: error.message });
    next(error);
  }
});

/**
 * POST /navigation
 * Yeni navigasyon öğesi ekle (SUPER_ADMIN only)
 */
router.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userRole = req.user!.role;
    
    if (userRole !== 'SUPER_ADMIN') {
      res.status(403).json({
        success: false,
        message: 'Bu işlem için SUPER_ADMIN yetkisi gerekli'
      });
      return;
    }
    
    const {
      item_type,
      code,
      label,
      description,
      path,
      icon,
      parent_code,
      keywords,
      search_priority = 0,
      sort_order = 0,
      required_roles,
      is_searchable = true,
      is_visible_in_menu = true,
      tenant_id // null for global
    } = req.body;
    
    // Validation
    if (!item_type || !code || !label) {
      res.status(400).json({
        success: false,
        message: 'item_type, code ve label zorunludur'
      });
      return;
    }
    
    const result = await db.query(`
      INSERT INTO navigation_items (
        tenant_id, item_type, code, label, description, path, icon,
        parent_code, keywords, search_priority, sort_order,
        required_roles, is_searchable, is_visible_in_menu
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (tenant_id, code) DO UPDATE SET
        label = EXCLUDED.label,
        description = EXCLUDED.description,
        path = EXCLUDED.path,
        icon = EXCLUDED.icon,
        parent_code = EXCLUDED.parent_code,
        keywords = EXCLUDED.keywords,
        search_priority = EXCLUDED.search_priority,
        sort_order = EXCLUDED.sort_order,
        required_roles = EXCLUDED.required_roles,
        is_searchable = EXCLUDED.is_searchable,
        is_visible_in_menu = EXCLUDED.is_visible_in_menu,
        updated_at = now()
      RETURNING *
    `, [
      tenant_id || null,
      item_type,
      code,
      label,
      description || null,
      path || null,
      icon || null,
      parent_code || null,
      keywords || null,
      search_priority,
      sort_order,
      required_roles || null,
      is_searchable,
      is_visible_in_menu
    ]);
    
    // Cache'i temizle
    await invalidateNavigationCache();
    
    res.json({
      success: true,
      data: result.rows[0],
      message: 'Navigasyon öğesi eklendi'
    });
    
  } catch (error: any) {
    logger.error('Navigation create error', { error: error.message });
    next(error);
  }
});

/**
 * PUT /navigation/:id
 * Navigasyon öğesi güncelle (SUPER_ADMIN only)
 */
router.put('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userRole = req.user!.role;
    const { id } = req.params;
    
    if (userRole !== 'SUPER_ADMIN') {
      res.status(403).json({
        success: false,
        message: 'Bu işlem için SUPER_ADMIN yetkisi gerekli'
      });
      return;
    }
    
    const {
      label,
      description,
      path,
      icon,
      parent_code,
      keywords,
      search_priority,
      sort_order,
      required_roles,
      is_searchable,
      is_visible_in_menu,
      is_active
    } = req.body;
    
    const result = await db.query(`
      UPDATE navigation_items SET
        label = COALESCE($2, label),
        description = COALESCE($3, description),
        path = COALESCE($4, path),
        icon = COALESCE($5, icon),
        parent_code = COALESCE($6, parent_code),
        keywords = COALESCE($7, keywords),
        search_priority = COALESCE($8, search_priority),
        sort_order = COALESCE($9, sort_order),
        required_roles = COALESCE($10, required_roles),
        is_searchable = COALESCE($11, is_searchable),
        is_visible_in_menu = COALESCE($12, is_visible_in_menu),
        is_active = COALESCE($13, is_active),
        updated_at = now()
      WHERE id = $1
      RETURNING *
    `, [
      id,
      label,
      description,
      path,
      icon,
      parent_code,
      keywords,
      search_priority,
      sort_order,
      required_roles,
      is_searchable,
      is_visible_in_menu,
      is_active
    ]);
    
    if (result.rowCount === 0) {
      res.status(404).json({
        success: false,
        message: 'Navigasyon öğesi bulunamadı'
      });
      return;
    }
    
    // Cache'i temizle
    await invalidateNavigationCache();
    
    res.json({
      success: true,
      data: result.rows[0],
      message: 'Navigasyon öğesi güncellendi'
    });
    
  } catch (error: any) {
    logger.error('Navigation update error', { error: error.message });
    next(error);
  }
});

/**
 * DELETE /navigation/:id
 * Navigasyon öğesi sil (SUPER_ADMIN only)
 */
router.delete('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userRole = req.user!.role;
    const { id } = req.params;
    
    if (userRole !== 'SUPER_ADMIN') {
      res.status(403).json({
        success: false,
        message: 'Bu işlem için SUPER_ADMIN yetkisi gerekli'
      });
      return;
    }
    
    const result = await db.query(`
      DELETE FROM navigation_items WHERE id = $1 RETURNING code
    `, [id]);
    
    if (result.rowCount === 0) {
      res.status(404).json({
        success: false,
        message: 'Navigasyon öğesi bulunamadı'
      });
      return;
    }
    
    // Cache'i temizle
    await invalidateNavigationCache();
    
    res.json({
      success: true,
      message: `Navigasyon öğesi silindi: ${result.rows[0].code}`
    });
    
  } catch (error: any) {
    logger.error('Navigation delete error', { error: error.message });
    next(error);
  }
});

/**
 * Cache invalidation helper
 */
async function invalidateNavigationCache() {
  try {
    // Tüm navigation cache'lerini temizle (pattern matching)
    const keys = await cache.keys(`${NAVIGATION_CACHE_KEY}:*`);
    for (const key of keys) {
      await cache.del(key);
    }
    logger.info('Navigation cache invalidated', { keysCleared: keys.length });
  } catch (error: any) {
    logger.warn('Failed to invalidate navigation cache', { error: error.message });
  }
}

export default router;

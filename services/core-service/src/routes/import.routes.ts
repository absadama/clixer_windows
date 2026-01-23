/**
 * Data Import Routes (Excel/Dataset)
 */

import { Router, Request, Response, NextFunction } from 'express';
import { db, clickhouse, authenticate, authorize, ROLES, createLogger, NotFoundError, ValidationError } from '@clixer/shared';

const router = Router();
const logger = createLogger({ service: 'core-service' });

/**
 * POST /stores/import
 * Import stores from Excel data (Admin only)
 */
router.post('/stores/import', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { data } = req.body; // [{ code, name, store_type, region_code, city, ... }]
    
    if (!Array.isArray(data) || data.length === 0) {
      throw new ValidationError('Veri dizisi boş veya geçersiz');
    }
    
    let imported = 0;
    let errors: string[] = [];
    
    for (const row of data) {
      try {
        // Find region ID from code
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

/**
 * POST /stores/import-from-dataset/preview
 * Preview dataset columns and sample data
 */
router.post('/stores/import-from-dataset/preview', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { datasetId } = req.body;
    
    if (!datasetId) {
      throw new ValidationError('Dataset ID gerekli');
    }
    
    // Get dataset info
    const dataset = await db.queryOne(
      'SELECT id, name, clickhouse_table FROM datasets WHERE id = $1 AND tenant_id = $2',
      [datasetId, req.user!.tenantId]
    );
    
    if (!dataset) {
      throw new NotFoundError('Dataset bulunamadı');
    }
    
    // Get column info from ClickHouse
    const columnsResult = await clickhouse.query<{ name: string; type: string }>(
      `DESCRIBE clixer_analytics.${dataset.clickhouse_table}`
    );
    
    const columns = columnsResult
      .filter((c: any) => !c.name.startsWith('_'))
      .map((c: any) => ({ name: c.name, type: c.type }));
    
    // Get first 10 rows for preview
    const previewData = await clickhouse.query(
      `SELECT * FROM clixer_analytics.${dataset.clickhouse_table} LIMIT 10`
    );
    
    // Get total row count
    const countResult = await clickhouse.query<{ count: number }>(
      `SELECT count() as count FROM clixer_analytics.${dataset.clickhouse_table}`
    );
    const totalRows = countResult[0]?.count || 0;
    
    res.json({
      success: true,
      data: {
        dataset: {
          id: dataset.id,
          name: dataset.name,
          tableName: dataset.clickhouse_table
        },
        columns,
        preview: previewData,
        totalRows
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /stores/import-from-dataset
 * Import stores from dataset with column mapping
 */
router.post('/stores/import-from-dataset', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { 
      datasetId, 
      mapping,
      limit
    } = req.body;
    
    if (!datasetId || !mapping || !mapping.code) {
      throw new ValidationError('Dataset ID ve en az code mapping gerekli');
    }
    
    // Get dataset info
    const dataset = await db.queryOne(
      'SELECT id, name, clickhouse_table FROM datasets WHERE id = $1 AND tenant_id = $2',
      [datasetId, req.user!.tenantId]
    );
    
    if (!dataset) {
      throw new NotFoundError('Dataset bulunamadı');
    }
    
    // Build SELECT query from mapping
    const selectColumns: string[] = [];
    const mappingFields = ['code', 'name', 'store_type', 'ownership_group', 'region_code', 'city', 'district', 'address', 'phone', 'email', 'manager_name'];
    
    for (const field of mappingFields) {
      if (mapping[field]) {
        selectColumns.push(`${mapping[field]} as ${field}`);
      }
    }
    
    if (selectColumns.length === 0) {
      throw new ValidationError('En az bir kolon mapping gerekli');
    }
    
    const limitClause = limit ? `LIMIT ${parseInt(limit)}` : '';
    const sql = `SELECT DISTINCT ${selectColumns.join(', ')} FROM clixer_analytics.${dataset.clickhouse_table} ${limitClause}`;
    
    const rows = await clickhouse.query<Record<string, any>>(sql);
    
    if (rows.length === 0) {
      throw new ValidationError('Dataset boş veya veri bulunamadı');
    }
    
    // Get existing regions for mapping
    const regions = await db.queryAll(
      'SELECT id, code FROM regions WHERE tenant_id = $1',
      [req.user!.tenantId]
    );
    const regionMap = new Map(regions.map((r: any) => [r.code, r.id]));
    
    let imported = 0;
    let updated = 0;
    let errors: string[] = [];
    
    for (const row of rows) {
      try {
        const code = String(row.code || '').trim();
        if (!code) {
          errors.push('Boş kod değeri atlandı');
          continue;
        }
        
        // Find region ID
        let regionId = null;
        if (row.region_code) {
          regionId = regionMap.get(String(row.region_code).trim()) || null;
        }
        
        // Check if exists
        const existing = await db.queryOne(
          'SELECT id FROM stores WHERE tenant_id = $1 AND code = $2',
          [req.user!.tenantId, code]
        );
        
        if (existing) {
          // Update
          await db.query(
            `UPDATE stores SET
              name = COALESCE($3, name),
              store_type = COALESCE($4, store_type),
              ownership_group = COALESCE($5, ownership_group),
              region_id = COALESCE($6, region_id),
              city = COALESCE($7, city),
              district = COALESCE($8, district),
              address = COALESCE($9, address),
              phone = COALESCE($10, phone),
              email = COALESCE($11, email),
              manager_name = COALESCE($12, manager_name),
              updated_at = NOW()
            WHERE tenant_id = $1 AND code = $2`,
            [
              req.user!.tenantId, code,
              row.name || null, row.store_type || null, row.ownership_group || null,
              regionId, row.city || null, row.district || null,
              row.address || null, row.phone || null, row.email || null, row.manager_name || null
            ]
          );
          updated++;
        } else {
          // Insert
          await db.query(
            `INSERT INTO stores (tenant_id, code, name, store_type, ownership_group, region_id, city, district, address, phone, email, manager_name, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true)`,
            [
              req.user!.tenantId, code,
              row.name || code, row.store_type || 'MAGAZA', row.ownership_group || 'MERKEZ',
              regionId, row.city || null, row.district || null,
              row.address || null, row.phone || null, row.email || null, row.manager_name || null
            ]
          );
          imported++;
        }
      } catch (err: any) {
        errors.push(`${row.code}: ${err.message}`);
      }
    }
    
    logger.info('Stores imported from dataset', { 
      datasetId, datasetName: dataset.name, imported, updated, errors: errors.length, user: req.user!.email 
    });
    
    res.json({ 
      success: true, 
      message: `${imported} mağaza eklendi, ${updated} mağaza güncellendi`,
      imported, updated, total: imported + updated,
      errors: errors.slice(0, 10)
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /regions/import
 * Import regions from Excel data (Admin only)
 */
router.post('/regions/import', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
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

export default router;

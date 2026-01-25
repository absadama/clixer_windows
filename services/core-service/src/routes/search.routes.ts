/**
 * Clixer - Unified Search Routes
 * Tüm entity'lerde arama yapan endpoint
 * GET /api/core/search?q=query&types=metric,store,user&limit=10
 */

import { Router, Request, Response, NextFunction } from 'express';
import { db, authenticate, authorize, ROLES, createLogger } from '@clixer/shared';

const router = Router();
const logger = createLogger({ service: 'core-service' });

// Aranabilir entity tipleri
type SearchType = 'metric' | 'store' | 'dashboard' | 'user' | 'dataset' | 'connection' | 'region';

// Varsayılan aranacak tipler (user hariç - admin only)
const DEFAULT_SEARCH_TYPES: SearchType[] = ['metric', 'store', 'dashboard', 'dataset', 'connection', 'region'];
const ADMIN_SEARCH_TYPES: SearchType[] = ['user'];

interface SearchResultItem {
  id: string;
  name?: string;
  label?: string;
  code?: string;
  description?: string;
  city?: string;
  email?: string;
  role?: string;
  type?: string;
}

interface SearchResultGroup {
  type: SearchType;
  items: SearchResultItem[];
}

/**
 * GET /search
 * Unified search across all entities
 * Query params:
 *   - q: search query (required, min 2 chars)
 *   - types: comma-separated list of types to search (optional)
 *   - limit: max results per type (default 5, max 20)
 */
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  
  try {
    const { q, types, limit: limitParam } = req.query;
    const tenantId = req.user!.tenantId;
    const userRole = req.user!.role;
    
    // Validate query
    if (!q || typeof q !== 'string' || q.length < 2) {
      res.status(400).json({
        success: false,
        errorCode: 'INVALID_QUERY',
        message: 'Arama sorgusu en az 2 karakter olmalı'
      });
      return;
    }
    
    // Parse limit
    const limit = Math.min(Math.max(1, parseInt(limitParam as string) || 5), 20);
    
    // Parse types
    let searchTypes: SearchType[] = [...DEFAULT_SEARCH_TYPES];
    
    // Admin/SuperAdmin can search users
    if (userRole === ROLES.ADMIN || userRole === ROLES.SUPER_ADMIN) {
      searchTypes.push(...ADMIN_SEARCH_TYPES);
    }
    
    // Filter by requested types if provided
    if (types && typeof types === 'string') {
      const requestedTypes = types.split(',').map(t => t.trim().toLowerCase()) as SearchType[];
      searchTypes = searchTypes.filter(t => requestedTypes.includes(t));
    }
    
    // Search pattern (case-insensitive)
    const searchPattern = `%${q}%`;
    
    // Execute searches in parallel
    const searchPromises = searchTypes.map(type => 
      searchByType(type, tenantId, searchPattern, limit, userRole)
    );
    
    const searchResults = await Promise.all(searchPromises);
    
    // Filter out empty results and build response
    const results: SearchResultGroup[] = searchResults
      .filter(r => r !== null && r.items.length > 0) as SearchResultGroup[];
    
    // Calculate total count
    const totalCount = results.reduce((sum, group) => sum + group.items.length, 0);
    
    const executionTime = Date.now() - startTime;
    
    logger.info('Search completed', { 
      query: q, 
      types: searchTypes, 
      totalCount, 
      executionTime 
    });
    
    res.json({
      success: true,
      data: {
        results,
        totalCount,
        executionTime
      }
    });
    
  } catch (error: any) {
    logger.error('Search error', { error: error.message });
    next(error);
  }
});

/**
 * Search by entity type
 */
async function searchByType(
  type: SearchType, 
  tenantId: string, 
  pattern: string, 
  limit: number,
  userRole: string
): Promise<SearchResultGroup | null> {
  try {
    let items: SearchResultItem[] = [];
    
    switch (type) {
      case 'metric':
        items = await searchMetrics(tenantId, pattern, limit);
        break;
      case 'store':
        items = await searchStores(tenantId, pattern, limit);
        break;
      case 'dashboard':
        items = await searchDashboards(tenantId, pattern, limit);
        break;
      case 'user':
        items = await searchUsers(tenantId, pattern, limit);
        break;
      case 'dataset':
        items = await searchDatasets(tenantId, pattern, limit);
        break;
      case 'connection':
        items = await searchConnections(tenantId, pattern, limit);
        break;
      case 'region':
        items = await searchRegions(tenantId, pattern, limit);
        break;
    }
    
    return { type, items };
  } catch (error: any) {
    logger.warn(`Search failed for type ${type}`, { error: error.message });
    return null;
  }
}

/**
 * Search metrics
 */
async function searchMetrics(tenantId: string, pattern: string, limit: number): Promise<SearchResultItem[]> {
  const result = await db.query(`
    SELECT id, name, label, description
    FROM metrics
    WHERE tenant_id = $1
      AND is_active = true
      AND (
        name ILIKE $2 
        OR label ILIKE $2 
        OR description ILIKE $2
      )
    ORDER BY 
      CASE WHEN label ILIKE $3 THEN 0 ELSE 1 END,
      label
    LIMIT $4
  `, [tenantId, pattern, pattern.replace(/%/g, ''), limit]);
  
  return result.rows.map(row => ({
    id: row.id,
    name: row.name,
    label: row.label,
    description: row.description
  }));
}

/**
 * Search stores
 */
async function searchStores(tenantId: string, pattern: string, limit: number): Promise<SearchResultItem[]> {
  const result = await db.query(`
    SELECT id, code, name, city
    FROM stores
    WHERE tenant_id = $1
      AND is_active = true
      AND (
        code ILIKE $2 
        OR name ILIKE $2 
        OR city ILIKE $2
      )
    ORDER BY 
      CASE WHEN name ILIKE $3 THEN 0 ELSE 1 END,
      name
    LIMIT $4
  `, [tenantId, pattern, pattern.replace(/%/g, ''), limit]);
  
  return result.rows.map(row => ({
    id: row.id,
    code: row.code,
    name: row.name,
    city: row.city
  }));
}

/**
 * Search dashboards (designs)
 */
async function searchDashboards(tenantId: string, pattern: string, limit: number): Promise<SearchResultItem[]> {
  const result = await db.query(`
    SELECT id, name, description, type
    FROM designs
    WHERE tenant_id = $1
      AND is_active = true
      AND (
        name ILIKE $2 
        OR description ILIKE $2
      )
    ORDER BY 
      CASE WHEN name ILIKE $3 THEN 0 ELSE 1 END,
      name
    LIMIT $4
  `, [tenantId, pattern, pattern.replace(/%/g, ''), limit]);
  
  return result.rows.map(row => ({
    id: row.id,
    name: row.name,
    description: row.description,
    type: row.type
  }));
}

/**
 * Search users (Admin only)
 */
async function searchUsers(tenantId: string, pattern: string, limit: number): Promise<SearchResultItem[]> {
  const result = await db.query(`
    SELECT id, name, email, role
    FROM users
    WHERE tenant_id = $1
      AND is_active = true
      AND (
        name ILIKE $2 
        OR email ILIKE $2
      )
    ORDER BY 
      CASE WHEN name ILIKE $3 THEN 0 ELSE 1 END,
      name
    LIMIT $4
  `, [tenantId, pattern, pattern.replace(/%/g, ''), limit]);
  
  return result.rows.map(row => ({
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role
  }));
}

/**
 * Search datasets
 */
async function searchDatasets(tenantId: string, pattern: string, limit: number): Promise<SearchResultItem[]> {
  const result = await db.query(`
    SELECT id, name, source_table, clickhouse_table, status
    FROM datasets
    WHERE tenant_id = $1
      AND (
        name ILIKE $2 
        OR source_table ILIKE $2
        OR clickhouse_table ILIKE $2
      )
    ORDER BY 
      CASE WHEN name ILIKE $3 THEN 0 ELSE 1 END,
      name
    LIMIT $4
  `, [tenantId, pattern, pattern.replace(/%/g, ''), limit]);
  
  return result.rows.map(row => ({
    id: row.id,
    name: row.name,
    description: row.source_table || row.clickhouse_table,
    type: row.status
  }));
}

/**
 * Search data connections
 */
async function searchConnections(tenantId: string, pattern: string, limit: number): Promise<SearchResultItem[]> {
  const result = await db.query(`
    SELECT id, name, type, database_name
    FROM data_connections
    WHERE tenant_id = $1
      AND (
        name ILIKE $2 
        OR type ILIKE $2
        OR database_name ILIKE $2
      )
    ORDER BY 
      CASE WHEN name ILIKE $3 THEN 0 ELSE 1 END,
      name
    LIMIT $4
  `, [tenantId, pattern, pattern.replace(/%/g, ''), limit]);
  
  return result.rows.map(row => ({
    id: row.id,
    name: row.name,
    type: row.type,
    description: row.database_name
  }));
}

/**
 * Search regions
 */
async function searchRegions(tenantId: string, pattern: string, limit: number): Promise<SearchResultItem[]> {
  const result = await db.query(`
    SELECT id, code, name, description
    FROM regions
    WHERE tenant_id = $1
      AND is_active = true
      AND (
        code ILIKE $2 
        OR name ILIKE $2
      )
    ORDER BY 
      CASE WHEN name ILIKE $3 THEN 0 ELSE 1 END,
      name
    LIMIT $4
  `, [tenantId, pattern, pattern.replace(/%/g, ''), limit]);
  
  return result.rows.map(row => ({
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description
  }));
}

export default router;

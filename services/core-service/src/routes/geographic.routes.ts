/**
 * Geographic Locations Routes
 */

import { Router, Request, Response, NextFunction } from 'express';
import { db, authenticate, NotFoundError } from '@clixer/shared';

const router = Router();

/**
 * GET /geographic/cities
 * Get all cities with optional region filter
 */
router.get('/cities', authenticate, async (req: Request, res: Response, next: NextFunction) => {
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

/**
 * GET /geographic/cities/:code
 * Get city details with districts
 */
router.get('/cities/:code', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cityCode = req.params.code;
    
    // City info
    const city = await db.queryOne(
      `SELECT * FROM geographic_locations WHERE city_code = $1 AND location_type = 'CITY' LIMIT 1`,
      [cityCode]
    );
    
    if (!city) {
      throw new NotFoundError('İl bulunamadı');
    }
    
    // Districts
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

/**
 * GET /geographic/cities/:cityCode/districts/:districtName
 * Get district details with neighborhoods
 */
router.get('/cities/:cityCode/districts/:districtName', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { cityCode, districtName } = req.params;
    
    // District info
    const district = await db.queryOne(
      `SELECT * FROM geographic_locations 
       WHERE city_code = $1 AND LOWER(district_name) = LOWER($2) AND location_type = 'DISTRICT' 
       LIMIT 1`,
      [cityCode, districtName]
    );
    
    if (!district) {
      throw new NotFoundError('İlçe bulunamadı');
    }
    
    // Neighborhoods
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

/**
 * GET /geographic/search
 * Fuzzy search locations
 */
router.get('/search', authenticate, async (req: Request, res: Response, next: NextFunction) => {
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

/**
 * POST /geographic/lookup
 * Coordinate lookup from names
 */
router.post('/lookup', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { locations } = req.body;
    
    if (!Array.isArray(locations) || locations.length === 0) {
      return res.json({ success: true, data: [] });
    }
    
    const results: any[] = [];
    
    for (const loc of locations) {
      const { name, city, district, neighborhood } = loc;
      
      let result = null;
      
      // 1. Search neighborhood if provided
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
      
      // 2. Search district
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
      
      // 3. Search city
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
      
      // 4. Fuzzy search
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

/**
 * GET /geographic/regions
 * Get all geographic regions (7 regions of Turkey)
 */
router.get('/regions', authenticate, async (req: Request, res: Response, next: NextFunction) => {
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

/**
 * GET /geographic/stats
 * Get statistics about geographic data
 */
router.get('/stats', authenticate, async (req: Request, res: Response, next: NextFunction) => {
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

export default router;

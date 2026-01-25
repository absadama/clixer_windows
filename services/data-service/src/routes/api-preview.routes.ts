/**
 * API Preview Routes
 * External API data preview
 * SECURITY: SSRF koruması uygulandı
 */

import { Router, Request, Response, NextFunction } from 'express';
import { db, authenticate, createLogger, NotFoundError, AppError, validateExternalUrl, safeFetch } from '@clixer/shared';

const router = Router();
const logger = createLogger({ service: 'data-service' });

/**
 * POST /api-preview
 * Preview data from external API
 */
router.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { connectionId, endpoint, method = 'GET', queryParams, headers, responsePath, requestBody } = req.body;

    const connection = await db.queryOne(
      'SELECT * FROM data_connections WHERE id = $1 AND tenant_id = $2',
      [connectionId, req.user!.tenantId]
    );

    if (!connection) {
      throw new NotFoundError('Bağlantı');
    }

    // Build URL
    let url = (connection.host || '').trim();
    if (endpoint) {
      url = url.replace(/\/$/, '') + '/' + endpoint.replace(/^\//, '');
    }
    if (queryParams) {
      url += (url.includes('?') ? '&' : '?') + queryParams;
    }

    // Build headers
    const fetchHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(connection.api_config?.headers || {}),
      ...(headers || {})
    };

    // Add API Key if exists
    if (connection.api_config?.apiKey) {
      const headerName = connection.api_config?.headerName || 'Authorization';
      if (headerName === 'Authorization') {
        fetchHeaders['Authorization'] = `Bearer ${connection.api_config.apiKey}`;
      } else {
        fetchHeaders[headerName] = connection.api_config.apiKey;
      }
    }

    logger.info('API Preview request', { url, method, hasBody: !!requestBody });

    // SECURITY: SSRF koruması - internal/private adreslere erişimi engelle
    const urlValidation = validateExternalUrl(url);
    if (!urlValidation.valid) {
      throw new AppError(`Güvenlik hatası: ${urlValidation.error}`, 400, 'SSRF_BLOCKED');
    }

    const startTime = Date.now();
    
    // Fetch options
    const fetchOptions: RequestInit = {
      method,
      headers: fetchHeaders,
      signal: AbortSignal.timeout(30000)
    };
    
    // Add body for POST/PUT
    if ((method === 'POST' || method === 'PUT') && requestBody) {
      try {
        fetchOptions.body = typeof requestBody === 'string' ? requestBody : JSON.stringify(requestBody);
      } catch {
        fetchOptions.body = requestBody;
      }
    }
    
    // SECURITY: safeFetch kullan (SSRF korumalı)
    const response = await safeFetch(url, fetchOptions);

    const executionTime = Date.now() - startTime;
    
    if (!response.ok) {
      throw new AppError(`API hatası: ${response.status} ${response.statusText}`, response.status, 'API_ERROR');
    }

    let data = await response.json();

    // Extract nested data using response path
    if (responsePath) {
      const paths = responsePath.split('.');
      for (const p of paths) {
        if (data && (data as Record<string, unknown>)[p] !== undefined) {
          data = (data as Record<string, unknown>)[p];
        }
      }
    }

    // Convert to array if not
    const rows = Array.isArray(data) ? data : [data];
    
    // Extract columns
    const columns = rows.length > 0 
      ? Object.keys(rows[0]).map(name => ({ name, type: typeof rows[0][name] }))
      : [];

    res.json({ 
      success: true, 
      data: { 
        rows: rows.slice(0, 100), // Max 100 rows
        columns,
        rowCount: rows.length,
        executionTime
      }
    });
  } catch (error: any) {
    logger.error('API Preview error', { error: error.message });
    next(error);
  }
});

export default router;

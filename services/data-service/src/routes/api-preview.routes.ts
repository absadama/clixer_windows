/**
 * API Preview Routes
 * API connection testing and preview
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, createLogger, ValidationError } from '@clixer/shared';

const router = Router();
const logger = createLogger({ service: 'data-service' });

/**
 * POST /api-preview
 * Test and preview an API connection
 */
router.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { url, method = 'GET', headers, body, authType, authConfig } = req.body;
    
    if (!url) {
      throw new ValidationError('URL gerekli');
    }
    
    // Build request options
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers
    };
    
    // Add auth headers
    if (authType === 'bearer' && authConfig?.token) {
      requestHeaders['Authorization'] = `Bearer ${authConfig.token}`;
    } else if (authType === 'basic' && authConfig?.username && authConfig?.password) {
      const credentials = Buffer.from(`${authConfig.username}:${authConfig.password}`).toString('base64');
      requestHeaders['Authorization'] = `Basic ${credentials}`;
    } else if (authType === 'api_key' && authConfig?.key && authConfig?.value) {
      requestHeaders[authConfig.key] = authConfig.value;
    }
    
    const startTime = Date.now();
    
    const response = await fetch(url, {
      method,
      headers: requestHeaders,
      body: method !== 'GET' && body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30000)
    });
    
    const latency = Date.now() - startTime;
    const responseText = await response.text();
    
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = responseText;
    }
    
    res.json({
      success: response.ok,
      data: {
        status: response.status,
        statusText: response.statusText,
        latency,
        headers: Object.fromEntries(response.headers.entries()),
        data: responseData,
        dataType: typeof responseData === 'object' ? 'json' : 'text',
        rowCount: Array.isArray(responseData) ? responseData.length : 1
      }
    });
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return res.json({ success: false, error: 'İstek zaman aşımına uğradı (30s)' });
    }
    next(error);
  }
});

export default router;

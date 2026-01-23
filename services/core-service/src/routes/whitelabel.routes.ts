/**
 * WhiteLabel Routes
 * Logo upload, logo-info, manifest.json for PWA
 */

import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { db, authenticate, authorize, ROLES, createLogger } from '@clixer/shared';

const router = Router();
const logger = createLogger({ service: 'core-service' });

// Upload directory configuration
const isDev = process.env.NODE_ENV !== 'production';
const UPLOAD_DIR = process.env.UPLOAD_DIR || (isDev 
  ? path.join(__dirname, '../../../../frontend/public/uploads') 
  : '/opt/clixer/uploads');

const LOGO_SIZES = [
  { name: 'logo-512', size: 512 },
  { name: 'logo-192', size: 192 },
  { name: 'logo-96', size: 96 },
  { name: 'logo-72', size: 72 },
  { name: 'logo-32', size: 32 }
];

// Multer configuration for logo upload
const logoStorage = multer.memoryStorage();
const logoUpload = multer({
  storage: logoStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/png', 'image/svg+xml'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Sadece PNG veya SVG formatı kabul edilir'));
    }
  }
});

// Ensure upload directory exists
const ensureUploadDir = () => {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    logger.info('Created upload directory', { path: UPLOAD_DIR });
  }
};

/**
 * POST /upload/logo
 * Upload and resize logo (Admin only)
 */
router.post('/upload/logo', authenticate, authorize(ROLES.ADMIN), logoUpload.single('logo'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Logo dosyası gerekli' });
    }

    ensureUploadDir();

    // Get image metadata to check dimensions
    const metadata = await sharp(req.file.buffer).metadata();
    if (!metadata.width || !metadata.height) {
      return res.status(400).json({ success: false, error: 'Görsel boyutları okunamadı' });
    }

    if (metadata.width < 512 || metadata.height < 512) {
      return res.status(400).json({ 
        success: false, 
        error: `Logo en az 512x512 piksel olmalı. Yüklenen: ${metadata.width}x${metadata.height}` 
      });
    }

    const isSvg = req.file.mimetype === 'image/svg+xml';
    const generatedFiles: string[] = [];

    if (isSvg) {
      // Save SVG directly
      const svgPath = path.join(UPLOAD_DIR, 'logo.svg');
      fs.writeFileSync(svgPath, req.file.buffer);
      generatedFiles.push('logo.svg');

      // Generate PNG versions from SVG
      for (const logoSize of LOGO_SIZES) {
        const outputPath = path.join(UPLOAD_DIR, `${logoSize.name}.png`);
        await sharp(req.file.buffer)
          .resize(logoSize.size, logoSize.size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .png()
          .toFile(outputPath);
        generatedFiles.push(`${logoSize.name}.png`);
      }
    } else {
      // Generate all PNG sizes
      for (const logoSize of LOGO_SIZES) {
        const outputPath = path.join(UPLOAD_DIR, `${logoSize.name}.png`);
        await sharp(req.file.buffer)
          .resize(logoSize.size, logoSize.size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .png()
          .toFile(outputPath);
        generatedFiles.push(`${logoSize.name}.png`);
      }
    }

    // Update system_settings with new logo URLs
    const logoUrl = isSvg ? '/uploads/logo.svg' : '/uploads/logo-512.png';
    const faviconUrl = '/uploads/logo-32.png';

    await db.query(
      `INSERT INTO system_settings (tenant_id, key, value, category)
       VALUES ($1, 'app_logo_url', $2, 'branding')
       ON CONFLICT (tenant_id, key) DO UPDATE SET value = $2, updated_at = NOW()`,
      [(req as any).user.tenantId, JSON.stringify({ value: logoUrl })]
    );

    await db.query(
      `INSERT INTO system_settings (tenant_id, key, value, category)
       VALUES ($1, 'app_favicon_url', $2, 'branding')
       ON CONFLICT (tenant_id, key) DO UPDATE SET value = $2, updated_at = NOW()`,
      [(req as any).user.tenantId, JSON.stringify({ value: faviconUrl })]
    );

    logger.info('Logo uploaded', { user: (req as any).user.email, files: generatedFiles });

    res.json({
      success: true,
      message: 'Logo başarıyla yüklendi',
      data: {
        logoUrl,
        faviconUrl,
        generatedFiles
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /logo-info
 * Get logo status (PUBLIC - for LoginPage and Admin Panel)
 */
router.get('/logo-info', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const logo512Exists = fs.existsSync(path.join(UPLOAD_DIR, 'logo-512.png'));
    const logo192Exists = fs.existsSync(path.join(UPLOAD_DIR, 'logo-192.png'));
    const logoSvgExists = fs.existsSync(path.join(UPLOAD_DIR, 'logo.svg'));

    // Get current URLs and app_name from system_settings
    const settings = await db.queryAll(
      `SELECT key, value FROM system_settings WHERE key IN ('app_logo_url', 'app_favicon_url', 'app_name')`
    );

    const settingsMap: Record<string, any> = {};
    for (const s of settings) {
      try {
        const parsed = JSON.parse(s.value);
        settingsMap[s.key] = typeof parsed === 'object' && parsed.value !== undefined ? parsed.value : parsed;
      } catch {
        settingsMap[s.key] = s.value;
      }
    }

    // Prefer SVG, then PNG
    const logoUrl = logoSvgExists ? '/uploads/logo.svg' 
                  : logo512Exists ? '/uploads/logo-512.png' 
                  : '/logo.png';

    // Extract appName
    let appName = 'Clixer';
    if (settingsMap['app_name']) {
      const raw = settingsMap['app_name'];
      if (typeof raw === 'object' && raw.value) {
        appName = raw.value;
      } else if (typeof raw === 'string') {
        appName = raw;
      }
    }

    res.json({
      success: true,
      data: {
        hasCustomLogo: logo512Exists || logoSvgExists,
        logoUrl,
        appName,
        files: {
          'logo-512.png': logo512Exists,
          'logo-192.png': logo192Exists,
          'logo.svg': logoSvgExists
        },
        currentLogoUrl: settingsMap['app_logo_url'] || '/logo.png',
        currentFaviconUrl: settingsMap['app_favicon_url'] || '/logo.png',
        uploadDir: UPLOAD_DIR
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /manifest.json
 * Dynamic PWA manifest (PUBLIC - no auth required)
 */
router.get('/manifest.json', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get app_name and logo info from system_settings
    const settings = await db.queryAll(
      `SELECT key, value FROM system_settings WHERE key IN ('app_name', 'app_logo_url', 'default_theme')`
    );

    const settingsMap: Record<string, any> = {};
    for (const s of settings) {
      try {
        const parsed = JSON.parse(s.value);
        if (typeof parsed === 'object' && parsed !== null) {
          settingsMap[s.key] = parsed.value !== undefined ? parsed.value : parsed;
        } else {
          settingsMap[s.key] = parsed;
        }
      } catch {
        settingsMap[s.key] = s.value;
      }
    }

    // appName must be string
    let appName = settingsMap['app_name'] || 'Clixer';
    if (typeof appName === 'object' && appName.value) {
      appName = appName.value;
    }
    const theme = settingsMap['default_theme'] || 'clixer';

    // Theme colors
    const themeColors: Record<string, { theme: string; background: string }> = {
      clixer: { theme: '#00CFDE', background: '#0F1116' },
      light: { theme: '#4F46E5', background: '#FFFFFF' },
      dark: { theme: '#6366F1', background: '#1F2937' },
      corporate: { theme: '#14B8A6', background: '#0A1F2E' },
      midnight: { theme: '#8B5CF6', background: '#0F0F23' },
      ember: { theme: '#F97316', background: '#1A0F0A' }
    };

    const colors = themeColors[theme] || themeColors.clixer;

    // Check logo files
    const logo192Exists = fs.existsSync(path.join(UPLOAD_DIR, 'logo-192.png'));
    const logo512Exists = fs.existsSync(path.join(UPLOAD_DIR, 'logo-512.png'));

    const manifest = {
      name: appName,
      short_name: appName,
      description: `${appName} - Enterprise Analytics Platform`,
      start_url: '/',
      display: 'standalone',
      background_color: colors.background,
      theme_color: colors.theme,
      icons: [
        {
          src: logo192Exists ? '/uploads/logo-192.png' : '/icons/icon-192x192.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any maskable'
        },
        {
          src: logo512Exists ? '/uploads/logo-512.png' : '/icons/icon-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any maskable'
        }
      ]
    };

    res.setHeader('Content-Type', 'application/manifest+json');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.json(manifest);
  } catch (error) {
    logger.error('Manifest generation failed', { error });
    next(error);
  }
});

export default router;

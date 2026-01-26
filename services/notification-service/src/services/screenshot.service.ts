/**
 * Screenshot Service
 * Captures dashboard/report screenshots using Puppeteer
 * 
 * Security:
 * - SSRF protection: Only internal URLs allowed
 * - Service account token for authentication
 * - Timeout protection
 * - Resource limiting
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import jwt from 'jsonwebtoken';
import { createLogger } from '@clixer/shared';

const logger = createLogger({ service: 'screenshot-service' });

// Allowed hosts for SSRF protection
const ALLOWED_HOSTS = [
  'localhost',
  '127.0.0.1',
  'frontend',
  'clixer-frontend'
];

// Browser instance (singleton for performance)
let browserInstance: Browser | null = null;

// ============================================
// BROWSER MANAGEMENT
// ============================================

async function getBrowser(): Promise<Browser> {
  if (browserInstance && browserInstance.connected) {
    return browserInstance;
  }

  logger.info('Launching Puppeteer browser');

  browserInstance = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      '--window-size=1920,1080'
    ],
    // Resource limits
    timeout: 60000
  });

  // Clean up on browser disconnect
  browserInstance.on('disconnected', () => {
    logger.warn('Browser disconnected');
    browserInstance = null;
  });

  return browserInstance;
}

export async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
    logger.info('Browser closed');
  }
}

// ============================================
// SSRF PROTECTION
// ============================================

function validateUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    
    // Only allow HTTP/HTTPS
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      logger.warn('Invalid protocol', { url, protocol: parsed.protocol });
      return false;
    }

    // Check hostname against whitelist
    if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
      logger.warn('Host not in whitelist', { url, hostname: parsed.hostname });
      return false;
    }

    return true;
  } catch (error) {
    logger.warn('Invalid URL', { url });
    return false;
  }
}

// ============================================
// SERVICE TOKEN GENERATION
// ============================================

export function generateServiceToken(tenantId: string, userId: string = 'system'): string {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET not configured');
  }

  return jwt.sign(
    {
      userId,
      tenantId,
      role: 'ADMIN', // Service account has admin access
      iat: Math.floor(Date.now() / 1000)
    },
    jwtSecret,
    { expiresIn: '5m' } // Short-lived token
  );
}

// ============================================
// SCREENSHOT CAPTURE
// ============================================

interface ScreenshotOptions {
  tenantId: string;
  designId: string;
  designType: 'cockpit' | 'analysis';
  width?: number;
  height?: number;
  timeout?: number;
}

interface ScreenshotResult {
  success: boolean;
  buffer?: Buffer;
  error?: string;
  duration?: number;
}

export async function captureScreenshot(options: ScreenshotOptions): Promise<ScreenshotResult> {
  const startTime = Date.now();
  const {
    tenantId,
    designId,
    designType,
    width = 1920,
    height = 1080,
    timeout = 60000
  } = options;

  let page: Page | null = null;

  try {
    // Build URL - Use 127.0.0.1 instead of localhost for IPv4 compatibility
    const frontendUrl = process.env.FRONTEND_URL || 'http://127.0.0.1:3000';
    const path = designType === 'cockpit' ? '/kokpit' : '/detayli-analiz';
    const targetUrl = `${frontendUrl}${path}?designId=${designId}&screenshot=true`;

    // SSRF Protection
    if (!validateUrl(targetUrl)) {
      return { success: false, error: 'Invalid or blocked URL' };
    }

    logger.info('Starting screenshot capture', { designId, designType, targetUrl });

    // Get browser
    const browser = await getBrowser();
    page = await browser.newPage();

    // Capture browser console logs
    page.on('console', (msg) => {
      const text = msg.text();
      if (text.includes('[AnalysisPage]') || text.includes('[DashboardPage]')) {
        logger.info('Browser console', { type: msg.type(), text });
      }
    });

    // Set viewport
    await page.setViewport({ width, height });

    // Generate service token
    const serviceToken = generateServiceToken(tenantId);

    // First, navigate to frontend root to establish the origin
    // Use 127.0.0.1 instead of localhost for IPv4 compatibility on Windows
    const frontendBase = process.env.FRONTEND_URL || 'http://127.0.0.1:3000';
    logger.info('Step 1: Navigating to frontend base', { frontendBase });
    
    try {
      await page.goto(frontendBase, { waitUntil: 'domcontentloaded', timeout: 30000 });
      logger.info('Step 1: Navigation to base completed');
    } catch (navError: any) {
      logger.error('Step 1: Failed to navigate to base', { error: navError.message });
      throw navError;
    }

    logger.info('Step 2: Setting localStorage');
    // Now set localStorage in the correct origin context
    await page.evaluate((token: string, tId: string) => {
      const authState = {
        state: {
          user: {
            id: 'screenshot-service',
            email: 'screenshot@system',
            name: 'Screenshot Service',
            role: 'ADMIN',
            position: 'GENERAL_MANAGER',
            positionCode: 'GM',
            tenantId: tId,
            canSeeAllCategories: true
          },
          accessToken: token,
          refreshToken: null,
          isAuthenticated: true,
          isLoading: false,
          error: null,
          hasHydrated: true,
          requiresTwoFactor: false,
          twoFactorEmail: null,
          requires2FASetup: false,
          setupToken: null
        },
        version: 0
      };
      // @ts-ignore
      localStorage.setItem('clixer-auth', JSON.stringify(authState));
    }, serviceToken, tenantId);
    logger.info('Step 2: localStorage set');

    // Navigate to target URL (with auth now set)
    // Use domcontentloaded instead of networkidle2 to avoid timeout on pages with continuous API calls
    logger.info('Step 3: Navigating to target URL', { targetUrl });
    try {
      await page.goto(targetUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });
      logger.info('Step 3: Navigation to target completed');
    } catch (navError: any) {
      logger.error('Step 3: Failed to navigate to target', { error: navError.message, targetUrl });
      throw navError;
    }

    // Debug: Log current URL after navigation
    const currentUrl = page.url();
    logger.info('Navigation completed', { targetUrl, currentUrl });

    // Debug: Get page content for debugging
    const pageTitle = await page.title();
    logger.info('Page info', { title: pageTitle });

    // Wait for dashboard to render
    // Look for the main content container
    try {
      await page.waitForSelector('#dashboard-content, .dashboard-content, [data-testid="dashboard-content"]', {
        timeout: 30000
      });
    } catch (selectorError: any) {
      // Debug: Take screenshot on failure to see what's displayed
      const debugScreenshot = await page.screenshot({ encoding: 'base64' });
      logger.error('Selector wait failed', { 
        currentUrl: page.url(),
        pageTitle: await page.title(),
        error: selectorError.message,
        // Log first 500 chars of screenshot for debugging
        screenshotPreview: debugScreenshot.substring(0, 100) + '...'
      });
      
      // Check if we're on login page
      // @ts-ignore - document is available in browser context
      const bodyText = await page.evaluate(() => document.body?.innerText?.substring(0, 500));
      logger.error('Page body preview', { bodyText });
      
      throw selectorError;
    }

    // Wait for design/widgets to load (look for chart elements or widget cards)
    // This waits for actual data to render, not just the container
    try {
      await page.waitForSelector('.recharts-wrapper, [data-widget], .widget-card, .metric-card', {
        timeout: 15000
      });
      logger.info('First widget/chart element found');
      
      // Wait for multiple widgets to load (dashboard might have many widgets)
      // Poll for widget count to stabilize
      let lastWidgetCount = 0;
      let stableCount = 0;
      const maxWaitTime = 15000; // 15 seconds max
      const pollInterval = 1000; // Check every second
      const startWait = Date.now();
      
      while (Date.now() - startWait < maxWaitTime && stableCount < 3) {
        // @ts-ignore - document is available in browser context
        const currentCount = await page.evaluate(() => document.querySelectorAll('[data-widget]').length);
        logger.info('Widget count check', { currentCount, lastWidgetCount, stableCount });
        
        if (currentCount === lastWidgetCount && currentCount > 0) {
          stableCount++;
        } else {
          stableCount = 0;
          lastWidgetCount = currentCount;
        }
        
        if (stableCount < 3) {
          await page.waitForTimeout(pollInterval);
        }
      }
      
      logger.info('Widget/chart elements stabilized', { finalCount: lastWidgetCount });
    } catch (widgetError: any) {
      logger.warn('Widget elements not found, page might be showing empty state', { error: widgetError.message });
      // Don't throw - continue with screenshot even if no widgets found
    }

    // Additional wait for charts/animations to complete
    await page.waitForTimeout(3000);

    // Hide sidebar, navbar, and other UI elements for clean screenshot
    // Also remove overflow restrictions to ensure all widgets are captured
    // Note: Code inside page.evaluate runs in browser context
    await page.evaluate(() => {
      // @ts-ignore - Hide desktop sidebar using correct selector
      const sidebar = document.querySelector('[data-sidebar="desktop"]');
      // @ts-ignore
      if (sidebar) (sidebar as any).style.display = 'none';
      
      // @ts-ignore - Also hide mobile sidebar
      const mobileSidebar = document.querySelector('[data-sidebar="mobile"]');
      // @ts-ignore
      if (mobileSidebar) (mobileSidebar as any).style.display = 'none';

      // @ts-ignore - Hide header
      const header = document.querySelector('header');
      // @ts-ignore
      if (header) (header as any).style.display = 'none';

      // @ts-ignore - document is available in browser context
      const floatingElements = document.querySelectorAll('.floating-button, .modal-backdrop, .tooltip');
      // @ts-ignore
      floatingElements.forEach((el: any) => el.style.display = 'none');
      
      // @ts-ignore - Remove left padding from main content (sidebar width)
      const mainContentWrapper = document.querySelector('[data-testid="dashboard-content"]')?.closest('div[class*="lg:pl-"]');
      // @ts-ignore
      if (mainContentWrapper) {
        (mainContentWrapper as any).style.paddingLeft = '0';
        (mainContentWrapper as any).style.marginLeft = '0';
      }
      
      // Remove overflow:hidden from dashboard container to ensure all widgets are visible
      // @ts-ignore
      const dashboardContent = document.querySelector('[data-testid="dashboard-content"]');
      // @ts-ignore
      if (dashboardContent) {
        // @ts-ignore
        (dashboardContent as any).style.overflow = 'visible';
        // @ts-ignore
        (dashboardContent as any).style.height = 'auto';
        // @ts-ignore
        (dashboardContent as any).style.paddingTop = '16px';
      }
      
      // @ts-ignore - Find the grid container and configure for proper layout
      const gridContainer = document.querySelector('[data-testid="dashboard-content"] > div:nth-child(2)');
      // @ts-ignore
      if (gridContainer) {
        // @ts-ignore
        (gridContainer as any).style.overflow = 'visible';
        // @ts-ignore
        (gridContainer as any).style.height = 'auto';
        // Force grid to show all rows by setting explicit grid template
        // @ts-ignore
        (gridContainer as any).style.gridTemplateRows = 'repeat(50, 40px)';
      }
      
      // Log widget positions for debugging
      // @ts-ignore
      const widgets = document.querySelectorAll('[data-widget]');
      console.log('[Screenshot] Widget count:', widgets.length);
    });

    // Calculate actual content height based on widget positions
    // @ts-ignore
    const { contentHeight, maxWidgetBottom } = await page.evaluate(() => {
      // @ts-ignore
      const widgets = document.querySelectorAll('[data-widget]');
      let maxBottom = 0;
      // @ts-ignore
      widgets.forEach((w: any) => {
        const rect = w.getBoundingClientRect();
        if (rect.bottom > maxBottom) maxBottom = rect.bottom;
      });
      // @ts-ignore
      const content = document.querySelector('[data-testid="dashboard-content"]');
      // @ts-ignore
      const scrollH = content ? content.scrollHeight : 1080;
      return { contentHeight: scrollH, maxWidgetBottom: maxBottom };
    });
    
    // Use the larger of scrollHeight and actual widget positions
    const finalHeight = Math.max(contentHeight, maxWidgetBottom + 50, 1080);
    logger.info('Adjusting viewport for full content', { contentHeight, maxWidgetBottom, finalHeight });
    await page.setViewport({ width, height: Math.ceil(finalHeight) });
    
    // Wait a bit for layout to adjust
    await page.waitForTimeout(1000);

    // Take full page screenshot to capture everything
    let screenshotBuffer: Buffer;
    
    screenshotBuffer = await page.screenshot({
      type: 'png',
      fullPage: true,
      encoding: 'binary'
    }) as Buffer;
    logger.info('Full page screenshot taken');

    const duration = Date.now() - startTime;
    logger.info('Screenshot captured successfully', {
      designId,
      duration,
      size: screenshotBuffer.length
    });

    return {
      success: true,
      buffer: screenshotBuffer,
      duration
    };

  } catch (error: any) {
    const duration = Date.now() - startTime;
    logger.error('Screenshot capture failed', {
      designId,
      error: error.message,
      duration
    });

    return {
      success: false,
      error: error.message,
      duration
    };

  } finally {
    // Clean up page
    if (page) {
      try {
        await page.close();
      } catch (e) {
        // Ignore close errors
      }
    }
  }
}

// ============================================
// BATCH SCREENSHOT (for multiple subscriptions)
// ============================================

export async function captureMultipleScreenshots(
  subscriptions: Array<{ tenantId: string; designId: string; designType: 'cockpit' | 'analysis' }>
): Promise<Map<string, ScreenshotResult>> {
  const results = new Map<string, ScreenshotResult>();

  // Process sequentially to avoid overwhelming the browser
  for (const sub of subscriptions) {
    const result = await captureScreenshot({
      tenantId: sub.tenantId,
      designId: sub.designId,
      designType: sub.designType
    });
    results.set(sub.designId, result);

    // Small delay between captures
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return results;
}

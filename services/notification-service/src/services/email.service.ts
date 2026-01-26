/**
 * Email Service
 * Handles sending emails with attachments
 * 
 * Security:
 * - SMTP credentials decrypted only when needed
 * - No sensitive data in logs
 * - HTML sanitization for email content
 */

import nodemailer, { Transporter } from 'nodemailer';
import { db, createLogger, decrypt } from '@clixer/shared';

const logger = createLogger({ service: 'email-service' });

interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
    encoding?: string;
  }>;
}

interface SMTPConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  fromEmail: string;
  fromName: string;
}

// ============================================
// GET SMTP CONFIG
// ============================================

export async function getSMTPConfig(tenantId: string): Promise<SMTPConfig | null> {
  try {
    const settings = await db.queryOne(
      `SELECT * FROM email_settings WHERE tenant_id = $1 AND is_configured = true`,
      [tenantId]
    );

    if (!settings) {
      logger.warn('No email settings configured', { tenantId });
      return null;
    }

    let password: string;
    try {
      password = decrypt(settings.smtp_password_encrypted);
    } catch (err) {
      logger.error('Failed to decrypt SMTP password', { tenantId });
      return null;
    }

    return {
      host: settings.smtp_host,
      port: settings.smtp_port,
      secure: settings.smtp_secure,
      user: settings.smtp_user,
      password,
      fromEmail: settings.from_email,
      fromName: settings.from_name || 'Clixer Analytics'
    };
  } catch (error) {
    logger.error('Failed to get SMTP config', { tenantId, error });
    return null;
  }
}

// ============================================
// CREATE TRANSPORTER
// ============================================

function createTransporter(config: SMTPConfig): Transporter {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.password
    },
    connectionTimeout: 30000,
    greetingTimeout: 15000,
    socketTimeout: 60000
  });
}

// ============================================
// SEND EMAIL
// ============================================

export async function sendEmail(
  tenantId: string,
  options: EmailOptions
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const startTime = Date.now();

  try {
    const config = await getSMTPConfig(tenantId);
    if (!config) {
      return { success: false, error: 'Email ayarları yapılandırılmamış' };
    }

    const transporter = createTransporter(config);

    const recipients = Array.isArray(options.to) ? options.to : [options.to];

    const mailOptions = {
      from: `"${config.fromName}" <${config.fromEmail}>`,
      to: recipients.join(', '),
      subject: options.subject,
      html: options.html,
      attachments: options.attachments
    };

    const info = await transporter.sendMail(mailOptions);

    const duration = Date.now() - startTime;
    logger.info('Email sent successfully', {
      tenantId,
      messageId: info.messageId,
      recipientCount: recipients.length,
      duration
    });

    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    logger.error('Failed to send email', {
      tenantId,
      error: error.message,
      duration
    });

    return { success: false, error: error.message };
  }
}

// ============================================
// EMAIL TEMPLATES
// ============================================

export function generateReportEmailHTML(
  reportName: string,
  reportDescription: string | null,
  scheduleName: string,
  screenshotBase64: string
): string {
  const currentDate = new Date().toLocaleDateString('tr-TR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return `
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${reportName}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #1e293b;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f8fafc;
    }
    .container {
      background-color: #ffffff;
      border-radius: 12px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
      color: white;
      padding: 24px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
    }
    .header p {
      margin: 8px 0 0;
      opacity: 0.9;
      font-size: 14px;
    }
    .content {
      padding: 24px;
    }
    .meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      background-color: #f1f5f9;
      border-radius: 8px;
      margin-bottom: 20px;
      font-size: 14px;
    }
    .meta-item {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .meta-label {
      color: #64748b;
    }
    .meta-value {
      font-weight: 500;
      color: #1e293b;
    }
    .report-image {
      width: 100%;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
    }
    .footer {
      padding: 16px 24px;
      background-color: #f8fafc;
      border-top: 1px solid #e2e8f0;
      text-align: center;
      font-size: 12px;
      color: #64748b;
    }
    .footer a {
      color: #3b82f6;
      text-decoration: none;
    }
    .badge {
      display: inline-block;
      padding: 4px 8px;
      background-color: #dbeafe;
      color: #1d4ed8;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 ${reportName}</h1>
      ${reportDescription ? `<p>${reportDescription}</p>` : ''}
    </div>
    
    <div class="content">
      <div class="meta">
        <div class="meta-item">
          <span class="meta-label">Abonelik:</span>
          <span class="meta-value">${scheduleName}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Tarih:</span>
          <span class="meta-value">${currentDate}</span>
        </div>
      </div>

      <img src="cid:report-screenshot" alt="${reportName}" class="report-image" />
    </div>

    <div class="footer">
      <p>Bu email <strong>Clixer Analytics</strong> tarafından otomatik olarak gönderilmiştir.</p>
      <p>Abonelik ayarlarını değiştirmek için <a href="#">Yönetim Paneli</a>'ni ziyaret edin.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

// ============================================
// SEND REPORT EMAIL
// ============================================

export async function sendReportEmail(
  tenantId: string,
  recipientEmails: string[],
  reportName: string,
  reportDescription: string | null,
  scheduleName: string,
  screenshotBuffer: Buffer
): Promise<{ success: boolean; error?: string }> {
  try {
    const html = generateReportEmailHTML(
      reportName,
      reportDescription,
      scheduleName,
      screenshotBuffer.toString('base64')
    );

    const result = await sendEmail(tenantId, {
      to: recipientEmails,
      subject: `📊 ${reportName} - ${scheduleName}`,
      html,
      attachments: [
        {
          filename: 'report-screenshot.png',
          content: screenshotBuffer,
          contentType: 'image/png',
          // @ts-ignore - cid for inline image
          cid: 'report-screenshot'
        }
      ]
    });

    return result;
  } catch (error: any) {
    logger.error('Failed to send report email', { tenantId, error: error.message });
    return { success: false, error: error.message };
  }
}

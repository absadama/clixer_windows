/**
 * Clixer - Structured Logging
 * Winston ile merkezi log yönetimi
 */

import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';

const { combine, timestamp, printf, colorize, errors } = winston.format;

// Custom log format
const logFormat = printf(({ level, message, timestamp, service, traceId, ...meta }) => {
  const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
  return `${timestamp} [${service || 'clixer'}] [${traceId || '-'}] ${level}: ${message} ${metaStr}`;
});

// Console format (development)
const consoleFormat = combine(
  colorize({ all: true }),
  timestamp({ format: 'HH:mm:ss' }),
  errors({ stack: true }),
  logFormat
);

// JSON format (production)
const jsonFormat = combine(
  timestamp(),
  errors({ stack: true }),
  winston.format.json()
);

export interface LoggerOptions {
  service: string;
  level?: string;
}

export function createLogger(options: LoggerOptions): winston.Logger {
  const { service, level = process.env.LOG_LEVEL || 'info' } = options;
  const isProduction = process.env.NODE_ENV === 'production';

  const logger = winston.createLogger({
    level,
    defaultMeta: { service },
    transports: [
      new winston.transports.Console({
        format: isProduction ? jsonFormat : consoleFormat
      })
    ]
  });

  // Production'da file transport ekle
  if (isProduction) {
    logger.add(new winston.transports.File({
      filename: `logs/${service}-error.log`,
      level: 'error',
      format: jsonFormat
    }));
    logger.add(new winston.transports.File({
      filename: `logs/${service}-combined.log`,
      format: jsonFormat
    }));
  }

  return logger;
}

// Request tracing için helper
export function generateTraceId(): string {
  return uuidv4().split('-')[0]; // Kısa trace ID
}

// Express middleware için request logger
export function requestLogger(logger: winston.Logger) {
  return (req: any, res: any, next: any) => {
    const traceId = req.headers['x-trace-id'] || generateTraceId();
    const start = Date.now();

    // Trace ID'yi request'e ekle
    req.traceId = traceId;
    res.setHeader('x-trace-id', traceId);

    // Response bitince logla
    res.on('finish', () => {
      const duration = Date.now() - start;
      const logData = {
        traceId,
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        duration: `${duration}ms`,
        userAgent: req.headers['user-agent'],
        ip: req.ip || req.connection?.remoteAddress
      };

      if (res.statusCode >= 400) {
        logger.warn('Request completed with error', logData);
      } else {
        logger.info('Request completed', logData);
      }
    });

    next();
  };
}

// Default export
export default createLogger;

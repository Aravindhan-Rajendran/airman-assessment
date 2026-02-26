const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';

function requireProductionSecrets(): void {
  if (!isProduction) return;
  const missing: string[] = [];
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.trim() === '') {
    missing.push('JWT_SECRET');
  }
  if (!process.env.JWT_REFRESH_SECRET || process.env.JWT_REFRESH_SECRET.trim() === '') {
    missing.push('JWT_REFRESH_SECRET');
  }
  if (!process.env.CORS_ORIGINS || process.env.CORS_ORIGINS.trim() === '') {
    missing.push('CORS_ORIGINS');
  }
  if (missing.length > 0) {
    console.error(
      `[FATAL] Production requires the following environment variables to be set and non-empty: ${missing.join(', ')}. ` +
        'Do not use default or placeholder values in production.'
    );
    process.exit(1);
  }
}

requireProductionSecrets();

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv,
  jwt: {
    secret:
      process.env.JWT_SECRET?.trim() ||
      (isProduction ? '' : 'dev-secret-change-in-prod'),
    refreshSecret:
      process.env.JWT_REFRESH_SECRET?.trim() ||
      (isProduction ? '' : 'dev-refresh-secret'),
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  rateLimit: {
    global: {
      windowMs: parseInt(
        process.env.RATE_LIMIT_GLOBAL_WINDOW_MS || '60000',
        10
      ),
      max: parseInt(
        process.env.RATE_LIMIT_GLOBAL_MAX || (isProduction ? '60' : '200'),
        10
      ),
    },
    auth: {
      windowMs: parseInt(process.env.RATE_LIMIT_AUTH_WINDOW_MS || '900000', 10),
      max: parseInt(process.env.RATE_LIMIT_AUTH_MAX || '10', 10),
    },
    booking: {
      windowMs: parseInt(process.env.RATE_LIMIT_BOOKING_WINDOW_MS || '60000', 10),
      max: parseInt(process.env.RATE_LIMIT_BOOKING_MAX || '20', 10),
    },
  },
  workflow: {
    escalationHours: parseInt(process.env.WORKFLOW_ESCALATION_HOURS || '24', 10),
  },
  cors: {
    allowedOrigins: process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean)
      : [],
  },
};

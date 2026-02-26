export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-in-prod',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  rateLimit: {
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
};

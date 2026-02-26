import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { errorHandler } from './middleware/errorHandler';
import { requestIdMiddleware } from './middleware/requestId';
import authRoutes from './routes/auth';
import coursesRoutes from './routes/courses';
import schedulingRoutes from './routes/scheduling';
import tenantsRoutes from './routes/tenants';
import auditRoutes from './routes/audit';
import instructorsRoutes from './routes/instructors';
import { runWorkflowEscalation, runWithRetry } from './jobs/workflowJob';

const app = express();

if (config.nodeEnv === 'production') {
  const allowedOrigins = config.cors.allowedOrigins;
  const allowAnyOrigin = allowedOrigins.includes('*');
  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        if (allowAnyOrigin || allowedOrigins.includes(origin)) return cb(null, true);
        cb(null, false);
      },
      credentials: true,
    })
  );
} else {
  app.use(cors({ origin: true, credentials: true }));
}
app.use(express.json());
app.use(requestIdMiddleware);

const globalLimiter = rateLimit({
  windowMs: config.rateLimit.global.windowMs,
  max: config.rateLimit.global.max,
  message: { error: 'Too many requests', code: 'RATE_LIMIT' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', globalLimiter);

const authLimiter = rateLimit({
  windowMs: config.rateLimit.auth.windowMs,
  max: config.rateLimit.auth.max,
  message: { error: 'Too many auth attempts', code: 'RATE_LIMIT' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/refresh', authLimiter);

const bookingLimiter = rateLimit({
  windowMs: config.rateLimit.booking.windowMs,
  max: config.rateLimit.booking.max,
  message: { error: 'Too many booking requests', code: 'RATE_LIMIT' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/scheduling/bookings', bookingLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/courses', coursesRoutes);
app.use('/api/scheduling', schedulingRoutes);
app.use('/api/tenants', tenantsRoutes);
app.use('/api/instructors', instructorsRoutes);
app.use('/api/audit', auditRoutes);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use(errorHandler);

let server: ReturnType<typeof app.listen> | null = null;
if (process.env.NODE_ENV !== 'test') {
  server = app.listen(config.port, () => {
    console.log(`Server listening on port ${config.port}`);
  });
}

if (process.env.NODE_ENV !== 'test') {
  setInterval(() => {
    runWithRetry(runWorkflowEscalation).catch((e) =>
      console.error('[WORKFLOW] Escalation job failed:', e)
    );
  }, 60 * 60 * 1000);
}

export { app };

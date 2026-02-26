import { Router, Request } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { authMiddleware, requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { requireTenant } from '../middleware/tenant';
import { AppError } from '../middleware/errorHandler';

const router = Router();

const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

router.get(
  '/',
  authMiddleware,
  requireAuth,
  requireRole('ADMIN'),
  requireTenant,
  async (req, res, next) => {
    try {
      const tenantId = req.context!.tenantId!;
      const query = listSchema.parse(req.query);
      const skip = (query.page - 1) * query.limit;
      const where = { tenantId };

      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          skip,
          take: query.limit,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.auditLog.count({ where }),
      ]);
      res.json({ data: logs, total, page: query.page, limit: query.limit });
    } catch (e) {
      if (e instanceof z.ZodError)
        next(new AppError(400, e.errors.map((x) => x.message).join(', '), 'VALIDATION_ERROR'));
      else next(e);
    }
  }
);

export default router;

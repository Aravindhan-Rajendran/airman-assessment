import { Router, Request } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { authMiddleware, requireAuth } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { AppError } from '../middleware/errorHandler';

const router = Router();

const createTenantSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
});

function getTenantId(req: Request): string | null {
  return req.context?.tenantId ?? null;
}

router.get('/public', async (_req, res, next) => {
  try {
    const tenants = await prisma.tenant.findMany({
      select: { id: true, name: true, slug: true },
    });
    res.json({ data: tenants });
  } catch (e) {
    next(e);
  }
});

router.get('/', authMiddleware, requireAuth, async (req, res, next) => {
  try {
    const tenants = await prisma.tenant.findMany({
      select: { id: true, name: true, slug: true },
    });
    res.json({ data: tenants });
  } catch (e) {
    next(e);
  }
});

router.post(
  '/',
  authMiddleware,
  requireAuth,
  requirePermission('admin:manage_tenants'),
  async (req, res, next) => {
    try {
      const body = createTenantSchema.parse(req.body);
      const existing = await prisma.tenant.findUnique({ where: { slug: body.slug } });
      if (existing) {
        next(new AppError(409, 'Tenant slug already exists', 'CONFLICT'));
        return;
      }
      const tenant = await prisma.tenant.create({ data: body });
      res.status(201).json(tenant);
    } catch (e) {
      if (e instanceof z.ZodError)
        next(new AppError(400, e.errors.map((x) => x.message).join(', '), 'VALIDATION_ERROR'));
      else next(e);
    }
  }
);

export default router;

import { Router, Request } from 'express';
import { prisma } from '../db';
import { authMiddleware, requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { requireTenant } from '../middleware/tenant';
import { AppError } from '../middleware/errorHandler';

const router = Router();

function getTenantId(req: Request): string {
  const id = req.context?.tenantId;
  if (!id) throw new AppError(403, 'Tenant context required', 'TENANT_REQUIRED');
  return id;
}

router.get(
  '/',
  authMiddleware,
  requireAuth,
  requireRole('ADMIN', 'INSTRUCTOR'),
  requireTenant,
  async (req, res, next) => {
    try {
      const tenantId = getTenantId(req);
      const instructors = await prisma.user.findMany({
        where: { tenantId, role: 'INSTRUCTOR' },
        select: { id: true, email: true },
        orderBy: { email: 'asc' },
      });
      res.json({ data: instructors });
    } catch (e) {
      next(e);
    }
  }
);

export default router;

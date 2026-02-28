import { Router } from 'express';
import { z } from 'zod';
import { authService } from '../services/authService';
import { authMiddleware, requireAuth } from '../middleware/auth';
import { requirePermission, requireRole } from '../middleware/rbac';
import { requireTenant } from '../middleware/tenant';
import { AppError } from '../middleware/errorHandler';
import { prisma } from '../db';
import { Role } from '@prisma/client';
import { auditService } from '../services/auditService';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  tenantId: z.string().uuid().optional(),
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['STUDENT', 'INSTRUCTOR', 'ADMIN']),
  tenantId: z.string().uuid(),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

const logoutSchema = z.object({
  refreshToken: z.string().min(1),
});

const approveStudentSchema = z.object({
  userId: z.string().uuid(),
  approved: z.boolean(),
});

router.post('/login', async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);
    const correlationId = (req.headers['x-correlation-id'] as string) || undefined;
    const result = await authService.login({
      email: body.email,
      password: body.password,
      tenantId: body.tenantId,
      correlationId,
    });
    res.json(result);
  } catch (e) {
    if (e instanceof z.ZodError) {
      next(new AppError(400, e.errors.map((x) => x.message).join(', '), 'VALIDATION_ERROR'));
      return;
    }
    next(e);
  }
});

router.post('/refresh', async (req, res, next) => {
  try {
    const body = refreshSchema.parse(req.body);
    const result = await authService.refreshAccessToken(body.refreshToken);
    res.json(result);
  } catch (e) {
    if (e instanceof z.ZodError) {
      next(new AppError(400, e.errors.map((x) => x.message).join(', '), 'VALIDATION_ERROR'));
      return;
    }
    next(e);
  }
});

router.post('/logout', async (req, res, next) => {
  try {
    const body = logoutSchema.parse(req.body);
    await authService.logout(body.refreshToken);
    res.status(204).send();
  } catch (e) {
    if (e instanceof z.ZodError) {
      next(new AppError(400, e.errors.map((x) => x.message).join(', '), 'VALIDATION_ERROR'));
      return;
    }
    next(e);
  }
});

router.post(
  '/register',
  authMiddleware,
  requireAuth,
  requirePermission('admin:create_instructor'),
  requireTenant,
  async (req, res, next) => {
    try {
      const body = registerSchema.parse(req.body);
      if (body.role !== 'INSTRUCTOR' && body.role !== 'STUDENT') {
        next(new AppError(400, 'Can only register INSTRUCTOR or STUDENT', 'VALIDATION_ERROR'));
        return;
      }
      const tenantId = req.context!.tenantId!;
      const correlationId = (req.headers['x-correlation-id'] as string) || undefined;
      const result = await authService.register({
        ...body,
        role: body.role as Role,
        tenantId,
        createdBy: req.context!.userId,
        correlationId,
      });
      res.status(201).json(result);
    } catch (e) {
      if (e instanceof z.ZodError) {
        next(new AppError(400, e.errors.map((x) => x.message).join(', '), 'VALIDATION_ERROR'));
        return;
      }
      next(e);
    }
  }
);

router.post(
  '/approve-student',
  authMiddleware,
  requireAuth,
  requirePermission('admin:approve_student'),
  requireTenant,
  async (req, res, next) => {
    try {
      const body = approveStudentSchema.parse(req.body);
      const tenantId = req.context!.tenantId!;
      const user = await prisma.user.findFirst({
        where: { id: body.userId, tenantId, role: 'STUDENT' },
      });
      if (!user) {
        next(new AppError(404, 'Student not found in this tenant', 'NOT_FOUND'));
        return;
      }
      const before = JSON.stringify({ approved: user.approved });
      await prisma.user.update({
        where: { id: user.id },
        data: { approved: body.approved },
      });
      await auditService.log({
        userId: req.context!.userId,
        tenantId,
        action: 'ROLE_CHANGE',
        resource: 'USER',
        resourceId: user.id,
        beforeState: before,
        afterState: JSON.stringify({ approved: body.approved }),
        correlationId: req.headers['x-correlation-id'] as string,
      });
      res.json({ success: true, userId: user.id, approved: body.approved });
    } catch (e) {
      if (e instanceof z.ZodError) {
        next(new AppError(400, e.errors.map((x) => x.message).join(', '), 'VALIDATION_ERROR'));
        return;
      }
      next(e);
    }
  }
);

router.get(
  '/students-pending',
  authMiddleware,
  requireAuth,
  requirePermission('admin:approve_student'),
  requireTenant,
  async (req, res, next) => {
    try {
      const tenantId = req.context!.tenantId!;
      const users = await prisma.user.findMany({
        where: { tenantId, role: 'STUDENT', approved: false },
        select: { id: true, email: true, createdAt: true },
      });
      res.json({ data: users });
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  '/students',
  authMiddleware,
  requireAuth,
  requirePermission('admin:approve_student'),
  requireTenant,
  async (req, res, next) => {
    try {
      const tenantId = req.context!.tenantId!;
      const users = await prisma.user.findMany({
        where: { tenantId, role: 'STUDENT' },
        select: { id: true, email: true, approved: true, createdAt: true },
        orderBy: { email: 'asc' },
      });
      res.json({ data: users });
    } catch (e) {
      next(e);
    }
  }
);

router.get('/me', authMiddleware, requireAuth, (req, res) => {
  res.json({
    id: req.context!.userId,
    email: req.context!.email,
    role: req.context!.role,
    tenantId: req.context!.tenantId,
    approved: req.context!.approved,
  });
});

export default router;

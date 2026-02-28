import { Router, Request } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { authMiddleware, requireAuth } from '../middleware/auth';
import { requirePermission, requireApprovedStudent } from '../middleware/rbac';
import { requireTenant } from '../middleware/tenant';
import { AppError } from '../middleware/errorHandler';
import { auditService } from '../services/auditService';
import { assertNoInstructorConflict, instructorHasAvailability } from '../services/bookingService';
import { cacheService } from '../services/cacheService';

const router = Router();

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const availabilitySchema = z.object({
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  instructorId: z.string().uuid().optional(),
});

const bookingSchema = z.object({
  name: z.string().min(1, 'Booking name is required').max(200),
  requestedAt: z.string().datetime(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
});

const assignSchema = z.object({
  instructorId: z.string().uuid(),
});

const weeklySchema = z.object({
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

function getTenantId(req: Request): string {
  const id = req.context?.tenantId;
  if (!id) throw new AppError(403, 'Tenant required', 'TENANT_REQUIRED');
  return id;
}

router.post(
  '/availability',
  authMiddleware,
  requireAuth,
  requirePermission('instructor:manage_availability'),
  requireTenant,
  async (req, res, next) => {
    try {
      const tenantId = getTenantId(req);
      const body = availabilitySchema.parse(req.body);
      const startAt = new Date(body.startAt);
      const endAt = new Date(body.endAt);
      if (endAt <= startAt) {
        next(new AppError(400, 'endAt must be after startAt', 'VALIDATION_ERROR'));
        return;
      }
      const instructorId =
        req.context!.role === 'INSTRUCTOR' ? req.context!.userId : (body.instructorId ?? req.context!.userId);
      if (req.context!.role === 'ADMIN' && !body.instructorId) {
        next(new AppError(400, 'Admin must provide instructorId', 'VALIDATION_ERROR'));
        return;
      }
      const slot = await prisma.instructorAvailability.create({
        data: {
          tenantId,
          instructorId: req.context!.role === 'INSTRUCTOR' ? req.context!.userId : body.instructorId!,
          startAt,
          endAt,
        },
      });
      res.status(201).json(slot);
    } catch (e) {
      if (e instanceof z.ZodError)
        next(new AppError(400, e.errors.map((x) => x.message).join(', '), 'VALIDATION_ERROR'));
      else next(e);
    }
  }
);

router.get(
  '/availability',
  authMiddleware,
  requireAuth,
  requirePermission('instructor:manage_availability', 'student:view_content'),
  requireTenant,
  async (req, res, next) => {
    try {
      const tenantId = getTenantId(req);
      const { page, limit } = paginationSchema.parse(req.query);
      const skip = (page - 1) * limit;
      const [slots, total] = await Promise.all([
        prisma.instructorAvailability.findMany({
          where: { tenantId },
          skip,
          take: limit,
          orderBy: { startAt: 'asc' },
        }),
        prisma.instructorAvailability.count({ where: { tenantId } }),
      ]);
      res.json({ data: slots, total, page, limit });
    } catch (e) {
      if (e instanceof z.ZodError)
        next(new AppError(400, e.errors.map((x) => x.message).join(', '), 'VALIDATION_ERROR'));
      else next(e);
    }
  }
);

router.post(
  '/bookings',
  authMiddleware,
  requireAuth,
  requirePermission('student:request_booking'),
  requireApprovedStudent,
  requireTenant,
  async (req, res, next) => {
    try {
      const tenantId = getTenantId(req);
      const body = bookingSchema.parse(req.body);
      const requestedAt = new Date(body.requestedAt);
      const startAt = new Date(body.startAt);
      const endAt = new Date(body.endAt);
      if (endAt <= startAt) {
        next(new AppError(400, 'endAt must be after startAt', 'VALIDATION_ERROR'));
        return;
      }
      if (startAt < requestedAt) {
        next(new AppError(400, 'Preferred start cannot be before the request time', 'VALIDATION_ERROR'));
        return;
      }
      const booking = await prisma.booking.create({
        data: {
          tenantId,
          studentId: req.context!.userId,
          status: 'REQUESTED',
          name: body.name,
          requestedAt,
          startAt,
          endAt,
        },
      });
      await auditService.log({
        userId: req.context!.userId,
        tenantId,
        action: 'CREATE',
        resource: 'SCHEDULE',
        resourceId: booking.id,
        afterState: JSON.stringify({ status: 'REQUESTED', startAt, endAt }),
        correlationId: req.headers['x-correlation-id'] as string,
      });
      res.status(201).json(booking);
    } catch (e) {
      if (e instanceof z.ZodError)
        next(new AppError(400, e.errors.map((x) => x.message).join(', '), 'VALIDATION_ERROR'));
      else next(e);
    }
  }
);

router.patch(
  '/bookings/:id/approve',
  authMiddleware,
  requireAuth,
  requirePermission('admin:approve_booking'),
  requireTenant,
  async (req, res, next) => {
    try {
      const tenantId = getTenantId(req);
      const booking = await prisma.booking.findFirst({
        where: { id: req.params.id, tenantId, status: 'REQUESTED' },
      });
      if (!booking) return next(new AppError(404, 'Booking not found', 'NOT_FOUND'));
      const before = JSON.stringify({ status: booking.status });
      const updated = await prisma.booking.update({
        where: { id: booking.id },
        data: { status: 'APPROVED', approvedAt: new Date() },
      });
      await auditService.log({
        userId: req.context!.userId,
        tenantId,
        action: 'APPROVAL',
        resource: 'SCHEDULE',
        resourceId: booking.id,
        beforeState: before,
        afterState: JSON.stringify({ status: 'APPROVED' }),
        correlationId: req.headers['x-correlation-id'] as string,
      });
      res.json(updated);
    } catch (e) {
      next(e);
    }
  }
);

router.patch(
  '/bookings/:id/assign',
  authMiddleware,
  requireAuth,
  requirePermission('admin:assign_instructor'),
  requireTenant,
  async (req, res, next) => {
    try {
      const tenantId = getTenantId(req);
      const body = assignSchema.parse(req.body);
      const booking = await prisma.booking.findFirst({
        where: { id: req.params.id, tenantId },
      });
      if (!booking) return next(new AppError(404, 'Booking not found', 'NOT_FOUND'));
      if (booking.status === 'CANCELLED') {
        next(new AppError(400, 'Cannot assign cancelled booking', 'VALIDATION_ERROR'));
        return;
      }
      await assertNoInstructorConflict(tenantId, body.instructorId, booking.startAt, booking.endAt, booking.id);
      const before = JSON.stringify({ status: booking.status, instructorId: booking.instructorId });
      const updated = await prisma.booking.update({
        where: { id: booking.id },
        data: { instructorId: body.instructorId, status: 'ASSIGNED', assignedAt: new Date() },
      });
      await auditService.log({
        userId: req.context!.userId,
        tenantId,
        action: 'ASSIGN',
        resource: 'SCHEDULE',
        resourceId: booking.id,
        beforeState: before,
        afterState: JSON.stringify({ status: 'ASSIGNED', instructorId: body.instructorId }),
        correlationId: req.headers['x-correlation-id'] as string,
      });
      res.json(updated);
    } catch (e) {
      if (e instanceof z.ZodError)
        next(new AppError(400, e.errors.map((x) => x.message).join(', '), 'VALIDATION_ERROR'));
      else next(e);
    }
  }
);

router.patch(
  '/bookings/:id/accept',
  authMiddleware,
  requireAuth,
  requirePermission('instructor:accept_booking'),
  requireTenant,
  async (req, res, next) => {
    try {
      const tenantId = getTenantId(req);
      const instructorId = req.context!.userId;
      const booking = await prisma.booking.findFirst({
        where: { id: req.params.id, tenantId },
      });
      if (!booking) return next(new AppError(404, 'Booking not found', 'NOT_FOUND'));
      if (booking.status === 'CANCELLED') {
        next(new AppError(400, 'Cannot accept a cancelled booking', 'VALIDATION_ERROR'));
        return;
      }
      if (booking.instructorId) {
        next(new AppError(400, 'Booking already has an instructor assigned', 'VALIDATION_ERROR'));
        return;
      }
      const hasAvail = await instructorHasAvailability(tenantId, instructorId, booking.startAt, booking.endAt);
      if (!hasAvail) {
        next(new AppError(400, 'You do not have availability for this time slot. Add availability first.', 'NO_AVAILABILITY'));
        return;
      }
      await assertNoInstructorConflict(tenantId, instructorId, booking.startAt, booking.endAt, booking.id);
      const before = JSON.stringify({ status: booking.status, instructorId: booking.instructorId });
      const updated = await prisma.booking.update({
        where: { id: booking.id },
        data: { instructorId, status: 'ASSIGNED', assignedAt: new Date() },
      });
      await auditService.log({
        userId: req.context!.userId,
        tenantId,
        action: 'ACCEPT',
        resource: 'SCHEDULE',
        resourceId: booking.id,
        beforeState: before,
        afterState: JSON.stringify({ status: 'ASSIGNED', instructorId }),
        correlationId: req.headers['x-correlation-id'] as string,
      });
      res.json(updated);
    } catch (e) {
      if (e instanceof z.ZodError)
        next(new AppError(400, e.errors.map((x) => x.message).join(', '), 'VALIDATION_ERROR'));
      else next(e);
    }
  }
);

router.patch(
  '/bookings/:id/complete',
  authMiddleware,
  requireAuth,
  requireTenant,
  async (req, res, next) => {
    try {
      const tenantId = getTenantId(req);
      const booking = await prisma.booking.findFirst({
        where: { id: req.params.id, tenantId },
      });
      if (!booking) return next(new AppError(404, 'Booking not found', 'NOT_FOUND'));
      const isInstructor = booking.instructorId === req.context!.userId;
      const isAdmin = req.context!.role === 'ADMIN';
      if (!isInstructor && !isAdmin) {
        next(new AppError(403, 'Only assigned instructor or admin can complete', 'FORBIDDEN'));
        return;
      }
      const before = JSON.stringify({ status: booking.status });
      const updated = await prisma.booking.update({
        where: { id: booking.id },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
      await auditService.log({
        userId: req.context!.userId,
        tenantId,
        action: 'COMPLETE',
        resource: 'SCHEDULE',
        resourceId: booking.id,
        beforeState: before,
        afterState: JSON.stringify({ status: 'COMPLETED' }),
        correlationId: req.headers['x-correlation-id'] as string,
      });
      res.json(updated);
    } catch (e) {
      next(e);
    }
  }
);

router.patch(
  '/bookings/:id/cancel',
  authMiddleware,
  requireAuth,
  requireTenant,
  async (req, res, next) => {
    try {
      const tenantId = getTenantId(req);
      const booking = await prisma.booking.findFirst({
        where: { id: req.params.id, tenantId },
      });
      if (!booking) return next(new AppError(404, 'Booking not found', 'NOT_FOUND'));
      const isStudent = booking.studentId === req.context!.userId;
      const isInstructor = booking.instructorId === req.context!.userId;
      const isAdmin = req.context!.role === 'ADMIN';
      if (!isStudent && !isInstructor && !isAdmin) {
        next(new AppError(403, 'Not authorized to cancel this booking', 'FORBIDDEN'));
        return;
      }
      const before = JSON.stringify({ status: booking.status });
      const updated = await prisma.booking.update({
        where: { id: booking.id },
        data: { status: 'CANCELLED', cancelledAt: new Date() },
      });
      await auditService.log({
        userId: req.context!.userId,
        tenantId,
        action: 'CANCEL',
        resource: 'SCHEDULE',
        resourceId: booking.id,
        beforeState: before,
        afterState: JSON.stringify({ status: 'CANCELLED' }),
        correlationId: req.headers['x-correlation-id'] as string,
      });
      res.json(updated);
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  '/bookings',
  authMiddleware,
  requireAuth,
  requireTenant,
  async (req, res, next) => {
    try {
      const tenantId = getTenantId(req);
      const { page, limit } = paginationSchema.parse(req.query);
      const skip = (page - 1) * limit;
      const cacheKey = `bookings:${tenantId}:${page}:${limit}`;
      const cached = await cacheService.get(cacheKey);
      if (cached) return res.json(JSON.parse(cached));

      const where: { tenantId: string; studentId?: string } = { tenantId };
      if (req.context!.role === 'STUDENT') where.studentId = req.context!.userId;

      const [data, total] = await Promise.all([
        prisma.booking.findMany({
          where,
          skip,
          take: limit,
          orderBy: { startAt: 'desc' },
          include: { student: { select: { id: true, email: true } }, instructor: { select: { id: true, email: true } } },
        }),
        prisma.booking.count({ where }),
      ]);
      const result = { data, total, page, limit };
      await cacheService.set(cacheKey, JSON.stringify(result), 30);
      res.json(result);
    } catch (e) {
      if (e instanceof z.ZodError)
        next(new AppError(400, e.errors.map((x) => x.message).join(', '), 'VALIDATION_ERROR'));
      else next(e);
    }
  }
);

router.get(
  '/bookings/weekly',
  authMiddleware,
  requireAuth,
  requireTenant,
  async (req, res, next) => {
    try {
      const tenantId = getTenantId(req);
      const { weekStart } = weeklySchema.parse(req.query);
      const start = new Date(weekStart);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      const bookings = await prisma.booking.findMany({
        where: {
          tenantId,
          startAt: { gte: start },
          endAt: { lte: end },
          status: { not: 'CANCELLED' },
        },
        orderBy: { startAt: 'asc' },
        include: { student: { select: { email: true } }, instructor: { select: { email: true } } },
      });
      res.json({ data: bookings });
    } catch (e) {
      if (e instanceof z.ZodError)
        next(new AppError(400, e.errors.map((x) => x.message).join(', '), 'VALIDATION_ERROR'));
      else next(e);
    }
  }
);

export default router;

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { authMiddleware, requireAuth } from '../middleware/auth';
import { requirePermission, requireApprovedStudent } from '../middleware/rbac';
import { requireTenant } from '../middleware/tenant';
import { AppError } from '../middleware/errorHandler';
import { auditService } from '../services/auditService';
import { cacheService } from '../services/cacheService';
import { LessonType, Prisma } from '@prisma/client';
import type { Request } from 'express';

const router = Router();

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
});

const createCourseSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
});

const updateCourseSchema = createCourseSchema.partial();

const createModuleSchema = z.object({
  title: z.string().min(1),
  order: z.number().int().min(0).optional(),
});

const createLessonSchema = z.object({
  title: z.string().min(1),
  type: z.enum(['TEXT', 'QUIZ']),
  content: z.string().optional(),
  order: z.number().int().min(0).optional(),
});

const quizAttemptSchema = z.object({
  answers: z.record(z.string(), z.string()),
});

function getTenantId(req: Request): string {
  const id = req.context?.tenantId;
  if (!id) throw new AppError(403, 'Tenant required', 'TENANT_REQUIRED');
  return id;
}

// List courses (paginated, search) - read-heavy, cache
router.get(
  '/',
  authMiddleware,
  requireAuth,
  requirePermission('student:view_content'),
  requireTenant,
  async (req, res, next) => {
    try {
      const tenantId = getTenantId(req);
      const { page, limit, search } = paginationSchema.parse(req.query);
      const skip = (page - 1) * limit;
      const cacheKey = `courses:${tenantId}:${page}:${limit}:${search ?? ''}`;
      const cached = await cacheService.get(cacheKey);
      if (cached) return res.json(JSON.parse(cached));

      const where: Prisma.CourseWhereInput = { tenantId };
      if (search?.trim()) {
        where.OR = [
          { title: { contains: search.trim(), mode: 'insensitive' } },
          { modules: { some: { title: { contains: search.trim(), mode: 'insensitive' } } } },
        ];
      }

      const [courses, total] = await Promise.all([
        prisma.course.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: { modules: { orderBy: { order: 'asc' } } },
        }),
        prisma.course.count({ where }),
      ]);

      const result = { data: courses, total, page, limit };
      await cacheService.set(cacheKey, JSON.stringify(result), 60);
      res.json(result);
    } catch (e) {
      if (e instanceof z.ZodError) next(new AppError(400, e.errors.map((x) => x.message).join(', '), 'VALIDATION_ERROR'));
      else next(e);
    }
  }
);

router.post(
  '/',
  authMiddleware,
  requireAuth,
  requirePermission('instructor:create_content'),
  requireTenant,
  async (req, res, next) => {
    try {
      const tenantId = getTenantId(req);
      const body = createCourseSchema.parse(req.body);
      const course = await prisma.course.create({
        data: {
          ...body,
          tenantId,
          createdById: req.context!.userId,
        },
      });
      await auditService.log({
        userId: req.context!.userId,
        tenantId,
        action: 'CREATE',
        resource: 'COURSE',
        resourceId: course.id,
        afterState: JSON.stringify({ title: course.title }),
        correlationId: req.headers['x-correlation-id'] as string,
      });
      res.status(201).json(course);
    } catch (e) {
      if (e instanceof z.ZodError) next(new AppError(400, e.errors.map((x) => x.message).join(', '), 'VALIDATION_ERROR'));
      else next(e);
    }
  }
);

router.get(
  '/:courseId',
  authMiddleware,
  requireAuth,
  requirePermission('student:view_content'),
  requireTenant,
  async (req, res, next) => {
    try {
      const tenantId = getTenantId(req);
      const course = await prisma.course.findFirst({
        where: { id: req.params.courseId, tenantId },
        include: { modules: { orderBy: { order: 'asc' }, include: { lessons: { orderBy: { order: 'asc' } } } } },
      });
      if (!course) return next(new AppError(404, 'Course not found', 'NOT_FOUND'));
      res.json(course);
    } catch (e) {
      next(e);
    }
  }
);

router.patch(
  '/:courseId',
  authMiddleware,
  requireAuth,
  requirePermission('instructor:create_content'),
  requireTenant,
  async (req, res, next) => {
    try {
      const tenantId = getTenantId(req);
      const existing = await prisma.course.findFirst({ where: { id: req.params.courseId, tenantId } });
      if (!existing) return next(new AppError(404, 'Course not found', 'NOT_FOUND'));
      const body = updateCourseSchema.parse(req.body);
      const course = await prisma.course.update({
        where: { id: existing.id },
        data: body,
      });
      await auditService.log({
        userId: req.context!.userId,
        tenantId,
        action: 'UPDATE',
        resource: 'COURSE',
        resourceId: course.id,
        beforeState: JSON.stringify({ title: existing.title }),
        afterState: JSON.stringify({ title: course.title }),
        correlationId: req.headers['x-correlation-id'] as string,
      });
      res.json(course);
    } catch (e) {
      if (e instanceof z.ZodError) next(new AppError(400, e.errors.map((x) => x.message).join(', '), 'VALIDATION_ERROR'));
      else next(e);
    }
  }
);

router.post(
  '/:courseId/modules',
  authMiddleware,
  requireAuth,
  requirePermission('instructor:create_content'),
  requireTenant,
  async (req, res, next) => {
    try {
      const tenantId = getTenantId(req);
      const course = await prisma.course.findFirst({ where: { id: req.params.courseId, tenantId } });
      if (!course) return next(new AppError(404, 'Course not found', 'NOT_FOUND'));
      const body = createModuleSchema.parse(req.body);
      const mod = await prisma.module.create({
        data: { courseId: course.id, title: body.title, order: body.order ?? 0 },
      });
      res.status(201).json(mod);
    } catch (e) {
      if (e instanceof z.ZodError) next(new AppError(400, e.errors.map((x) => x.message).join(', '), 'VALIDATION_ERROR'));
      else next(e);
    }
  }
);

router.post(
  '/:courseId/modules/:moduleId/lessons',
  authMiddleware,
  requireAuth,
  requirePermission('instructor:create_content'),
  requireTenant,
  async (req, res, next) => {
    try {
      const tenantId = getTenantId(req);
      const course = await prisma.course.findFirst({ where: { id: req.params.courseId, tenantId } });
      if (!course) return next(new AppError(404, 'Course not found', 'NOT_FOUND'));
      const mod = await prisma.module.findFirst({
        where: { id: req.params.moduleId, courseId: course.id },
      });
      if (!mod) return next(new AppError(404, 'Module not found', 'NOT_FOUND'));
      const body = createLessonSchema.parse(req.body);
      const lesson = await prisma.lesson.create({
        data: {
          moduleId: mod.id,
          title: body.title,
          type: body.type as LessonType,
          content: body.content ?? null,
          order: body.order ?? 0,
        },
      });
      res.status(201).json(lesson);
    } catch (e) {
      if (e instanceof z.ZodError) next(new AppError(400, e.errors.map((x) => x.message).join(', '), 'VALIDATION_ERROR'));
      else next(e);
    }
  }
);

router.get(
  '/:courseId/modules/:moduleId/lessons/:lessonId',
  authMiddleware,
  requireAuth,
  requirePermission('student:view_content'),
  requireApprovedStudent,
  requireTenant,
  async (req, res, next) => {
    try {
      const tenantId = getTenantId(req);
      const course = await prisma.course.findFirst({ where: { id: req.params.courseId, tenantId } });
      if (!course) return next(new AppError(404, 'Course not found', 'NOT_FOUND'));
      const mod = await prisma.module.findFirst({ where: { id: req.params.moduleId, courseId: course.id } });
      if (!mod) return next(new AppError(404, 'Module not found', 'NOT_FOUND'));
      const lesson = await prisma.lesson.findFirst({ where: { id: req.params.lessonId, moduleId: mod.id } });
      if (!lesson) return next(new AppError(404, 'Lesson not found', 'NOT_FOUND'));
      res.json(lesson);
    } catch (e) {
      next(e);
    }
  }
);

// Submit quiz attempt: store attempt, calculate score, return incorrect questions
router.post(
  '/:courseId/modules/:moduleId/lessons/:lessonId/attempt',
  authMiddleware,
  requireAuth,
  requirePermission('student:attempt_quizzes'),
  requireApprovedStudent,
  requireTenant,
  async (req, res, next) => {
    try {
      const tenantId = getTenantId(req);
      const course = await prisma.course.findFirst({ where: { id: req.params.courseId, tenantId } });
      if (!course) return next(new AppError(404, 'Course not found', 'NOT_FOUND'));
      const mod = await prisma.module.findFirst({ where: { id: req.params.moduleId, courseId: course.id } });
      if (!mod) return next(new AppError(404, 'Module not found', 'NOT_FOUND'));
      const lesson = await prisma.lesson.findFirst({ where: { id: req.params.lessonId, moduleId: mod.id } });
      if (!lesson) return next(new AppError(404, 'Lesson not found', 'NOT_FOUND'));
      if (lesson.type !== 'QUIZ') return next(new AppError(400, 'Lesson is not a quiz', 'VALIDATION_ERROR'));

      const body = quizAttemptSchema.parse(req.body);
      const content = lesson.content ? (JSON.parse(lesson.content) as { questions: Array<{ id: string; correctOptionId: string }> }) : { questions: [] };
      const questions = content.questions || [];
      let correct = 0;
      const incorrect: Array<{ questionId: string; correctOptionId: string; selectedOptionId: string }> = [];
      for (const q of questions) {
        const selected = body.answers[q.id];
        if (selected === q.correctOptionId) correct++;
        else incorrect.push({ questionId: q.id, correctOptionId: q.correctOptionId, selectedOptionId: selected ?? '' });
      }
      const total = questions.length;
      const score = total > 0 ? (correct / total) * 100 : 0;

      const attempt = await prisma.quizAttempt.create({
        data: {
          lessonId: lesson.id,
          userId: req.context!.userId,
          tenantId,
          score,
          total,
          answers: JSON.stringify(body.answers),
        },
      });

      res.status(201).json({
        attemptId: attempt.id,
        score,
        total,
        correct,
        incorrectQuestions: incorrect,
      });
    } catch (e) {
      if (e instanceof z.ZodError) next(new AppError(400, e.errors.map((x) => x.message).join(', '), 'VALIDATION_ERROR'));
      else next(e);
    }
  }
);

// List attempts for a lesson (paginated)
router.get(
  '/:courseId/modules/:moduleId/lessons/:lessonId/attempts',
  authMiddleware,
  requireAuth,
  requireTenant,
  async (req, res, next) => {
    try {
      const tenantId = getTenantId(req);
      const { page, limit } = paginationSchema.parse(req.query);
      const skip = (page - 1) * limit;
      const course = await prisma.course.findFirst({ where: { id: req.params.courseId, tenantId } });
      if (!course) return next(new AppError(404, 'Course not found', 'NOT_FOUND'));
      const mod = await prisma.module.findFirst({ where: { id: req.params.moduleId, courseId: course.id } });
      if (!mod) return next(new AppError(404, 'Module not found', 'NOT_FOUND'));
      const lesson = await prisma.lesson.findFirst({ where: { id: req.params.lessonId, moduleId: mod.id } });
      if (!lesson) return next(new AppError(404, 'Lesson not found', 'NOT_FOUND'));

      const [attempts, total] = await Promise.all([
        prisma.quizAttempt.findMany({
          where: { lessonId: lesson.id, userId: req.context!.userId, tenantId },
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.quizAttempt.count({ where: { lessonId: lesson.id, userId: req.context!.userId, tenantId } }),
      ]);
      res.json({ data: attempts, total, page, limit });
    } catch (e) {
      if (e instanceof z.ZodError) next(new AppError(400, e.errors.map((x) => x.message).join(', '), 'VALIDATION_ERROR'));
      else next(e);
    }
  }
);

export default router;

import express from 'express';
import rateLimit from 'express-rate-limit';
import request from 'supertest';
import { app } from './index';
import { prisma } from './db';
import { hashPassword } from './services/authService';

const TEST_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const TEST_TENANT_ID_B = '00000000-0000-0000-0000-000000000002';

describe('Global rate limiter', () => {
  it('returns 429 when global API rate limit is exceeded', async () => {
    const limit = 2;
    const testApp = express();
    testApp.use(
      rateLimit({
        windowMs: 60000,
        max: limit,
        message: { error: 'Too many requests', code: 'RATE_LIMIT' },
        standardHeaders: true,
        legacyHeaders: false,
      })
    );
    testApp.get('/ping', (_req, res) => res.json({ ok: true }));
    for (let i = 0; i < limit; i++) {
      const res = await request(testApp).get('/ping');
      expect(res.status).toBe(200);
    }
    const overLimit = await request(testApp).get('/ping');
    expect(overLimit.status).toBe(429);
    expect(overLimit.body.code).toBe('RATE_LIMIT');
  });
});

describe('API Integration', () => {
  let adminId: string;
  let instructorId: string;
  let studentId: string;
  let courseId: string;
  let moduleId: string;
  let lessonId: string;

  beforeAll(async () => {
    await prisma.auditLog.deleteMany({}).catch(() => {});
    await prisma.quizAttempt.deleteMany({}).catch(() => {});
    await prisma.booking.deleteMany({}).catch(() => {});
    await prisma.lesson.deleteMany({}).catch(() => {});
    await prisma.module.deleteMany({}).catch(() => {});
    await prisma.course.deleteMany({}).catch(() => {});
    await prisma.refreshToken.deleteMany({}).catch(() => {});
    await prisma.user.deleteMany({}).catch(() => {});
    await prisma.tenant.deleteMany({}).catch(() => {});

    const [tenantA, tenantB] = await Promise.all([
      prisma.tenant.create({
        data: { id: TEST_TENANT_ID, name: 'Test School A', slug: 'test-school-a' },
      }),
      prisma.tenant.create({
        data: { id: TEST_TENANT_ID_B, name: 'Test School B', slug: 'test-school-b' },
      }),
    ]);

    const pw = await hashPassword('Test123!');
    const pwAdmin = await hashPassword('Admin123!');
    const [admin, instructor, student] = await Promise.all([
      prisma.user.create({
        data: {
          tenantId: tenantA.id,
          email: 'admin@test.com',
          passwordHash: pw,
          role: 'ADMIN',
          approved: true,
        },
      }),
      prisma.user.create({
        data: {
          tenantId: tenantA.id,
          email: 'instructor@test.com',
          passwordHash: pw,
          role: 'INSTRUCTOR',
          approved: true,
        },
      }),
      prisma.user.create({
        data: {
          tenantId: tenantA.id,
          email: 'student@test.com',
          passwordHash: pw,
          role: 'STUDENT',
          approved: true,
        },
      }),
    ]);
    await prisma.user.create({
      data: {
        tenantId: tenantB.id,
        email: 'admin@schoolbeta.com',
        passwordHash: pwAdmin,
        role: 'ADMIN',
        approved: true,
      },
    });
    adminId = admin.id;
    instructorId = instructor.id;
    studentId = student.id;

    const course = await prisma.course.create({
      data: {
        tenantId: tenantA.id,
        title: 'Test Course',
        createdById: instructorId,
      },
    });
    courseId = course.id;
    const mod = await prisma.module.create({
      data: { courseId, title: 'Module 1', order: 0 },
    });
    moduleId = mod.id;
    const lesson = await prisma.lesson.create({
      data: {
        moduleId,
        title: 'Quiz 1',
        type: 'QUIZ',
        content: JSON.stringify({
          questions: [{ id: 'q1', correctOptionId: 'b', options: [] }],
        }),
        order: 0,
      },
    });
    lessonId = lesson.id;
  });

  afterAll(async () => {
    await prisma.lesson.deleteMany({}).catch(() => {});
    await prisma.module.deleteMany({}).catch(() => {});
    await prisma.course.deleteMany({}).catch(() => {});
    await prisma.booking.deleteMany({}).catch(() => {});
    await prisma.user.deleteMany({}).catch(() => {});
    await prisma.tenant.deleteMany({}).catch(() => {});
    await prisma.$disconnect();
  });

  describe('Auth flow', () => {
    it('POST /api/auth/login returns tokens and user', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@test.com',
          password: 'Test123!',
          tenantId: TEST_TENANT_ID,
        })
        .expect(200);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
      expect(res.body.user.email).toBe('admin@test.com');
      expect(res.body.user.role).toBe('ADMIN');
    });

    it('GET /api/auth/me requires auth', async () => {
      const login = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@test.com', password: 'Test123!', tenantId: TEST_TENANT_ID });
      const token = login.body.accessToken;
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body.email).toBe('admin@test.com');
    });

    it('login audit entry includes correlationId when x-correlation-id header is sent', async () => {
      const correlationId = 'test-login-correlation-id-' + Date.now();
      await request(app)
        .post('/api/auth/login')
        .set('x-correlation-id', correlationId)
        .send({ email: 'admin@test.com', password: 'Test123!', tenantId: TEST_TENANT_ID })
        .expect(200);

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@test.com', password: 'Test123!', tenantId: TEST_TENANT_ID })
        .expect(200);
      const token = loginRes.body.accessToken;

      const auditRes = await request(app)
        .get('/api/audit?page=1&limit=20')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const loginEntry = (auditRes.body.data as Array<{ action: string; correlationId: string | null }>).find(
        (e) => e.action === 'LOGIN' && e.correlationId === correlationId
      );
      expect(loginEntry).toBeDefined();
      expect(loginEntry!.correlationId).toBe(correlationId);
    });

    it('register audit entry includes correlationId when x-correlation-id header is sent', async () => {
      const correlationId = 'test-register-correlation-id-' + Date.now();
      const uniqueEmail = `newinstructor-${Date.now()}@test.com`;
      const adminLogin = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@test.com', password: 'Test123!', tenantId: TEST_TENANT_ID })
        .expect(200);
      const adminToken = adminLogin.body.accessToken;

      await request(app)
        .post('/api/auth/register')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-correlation-id', correlationId)
        .send({
          email: uniqueEmail,
          password: 'Password123!',
          role: 'INSTRUCTOR',
          tenantId: TEST_TENANT_ID,
        })
        .expect(201);

      const auditRes = await request(app)
        .get('/api/audit?page=1&limit=50')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const registerEntry = (auditRes.body.data as Array<{ action: string; resource: string; correlationId: string | null }>).find(
        (e) => e.action === 'CREATE' && e.resource === 'USER' && e.correlationId === correlationId
      );
      expect(registerEntry).toBeDefined();
      expect(registerEntry!.correlationId).toBe(correlationId);
    });
  });

  describe('Booking conflict detection', () => {
    it('assign endpoint rejects double-booking same instructor', async () => {
      const login = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@test.com', password: 'Test123!', tenantId: TEST_TENANT_ID });
      const token = login.body.accessToken;

      const studentLogin = await request(app)
        .post('/api/auth/login')
        .send({ email: 'student@test.com', password: 'Test123!', tenantId: TEST_TENANT_ID });
      const studentToken = studentLogin.body.accessToken;
      const bookRes = await request(app)
        .post('/api/scheduling/bookings')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          name: 'Test booking 1',
          requestedAt: new Date().toISOString(),
          startAt: new Date('2025-06-01T10:00:00Z').toISOString(),
          endAt: new Date('2025-06-01T11:00:00Z').toISOString(),
        })
        .expect(201);
      const bookingId = bookRes.body.id;

      await request(app)
        .patch(`/api/scheduling/bookings/${bookingId}/approve`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      await request(app)
        .patch(`/api/scheduling/bookings/${bookingId}/assign`)
        .set('Authorization', `Bearer ${token}`)
        .send({ instructorId })
        .expect(200);

      const book2Res = await request(app)
        .post('/api/scheduling/bookings')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          name: 'Test booking 2',
          requestedAt: new Date().toISOString(),
          startAt: new Date('2025-06-01T10:30:00Z').toISOString(),
          endAt: new Date('2025-06-01T11:30:00Z').toISOString(),
        })
        .expect(201);
      const booking2Id = book2Res.body.id;
      await request(app)
        .patch(`/api/scheduling/bookings/${booking2Id}/approve`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const assignRes = await request(app)
        .patch(`/api/scheduling/bookings/${booking2Id}/assign`)
        .set('Authorization', `Bearer ${token}`)
        .send({ instructorId });
      expect([400, 409]).toContain(assignRes.status);
      if (assignRes.status === 409) {
        expect(assignRes.body.code).toBe('BOOKING_CONFLICT');
      }
    });
  });

  describe('Tenant isolation', () => {
    it('School A cannot access School B course', async () => {
      const loginA = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@test.com', password: 'Test123!', tenantId: TEST_TENANT_ID });
      const tokenA = loginA.body.accessToken;

      const courseInA = await prisma.course.findFirst({
        where: { tenantId: TEST_TENANT_ID },
        select: { id: true },
      });
      expect(courseInA).not.toBeNull();
      const courseIdA = courseInA!.id;

      const res = await request(app)
        .get(`/api/courses/${courseIdA}`)
        .set('Authorization', `Bearer ${tokenA}`);
      expect(res.status).toBe(200);

      const loginB = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@schoolbeta.com', password: 'Admin123!', tenantId: TEST_TENANT_ID_B });
      if (loginB.status !== 200) return;
      const tokenB = loginB.body.accessToken;
      const resB = await request(app)
        .get(`/api/courses/${courseIdA}`)
        .set('Authorization', `Bearer ${tokenB}`);
      expect(resB.status).toBe(404);
    });

    it('Admin from tenant A cannot access tenant B audit logs via query.tenantId', async () => {
      await prisma.auditLog.create({
        data: {
          tenantId: TEST_TENANT_ID,
          userId: adminId,
          action: 'AUDIT_TEST_A',
          resource: 'TEST',
          resourceId: 'log-tenant-a',
          afterState: '{}',
        },
      });
      await prisma.auditLog.create({
        data: {
          tenantId: TEST_TENANT_ID_B,
          userId: null,
          action: 'AUDIT_TEST_B',
          resource: 'TEST',
          resourceId: 'log-tenant-b',
          afterState: '{}',
        },
      });

      const loginA = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@test.com', password: 'Test123!', tenantId: TEST_TENANT_ID })
        .expect(200);
      const tokenA = loginA.body.accessToken;

      // Explicitly pass tenant B ID in query; must be ignored (auth context = tenant A).
      // If audit route ever uses query.tenantId in the where clause, this test will fail.
      const res = await request(app)
        .get(`/api/audit?tenantId=${TEST_TENANT_ID_B}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      const logs = res.body.data as Array<{ tenantId: string | null; resourceId: string }>;
      expect(Array.isArray(logs)).toBe(true);

      // All returned logs must belong to tenant A (authenticated tenant).
      expect(logs.every((log) => log.tenantId === TEST_TENANT_ID)).toBe(true);

      // Response must NOT contain any tenant B data (override must be ignored).
      expect(logs.some((log) => log.tenantId === TEST_TENANT_ID_B)).toBe(false);
      expect(logs.some((log) => log.resourceId === 'log-tenant-b')).toBe(false);
    });
  });
});

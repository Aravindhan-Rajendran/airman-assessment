# Requirements Checklist – AIRMAN Assessment

| # | Requirement | Implemented | File/Location |
|---|-------------|-------------|---------------|
| **Submission** |
| 1 | Public GitHub repo, clean commit history | Yes | Repo root |
| 2 | Proper folder structure | Yes | backend/, frontend/, .github/ |
| 3 | No broken builds | Yes | npm run build in backend & frontend |
| 4 | README: setup steps | Yes | README.md |
| 5 | README: architecture diagram | Yes | README.md |
| 6 | README: technical decisions & tradeoffs | Yes | README.md |
| 7 | README: API documentation | Yes | README.md |
| 8 | README: sample requests | Yes | README.md |
| 9 | README: demo credentials | Yes | README.md |
| 10 | PLAN.md: 72-hour schedule | Yes | PLAN.md |
| 11 | PLAN.md: what was shipped | Yes | PLAN.md |
| 12 | PLAN.md: what was cut | Yes | PLAN.md |
| 13 | PLAN.md: why deprioritized | Yes | PLAN.md |
| 14 | CUTS.md: features not built + reasoning | Yes | CUTS.md |
| 15 | POSTMORTEM.md: what went wrong, challenges, improvements | Yes | POSTMORTEM.md |
| 16 | Docker Compose runs entire stack | Yes | docker-compose.yml |
| 17 | Optional: cloud deployment | Documented | README, PLAN |
| **Level 1 – Auth & RBAC** |
| L1-A1 | Roles: Student, Instructor, Admin | Yes | backend/prisma/schema.prisma (Role enum) |
| L1-A2 | Admin: create instructors | Yes | backend/src/routes/auth.ts POST /register |
| L1-A3 | Admin: approve students | Yes | backend/src/routes/auth.ts POST /approve-student |
| L1-A4 | Instructor: create content | Yes | backend/src/routes/courses.ts (create course/module/lesson) |
| L1-A5 | Instructor: assign quizzes | Yes | Lessons type QUIZ; instructor creates lessons |
| L1-A6 | Student: view content | Yes | requirePermission('student:view_content') |
| L1-A7 | Student: attempt quizzes | Yes | POST .../attempt, requirePermission('student:attempt_quizzes') |
| L1-A8 | Hashed passwords (bcrypt/argon2) | Yes | backend/src/services/authService.ts (argon2) |
| L1-A9 | Refresh tokens or session | Yes | RefreshToken model, POST /refresh |
| L1-A10 | Route guards on frontend | Yes | frontend useRequireAuth, dashboard layout |
| L1-A11 | RBAC enforced at backend API | Yes | backend middleware requirePermission, requireRole |
| **Level 1 – Learning** |
| L1-B1 | Course → Module → Lesson hierarchy | Yes | Prisma models, routes |
| L1-B2 | Lesson types: Text, MCQ quiz | Yes | LessonType enum, type TEXT/QUIZ |
| L1-B3 | Quiz: store attempts | Yes | QuizAttempt model, POST .../attempt |
| L1-B4 | Quiz: calculate score | Yes | backend/src/routes/courses.ts attempt handler |
| L1-B5 | Quiz: show incorrect questions | Yes | Response incorrectQuestions |
| L1-B6 | Pagination for content lists | Yes | GET /api/courses?page&limit |
| L1-B7 | Search by course/module title | Yes | GET /api/courses?search= |
| **Level 1 – Scheduling** |
| L1-C1 | Instructor availability | Yes | POST/GET /api/scheduling/availability |
| L1-C2 | Student booking requests | Yes | POST /api/scheduling/bookings |
| L1-C3 | Admin approval & instructor assign | Yes | PATCH .../approve, .../assign |
| L1-C4 | Weekly calendar list view | Yes | GET /api/scheduling/bookings/weekly?weekStart= |
| L1-C5 | Conflict detection (no double-book) | Yes | backend/src/services/bookingService.ts, assertNoInstructorConflict |
| L1-C6 | Status: requested, approved, completed, cancelled | Yes | BookingStatus enum, PATCH complete/cancel |
| **Level 1 – Tech** |
| L1-T1 | REST API (Node+Express) | Yes | backend/src/index.ts, routes |
| L1-T2 | PostgreSQL | Yes | Prisma, docker-compose postgres |
| L1-T3 | ORM (Prisma) | Yes | backend/prisma/schema.prisma |
| L1-T4 | Input validation (Zod) | Yes | All routes use z.parse() |
| L1-T5 | Structured error handling | Yes | backend/src/middleware/errorHandler.ts |
| L1-T6 | Frontend React/Next.js | Yes | frontend/ Next.js 14 |
| L1-T7 | Form validation | Yes | Frontend forms, API Zod |
| L1-T8 | Clean UX, role-aware nav | Yes | Dashboard layout, nav by role |
| L1-T9 | Docker: frontend, backend, postgres | Yes | docker-compose.yml |
| L1-T10 | CI: lint, unit tests, build | Yes | .github/workflows/ci.yml |
| L1-T11 | Unit tests: Auth | Yes | backend/src/services/authService.test.ts |
| L1-T12 | Unit tests: Booking conflict | Yes | backend/src/services/bookingService.test.ts |
| L1-T13 | 2 integration tests (real DB) | Yes | backend/src/app.integration.test.ts (Auth, Booking conflict, Tenant isolation) |
| **Level 2 – Multi-tenancy** |
| L2-A1 | Two flight schools as tenants | Yes | Seed: Flight School Alpha, Beta |
| L2-A2 | Approach documented (shared DB + tenant_id) | Yes | README, schema comments |
| L2-A3 | All queries scoped to tenant_id | Yes | getTenantId(req), where: { tenantId } |
| L2-A4 | School A cannot access School B data | Yes | All list/get filter by req.context.tenantId |
| L2-A5 | Backend rejects cross-tenant | Yes | findFirst with tenantId returns 404 for other tenant |
| **Level 2 – Audit** |
| L2-B1 | Log: user login | Yes | auditService.log in authService.login |
| L2-B2 | Log: course create/update | Yes | courses.ts create/patch |
| L2-B3 | Log: schedule create/approve/cancel | Yes | scheduling.ts bookings |
| L2-B4 | Log: role changes | Yes | auth.ts approve-student → ROLE_CHANGE |
| L2-B5 | user_id, tenant_id, before/after, timestamp, correlation_id | Yes | AuditLog model, auditService |
| **Level 2 – Workflow** |
| L2-C1 | requested → approved → assigned → completed | Yes | BookingStatus, PATCH approve/assign/complete |
| L2-C2 | Escalate if not assigned within X hours | Yes | backend/src/jobs/workflowJob.ts |
| L2-C3 | Email stub (console) | Yes | workflowJob console.log |
| L2-C4 | Background job runner | Yes | setInterval in index.ts (in-process) |
| L2-C5 | Safe retry | Yes | runWithRetry in workflowJob |
| **Level 2 – Performance** |
| L2-D1 | Caching read-heavy endpoints | Yes | cacheService, courses list, bookings list |
| L2-D2 | DB indexes documented | Yes | README “DB Indexes”, schema @@index |
| L2-D3 | Pagination on all list endpoints | Yes | courses, bookings, availability, audit |
| L2-D4 | Rate limit: auth | Yes | express-rate-limit on /api/auth/login, refresh |
| L2-D5 | Rate limit: booking | Yes | bookingLimiter on /api/scheduling/bookings |
| **Level 2 – Deployment & CI** |
| L2-E1 | Cloud deployment option documented | Yes | README, PLAN |
| L2-E2 | Env separation (dev/staging/prod) | Yes | README, NODE_ENV, env vars |
| L2-E3 | Secrets management documented | Yes | README, .env.example |
| L2-E4 | Rollback strategy documented | Yes | POSTMORTEM, PLAN |
| L2-F1 | CI: lint, unit, integration with DB | Yes | .github/workflows/ci.yml |
| L2-F2 | CI: migration check | Yes | prisma migrate deploy in CI |
| L2-F3 | CI: build artifacts frontend + backend | Yes | npm run build in both jobs |
| L2-F4 | Quality gate (coverage or perf) | Yes | jest.config.js coverageThreshold |
| **Level 2 Acceptance** |
| L2-ACC1 | Tenant isolation verified with tests | Yes | app.integration.test.ts “Tenant isolation” |
| L2-ACC2 | Audit logs correct metadata | Yes | AuditLog model, auditService.log |
| L2-ACC3 | Background jobs retry safely | Yes | runWithRetry in workflowJob |
| L2-ACC4 | Rate limiting prevents abuse | Yes | auth + booking limiters |
| L2-ACC5 | Cloud deployment works or documented | Yes | Documented in README/PLAN |
| L2-ACC6 | CI blocks regressions | Yes | CI runs on push/PR |

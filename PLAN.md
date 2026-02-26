# PLAN.md – 72-Hour Schedule & Prioritization

## 72-Hour Schedule Breakdown

| Block | Hours | Focus |
|-------|--------|--------|
| Day 1 – Foundation | 0–8 | Repo setup, Prisma schema (Auth, Tenant, Course, Module, Lesson, Booking, AuditLog), migrations, seed data, Express app skeleton, auth (login/refresh/register), RBAC middleware |
| Day 1 – Core API | 8–16 | Course CRUD, module/lesson APIs, quiz attempt with scoring and incorrect-questions response, pagination and search on courses |
| Day 2 – Scheduling | 16–24 | Booking CRUD, instructor availability, conflict detection (no double-book), statuses (requested/approved/assigned/completed/cancelled), weekly calendar endpoint |
| Day 2 – Multi-tenant & Audit | 24–32 | Tenant scoping on all queries, cross-tenant rejection, audit logging (login, course create/update, schedule create/approve/cancel, role changes) with user_id, tenant_id, before/after, timestamp, correlation_id |
| Day 2 – Level 2 | 32–40 | Workflow engine (requested→approved→assigned→completed), escalation job (unassigned after X hours), notification stub, background job with retry |
| Day 3 – Frontend | 40–48 | Next.js app, login (tenant selector), role-based nav, dashboard, courses list/detail, lesson view, quiz attempt, schedule (list + weekly), admin (approve students, bookings) |
| Day 3 – DevOps & Quality | 48–56 | Docker Compose (frontend, backend, postgres), CI (lint, unit tests, integration tests with DB, build), rate limiting (auth + booking), caching on read-heavy endpoints |
| Day 3 – Polish | 56–72 | README, PLAN, CUTS, POSTMORTEM, DB index documentation, cloud deployment notes, quality gate (e.g. coverage threshold) |

## What Was Shipped

- **Auth & RBAC**: Login, refresh, register (admin creates instructors/students), approve students, hashed passwords (Argon2), refresh tokens, route guards (frontend), RBAC enforced on backend for all relevant routes.
- **Learning**: Course → Module → Lesson hierarchy; text and MCQ quiz lessons; store attempts, calculate score, return incorrect questions; pagination and search on course list.
- **Scheduling**: Instructor availability; student booking requests; admin approve and assign instructor; weekly calendar list; conflict detection (no double-booking); statuses requested/approved/assigned/completed/cancelled.
- **Multi-tenancy**: Two tenants (flight schools); shared DB with tenant_id; all queries scoped; cross-tenant access rejected.
- **Audit**: Logs for login, course create/update, schedule create/approve/assign/complete/cancel, role (approve) changes; fields: user_id, tenant_id, before/after, timestamp, correlation_id.
- **Workflow**: Status flow; background job for escalation (unassigned after X hours); notification stub (console); safe retry.
- **Performance**: Pagination on all list endpoints; caching for courses and bookings list; DB indexes documented; rate limiting on auth and booking endpoints.
- **DevOps**: Docker Compose (frontend, backend, postgres); CI (lint, unit tests, integration tests with DB, build); coverage threshold as quality gate.

## What Was Intentionally Cut

- **Cloud deployment**: Documented approach (env separation, secrets, rollback) and optional link; no live cloud URL required for submission.
- **Redis**: Cache implemented as in-memory with TTL to satisfy “Redis preferred or in-memory with TTL”; no Redis in default Docker Compose.
- **Bonus**: Offline quiz, telemetry stub, feature flags not implemented to keep scope within 72h.

## Why Certain Features Were Deprioritized

- **Full Redis stack**: In-memory cache meets the mandatory requirement and keeps Docker setup simpler; Redis can be added for production.
- **Live cloud URL**: Environment and rollback documentation provided; actual deployment left to infra/time.
- **Bonus items**: Explicitly optional; focused on mandatory Level 1 and Level 2 first.

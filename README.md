# AIRMAN Full Stack Developer Technical Assessment

Production-minded AIRMAN Core: Authentication, RBAC, Learning (Maverick-style), Scheduling (Skynet-style), Multi-tenancy, Audit logs, and CI/CD.

## Architecture Diagram

```
┌─────────────┐     ┌─────────────┐     ┌──────────────┐
│   Browser   │────▶│  Next.js    │────▶│  Express     │
│   (React)   │     │  Frontend   │     │  Backend     │
└─────────────┘     └─────────────┘     └──────┬───────┘
                                               │
                    ┌──────────────────────────┼──────────────────────────┐
                    │                          │                          │
                    ▼                          ▼                          ▼
             ┌────────────┐            ┌────────────┐            ┌────────────┐
             │ PostgreSQL │            │   Redis    │             │  BullMQ    │
             │  (Primary) │            │  (Cache)   │             │  (Jobs)    │
             └────────────┘            └────────────┘             └────────────┘
```

- **Frontend**: Next.js 14, React 18, role-based routes, form validation.
- **Backend**: Express, TypeScript, Prisma ORM, Zod validation, JWT + refresh tokens.
- **DB**: PostgreSQL with tenant_id on all tenant-scoped tables; indexes for tenantId, (tenantId, title), (tenantId, startAt, endAt), etc.
- **Auth**: Argon2 hashed passwords; access + refresh tokens; RBAC enforced on every API route.
- **Multi-tenancy**: Shared DB, tenant_id on every row; all queries scoped by tenant; cross-tenant access rejected.

## Setup

### Prerequisites

- Node.js 18+
- Docker & Docker Compose (for one-command run)
- PostgreSQL 16 (if running without Docker)

### Local development (without Docker)

1. **Backend**
   ```bash
   cd backend
   cp .env.example .env
   # Set DATABASE_URL to your PostgreSQL (e.g. postgresql://postgres:postgres@localhost:5432/airman)
   npm install
   npx prisma migrate deploy
   npx prisma db seed
   npm run dev
   ```
   Backend runs at http://localhost:4000

2. **Frontend**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   Frontend runs at http://localhost:3000. Set `NEXT_PUBLIC_API_URL=http://localhost:4000` if needed.

### Run everything in Docker (build + run)

From the project root:

```bash
docker compose build
docker compose up -d
```

Or build and run in one go:

```bash
docker compose up -d --build
```

- **Frontend**: http://localhost:3000  
- **Backend**: http://localhost:4000  
- **PostgreSQL**: localhost:5432 (user `postgres`, password `postgres`, db `airman`)  
- **Redis**: localhost:6379  

Migrations and DB seed run automatically when the backend container starts. No need to run them manually.

## Key Technical Decisions & Tradeoffs

| Decision | Rationale |
|----------|-----------|
| Shared DB + tenant_id | Simpler ops than per-tenant DBs; strict query scoping and tests ensure isolation. |
| Argon2 for passwords | Strong, standard choice; preferred over bcrypt for new systems. |
| Refresh tokens in DB | Enables revocation and audit; tradeoff is DB read on refresh. |
| In-memory cache (no Redis required for Level 1) | Cache service abstracts storage; can swap to Redis for production. |
| Zod for validation | Single schema for runtime + types; consistent error messages. |
| Pagination on all list endpoints | Avoids large responses; same pattern for courses, bookings, audit logs. |

## API Documentation

Base URL: `http://localhost:4000` (or your backend URL).

### Auth

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/auth/login | Login. Body: `{ "email", "password", "tenantId?" }`. Returns `accessToken`, `refreshToken`, `user`. |
| POST | /api/auth/refresh | Body: `{ "refreshToken" }`. Returns new tokens. |
| GET | /api/auth/me | Current user (requires Bearer token). |
| POST | /api/auth/register | Create instructor/student (Admin, requires tenant). Body: `{ "email", "password", "role", "tenantId" }`. |
| POST | /api/auth/approve-student | Approve student (Admin). Body: `{ "userId", "approved" }`. |
| GET | /api/auth/students-pending | List unapproved students (Admin). |

### Tenants

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/tenants/public | List tenants (public, for login dropdown). |
| GET | /api/tenants | List tenants (authenticated). |

### Courses (Learning)

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/courses | List courses (paginated, search). Query: `page`, `limit`, `search`. |
| GET | /api/courses/:id | Get course with modules and lessons. |
| POST | /api/courses | Create course (Instructor/Admin). Body: `{ "title", "description?" }`. |
| PATCH | /api/courses/:id | Update course. |
| POST | /api/courses/:courseId/modules | Create module. Body: `{ "title", "order?" }`. |
| POST | /api/courses/:courseId/modules/:moduleId/lessons | Create lesson. Body: `{ "title", "type": "TEXT"|"QUIZ", "content?", "order?" }`. |
| POST | /api/courses/:courseId/modules/:moduleId/lessons/:lessonId/attempt | Submit quiz attempt. Body: `{ "answers": { "questionId": "optionId" } }`. |

### Scheduling

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/scheduling/bookings | List bookings (paginated). |
| GET | /api/scheduling/bookings/weekly | Weekly view. Query: `weekStart` (YYYY-MM-DD). |
| POST | /api/scheduling/bookings | Create booking (Student). Body: `{ "requestedAt", "startAt", "endAt" }`. |
| PATCH | /api/scheduling/bookings/:id/approve | Approve (Admin). |
| PATCH | /api/scheduling/bookings/:id/assign | Assign instructor (Admin). Body: `{ "instructorId" }`. |
| PATCH | /api/scheduling/bookings/:id/complete | Mark completed. |
| PATCH | /api/scheduling/bookings/:id/cancel | Cancel. |
| POST | /api/scheduling/availability | Add availability. Body: `{ "startAt", "endAt", "instructorId?" }`. |
| GET | /api/scheduling/availability | List availability (paginated). |

### Audit

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/audit | List audit logs (Admin, tenant-scoped, paginated). Query: `page`, `limit`. Tenant is taken from auth context only. |

## Sample Requests

**Login**
```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@schoolalpha.com","password":"Admin123!","tenantId":"<TENANT_ID>"}'
```

**List courses (with token)**
```bash
curl -X GET "http://localhost:4000/api/courses?page=1&limit=10" \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

**Create booking**
```bash
curl -X POST http://localhost:4000/api/scheduling/bookings \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"requestedAt":"2025-06-01T09:00:00Z","startAt":"2025-06-01T10:00:00Z","endAt":"2025-06-01T11:00:00Z"}'
```

## Demo Credentials

After running `npx prisma db seed` in the backend:

| Role | Email | Password | Tenant |
|------|--------|----------|--------|
| Admin | admin@schoolalpha.com | Admin123! | Flight School Alpha |
| Instructor | instructor@schoolalpha.com | Password123! | Flight School Alpha |
| Student | student@schoolalpha.com | Password123! | Flight School Alpha |
| Admin | admin@schoolbeta.com | Admin123! | Flight School Beta |

Use the tenant ID from `GET /api/tenants/public` when logging in if you have multiple tenants.

## DB Indexes (documented)

- `User`: tenantId, email, role  
- `Course`: tenantId, (tenantId, title)  
- `Booking`: tenantId, studentId, instructorId, status, (tenantId, startAt, endAt)  
- `AuditLog`: tenantId, userId, createdAt, correlationId  
- `QuizAttempt`: lessonId, userId, tenantId  
- `InstructorAvailability`: tenantId, instructorId, (tenantId, startAt, endAt)  

## Production

When `NODE_ENV=production`, the backend **requires** the following environment variables to be set and non-empty. The process will exit with an error if they are missing (no fallback secrets are used in production).

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET` | **Yes** | Secret used to sign access JWTs. Use a long, random value (e.g. 32+ chars). |
| `JWT_REFRESH_SECRET` | **Yes** | Secret used to sign refresh tokens. Must be different from `JWT_SECRET`. |
| `CORS_ORIGINS` | **Yes** | Comma-separated list of allowed origins (e.g. `https://app.example.com,https://admin.example.com`). Requests from other origins are rejected. |
| `DATABASE_URL` | Yes | PostgreSQL connection string. |
| `PORT` | No | Defaults to `4000`. |
| `JWT_EXPIRES_IN` | No | Access token TTL (default `15m`). |
| `JWT_REFRESH_EXPIRES_IN` | No | Refresh token TTL (default `7d`). |

**Why CORS allowlist in production:** Allowing any origin (`origin: true`) lets any website send credentialed requests to your API. A malicious site could trigger actions as the logged-in user. In production, set `CORS_ORIGINS` to your frontend origin(s) only (e.g. your Vercel or custom domain).

**Why fallback secrets are dangerous:** If the app starts in production with default or placeholder secrets, anyone who knows or guesses them can forge valid JWTs and impersonate users (including admins). Requiring explicit secrets in production prevents accidental deployment with weak or well-known values.

In **development** (`NODE_ENV` not set or not `production`), the backend allows default dev-only values for `JWT_SECRET` and `JWT_REFRESH_SECRET` so you can run locally without setting them. Never use those defaults in production.

## Cloud Deployment (Optional)

- **Backend**: Deploy to Render, Railway, or Fly.io. Set `DATABASE_URL` to a managed Postgres (e.g. Render Postgres, Supabase). **Set `NODE_ENV=production` and provide `JWT_SECRET`, `JWT_REFRESH_SECRET`, and `CORS_ORIGINS`** (see Production above). Run `prisma migrate deploy` in build or release phase.
- **Frontend**: Deploy to Vercel. Set `NEXT_PUBLIC_API_URL` to your backend URL.
- **Environments**: Use separate projects or env vars for dev/staging/prod. Never commit secrets; use the platform’s secret management.
- **Rollback**: Redeploy previous image/revision from the platform’s dashboard or CLI.

## License

MIT (or as specified by the assessment).

# POSTMORTEM.md – Reflection & Improvements

## What Went Wrong

- **Seed timing**: Seed depends on Prisma and existing migrations; first-time setup must run migrations before seed. Documented in README.
- **Frontend API base URL**: In Docker, browser calls backend from host; `NEXT_PUBLIC_API_URL` must point to a URL the browser can reach (e.g. `http://localhost:4000`), not `http://backend:4000`. Documented.
- **Integration tests**: Require a real DB; CI uses a Postgres service and `DATABASE_URL`; locally you must run Postgres or use a test DB.
- **Lesson content shape**: Quiz content JSON (questions, options, correctOptionId) must match between backend scoring and frontend display; one place assumed a different shape and was corrected.

## Technical Challenges Faced

- **Tenant in login**: Students/admins must select tenant when multiple exist; added public `/api/tenants/public` so login page can list tenants without being authenticated.
- **Booking conflict query**: Overlap condition (startAt < endAt, endAt > startAt) and excluding cancelled/current booking required careful Prisma `where` to avoid false positives.
- **RBAC vs tenant**: Some routes need both permission and tenant (e.g. approve only within own tenant); combined `requirePermission` and `requireTenant` middleware.
- **Next.js standalone**: Docker build uses `output: 'standalone'` so the frontend image can run with `node server.js` without full `node_modules`.

## What Would Be Improved With One More Week

1. **Redis**: Add Redis to Docker Compose and use it for cache and (optionally) rate limiting and session store.
2. **BullMQ worker**: Move escalation and notification to a dedicated worker container with retries and dead-letter handling.
3. **Cloud deployment**: Deploy backend (e.g. Railway) and frontend (e.g. Vercel) with env-specific config and a real demo URL.
4. **E2E tests**: Playwright or Cypress for login, course flow, and booking flow in the browser.
5. **Audit log UI**: Admin page to browse and filter audit logs by tenant, user, action, date.
6. **Better error handling**: More consistent error codes and messages; frontend toasts or inline errors for each form.
7. **One more bonus**: e.g. telemetry stub (accept JSON flight event logs and store or forward).

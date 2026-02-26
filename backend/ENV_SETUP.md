# Environment setup guide

## 1. Create your `.env` file

Copy from the example (already done if you have `.env`):

```bash
cp .env.example .env
```

Then edit `backend/.env` with your real values.

---

## 2. What each variable does

| Variable | What to set | Notes |
|----------|-------------|--------|
| **NODE_ENV** | `development` or `production` | Leave as `development` for local dev. |
| **PORT** | `4000` (or any free port) | Port the API runs on. |
| **DATABASE_URL** | PostgreSQL connection string | See below. |
| **JWT_SECRET** | Long random string | **Change** from the example; used to sign access tokens. |
| **JWT_REFRESH_SECRET** | Another long random string | **Change** from the example; used for refresh tokens. |
| **JWT_EXPIRES_IN** | e.g. `15m` | Access token lifetime. |
| **JWT_REFRESH_EXPIRES_IN** | e.g. `7d` | Refresh token lifetime. |
| **REDIS_URL** | Redis connection string | See below. |
| **RATE_LIMIT_*** | Numbers (optional) | Rate limits for auth and booking; defaults in example are fine. |
| **WORKFLOW_ESCALATION_HOURS** | e.g. `24` | Escalation delay in hours; optional. |

---

## 3. PostgreSQL (DATABASE_URL)

Format:

```text
postgresql://USER:PASSWORD@HOST:PORT/DATABASE
```

- **Local:** Install PostgreSQL, create a database (e.g. `airman`), then set:
  - `postgresql://postgres:YOUR_PASSWORD@localhost:5432/airman`
- **Host/port:** Change `localhost:5432` if PostgreSQL is on another machine.
- **Cloud:** Use the connection string from your provider (e.g. Supabase, Neon, Railway).

Then run migrations:

```bash
cd backend
npm run db:migrate
# or for dev: npm run db:migrate:dev
```

---

## 4. Redis (REDIS_URL)

Format:

```text
redis://HOST:PORT
```

- **Local:** Install Redis and use `redis://localhost:6379`.
- **Docker:** `docker run -d -p 6379:6379 redis` then `redis://localhost:6379`.
- **Cloud:** Use the URL from your Redis provider (e.g. Upstash, Redis Cloud).

---

## 5. JWT secrets (important)

**Do not use the example values in production.**

Generate two random strings and put them in `.env`:

- **JWT_SECRET** – e.g. 32+ random characters.
- **JWT_REFRESH_SECRET** – different 32+ random characters.

Example (Node one-liner):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Run it twice and set one result as `JWT_SECRET`, the other as `JWT_REFRESH_SECRET`.

---

## 6. Quick local checklist

1. Copy `.env.example` → `.env` (already done if you have `.env`).
2. Install and start **PostgreSQL**; create database `airman`; set **DATABASE_URL**.
3. Install and start **Redis**; set **REDIS_URL** (e.g. `redis://localhost:6379`).
4. Generate and set **JWT_SECRET** and **JWT_REFRESH_SECRET**.
5. Run `npm run db:migrate` (or `db:migrate:dev`) in `backend`.
6. Start the backend: `npm run dev`.

After this, all env details are set and the app can use the database and Redis.

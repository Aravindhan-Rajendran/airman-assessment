# Deploy AIRMAN to a Real URL

This guide gets your app live with **free-tier** options so you get real URLs like:
- **Frontend**: `https://your-app.vercel.app`
- **Backend**: `https://your-api.onrender.com`

---

## Overview

| Part        | Where to deploy | You get                          |
|------------|------------------|-----------------------------------|
| **Frontend** (Next.js) | [Vercel](https://vercel.com) | `https://<project>.vercel.app`   |
| **Backend** (Express)  | [Render](https://render.com) or [Railway](https://railway.app) | `https://<service>.onrender.com` |
| **PostgreSQL**         | Render Postgres or Railway Postgres (or [Supabase](https://supabase.com)) | Connection URL |
| **Redis** (optional)   | [Upstash](https://upstash.com) (free tier) or same platform | `REDIS_URL` |

---

## Option 1: Vercel (Frontend) + Render (Backend + DB) — Recommended

### Step 1: Deploy backend on Render

1. **Push your code to GitHub** (if not already):
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/airman-assessment.git
   git push -u origin main
   ```

2. **Create a PostgreSQL database on Render**
   - Go to [Render Dashboard](https://dashboard.render.com) → **New** → **PostgreSQL**.
   - Name it e.g. `airman-db`, choose a region, create.
   - Copy the **Internal Database URL** (use this in the backend service).

3. **Create a Web Service for the backend**
   - **New** → **Web Service**.
   - Connect your GitHub repo, select `airman-assessment`.
   - **Root Directory**: `backend`.
   - **Build Command**: `npm install && npx prisma generate && npm run build`.
   - **Start Command**: `npx prisma migrate deploy && npx prisma db seed && node dist/index.js`.
   - **Instance Type**: Free (or paid if you need always-on).

4. **Environment variables** (Render → your service → **Environment**):

   | Key | Value |
   |-----|--------|
   | `NODE_ENV` | `production` |
   | `PORT` | `4000` |
   | `DATABASE_URL` | *(paste Internal Database URL from step 2)* |
   | `JWT_SECRET` | *(generate: e.g. `openssl rand -base64 32`)* |
   | `JWT_REFRESH_SECRET` | *(different from JWT_SECRET, same method)* |
   | `CORS_ORIGINS` | `https://your-frontend.vercel.app` *(update after deploying frontend)* |
   | `REDIS_URL` | *(optional: leave empty or use Upstash Redis URL)* |

   For **free tier** you can leave `REDIS_URL` empty if the app allows it; if the backend requires it, use [Upstash Redis](https://upstash.com) (free) and paste the URL.

5. **Deploy.** Render will build and deploy. Note your backend URL, e.g. `https://airman-api.onrender.com`.

---

### Step 2: Deploy frontend on Vercel

1. Go to [Vercel](https://vercel.com) and sign in with GitHub.

2. **Import** your `airman-assessment` repo.

3. **Configure project**:
   - **Root Directory**: `frontend` (or set in Vercel UI).
   - **Framework Preset**: Next.js (auto-detected).

4. **Environment variable** (Vercel → Project → Settings → Environment Variables):

   | Name | Value |
   |------|--------|
   | `NEXT_PUBLIC_API_URL` | `https://airman-api.onrender.com` *(your Render backend URL)* |

5. **Deploy.** You get a URL like `https://airman-assessment-xxx.vercel.app`.

6. **Update backend CORS**: In Render, edit `CORS_ORIGINS` to include your real Vercel URL, e.g.:
   ```
   https://airman-assessment-xxx.vercel.app,https://your-custom-domain.com
   ```
   Then redeploy the backend so CORS allows the frontend.

---

## Option 2: Railway (Backend + Frontend + DB in one place)

1. Go to [Railway](https://railway.app) and connect GitHub.

2. **New Project** → **Deploy from GitHub** → select `airman-assessment`.

3. **Add PostgreSQL**: In the project, **New** → **Database** → **PostgreSQL**. Copy `DATABASE_URL` from Variables.

4. **Add Redis** (optional): **New** → **Database** → **Redis**. Copy `REDIS_URL`.

5. **Backend service**:
   - Add a service from the same repo.
   - **Root Directory**: `backend`.
   - **Build**: `npm install && npx prisma generate && npm run build`.
   - **Start**: `npx prisma migrate deploy && npx prisma db seed && node dist/index.js`.
   - Set env: `NODE_ENV=production`, `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `CORS_ORIGINS`, `REDIS_URL` (if used).
   - Railway assigns a URL like `https://backend-xxx.up.railway.app`.

6. **Frontend service**:
   - Add another service from the same repo.
   - **Root Directory**: `frontend`.
   - **Build**: `npm install && npm run build`.
   - **Start**: `npm start`.
   - Set `NEXT_PUBLIC_API_URL` to the backend URL from step 5.
   - Railway assigns a URL like `https://frontend-xxx.up.railway.app`.

7. Set `CORS_ORIGINS` on the backend to the frontend URL.

---

## Option 3: Run with Docker (VPS or cloud VM)

If you have a server (DigitalOcean, AWS EC2, etc.):

```bash
# On the server, clone repo then:
cd airman-assessment
```

Create a production `.env` or set env vars for the backend (see README Production section). For **docker-compose**, use a production override so the backend gets real secrets and the frontend gets the real API URL:

```bash
# Build and run (update CORS and NEXT_PUBLIC_API_URL in docker-compose or env)
export JWT_SECRET="your-production-secret"
export JWT_REFRESH_SECRET="your-other-production-secret"
docker compose up -d --build
```

Then put Nginx (or Caddy) in front of ports 3000 and 4000 and add a domain with SSL (e.g. Let’s Encrypt).

---

## After deployment

- **Frontend URL**: Use this as your “real deploy URL” (e.g. Vercel or Railway frontend URL).
- **Backend URL**: Only for API calls; keep `NEXT_PUBLIC_API_URL` and `CORS_ORIGINS` in sync.
- **Demo logins**: Same as local (see RUN_GUIDE.md), e.g. `admin@schoolalpha.com` / `Admin123!` (tenant: Flight School Alpha).

---

## Quick checklist

- [ ] Code on GitHub (or GitLab).
- [ ] PostgreSQL created (Render/Railway/Supabase); `DATABASE_URL` set on backend.
- [ ] Backend env: `JWT_SECRET`, `JWT_REFRESH_SECRET`, `CORS_ORIGINS` (frontend URL).
- [ ] Frontend env: `NEXT_PUBLIC_API_URL` (backend URL).
- [ ] Migrations run on deploy (`prisma migrate deploy`); seed run once (`prisma db seed`).
- [ ] CORS updated after you know the final frontend URL.

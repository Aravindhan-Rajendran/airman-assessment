# Airman Assessment – After Docker Is Running

Use this **after** `docker-compose up -d --build` has finished successfully.

---

## 1. Apply database migrations

The database is empty until you run Prisma migrations.

**Where to run:** Open a terminal and go to the **project root** (the folder that contains `docker-compose.yml`), e.g.:

```bash
cd D:\Assesments\airman-assessment
```

Then run (use `run` so it works even if the backend container has stopped):

```bash
docker-compose run --rm backend npx prisma migrate deploy
```

You should see something like: `Applied 1 migration(s).`

---

## 2. (Optional) Seed demo data

To get demo tenants and users (so you can log in and test the app), run the seed (same folder as above):

```bash
docker-compose run --rm backend npm run db:seed
```

This creates:

- **Tenants:** Flight School Alpha, Flight School Beta  
- **Users (Alpha):**
  - `admin@schoolalpha.com` / `Admin123!` (ADMIN)
  - `instructor@schoolalpha.com` / `Password123!` (INSTRUCTOR)
  - `student@schoolalpha.com` / `Password123!` (STUDENT, approved)
  - `pending@schoolalpha.com` / `Password123!` (STUDENT, pending approval)
- **Users (Beta):**  
  - `admin@schoolbeta.com` / `Admin123!`  
  - `instructor@schoolbeta.com` / `Password123!`  
  - `student@schoolbeta.com` / `Password123!`

---

## 3. Open the app

- **Frontend:** http://localhost:3000  
- **Backend API:** http://localhost:4000  

On the login page, pick a tenant (e.g. “Flight School Alpha”), then log in with one of the seeded emails and passwords above.

---

## 4. Environment variables (optional)

Docker Compose already sets:

- **Postgres:** `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`  
- **Backend:** `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `PORT`  
- **Frontend:** `NEXT_PUBLIC_API_URL=http://localhost:4000`

To override JWT secrets (recommended in production), create a `.env` file in the **project root** (same folder as `docker-compose.yml`):

```env
JWT_SECRET=your-strong-secret-here
JWT_REFRESH_SECRET=your-strong-refresh-secret-here
```

Then run:

```bash
docker-compose up -d
```

---

## 5. Useful commands

| What | Command |
|------|--------|
| View running containers | `docker-compose ps` |
| Backend logs | `docker-compose logs -f backend` |
| Frontend logs | `docker-compose logs -f frontend` |
| Stop everything | `docker-compose down` |
| Stop and remove DB volume | `docker-compose down -v` |
| Open Prisma Studio (DB UI) | `docker-compose exec backend npx prisma studio` (then open the URL it prints) |

---

## Quick checklist

1. `docker-compose up -d --build` ✅ (you did this)
2. `docker-compose exec backend npx prisma migrate deploy`
3. `docker-compose exec backend npm run db:seed` (optional)
4. Open http://localhost:3000 and log in with a seeded user

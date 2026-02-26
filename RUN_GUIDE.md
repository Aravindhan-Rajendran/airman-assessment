# How to Run AIRMAN & How to Move Around

## Prerequisites

- **Node.js 18+**
- **PostgreSQL** (running on your machine or in Docker)
- Your backend `.env` already has: `DATABASE_URL="postgresql://postgres:postgres@localhost:5432/airman"`  
  → Make sure PostgreSQL is running and the database `airman` exists (or create it).

---

## 1. Run the app (local)

### Step 1: Database

Create the database if it doesn’t exist:

```bash
# In psql or any PostgreSQL client:
CREATE DATABASE airman;
```

### Step 2: Backend

```bash
cd backend
npm install
npx prisma migrate deploy
npx prisma db seed
npm run dev
```

- Backend: **http://localhost:4000**
- Health: http://localhost:4000/health

### Step 3: Frontend (new terminal)

```bash
cd frontend
npm install
npm run dev
```

- Frontend: **http://localhost:3000**

---

## 2. How to “move” (navigate the app)

1. **Open** http://localhost:3000  
2. **Login**
   - Choose **School**: e.g. “Flight School Alpha”
   - **Email**: e.g. `admin@schoolalpha.com`
   - **Password**: `Admin123!`
   - Click **Login**
3. You land on the **Dashboard**.
4. **Nav links** (top):
   - **Dashboard** – home
   - **Courses** – list courses, open one, view lessons/quizzes
   - **Schedule** – bookings (students request; admin/instructor approve/assign)
   - **Admin** – only for Admin/Instructor: pending students, create instructor, audit logs, bookings
5. **By role**
   - **Admin**: Create instructor, approve students, create courses, view audit logs, manage bookings.
   - **Instructor**: Create courses, add modules/lessons/quizzes, manage schedule.
   - **Student**: View courses, take quizzes, request bookings, see results.
6. **Logout**: click **Logout** in the top nav.

---

## 3. Demo logins (after seed)

| Role       | Email                     | Password    | School              |
|-----------|----------------------------|-------------|---------------------|
| Admin     | admin@schoolalpha.com      | Admin123!   | Flight School Alpha |
| Instructor| instructor@schoolalpha.com  | Password123!| Flight School Alpha |
| Student   | student@schoolalpha.com     | Password123!| Flight School Alpha |
| Admin     | admin@schoolbeta.com       | Admin123!   | Flight School Beta  |

---

## 4. Optional: frontend API URL

If the backend is not on `localhost:4000`, create `frontend/.env.local`:

```
NEXT_PUBLIC_API_URL=http://localhost:4000
```

(Replace with your backend URL if different.)

---

## 5. One-command run with Docker

From the project root:

```bash
docker-compose up -d
```

Then run migrations and seed once:

```bash
docker-compose exec backend npx prisma migrate deploy
docker-compose exec backend npx prisma db seed
```

- Frontend: http://localhost:3000  
- Backend: http://localhost:4000  

---

## 6. Useful backend commands

| Command | Purpose |
|--------|---------|
| `npm run dev` | Start backend (watch mode) |
| `npx prisma migrate deploy` | Apply migrations |
| `npx prisma db seed` | Seed tenants, users, sample courses |
| `npx prisma studio` | Open DB UI at http://localhost:5555 |

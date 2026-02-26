# Step-by-Step Deploy Instructions

**Websites you will use:**

| Step | Website | URL | What you do there |
|------|---------|-----|-------------------|
| 1 | **GitHub** | https://github.com | Put your code online |
| 2 | **Render** | https://render.com | Host database + backend API |
| 3 | **Vercel** | https://vercel.com | Host frontend (your app URL) |

**Your final app URL will look like:** `https://airman-assessment-xxxx.vercel.app`

---

## PART A: Put your code on GitHub

### Step 1: Create a GitHub account (if you don’t have one)
- Open: **https://github.com**
- Click **Sign up** and create an account.

### Step 2: Create a new repository on GitHub
1. Go to **https://github.com**
2. Click the **+** (top right) → **New repository**
3. **Repository name:** `airman-assessment` (or any name you like)
4. Leave **Public** selected
5. Do **not** check “Add a README”
6. Click **Create repository**

### Step 3: Push your project from your computer
Open **PowerShell** or **Command Prompt** in your project folder and run (replace `YOUR_USERNAME` with your GitHub username):

```powershell
cd d:\Assesments\airman-assessment
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/airman-assessment.git
git push -u origin main
```

When it asks for login, use your GitHub username and a **Personal Access Token** (not your password).  
To create a token: GitHub → **Settings** → **Developer settings** → **Personal access tokens** → **Generate new token**.

---

## PART B: Create database and backend on Render

### Step 4: Sign up / log in on Render
1. Open: **https://render.com**
2. Click **Get Started for Free**
3. Choose **Sign up with GitHub** and allow Render to access your GitHub

### Step 5: Create a PostgreSQL database
1. On the Render **Dashboard**, click **New +** → **PostgreSQL**
2. **Name:** `airman-db`
3. **Region:** Choose one close to you (e.g. **Oregon (US West)**)
4. **PostgreSQL Version:** 16
5. Click **Create Database**
6. Wait until the database is **Available**
7. In the database page, find **Connections** → **Internal Database URL**
8. Click **Copy** next to **Internal Database URL** and save it somewhere (you need it in the next part)

### Step 6: Create the backend Web Service
1. On the Render Dashboard, click **New +** → **Web Service**
2. Click **Connect account** if your GitHub is not connected, then select your **airman-assessment** repository
3. Click **Connect** next to your repo name
4. Set:
   - **Name:** `airman-api` (or any name)
   - **Region:** Same as your database
   - **Root Directory:** click **Add root directory** and type: `backend`
   - **Runtime:** Node
   - **Build Command:**  
     `npm install && npx prisma generate && npm run build`
   - **Start Command:**  
     `npx prisma migrate deploy && npx prisma db seed && node dist/index.js`
   - **Instance Type:** Free (or paid if you want)
5. Click **Advanced** and then **Add Environment Variable**. Add these one by one:

| Key | Value |
|-----|--------|
| `NODE_ENV` | `production` |
| `PORT` | `4000` |
| `DATABASE_URL` | *(paste the Internal Database URL you copied in Step 5)* |
| `JWT_SECRET` | *(use a long random string, e.g. copy from: https://www.random.org/strings/ — 32 characters)* |
| `JWT_REFRESH_SECRET` | *(another long random string, different from JWT_SECRET)* |
| `CORS_ORIGINS` | `https://airman-assessment.vercel.app` *(we will change this after Vercel deploy)* |

6. Click **Create Web Service**
7. Wait for the first deploy to finish (can take a few minutes)
8. When it’s live, you’ll see a URL like: **https://airman-api.onrender.com**  
   **Copy this URL** — this is your backend API URL.

---

## PART C: Deploy frontend on Vercel

### Step 7: Sign up / log in on Vercel
1. Open: **https://vercel.com**
2. Click **Sign Up** or **Log In**
3. Choose **Continue with GitHub** and allow Vercel to access your GitHub

### Step 8: Import your project
1. On Vercel, click **Add New…** → **Project**
2. You should see **Import Git Repository**. Find **airman-assessment** and click **Import**
3. **Configure Project:**
   - **Project Name:** `airman-assessment` (or keep default)
   - **Root Directory:** click **Edit** → set to `frontend` → **Continue**
   - **Framework Preset:** Next.js (should be auto)
   - **Environment Variables:** click **Add** and add:
     - **Name:** `NEXT_PUBLIC_API_URL`
     - **Value:** the backend URL from Step 6 (e.g. `https://airman-api.onrender.com`)
4. Click **Deploy**
5. Wait for the build to finish. When it’s done, you’ll see **Visit** or a URL like: **https://airman-assessment-xxxx.vercel.app**  
   **This is your real app URL.** Copy it.

### Step 9: Update backend CORS with your real Vercel URL
1. Go back to **https://dashboard.render.com**
2. Open your **airman-api** Web Service
3. Go to **Environment** (left side)
4. Find **CORS_ORIGINS** and click **Edit**
5. Change the value to your **exact** Vercel URL (e.g. `https://airman-assessment-xxxx.vercel.app`) — no slash at the end
6. Click **Save Changes**
7. Render will redeploy automatically. Wait until the deploy is done.

---

## You’re done

- **Your app (frontend) URL:** `https://airman-assessment-xxxx.vercel.app` (the one from Step 8)
- **Backend API URL:** `https://airman-api.onrender.com` (or whatever Render gave you)

**To log in:**  
Open your Vercel URL → choose **Flight School Alpha** → Email: `admin@schoolalpha.com` → Password: `Admin123!` → **Login**.

---

## Quick reference – websites

| What | Website |
|------|---------|
| Put code online | https://github.com |
| Database + Backend | https://render.com |
| Frontend (your app URL) | https://vercel.com |

If anything fails (e.g. build error), check the **Logs** tab on Render or the **Deployments** tab on Vercel for the error message.

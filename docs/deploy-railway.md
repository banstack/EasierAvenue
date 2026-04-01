# Deploying EasierAvenue to Railway

## Prerequisites

- A [Railway](https://railway.app) account
- This repo pushed to GitHub

---

## Step 1 — Create the Railway project

1. Go to [railway.app](https://railway.app) and click **"New Project"**
2. Select **"Deploy from GitHub repo"**
3. Authorize Railway to access your GitHub account if prompted
4. Select the `streeteasy-finder` repository
5. Railway will create the project and link it to the `main` branch

---

## Step 2 — Add PostgreSQL

1. Inside your project, click **"+ New"**
2. Select **"Database"** → **"Add PostgreSQL"**
3. Railway provisions the database instantly

**Important:** You must link the database to your app service so `DATABASE_URL` is injected:

1. Click on your **app service**
2. Go to the **"Variables"** tab
3. Click **"+ Add Variable Reference"**
4. Select the PostgreSQL service → select `DATABASE_URL`
5. Click **"Add"**

---

## Step 3 — Set environment variables

In your app service → **"Variables"** tab, add:

| Variable | Value | Notes |
|---|---|---|
| `CRON_SECRET` | a long random string | Authenticates `/api/cleanup`. Generate one with the command below. |

Generate your `CRON_SECRET` by running this in your terminal:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output (a 64-character hex string) and paste it as the value.

`DATABASE_URL` is already set via the variable reference added in Step 2 — do not set it manually.

---

## Step 4 — Run the initial database migration

The tables don't exist yet. You need to run the Prisma migration once to create them.

1. In the Railway dashboard, go to your **PostgreSQL service**
2. Click the **"Data"** tab → **"Connect"** and copy the connection string
3. Set it locally and run the migration:

```bash
DATABASE_URL="<paste connection string here>" \
  npx prisma migrate deploy --schema=prisma/schema.prisma
```

This creates the `apartments`, `neighborhood_stats`, and `scrape_locks` tables.

> Future schema changes: create a migration with `npx prisma migrate dev --name your_change`, commit the generated files in `prisma/migrations/`, and push. Railway will pick up the new migration on the next deploy.

---

## Step 5 — Deploy

Railway automatically deploys on every push to `main`. Trigger the first deploy by pushing any commit, or click **"Deploy"** in the Railway dashboard.

The build runs `prisma generate` then `next build`. You can monitor progress in the **"Deployments"** tab.

---

## Step 6 — Set up the cleanup cron

The `/api/cleanup` endpoint deletes listings older than 3 days and orphaned scrape locks.

### Option A — Railway Cron Service (recommended)

1. In your project, click **"+ New"** → **"Empty Service"**
2. Name it `cron-cleanup`
3. Go to the service → **"Settings"** tab → set the **Start Command**:

```bash
curl -s -X POST $APP_URL/api/cleanup -H "Authorization: Bearer $CRON_SECRET"
```

4. Go to the **"Deploy"** tab → enable **"Cron Schedule"** → set: `0 2 * * *` (daily at 2 AM UTC)
5. In the **"Variables"** tab for this service, add:

| Variable | Value |
|---|---|
| `APP_URL` | Your app's public URL, e.g. `https://easieravenue.up.railway.app` |
| `CRON_SECRET` | Same value as in Step 3 |

### Option B — External cron (e.g. cron-job.org)

Create a free job at [cron-job.org](https://cron-job.org):
- URL: `https://your-app.up.railway.app/api/cleanup`
- Method: `POST`
- Header: `Authorization: Bearer <your-cron-secret>`
- Schedule: daily at 2:00 AM

---

## Step 7 — Verify

1. Visit your Railway app URL — the home page should load
2. Search a neighborhood — results should scrape live and cache in PostgreSQL
3. Search the same neighborhood again — should return from cache instantly
4. Test the cleanup endpoint:

```bash
curl -X POST https://your-app.up.railway.app/api/cleanup \
  -H "Authorization: Bearer <your-cron-secret>"
# Expected: {"deletedApartments":0,"deletedLocks":0}
```

---

## Environment variable reference

| Variable | Required | Set by | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | Railway (variable reference) | PostgreSQL connection string |
| `CRON_SECRET` | Yes | You | Authenticates `/api/cleanup` requests |

---

## Subsequent deploys

Push to `main` — Railway auto-deploys.

```bash
git push origin main
```

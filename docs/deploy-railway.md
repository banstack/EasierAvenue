# Deploying EasierAvenue to Railway

## Prerequisites

- A [Railway](https://railway.app) account
- The [Railway CLI](https://docs.railway.app/develop/cli) installed: `npm install -g @railway/cli`
- This repo pushed to GitHub

---

## Step 1 — Create the Railway project

```bash
railway login
railway init
```

Choose **"Empty project"** when prompted. Railway will create a new project and link your local directory to it.

---

## Step 2 — Add PostgreSQL

In the Railway dashboard:

1. Open your project
2. Click **"+ New"** → **"Database"** → **"Add PostgreSQL"**
3. Railway provisions the database and automatically injects `DATABASE_URL` into your project's environment

You do not need to set `DATABASE_URL` manually — Railway handles it.

---

## Step 3 — Run the initial migration

Before the first deploy you need to create the database schema. With Railway's PostgreSQL plugin active, pull the connection string locally and run migrate:

```bash
railway run npx prisma migrate dev --name init
```

This creates the `apartments`, `neighborhood_stats`, and `scrape_locks` tables. Commit the generated migration files:

```bash
git add prisma/migrations
git commit -m "chore: add initial prisma migration"
```

Future schema changes follow the same pattern: create a migration locally with `prisma migrate dev`, commit it, and Railway will apply it on the next deploy via the `postinstall` script.

---

## Step 4 — Set environment variables

In the Railway dashboard, go to your app service → **"Variables"** tab and add:

| Variable | Value | Notes |
|---|---|---|
| `CRON_SECRET` | a long random string | Used to authenticate the cleanup cron. Generate with `openssl rand -hex 32` |

`DATABASE_URL` is already set by the PostgreSQL plugin — do not override it.

---

## Step 5 — Deploy the app

```bash
railway up
```

Or connect your GitHub repo in the Railway dashboard for automatic deploys on push to `main`:

1. In your service settings, click **"Connect Repo"**
2. Select your repository and branch (`main`)
3. Railway will redeploy on every push

The `postinstall` script (`prisma generate`) runs automatically during each Railway build.

---

## Step 6 — Set up the cleanup cron

The `/api/cleanup` endpoint deletes listings older than 3 days and orphaned scrape locks. It needs to be called on a schedule.

### Option A — Railway Cron Service (recommended)

1. In your Railway project, click **"+ New"** → **"Empty Service"**
2. Name it `cron-cleanup`
3. Go to the service settings → **"Deploy"** tab → set the **Start Command**:

```bash
curl -s -X POST $APP_URL/api/cleanup -H "Authorization: Bearer $CRON_SECRET"
```

4. Go to the **"Cron"** tab and set the schedule: `0 2 * * *` (daily at 2 AM UTC)
5. Add environment variables to this service:

| Variable | Value |
|---|---|
| `APP_URL` | Your app's Railway URL, e.g. `https://easieravenue.up.railway.app` |
| `CRON_SECRET` | Same value as in Step 4 |

### Option B — External cron (e.g. cron-job.org)

Create a free cron job at [cron-job.org](https://cron-job.org):
- URL: `https://your-app.up.railway.app/api/cleanup`
- Method: `POST`
- Header: `Authorization: Bearer <your-cron-secret>`
- Schedule: daily at 2:00 AM

---

## Step 7 — Verify the deployment

1. Visit your Railway app URL — the home page should load
2. Search a neighborhood — should scrape live and cache results in PostgreSQL
3. Search the same neighborhood again — should return from cache instantly
4. Test the cleanup endpoint manually:

```bash
curl -X POST https://your-app.up.railway.app/api/cleanup \
  -H "Authorization: Bearer <your-cron-secret>"
# Expected: {"deletedApartments":0,"deletedLocks":0}
```

---

## Environment variable reference

| Variable | Required | Set by | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | Railway PostgreSQL plugin | PostgreSQL connection string |
| `CRON_SECRET` | Yes | You | Authenticates `/api/cleanup` requests |

---

## Subsequent deploys

```bash
git push origin main   # triggers auto-deploy if GitHub connected
# or
railway up             # manual deploy from CLI
```

If you change `prisma/schema.prisma`, create a migration before deploying:

```bash
railway run npx prisma migrate dev --name describe_your_change
git add prisma/migrations
git commit -m "chore: prisma migration — describe_your_change"
git push
```

Railway applies pending migrations automatically via `prisma migrate deploy`, which you should add to your build command or a pre-deploy hook once you have multiple migrations to manage.

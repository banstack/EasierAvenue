# Productionizing EasierAvenue — Persistent Shared Storage

## The Problem with the Current Setup

Right now the app uses **SQLite (file-based, single-process)**. This breaks down in production in several ways:

| Problem | Impact |
|---|---|
| File lives on the server's ephemeral disk | Railway redeploys wipe it |
| Single file — no concurrent writes | Two simultaneous scrapes corrupt the DB |
| Cache is per-instance | Two Railway replicas = two separate caches |
| One user's 30-min cache affects everyone | User A searches Williamsburg at 9:00, User B gets stale data until 9:30 |
| No true TTL management | Old listings linger, no cleanup |

---

## PostgreSQL vs Redis

### Redis — why it seems appealing but isn't the right fit

Redis is fast and has native TTL per key. But the data model breaks down:

- Every `SELECT * FROM apartments WHERE neighborhood = ? AND price_num BETWEEN ? AND ? AND bedrooms = ?` becomes "load all JSON blobs for this neighborhood, deserialize 300 objects, filter in application code."
- There's no `ORDER BY score DESC` — you'd maintain a sorted set manually.
- `neighborhood_stats` is relational data with joins — it doesn't map to key-value.
- Redis persistence (RDB/AOF) requires careful configuration; data loss on restart without it.
- You'd be rebuilding a relational database on top of a key-value store.

**Redis is the right tool for: session caching, rate limiting, pub/sub, job queues.** It's not the right tool for filtering 300-row result sets with 5 dimensions.

### PostgreSQL — the right choice

- **Direct schema migration**: the current SQLite schema maps 1:1 to PostgreSQL. Column types change slightly (`REAL` → `DOUBLE PRECISION`, `INTEGER` → `BIGINT`, `unixepoch()` → `NOW()`), but no structural changes.
- **Shared across all Railway instances** — every user and every replica queries the same database.
- **Railway-managed PostgreSQL** — one click to provision, automatic backups, connection string injected as `DATABASE_URL`.
- **All existing queries work** — `WHERE neighborhood = ?`, `ORDER BY score DESC NULLS LAST`, `CAST(REPLACE(...))` — all valid PostgreSQL.
- **Advisory locks** available for preventing duplicate concurrent scrapes (see below).
- **`pg_cron`** or an external Railway cron can handle weekly cleanup.

**Recommendation: PostgreSQL as the only data store.** Redis can be added later as a hot cache in front of PostgreSQL if query latency becomes a concern — but it won't be needed at early scale.

---

## Schema Changes

### New columns

```sql
-- Replace single cached_at with two timestamps
first_seen_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()   -- set on INSERT, never updated
last_seen_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()   -- updated on every upsert (replaces cached_at)
```

**Why two timestamps:**
- `first_seen_at` = when we first discovered this listing. Useful for "new listings" badge.
- `last_seen_at` = last time a scrape confirmed this listing still exists. This is the TTL field — delete when not seen for 7 days.

`cached_at` (current, integer unix) is replaced by these two proper `TIMESTAMPTZ` columns.

### Full PostgreSQL schema

```sql
CREATE TABLE apartments (
  id                  TEXT        PRIMARY KEY,
  title               TEXT        NOT NULL,
  price               TEXT        NOT NULL,
  price_num           BIGINT,
  address             TEXT,
  neighborhood        TEXT,
  url                 TEXT        NOT NULL,
  bedrooms            TEXT,
  bathrooms           TEXT,
  sqft                TEXT,
  sqft_num            BIGINT,
  image_url           TEXT,
  score               DOUBLE PRECISION,
  lat                 DOUBLE PRECISION,
  lng                 DOUBLE PRECISION,
  transit_score       DOUBLE PRECISION,
  net_effective_price BIGINT,
  months_free         DOUBLE PRECISION,
  lease_term          TEXT,
  price_reduction     BIGINT,
  first_seen_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_neighborhood  ON apartments(neighborhood);
CREATE INDEX idx_last_seen_at  ON apartments(last_seen_at);
CREATE INDEX idx_first_seen_at ON apartments(first_seen_at);

CREATE TABLE neighborhood_stats (
  neighborhood        TEXT        PRIMARY KEY,
  median_price        BIGINT      NOT NULL,
  avg_price_per_sqft  DOUBLE PRECISION,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Cache freshness logic change

Currently: `WHERE cached_at > unixepoch() - 1800` (30 min TTL).

With PostgreSQL: `WHERE last_seen_at > NOW() - INTERVAL '30 minutes'`

The 30-minute scrape cache stays. The 7-day data retention is separate and handled by the cron job.

---

## Concurrent Scraping Problem

This is the new multi-user issue SQLite never had to solve. Two users request "williamsburg" at the exact same moment — both find no fresh cache — both trigger a scrape in parallel. Result: two 60-second scrapes, duplicate listings written, wasted StreetEasy requests.

### Solution: scrape_locks table

```sql
CREATE TABLE scrape_locks (
  neighborhood  TEXT      PRIMARY KEY,
  locked_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Flow in `route.ts`:**

```
1. Try: INSERT INTO scrape_locks (neighborhood) VALUES ($1)
         ON CONFLICT DO NOTHING
         RETURNING neighborhood

2. If INSERT returned a row → this request holds the lock → proceed to scrape
   If INSERT returned nothing → another request is already scraping this neighborhood

3. On conflict: poll for fresh cache every 2s (max 90s), then serve whatever exists
   (avoids hanging the second user's request indefinitely)

4. After scrape completes (success or failure) → DELETE FROM scrape_locks WHERE neighborhood = $1

5. Safety net: cron job also clears locks older than 5 minutes (handles crashed scrapes)
```

This is a lightweight advisory lock using the database itself — no Redis required.

---

## Cron Job on Railway

### What it does

Runs daily at 2 AM:
1. `DELETE FROM apartments WHERE last_seen_at < NOW() - INTERVAL '7 days'` — removes stale listings
2. `DELETE FROM scrape_locks WHERE locked_at < NOW() - INTERVAL '5 minutes'` — clears orphaned locks
3. Optionally: `DELETE FROM neighborhood_stats WHERE updated_at < NOW() - INTERVAL '30 days'`

### Implementation

**Protected API route** `/api/cleanup` (Next.js route handler):

```ts
// Verify Authorization: Bearer $CRON_SECRET
// Run DELETE queries
// Return { deletedApartments: N, deletedLocks: M }
```

**Railway Cron Service** (separate service in same project):
- Schedule: `0 2 * * *`
- Command: `curl -s -X POST $APP_URL/api/cleanup -H "Authorization: Bearer $CRON_SECRET"`
- Env vars: `APP_URL`, `CRON_SECRET`

Alternatively, **Railway's built-in cron** (if on a plan that supports it) can call the route directly without a separate service.

---

## Implementation Plan

### Phase 1 — PostgreSQL migration (core)

| Step | File(s) | Change |
|---|---|---|
| Add `pg` package | `package.json` | `npm install pg @types/pg` |
| Rewrite `lib/db.ts` | `lib/db.ts` | Replace `better-sqlite3` with `pg` Pool; rewrite all queries to PostgreSQL syntax |
| Update `Apartment` interface | `lib/db.ts` | `cached_at: number` → `first_seen_at: string; last_seen_at: string` |
| Update `saveApartments` | `lib/db.ts` | `INSERT ... ON CONFLICT (id) DO UPDATE SET last_seen_at = NOW(), ...` (preserve `first_seen_at`) |
| Update cache freshness check | `lib/db.ts` | Change `unixepoch()` arithmetic to `NOW() - INTERVAL '30 minutes'` |
| Environment variable | Railway | Set `DATABASE_URL` from Railway PostgreSQL plugin |
| Remove `better-sqlite3` | `package.json` | Drop dev + runtime dependency |

### Phase 2 — Concurrency guard

| Step | File(s) | Change |
|---|---|---|
| Add `scrape_locks` table | `lib/db.ts` | Create table in schema init |
| Lock acquisition | `app/api/search/route.ts` | Try-insert before scraping; poll on conflict |
| Lock release | `app/api/search/route.ts` | Delete lock in finally block |
| Stale lock cleanup | `/api/cleanup` | Include in daily cron |

### Phase 3 — Cleanup cron

| Step | File(s) | Change |
|---|---|---|
| Create cleanup route | `app/api/cleanup/route.ts` | DELETE queries + CRON_SECRET auth |
| Railway Cron Service | Railway dashboard | Schedule `0 2 * * *`, set env vars |

---

## What Changes in `lib/db.ts`

The public API (`getCachedApartments`, `saveApartments`, `getNeighborhoodStats`, `upsertNeighborhoodStats`) stays identical — the rest of the app doesn't change. Only the internals swap from `better-sqlite3` sync calls to `pg` async calls.

This means `route.ts` currently calls `getCachedApartments` synchronously. It'll need `await`. That's the only ripple into other files.

---

## What We're NOT Changing

- Scraper logic (`lib/scraper.ts`) — untouched
- Scoring (`lib/rating.ts`, `lib/transit.ts`) — untouched
- All UI components — untouched
- Search API shape — untouched (same SSE streaming)
- `neighborhood_stats` data (hardcoded medians) — untouched

---

## Open Questions to Decide Together

1. **ORM or raw SQL?** Raw `pg` keeps the existing code style and is minimal friction. Drizzle or Prisma adds type-safe migrations but more setup. Given the schema is simple and stable, raw `pg` is probably fine.

2. **Connection pooling:** PgBouncer (Railway add-on) vs `pg.Pool` (built into the app). For a Next.js app on Railway, `pg.Pool` with a pool size of 5–10 is sufficient to start.

3. **TTL duration:** 7 days proposed. Does that feel right? NYC listings move fast — a listing that's been sitting for a week might already be gone. Could argue for 3–4 days.

4. **Data migration:** Do we care about migrating the existing ~1,000 SQLite rows to PostgreSQL, or do we start fresh and let the app re-scrape on demand?

5. **`first_seen_at` in the UI:** The "New listing" indicator currently uses `days_on_market` from StreetEasy (which we can't reliably scrape). Should we show a "First seen X days ago" badge using `first_seen_at`? It's not the same thing but is available for free.

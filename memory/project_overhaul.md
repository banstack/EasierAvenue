---
name: EasierAvenue overhaul
description: Full rewrite from Flask/Python to Next.js 14 + TypeScript + shadcn/ui — architecture, stack decisions, and status
type: project
---

Overhauling "StreetEasy Finder" to "EasierAvenue" — a Next.js 14 (App Router) app replacing the original Flask/Python stack.

**Why:** Requirements v2.0 in CLAUDE.md — modern UI, prompt creator UX, DB caching, affordability rating.

**Stack:**
- Next.js 16.2 + TypeScript, App Router, standalone output
- shadcn/ui + Tailwind v4 — dark mode by default (`.dark` on `<html>`), blue accent theme (primary: oklch ~0.607 0.22 255)
- better-sqlite3 for SQLite, stored at `/data/apartments.db` (Railway persistent volume)
- cheerio for TypeScript scraper (ported from Python/BeautifulSoup)

**Key files:**
- `lib/db.ts` — SQLite connection, schema, cache queries (10-min TTL)
- `lib/scraper.ts` — StreetEasy scraper with retry + user-agent rotation
- `lib/rating.ts` — 1-10 affordability score (price vs neighborhood median, $/sqft)
- `data/neighborhoods.ts` — hardcoded NYC neighborhoods + median rents + URL builder
- `app/api/search/route.ts` — POST endpoint: cache-first, then live scrape
- `components/PromptCreator.tsx` — fill-in-the-blank home page
- `app/results/ResultsClient.tsx` — results grid + pagination (20/page)
- `Dockerfile` — multi-stage Node 20 Alpine build
- `railway.json` — Railway deployment with `/data` persistent volume mount

**How to apply:** Reference this for any future work on EasierAvenue — the Python files (apartment_tracker.py, app.py) are legacy and should not be modified.

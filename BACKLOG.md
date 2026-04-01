# Backlog

## `first_seen_at` in the UI

**What:** Show a "First seen X days ago" badge on listing cards or in the modal.

**Why:** `first_seen_at` is now tracked on every listing (set on INSERT, never updated). It's not the same as StreetEasy's "days on market" (which we can't scrape from card HTML), but it tells users how long ago EasierAvenue first discovered this listing — useful signal for how fresh a result is.

**Design options:**
- Badge on card: `"New"` if first_seen_at < 24h ago, otherwise omit
- Modal tile: `"First seen 3 days ago"` using relative time formatting
- Results sort: "Sort by newest to us" using `first_seen_at DESC`

**Notes:**
- `first_seen_at` is set to `NOW()` on the initial INSERT and is never overwritten by subsequent upserts
- All listings created before this feature ships will have `first_seen_at` equal to their `last_seen_at`

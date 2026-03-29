# StreetEasy Listing Card — Scraping Analysis

Fetched: `https://streeteasy.com/for-rent/nyc/williamsburg` (14 cards)
Date: 2026-03-29

---

## What IS available in card HTML

These fields can be reliably scraped from search result pages without hitting individual listing URLs.

| Field | Selector | Example |
|---|---|---|
| **Base rent** | `.PriceInfo-module__price___pKybg` | `$4,250` |
| **Net effective rent** | `.PriceInfo-module__priceDetailsContainer___cegQf` | `$3,946 net effective base rent` |
| **Concessions** | Same element as net effective | `0.93 months free · 13-month lease` |
| **Price reduction tag** | `[data-testid="tag-text"]` (when $ amount) | `$122` (monthly discount) |
| **Listing type** | `.ListingDescription-module__title___B9n4Z` | `Rental unit`, `New Development`, `Condo`, `Two-family home` |
| **Address** | `.ListingDescription-module__addressTextAction___xAFZJ` | `54 Maujer Street #14B` |
| **Neighborhood** | Same title element | `in Williamsburg` (appended to type) |
| **Beds / baths / sqft** | `.BedsBathsSqft-module__text___lnveO` | `2 beds`, `1 bath`, `1,045 ft²` |
| **Open house date/time** | `[data-testid="open-house-tag"]` | `Open: Mar 29 (12–2 PM)` |
| **Broker/agent name** | Plain text: `Listing by <Name>` | `Listing by Urban Choice LLC` |
| **Media tags** | `[data-testid="tag-text"]` (non-$ values) | `Featured`, `Video`, `3D Tour` |
| **Listing URL** | `a[href*="/rental/"]` or `a[href*="/building/"]` | `https://streeteasy.com/building/...` |
| **Image URL** | `img` src/srcset | CDN image URL |

---

## What is NOT in card HTML

These fields **do not appear** in search result card HTML — they require fetching each individual listing page.

| Field | Notes |
|---|---|
| **Available / move-in date** | Absent from all 14 cards. Detail page only. |
| **Days on market** | Absent from all 14 cards. Detail page only. |
| **Amenities** | Not rendered in card. Detail page only. |
| **No-fee indicator** | Not present. |
| **Floor plan / layout details** | Detail page only. |
| **Pet policy** | Detail page only. |

---

## New fields we could scrape (not currently captured)

### 1. Net effective rent + concessions
Cards with rent concessions expose a second price row:
```
$3,946 net effective base rent · 0.93 months free · 13-month lease
```
Selector: `.PriceInfo-module__priceDetailsContainer___cegQf`
Could store: `net_effective_price`, `months_free`, `lease_term_months`

### 2. Open house
`[data-testid="open-house-tag"]` → `"Open: Mar 29 (12–2 PM)"`
Present on ~8 of 14 cards today. Parseable to a date + time range.

### 3. Price reduction tag
When a listing has a price drop, a tag like `$122` appears next to the price.
Selector: `[data-testid="tag-text"]` when the value starts with `$`
Distinct from the media tags (`Video`, `Featured`, `3D Tour`) which use the same selector.

### 4. Listing type
`.ListingDescription-module__title___B9n4Z` contains both the type and the neighborhood:
`"New Development · Rental unit in Boerum Hill"` — first part is the type badge.

---

## Conclusion on available_date

**Available / move-in date is not in card HTML.** It does not appear in any of the 14 cards scraped.

To get it we would need to scrape individual listing detail pages (one HTTP request per listing). Given a typical search returns 100–300 listings, that would mean 100–300 extra requests — significantly slower and more likely to trigger rate limiting.

**Options:**
1. **Drop move-in sort** — data coverage is 0%, sort is meaningless
2. **Lazy enrichment** — fetch the detail page when a user opens a modal, show move-in date there
3. **Accept partial coverage** — keep the sort, acknowledge most listings will show "Unknown"

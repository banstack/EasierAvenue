import * as cheerio from "cheerio";
import crypto from "crypto";

export interface ScrapedListing {
  id: string;
  title: string;
  price: string;
  price_num: number | null;
  address: string | null;
  neighborhood: string;
  url: string;
  bedrooms: string | null;
  bathrooms: string | null;
  sqft: string | null;
  sqft_num: number | null;
  image_url: string | null;
  net_effective_price: number | null;
  months_free: number | null;
  lease_term: string | null;
  price_reduction: number | null;
}

export interface ScrapeResult {
  listings: ScrapedListing[];
  seTotal: number | null; // total count reported by StreetEasy
  pagesScraped: number;
}

const USER_AGENTS = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0",
];

const DEFAULT_MAX_PAGES = 15;

// Minimum gap between any two outbound StreetEasy requests, globally across
// all concurrent scrapes. Serializes all HTTP calls through a single chain so
// no two requests ever fire simultaneously, regardless of how many neighborhood
// scrapes are running in parallel.
const MIN_REQUEST_INTERVAL_MS = 1500;

let rateLimitChain: Promise<void> = Promise.resolve();
let lastRequestAt = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function buildFetchUrl(url: string): string {
  const apiKey = process.env.SCRAPER_API_KEY;
  if (!apiKey) return url;
  return `http://api.scraperapi.com?api_key=${apiKey}&url=${encodeURIComponent(url)}&render=false`;
}

async function fetchPage(url: string, maxRetries = 3): Promise<string> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (attempt > 0) {
      await sleep(2000 + Math.random() * 2000);
    }

    const fetchUrl = buildFetchUrl(url);
    const ua = randomUserAgent();
    const isChrome = ua.includes("Chrome") && !ua.includes("Edg");
    const res = await fetch(fetchUrl, {
      headers: {
        "User-Agent": ua,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "max-age=0",
        Connection: "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        Referer: "https://www.google.com/",
        "sec-fetch-dest": "document",
        "sec-fetch-mode": "navigate",
        "sec-fetch-site": "cross-site",
        "sec-fetch-user": "?1",
        ...(isChrome && {
          "sec-ch-ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
          "sec-ch-ua-mobile": "?0",
          "sec-ch-ua-platform": ua.includes("Windows") ? '"Windows"' : '"macOS"',
        }),
      },
    });

    if (res.ok) return res.text();
    if (res.status === 403 && attempt < maxRetries - 1) continue;

    throw new Error(`HTTP ${res.status} fetching ${url}`);
  }

  throw new Error(`Failed to fetch ${url} after ${maxRetries} attempts`);
}

/**
 * Rate-limited fetch — serializes all outbound StreetEasy requests through a
 * single global queue, enforcing at least MIN_REQUEST_INTERVAL_MS between each
 * request. Safe to call from multiple concurrent scrapes.
 */
function fetchWithRetry(url: string): Promise<string> {
  const result = rateLimitChain.then(async () => {
    const wait = Math.max(0, lastRequestAt + MIN_REQUEST_INTERVAL_MS - Date.now());
    if (wait > 0) await sleep(wait);
    lastRequestAt = Date.now();
    return fetchPage(url);
  });

  // Advance the chain; swallow errors so a failed request doesn't stall the queue
  rateLimitChain = result.then(() => {}, () => {});

  return result;
}

/** Build a paginated StreetEasy URL. Page 1 has no query param. */
function pageUrl(baseUrl: string, page: number): string {
  if (page <= 1) return baseUrl;
  const sep = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${sep}page=${page}`;
}

function generateId(title: string, address: string | null, price: string, url: string): string {
  return crypto
    .createHash("md5")
    .update(`${title}_${address ?? ""}_${price}_${url}`)
    .digest("hex");
}

function parsePrice(raw: string): number | null {
  const match = raw.match(/[\d,]+/);
  if (!match) return null;
  return parseInt(match[0].replace(/,/g, ""), 10);
}

function parseSqft(raw: string): number | null {
  const match = raw.replace(/,/g, "").match(/(\d+)/);
  if (!match) return null;
  return parseInt(match[1], 10);
}

/**
 * Try to extract StreetEasy's reported total listing count from the page HTML.
 * They render something like "572 rentals" in multiple possible locations.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractSeTotal($: any): number | null {
  // Try common data-testid selectors first
  const candidates = [
    $('[data-testid="listings-count"]').text(),
    $('[data-testid="search-results-count"]').text(),
    $('[class*="resultsCount"]').first().text(),
    $('[class*="listingsCount"]').first().text(),
    $('[class*="ResultsCount"]').first().text(),
    $("h1").first().text(),
    $("h2").first().text(),
  ];

  for (const text of candidates) {
    if (!text) continue;
    const match = text.match(/([\d,]+)\s*(rental|listing|apartment|home)/i);
    if (match) {
      return parseInt(match[1].replace(/,/g, ""), 10);
    }
  }

  // Fallback: scan the full page text for "N rentals" pattern
  const bodyText = $("body").text();
  const fallback = bodyText.match(/([\d,]+)\s+rentals?\s+for\s+rent/i);
  if (fallback) return parseInt(fallback[1].replace(/,/g, ""), 10);

  return null;
}

/** Parse all listing cards from a loaded cheerio document. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseCards($: any, neighborhood: string): ScrapedListing[] {
  const listings: ScrapedListing[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  $('[data-testid="listing-card"]').each((_: any, card: any) => {
    try {
      const $card = $(card);

      // URL
      let listingUrl =
        $card.find("a.ImageContainer-module__listingLink___sYIL9").attr("href") ||
        $card.find('a[href*="/rental/"]').attr("href") ||
        $card.find('a[href*="/building/"]').attr("href") ||
        "";
      if (listingUrl && !listingUrl.startsWith("http")) {
        listingUrl = `https://streeteasy.com${listingUrl}`;
      }
      if (!listingUrl) return;

      // Image + title from alt text
      const $img =
        $card.find("img.CardImage-module__cardImage__cirIn").first().length
          ? $card.find("img.CardImage-module__cardImage__cirIn").first()
          : $card.find("img").first();

      let title = "N/A";
      let imageUrl: string | null = null;

      if ($img.length) {
        const alt = $img.attr("alt") || "";
        if (alt) {
          title = alt.includes("image") ? alt.split("image")[0].trim() : alt.trim();
        }

        // Try attributes in priority order, skipping base64 placeholders
        const srcCandidates = [
          $img.attr("src"),
          $img.attr("data-src"),
          $img.attr("data-lazy-src"),
          $img.attr("data-lazy"),
          // srcset: take the first URL (lowest resolution is fine for cards)
          ($img.attr("srcset") || "").split(",")[0]?.trim().split(" ")[0],
        ];
        for (const candidate of srcCandidates) {
          if (candidate && !candidate.startsWith("data:")) {
            imageUrl = candidate.startsWith("http")
              ? candidate
              : `https://streeteasy.com${candidate}`;
            break;
          }
        }
      }

      if (title === "N/A") {
        for (const sel of [
          '[data-testid="listing-title"]',
          '[class*="address"]',
          '[class*="title"]',
          "h3",
          "h2",
        ]) {
          const text = $card.find(sel).first().text().trim();
          if (text) { title = text; break; }
        }
      }

      if (title === "N/A") return;

      // Price
      let price = "N/A";
      for (const sel of [
        ".PriceInfo-module__priceText___Ej9Ej",
        '[data-testid="price"]',
        '[class*="price"]',
        '[class*="Price"]',
      ]) {
        const raw = $card.find(sel).first().text().trim();
        if (raw) {
          const match = raw.match(/\$[\d,]+/);
          if (match) { price = match[0]; break; }
        }
      }

      // Address
      let address: string | null = null;
      const addressKeywords = ["street", "avenue", "road", "place", "drive", "blvd", "lane", "st ", "ave "];
      if (addressKeywords.some((kw) => title.toLowerCase().includes(kw))) {
        const parts = title.split(" ");
        if (parts.length >= 3) address = parts.slice(0, -1).join(" ");
      }

      // Beds / baths / sqft
      let bedrooms: string | null = null;
      let bathrooms: string | null = null;
      let sqft: string | null = null;

      const $bedsBaths = $card.find(".BedsBathsSqft-module__bedsBathsSqft___QFOK-");
      if ($bedsBaths.length) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        $bedsBaths.find(".BedsBathsSqft-module__text___lnveO").each((_: any, el: any) => {
          const text = $(el).text().trim().toLowerCase();
          if (text.includes("bed") || text.includes("studio")) bedrooms = $(el).text().trim();
          else if (text.includes("bath")) bathrooms = $(el).text().trim();
          else if (text.includes("ft²") || text.includes("sqft")) sqft = $(el).text().trim();
        });
      }

      if (!bedrooms) {
        const t = $card.find('[data-testid="beds"]').first().text().trim();
        if (t) bedrooms = t;
      }
      if (!bathrooms) {
        const t = $card.find('[data-testid="baths"]').first().text().trim();
        if (t) bathrooms = t;
      }

      // Concessions / net effective rent
      let net_effective_price: number | null = null;
      let months_free: number | null = null;
      let lease_term: string | null = null;

      const $concessions = $card.find(".PriceInfo-module__priceDetailsContainer___cegQf");
      if ($concessions.length) {
        const text = $concessions.text();
        const netMatch = text.match(/\$([\d,]+)\s+net\s+effective/i);
        if (netMatch) net_effective_price = parseInt(netMatch[1].replace(/,/g, ""), 10);
        const monthsMatch = text.match(/([\d.]+)\s+months?\s+free/i);
        if (monthsMatch) months_free = parseFloat(monthsMatch[1]);
        const leaseMatch = text.match(/(\d+)-month\s+lease/i);
        if (leaseMatch) lease_term = `${leaseMatch[1]}-month lease`;
      }

      // Price reduction tag (down-arrow icon + $ amount next to price)
      let price_reduction: number | null = null;
      $card.find(".PriceInfo-module__priceInfoTag___pVv0Z [data-testid=\"tag-text\"]").each((_: unknown, el: unknown) => {
        const text = $(el as Parameters<typeof $>[0]).text().trim();
        const match = text.match(/^\$([\d,]+)$/);
        if (match) { price_reduction = parseInt(match[1].replace(/,/g, ""), 10); return false; }
      });

      listings.push({
        id: generateId(title, address, price, listingUrl),
        title,
        price,
        price_num: price !== "N/A" ? parsePrice(price) : null,
        address,
        neighborhood,
        url: listingUrl,
        bedrooms,
        bathrooms,
        sqft,
        sqft_num: sqft ? parseSqft(sqft) : null,
        image_url: imageUrl,
        net_effective_price,
        months_free,
        lease_term,
        price_reduction,
      });
    } catch {
      // skip malformed card
    }
  });

  return listings;
}

export type OnPageCallback = (
  pageNum: number,
  totalPages: number,
  listings: ScrapedListing[]
) => void;

export async function scrapeListings(
  baseUrl: string,
  neighborhood: string,
  maxPages = DEFAULT_MAX_PAGES,
  onPage?: OnPageCallback
): Promise<ScrapeResult> {
  // --- Page 1 ---
  const html1 = await fetchWithRetry(pageUrl(baseUrl, 1));
  const $1 = cheerio.load(html1);

  const seTotal = extractSeTotal($1);
  const page1Listings = parseCards($1, neighborhood);

  if (page1Listings.length === 0) {
    console.warn(`No listing cards found on page 1 for ${baseUrl}`);
    return { listings: [], seTotal, pagesScraped: 1 };
  }

  const listingsPerPage = page1Listings.length;

  // Calculate how many pages we actually need (cap at maxPages)
  const totalPages = seTotal
    ? Math.min(maxPages, Math.ceil(seTotal / listingsPerPage))
    : maxPages;

  // Fire callback for page 1 immediately — callers can stream this before continuing
  onPage?.(1, totalPages, page1Listings);

  if (totalPages <= 1) {
    return { listings: page1Listings, seTotal, pagesScraped: 1 };
  }

  console.log(
    `Scraping ${totalPages} pages for ${neighborhood} (SE reports ${seTotal ?? "unknown"} total)`
  );

  // Collect all listings, dedupe by ID
  const seen = new Set<string>(page1Listings.map((l) => l.id));
  const allListings: ScrapedListing[] = [...page1Listings];

  // --- Pages 2..N ---
  for (let pageNum = 2; pageNum <= totalPages; pageNum++) {
    let html: string;
    try {
      html = await fetchWithRetry(pageUrl(baseUrl, pageNum));
    } catch (err) {
      // A 403 mid-scrape is common — stop gracefully rather than erroring
      console.warn(`Page ${pageNum} failed, stopping early:`, err);
      break;
    }

    const $ = cheerio.load(html);
    const pageListings = parseCards($, neighborhood);

    if (pageListings.length === 0) {
      // Empty page — StreetEasy likely has no more results
      console.log(`Page ${pageNum} returned 0 cards — stopping`);
      break;
    }

    const newListings: ScrapedListing[] = [];
    for (const listing of pageListings) {
      if (!seen.has(listing.id)) {
        seen.add(listing.id);
        allListings.push(listing);
        newListings.push(listing);
      }
    }

    onPage?.(pageNum, totalPages, newListings);

    console.log(
      `Page ${pageNum}/${totalPages}: +${pageListings.length} listings (${allListings.length} total)`
    );
  }

  return {
    listings: allListings,
    seTotal,
    pagesScraped: Math.min(totalPages, allListings.length > 0 ? totalPages : 1),
  };
}

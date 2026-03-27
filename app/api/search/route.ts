import { NextRequest, NextResponse } from "next/server";
import { getCachedApartments, saveApartments } from "@/lib/db";
import { scrapeListings } from "@/lib/scraper";
import { scoreBatch } from "@/lib/rating";
import { buildStreetEasyUrl } from "@/data/neighborhoods";

// Allow up to 60s — paginated scraping of 15 pages takes ~25–30s
export const maxDuration = 60;

export interface SearchParams {
  neighborhood: string;
  beds?: string;
  baths?: string;
  minPrice?: number;
  maxPrice?: number;
  page?: number;
}

export async function POST(req: NextRequest) {
  try {
    const body: SearchParams = await req.json();
    const { neighborhood, beds, baths, minPrice, maxPrice, page = 1 } = body;

    if (!neighborhood) {
      return NextResponse.json({ error: "neighborhood is required" }, { status: 400 });
    }

    const PAGE_SIZE = 20;

    // Try cache first
    const cached = getCachedApartments({
      neighborhood,
      beds,
      baths,
      minPrice,
      maxPrice,
      page,
      pageSize: PAGE_SIZE,
    });

    if (cached.fromCache && cached.apartments.length > 0) {
      return NextResponse.json({
        apartments: cached.apartments,
        total: cached.total,
        page,
        pageSize: PAGE_SIZE,
        totalPages: Math.ceil(cached.total / PAGE_SIZE),
        fromCache: true,
      });
    }

    // Cache miss — scrape live (all pages)
    const url = buildStreetEasyUrl({ neighborhood, beds, minPrice, maxPrice });

    let scrapeResult;
    try {
      scrapeResult = await scrapeListings(url, neighborhood);
    } catch (err) {
      console.error("Scrape failed:", err);
      if (cached.apartments.length > 0) {
        return NextResponse.json({
          apartments: cached.apartments,
          total: cached.total,
          page,
          pageSize: PAGE_SIZE,
          totalPages: Math.ceil(cached.total / PAGE_SIZE),
          fromCache: true,
          stale: true,
        });
      }
      return NextResponse.json(
        { error: "Failed to fetch listings. StreetEasy may be rate limiting — try again shortly." },
        { status: 503 }
      );
    }

    const { listings: scraped, seTotal, pagesScraped } = scrapeResult;

    if (scraped.length === 0) {
      return NextResponse.json({
        apartments: [],
        total: 0,
        page: 1,
        pageSize: PAGE_SIZE,
        totalPages: 0,
        fromCache: false,
        seTotal,
        pagesScraped,
      });
    }

    // Score and persist
    const scored = scoreBatch(scraped);
    const now = Math.floor(Date.now() / 1000);
    saveApartments(scored.map((apt) => ({ ...apt, cached_at: now })));

    // Re-query with filters applied
    const fresh = getCachedApartments({
      neighborhood,
      beds,
      baths,
      minPrice,
      maxPrice,
      page,
      pageSize: PAGE_SIZE,
    });

    return NextResponse.json({
      apartments: fresh.apartments,
      total: fresh.total,
      page,
      pageSize: PAGE_SIZE,
      totalPages: Math.ceil(fresh.total / PAGE_SIZE),
      fromCache: false,
      seTotal,
      pagesScraped,
    });
  } catch (err) {
    console.error("Search error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

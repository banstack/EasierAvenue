import { NextRequest } from "next/server";
import { getCachedApartments, saveApartments } from "@/lib/db";
import { scrapeListings, type ScrapedListing } from "@/lib/scraper";
import { scoreBatch } from "@/lib/rating";
import { buildStreetEasyUrl } from "@/data/neighborhoods";

export const maxDuration = 60;

export interface SearchParams {
  neighborhood: string;
  beds?: string;
  baths?: string;
  minPrice?: number;
  maxPrice?: number;
}

const encoder = new TextEncoder();

function sse(data: object): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
}

function toApartmentShape(listings: ScrapedListing[], score: (number | null)[]) {
  const now = Math.floor(Date.now() / 1000);
  return listings.map((apt, i) => ({ ...apt, score: score[i], cached_at: now }));
}

export async function POST(req: NextRequest) {
  let body: SearchParams;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { neighborhood, beds, baths, minPrice, maxPrice } = body;

  if (!neighborhood) {
    return new Response(JSON.stringify({ error: "neighborhood is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- Cache hit: return plain JSON with all apartments ---
  const cached = getCachedApartments({ neighborhood, beds, baths, minPrice, maxPrice });

  if (cached.fromCache && cached.apartments.length > 0) {
    return new Response(
      JSON.stringify({
        type: "complete",
        apartments: cached.apartments,
        total: cached.apartments.length,
        fromCache: true,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  // --- Cache miss: stream SSE ---
  const url = buildStreetEasyUrl({ neighborhood, beds, minPrice, maxPrice });
  const allScraped: ScrapedListing[] = [];

  const stream = new ReadableStream({
    async start(controller) {
      try {
        await scrapeListings(url, neighborhood, 15, (pageNum, totalPages, pageListings) => {
          allScraped.push(...pageListings);

          if (pageNum === 1) {
            // Score page 1 and send immediately so the UI can render
            const scored = scoreBatch(pageListings);
            const apartments = toApartmentShape(pageListings, scored.map((s) => s.score));
            controller.enqueue(sse({ type: "initial", apartments, totalPages }));
          } else {
            controller.enqueue(
              sse({ type: "progress", page: pageNum, totalPages, count: allScraped.length })
            );
          }
        });
      } catch (err) {
        console.error("Scrape error:", err);
        // Stale cache fallback
        const stale = getCachedApartments({ neighborhood, beds, baths, minPrice, maxPrice });
        if (stale.apartments.length > 0) {
          controller.enqueue(
            sse({
              type: "complete",
              apartments: stale.apartments,
              total: stale.apartments.length,
              fromCache: true,
              stale: true,
            })
          );
        } else {
          controller.enqueue(
            sse({ type: "error", message: "Failed to fetch listings. Try again shortly." })
          );
        }
        controller.close();
        return;
      }

      // Score + persist all scraped listings
      const scored = scoreBatch(allScraped);
      const now = Math.floor(Date.now() / 1000);
      saveApartments(scored.map((apt) => ({ ...apt, cached_at: now })));

      // Return all results from DB
      const fresh = getCachedApartments({ neighborhood, beds, baths, minPrice, maxPrice });

      controller.enqueue(
        sse({
          type: "complete",
          apartments: fresh.apartments,
          total: fresh.apartments.length,
          fromCache: false,
          scrapedCount: allScraped.length,
        })
      );
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

import { NextRequest } from "next/server";
import { getCachedApartments, saveApartments } from "@/lib/db";
import { scrapeListings, type ScrapedListing } from "@/lib/scraper";
import { scoreBatch } from "@/lib/rating";
import { buildStreetEasyUrl } from "@/data/neighborhoods";
import { batchGeocode } from "@/lib/geocode";
import { getTransitBreakdown } from "@/lib/transit";

export const maxDuration = 60;

export interface SearchParams {
  neighborhood: string;
  beds?: string;
  baths?: string;
  minPrice?: number;
  maxPrice?: number;
  force?: boolean;
}

const encoder = new TextEncoder();

function sse(data: object): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
}

function toApartmentShape(listings: ScrapedListing[], score: (number | null)[]) {
  const now = Math.floor(Date.now() / 1000);
  return listings.map((apt, i) => ({
    ...apt,
    score: score[i],
    lat: null,
    lng: null,
    transit_score: null,
    cached_at: now,
  }));
}

/**
 * Batch-geocode all listings in a single Census API call, then attach
 * lat/lng/transit_score to each listing. Listings that fail to geocode
 * keep transit_score = null.
 */
async function attachTransitScores<T extends {
  id: string;
  address: string | null;
  title: string;
  lat: null | number;
  lng: null | number;
  transit_score: null | number;
}>(listings: T[]): Promise<T[]> {
  const coordsMap = await batchGeocode(listings);

  return listings.map((apt) => {
    const coords = coordsMap.get(apt.id);
    if (!coords) return apt;
    const breakdown = getTransitBreakdown(coords.lat, coords.lng);
    return {
      ...apt,
      lat: coords.lat,
      lng: coords.lng,
      transit_score: breakdown.transitScore,
    };
  });
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

  const { neighborhood, beds, baths, minPrice, maxPrice, force } = body;

  if (!neighborhood) {
    return new Response(JSON.stringify({ error: "neighborhood is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- Cache hit: return plain JSON with all apartments ---
  const cached = getCachedApartments({ neighborhood, beds, baths, minPrice, maxPrice, force });

  if (cached.fromCache && cached.apartments.length > 0) {
    const cachedAt = Math.max(...cached.apartments.map((a) => a.cached_at));
    return new Response(
      JSON.stringify({
        type: "complete",
        apartments: cached.apartments,
        total: cached.apartments.length,
        fromCache: true,
        cachedAt,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  // --- Cache miss: stream SSE ---
  const url = buildStreetEasyUrl({ neighborhood, beds, minPrice, maxPrice });
  const allScraped: ScrapedListing[] = [];

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;

      // Safe enqueue — silently drops writes after the client disconnects
      function send(data: object) {
        if (closed) return;
        try {
          controller.enqueue(sse(data));
        } catch {
          closed = true;
        }
      }

      function close() {
        if (closed) return;
        closed = true;
        try { controller.close(); } catch { /* already closed */ }
      }

      try {
        await scrapeListings(url, neighborhood, 15, (pageNum, totalPages, pageListings) => {
          if (closed) return; // client disconnected — stop processing callbacks
          allScraped.push(...pageListings);

          if (pageNum === 1) {
            const scored = scoreBatch(pageListings);
            const apartments = toApartmentShape(pageListings, scored.map((s) => s.score));
            send({ type: "initial", apartments, totalPages });
          } else {
            send({ type: "progress", page: pageNum, totalPages, count: allScraped.length });
          }
        });
      } catch (err) {
        // Only log if it's a real scrape error, not a closed-controller error
        if (!closed) {
          console.error("Scrape error:", err);
          const stale = getCachedApartments({ neighborhood, beds, baths, minPrice, maxPrice });
          if (stale.apartments.length > 0) {
            const staleAt = Math.max(...stale.apartments.map((a) => a.cached_at));
            send({
              type: "complete",
              apartments: stale.apartments,
              total: stale.apartments.length,
              fromCache: true,
              stale: true,
              cachedAt: staleAt,
            });
          } else {
            send({ type: "error", message: "Failed to fetch listings. Try again shortly." });
          }
        }
        close();
        return;
      }

      // Score affordability
      const scored = scoreBatch(allScraped);
      const now = Math.floor(Date.now() / 1000);
      const withTimestamp = scored.map((apt) => ({
        ...apt,
        lat: null as number | null,
        lng: null as number | null,
        transit_score: null as number | null,
        cached_at: now,
      }));

      // Batch-geocode all listings in one Census API call, then score transit
      console.log(`Batch-geocoding ${withTimestamp.length} listings…`);
      const withTransit = await attachTransitScores(withTimestamp);
      const geocoded = withTransit.filter((a) => a.transit_score !== null).length;
      console.log(`Transit scores: ${geocoded}/${withTimestamp.length} listings scored`);

      saveApartments(withTransit);

      if (closed) return; // client disconnected before we finished

      // Return all results from DB
      const fresh = getCachedApartments({ neighborhood, beds, baths, minPrice, maxPrice });

      send({
        type: "complete",
        apartments: fresh.apartments,
        total: fresh.apartments.length,
        fromCache: false,
        scrapedCount: allScraped.length,
        cachedAt: now,
      });
      close();
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

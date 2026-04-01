import { Prisma } from "@/lib/generated/prisma";
import { prisma } from "@/lib/prisma";

export interface Apartment {
  id: string;
  title: string;
  price: string;
  price_num: number | null;
  address: string | null;
  neighborhood: string | null;
  url: string;
  bedrooms: string | null;
  bathrooms: string | null;
  sqft: string | null;
  sqft_num: number | null;
  image_url: string | null;
  score: number | null;
  lat: number | null;
  lng: number | null;
  transit_score: number | null;
  net_effective_price: number | null;
  months_free: number | null;
  lease_term: string | null;
  price_reduction: number | null;
  first_seen_at: Date;
  last_seen_at: Date;
}

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

function toDomain(row: {
  id: string;
  title: string;
  price: string;
  price_num: bigint | null;
  address: string | null;
  neighborhood: string | null;
  url: string;
  bedrooms: string | null;
  bathrooms: string | null;
  sqft: string | null;
  sqft_num: bigint | null;
  image_url: string | null;
  score: number | null;
  lat: number | null;
  lng: number | null;
  transit_score: number | null;
  net_effective_price: bigint | null;
  months_free: number | null;
  lease_term: string | null;
  price_reduction: bigint | null;
  first_seen_at: Date;
  last_seen_at: Date;
}): Apartment {
  return {
    ...row,
    price_num: row.price_num !== null ? Number(row.price_num) : null,
    sqft_num: row.sqft_num !== null ? Number(row.sqft_num) : null,
    net_effective_price: row.net_effective_price !== null ? Number(row.net_effective_price) : null,
    price_reduction: row.price_reduction !== null ? Number(row.price_reduction) : null,
  };
}

export async function getCachedApartments(params: {
  neighborhood: string;
  beds?: string;
  baths?: string;
  minPrice?: number;
  maxPrice?: number;
  force?: boolean;
}): Promise<{ apartments: Apartment[]; fromCache: boolean }> {
  const { neighborhood, beds, minPrice, maxPrice, force } = params;

  const cutoff = new Date(Date.now() - CACHE_TTL_MS);

  const freshCount = await prisma.apartment.count({
    where: { neighborhood, last_seen_at: { gt: cutoff } },
  });

  const fromCache = !force && freshCount > 0;

  // Build where clause
  const where: Prisma.ApartmentWhereInput = { neighborhood };

  // Beds are post-filtered in application code — Prisma can't do CAST(REPLACE(...))

  if (minPrice) where.price_num = { gte: BigInt(minPrice) };
  if (maxPrice) where.price_num = { ...((where.price_num ?? {}) as object), lte: BigInt(maxPrice) };

  const rows = await prisma.apartment.findMany({
    where,
    orderBy: [{ score: "desc" }, { last_seen_at: "desc" }],
  });

  let apartments = rows.map(toDomain);

  // Post-filter beds (REPLACE logic can't be expressed in Prisma where clause)
  if (beds && beds !== "any") {
    const bedsNum = beds === "studio" ? 0 : parseInt(beds, 10);
    if (!isNaN(bedsNum)) {
      apartments = apartments.filter((a) => {
        if (!a.bedrooms) return false;
        const n = parseInt(a.bedrooms.replace(" bed", "").replace("Studio", "0"), 10);
        return n === bedsNum;
      });
    }
  }

  return { apartments, fromCache };
}

export async function saveApartments(apartments: Apartment[]): Promise<void> {
  await Promise.all(
    apartments.map((apt) =>
      prisma.apartment.upsert({
        where: { id: apt.id },
        create: {
          id: apt.id,
          title: apt.title,
          price: apt.price,
          price_num: apt.price_num !== null ? BigInt(apt.price_num) : null,
          address: apt.address,
          neighborhood: apt.neighborhood,
          url: apt.url,
          bedrooms: apt.bedrooms,
          bathrooms: apt.bathrooms,
          sqft: apt.sqft,
          sqft_num: apt.sqft_num !== null ? BigInt(apt.sqft_num) : null,
          image_url: apt.image_url,
          score: apt.score,
          lat: apt.lat,
          lng: apt.lng,
          transit_score: apt.transit_score,
          net_effective_price: apt.net_effective_price !== null ? BigInt(apt.net_effective_price) : null,
          months_free: apt.months_free,
          lease_term: apt.lease_term,
          price_reduction: apt.price_reduction !== null ? BigInt(apt.price_reduction) : null,
          first_seen_at: apt.first_seen_at,
          last_seen_at: apt.last_seen_at,
        },
        update: {
          title: apt.title,
          price: apt.price,
          price_num: apt.price_num !== null ? BigInt(apt.price_num) : null,
          address: apt.address,
          url: apt.url,
          bedrooms: apt.bedrooms,
          bathrooms: apt.bathrooms,
          sqft: apt.sqft,
          sqft_num: apt.sqft_num !== null ? BigInt(apt.sqft_num) : null,
          image_url: apt.image_url,
          score: apt.score,
          lat: apt.lat,
          lng: apt.lng,
          transit_score: apt.transit_score,
          net_effective_price: apt.net_effective_price !== null ? BigInt(apt.net_effective_price) : null,
          months_free: apt.months_free,
          lease_term: apt.lease_term,
          price_reduction: apt.price_reduction !== null ? BigInt(apt.price_reduction) : null,
          last_seen_at: apt.last_seen_at, // preserve first_seen_at on updates
        },
      })
    )
  );
}

export async function getNeighborhoodStats(
  neighborhood: string
): Promise<{ median_price: number; avg_price_per_sqft: number | null } | null> {
  const row = await prisma.neighborhoodStat.findUnique({ where: { neighborhood } });
  if (!row) return null;
  return {
    median_price: Number(row.median_price),
    avg_price_per_sqft: row.avg_price_per_sqft,
  };
}

export async function upsertNeighborhoodStats(
  neighborhood: string,
  median_price: number,
  avg_price_per_sqft: number | null
): Promise<void> {
  await prisma.neighborhoodStat.upsert({
    where: { neighborhood },
    create: { neighborhood, median_price: BigInt(median_price), avg_price_per_sqft },
    update: { median_price: BigInt(median_price), avg_price_per_sqft, updated_at: new Date() },
  });
}

// --- Scrape lock helpers ---

/**
 * Try to acquire a scrape lock for a neighborhood.
 * Returns true if the lock was acquired, false if another process holds it.
 */
export async function acquireScrapeLock(neighborhood: string): Promise<boolean> {
  try {
    await prisma.scrapeLock.create({ data: { neighborhood } });
    return true;
  } catch {
    // Unique constraint violation — someone else holds the lock
    return false;
  }
}

export async function releaseScrapeLock(neighborhood: string): Promise<void> {
  await prisma.scrapeLock.deleteMany({ where: { neighborhood } });
}

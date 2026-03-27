import { NEIGHBORHOOD_MEDIAN_RENTS } from "@/data/neighborhoods";
import type { ScrapedListing } from "./scraper";

/**
 * Score an apartment 1–10 based on affordability relative to its neighborhood.
 * Higher score = better deal (cheaper relative to what the area normally costs).
 *
 * Two equal-weight components:
 *   1. Price vs neighborhood median rent
 *   2. Price-per-sqft vs neighborhood avg price-per-sqft (skipped if sqft unknown)
 */
export function scoreApartment(
  apt: Pick<ScrapedListing, "price_num" | "sqft_num" | "neighborhood">
): number | null {
  if (!apt.price_num || !apt.neighborhood) return null;

  const medianRent = NEIGHBORHOOD_MEDIAN_RENTS[apt.neighborhood] ?? 3500;

  // Component 1: price relative to median (lower is better)
  // ratio < 1 means cheaper than median (good deal), > 1 means more expensive
  const priceRatio = apt.price_num / medianRent;
  const priceScore = ratioToScore(priceRatio);

  // Component 2: price/sqft relative to neighborhood avg (if sqft available)
  let sqftScore: number | null = null;
  if (apt.sqft_num && apt.sqft_num > 0) {
    const pricePerSqft = apt.price_num / apt.sqft_num;
    const avgPricePerSqft = medianRent / 750; // assume ~750 sqft median unit
    const sqftRatio = pricePerSqft / avgPricePerSqft;
    sqftScore = ratioToScore(sqftRatio);
  }

  const finalScore = sqftScore !== null
    ? (priceScore + sqftScore) / 2
    : priceScore;

  return Math.round(Math.min(10, Math.max(1, finalScore)) * 10) / 10;
}

/**
 * Convert a price ratio (actual/expected) to a 1–10 score.
 * ratio = 0.5 (50% of median) → ~10 (great deal)
 * ratio = 1.0 (at median)      → ~5
 * ratio = 2.0 (2x median)      → ~1 (poor value)
 */
function ratioToScore(ratio: number): number {
  // Linear mapping: ratio 0.3 → 10, ratio 1.7 → 1
  const score = 10 - ((ratio - 0.3) / 1.4) * 9;
  return Math.min(10, Math.max(1, score));
}

export function scoreColor(score: number): string {
  if (score >= 8) return "text-green-400";
  if (score >= 6) return "text-blue-400";
  if (score >= 4) return "text-yellow-400";
  return "text-red-400";
}

export function scoreBgColor(score: number): string {
  if (score >= 8) return "bg-green-600/85 border-green-600/60 text-white";
  if (score >= 6) return "bg-blue-600/85 border-blue-600/60 text-white";
  if (score >= 4) return "bg-yellow-500/85 border-yellow-500/60 text-white";
  return "bg-red-600/85 border-red-600/60 text-white";
}

export function scoreLabel(score: number): string {
  if (score >= 8) return "Great Deal";
  if (score >= 6) return "Good Value";
  if (score >= 4) return "Fair";
  return "Overpriced";
}

export interface ScoreBreakdown {
  finalScore: number;
  neighborhoodMedian: number;
  priceComponent: {
    aptPrice: number;
    ratio: number;
    score: number;
    diffPct: number; // positive = cheaper than median, negative = more expensive
  };
  sqftComponent: {
    aptPricePerSqft: number;
    neighborhoodAvgPerSqft: number;
    ratio: number;
    score: number;
    sqft: number;
  } | null;
}

export function getScoreBreakdown(
  apt: Pick<ScrapedListing, "price_num" | "sqft_num" | "neighborhood">
): ScoreBreakdown | null {
  if (!apt.price_num || !apt.neighborhood) return null;

  const medianRent = NEIGHBORHOOD_MEDIAN_RENTS[apt.neighborhood] ?? 3500;
  const priceRatio = apt.price_num / medianRent;
  const priceScore = Math.round(ratioToScore(priceRatio) * 10) / 10;
  const diffPct = Math.round((1 - priceRatio) * 100);

  let sqftComponent: ScoreBreakdown["sqftComponent"] = null;
  if (apt.sqft_num && apt.sqft_num > 0) {
    const avgPricePerSqft = medianRent / 750;
    const aptPricePerSqft = apt.price_num / apt.sqft_num;
    const sqftRatio = aptPricePerSqft / avgPricePerSqft;
    sqftComponent = {
      aptPricePerSqft: Math.round(aptPricePerSqft),
      neighborhoodAvgPerSqft: Math.round(avgPricePerSqft),
      ratio: Math.round(sqftRatio * 100) / 100,
      score: Math.round(ratioToScore(sqftRatio) * 10) / 10,
      sqft: apt.sqft_num,
    };
  }

  const finalScore =
    sqftComponent !== null
      ? Math.round(((priceScore + sqftComponent.score) / 2) * 10) / 10
      : priceScore;

  return {
    finalScore: Math.min(10, Math.max(1, finalScore)),
    neighborhoodMedian: medianRent,
    priceComponent: {
      aptPrice: apt.price_num,
      ratio: Math.round(priceRatio * 100) / 100,
      score: priceScore,
      diffPct,
    },
    sqftComponent,
  };
}

/**
 * Compute and attach scores to a batch of listings using
 * the median derived from the batch itself as a fallback.
 */
export function scoreBatch(
  listings: ScrapedListing[]
): (ScrapedListing & { score: number | null })[] {
  return listings.map((apt) => ({
    ...apt,
    score: scoreApartment(apt),
  }));
}

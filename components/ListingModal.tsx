"use client";

import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { scoreBgColor, scoreLabel, type ScoreBreakdown } from "@/lib/rating";
import { transitScoreBgColor, transitScoreLabel, getTransitBreakdown } from "@/lib/transit";
import type { Apartment } from "@/lib/db";

interface ListingModalProps {
  open: boolean;
  onClose: () => void;
  apartment: Apartment;
  breakdown: ScoreBreakdown | null;
}

function ScoreBar({ score }: { score: number }) {
  const pct = ((score - 1) / 9) * 100;
  const color =
    score >= 8
      ? "bg-green-400/70"
      : score >= 6
      ? "bg-blue-400/70"
      : score >= 4
      ? "bg-yellow-400/70"
      : "bg-red-400/70";

  return (
    <div className="relative h-2 w-full rounded-full bg-muted overflow-hidden">
      <div
        className={`absolute left-0 top-0 h-full rounded-full transition-all ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function ComponentRow({
  label,
  score,
  detail,
}: {
  label: string;
  score: number;
  detail: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold tabular-nums">{score}/10</span>
      </div>
      <ScoreBar score={score} />
      <p className="text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

export default function ListingModal({
  open,
  onClose,
  apartment: apt,
  breakdown,
}: ListingModalProps) {
  const displayNeighborhood = apt.neighborhood?.replace(/-/g, " ") ?? "";
  const transitBreakdown =
    apt.lat != null && apt.lng != null ? getTransitBreakdown(apt.lat, apt.lng) : null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-3xl p-0 overflow-hidden">
        {/* Hidden title for accessibility */}
        <DialogHeader className="sr-only">
          <DialogTitle>{apt.title}</DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto max-h-[90vh]">
        {/* Focus sentinel — gives Base UI something to focus at the top so it never scrolls to the button */}
        <span tabIndex={0} aria-hidden="true" className="sr-only" />
        {/* 2×2 grid — top row fixed height, bottom row auto (content-driven so outer container scrolls) */}
        <div className="grid grid-cols-2" style={{ gridTemplateRows: "280px auto" }}>

          {/* ── Top-left: Image ── */}
          <div className="relative bg-muted rounded-tl-lg overflow-hidden">
            {apt.image_url ? (
              <Image
                src={apt.image_url}
                alt={apt.title}
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <svg
                  className="h-14 w-14 text-muted-foreground/30"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1}
                    d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"
                  />
                </svg>
              </div>
            )}
          </div>

          {/* ── Top-right: Basic Information ── */}
          <div className="p-7 flex flex-col gap-5 border-l border-border/50">
            <div className="space-y-1">
              <p className="text-2xl font-bold">
                {apt.price !== "N/A" ? apt.price : "—"}
                <span className="text-sm font-normal text-muted-foreground ml-1">/mo</span>
              </p>
              <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">{apt.title}</p>
            </div>

            {apt.neighborhood && (
              <Badge variant="secondary" className="capitalize text-xs w-fit">
                {displayNeighborhood}
              </Badge>
            )}

            <div className="grid grid-cols-2 gap-3">
              {apt.bedrooms && apt.bedrooms !== "N/A" && (
                <div className="rounded-xl border bg-muted/30 px-4 py-3">
                  <p className="text-[11px] text-muted-foreground mb-1">Bedrooms</p>
                  <p className="text-sm font-semibold">{apt.bedrooms}</p>
                </div>
              )}
              {apt.bathrooms && apt.bathrooms !== "N/A" && (
                <div className="rounded-xl border bg-muted/30 px-4 py-3">
                  <p className="text-[11px] text-muted-foreground mb-1">Bathrooms</p>
                  <p className="text-sm font-semibold">{apt.bathrooms}</p>
                </div>
              )}
              {apt.sqft && apt.sqft !== "N/A" && (
                <div className="rounded-xl border bg-muted/30 px-4 py-3 col-span-2">
                  <p className="text-[11px] text-muted-foreground mb-1">Size</p>
                  <p className="text-sm font-semibold">{apt.sqft}</p>
                </div>
              )}
              {apt.net_effective_price && (
                <div className="rounded-xl border bg-muted/30 px-4 py-3">
                  <p className="text-[11px] text-muted-foreground mb-1">Net effective</p>
                  <p className="text-sm font-semibold">${apt.net_effective_price.toLocaleString()}/mo</p>
                </div>
              )}
              {apt.months_free != null && (
                <div className="rounded-xl border bg-muted/30 px-4 py-3">
                  <p className="text-[11px] text-muted-foreground mb-1">Concession</p>
                  <p className="text-sm font-semibold">{apt.months_free} mo free</p>
                </div>
              )}
              {apt.lease_term && (
                <div className="rounded-xl border bg-muted/30 px-4 py-3">
                  <p className="text-[11px] text-muted-foreground mb-1">Lease</p>
                  <p className="text-sm font-semibold capitalize">{apt.lease_term}</p>
                </div>
              )}
              {apt.price_reduction != null && (
                <div className="rounded-xl border border-green-800/40 bg-green-950/40 px-4 py-3">
                  <p className="text-[11px] text-green-400/80 mb-1">Price reduced</p>
                  <p className="text-sm font-semibold text-green-300">−${apt.price_reduction.toLocaleString()}/mo</p>
                </div>
              )}
            </div>
          </div>

          {/* ── Bottom-left: Overall Score ── */}
          <div className="p-7 border-t border-border/50 flex flex-col gap-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Overall Score
            </h3>

            {breakdown ? (
              <>
                {/* Combined score summary */}
                <div className="flex items-center gap-4 rounded-xl border bg-muted/30 px-4 py-3">
                  <div
                    className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl border ${scoreBgColor(breakdown.combinedScore)}`}
                  >
                    <span className="text-2xl font-bold leading-none">{breakdown.combinedScore}</span>
                    <span className="text-[10px] font-medium leading-tight mt-0.5">/ 10</span>
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{scoreLabel(breakdown.combinedScore)}</p>
                    <p className="text-xs text-muted-foreground capitalize mt-0.5">
                      {displayNeighborhood} ·{" "}
                      {breakdown.transitScore !== null
                        ? `${breakdown.sqftComponent ? "3" : "2"} components`
                        : `${breakdown.sqftComponent ? "2" : "1"} component${breakdown.sqftComponent ? "s" : ""}`
                      }, equal weight
                    </p>
                  </div>
                </div>

                <div className="space-y-5">
                  {/* Price component */}
                  <ComponentRow
                    label="Price vs. neighborhood median"
                    score={breakdown.priceComponent.score}
                    detail={
                      breakdown.priceComponent.diffPct > 0
                        ? `$${breakdown.priceComponent.aptPrice.toLocaleString()}/mo is ${breakdown.priceComponent.diffPct}% cheaper than the ${displayNeighborhood} median ($${breakdown.neighborhoodMedian.toLocaleString()})`
                        : breakdown.priceComponent.diffPct < 0
                        ? `$${breakdown.priceComponent.aptPrice.toLocaleString()}/mo is ${Math.abs(breakdown.priceComponent.diffPct)}% more expensive than the ${displayNeighborhood} median ($${breakdown.neighborhoodMedian.toLocaleString()})`
                        : `$${breakdown.priceComponent.aptPrice.toLocaleString()}/mo is exactly at the ${displayNeighborhood} median`
                    }
                  />

                  {/* Sqft component */}
                  {breakdown.sqftComponent ? (
                    <ComponentRow
                      label="Price per ft² vs. neighborhood avg"
                      score={breakdown.sqftComponent.score}
                      detail={`$${breakdown.sqftComponent.aptPricePerSqft}/ft² vs. avg $${breakdown.sqftComponent.neighborhoodAvgPerSqft}/ft² (${breakdown.sqftComponent.sqft.toLocaleString()} ft²)`}
                    />
                  ) : (
                    <div className="rounded-xl border border-dashed border-border p-4 text-xs text-muted-foreground">
                      <strong>Price per ft²</strong> — not available. Skipped from calculation.
                    </div>
                  )}

                  {/* Transit component */}
                  {breakdown.transitScore !== null ? (
                    <ComponentRow
                      label="Transit access"
                      score={breakdown.transitScore}
                      detail={
                        transitBreakdown
                          ? `${transitBreakdown.nearestStation.name} · ${transitBreakdown.distanceMiles} mi (~${transitBreakdown.walkMinutes} min walk)`
                          : `Score: ${breakdown.transitScore}/10`
                      }
                    />
                  ) : (
                    <div className="rounded-xl border border-dashed border-border p-4 text-xs text-muted-foreground">
                      <strong>Transit</strong> — not available. Address could not be geocoded.
                    </div>
                  )}
                </div>

                {/* Formula footnote */}
                <div className="rounded-xl bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
                  {breakdown.transitScore !== null ? (
                    <>
                      Affordability ({breakdown.affordabilityScore}) + Transit ({breakdown.transitScore}) ÷ 2 ={" "}
                      <strong className="text-foreground">{breakdown.combinedScore}</strong>
                    </>
                  ) : (
                    <>
                      No transit data · Affordability score only ={" "}
                      <strong className="text-foreground">{breakdown.combinedScore}</strong>
                    </>
                  )}
                </div>

                <p className="text-[11px] text-muted-foreground/60 border-t border-border/40 pt-4">
                  Median rents from{" "}
                  <a href="https://streeteasy.com/blog/data-dashboard/" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-muted-foreground">
                    StreetEasy
                  </a>{" "}
                  &amp;{" "}
                  <a href="https://www.zumper.com/blog/nyc-neighborhood-rent-prices/" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-muted-foreground">
                    Zumper
                  </a>
                  , ~2024–2025. See{" "}
                  <a href="/key" className="underline underline-offset-2 hover:text-muted-foreground">
                    Price Index
                  </a>
                  .
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                Score not available for this listing.
              </p>
            )}
          </div>

          {/* ── Bottom-right: Transit Access ── */}
          <div className="p-7 border-t border-l border-border/50 flex flex-col gap-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Transit Access
            </h3>

            {transitBreakdown ? (
              <>
                <div className="flex items-center gap-4 rounded-xl border bg-muted/30 px-4 py-3">
                  <div className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl border ${transitScoreBgColor(transitBreakdown.transitScore)}`}>
                    <span className="text-2xl font-bold leading-none">{transitBreakdown.transitScore}</span>
                    <span className="text-[10px] font-medium leading-tight mt-0.5">/ 10</span>
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{transitScoreLabel(transitBreakdown.transitScore)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {transitBreakdown.distanceMiles} mi · ~{transitBreakdown.walkMinutes} min walk
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Nearest station</p>
                  <div className="rounded-xl border bg-muted/30 px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold">{transitBreakdown.nearestStation.name}</p>
                      <div className="flex flex-wrap gap-1 justify-end">
                        {transitBreakdown.nearestStation.lines.slice(0, 5).map((line) => (
                          <span key={line} className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-primary/20 text-primary text-[10px] font-bold shrink-0">
                            {line}
                          </span>
                        ))}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {transitBreakdown.distanceMiles} mi away
                    </p>
                  </div>

                  {transitBreakdown.nearbyStations.length > 1 && (
                    <>
                      <p className="text-xs font-medium text-muted-foreground pt-1">Also nearby</p>
                      <div className="space-y-1.5">
                        {transitBreakdown.nearbyStations.slice(1, 4).map(({ station, distanceMiles }) => (
                          <div key={station.name + distanceMiles} className="flex items-center justify-between text-xs px-1">
                            <span className="text-muted-foreground">{station.name}</span>
                            <div className="flex items-center gap-1.5">
                              <div className="flex gap-0.5">
                                {station.lines.slice(0, 4).map((line) => (
                                  <span key={line} className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-primary/15 text-primary text-[9px] font-bold">
                                    {line}
                                  </span>
                                ))}
                              </div>
                              <span className="text-muted-foreground/70 tabular-nums">{distanceMiles} mi</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                <p className="text-[11px] text-muted-foreground/60 border-t border-border/40 pt-3">
                  Straight-line distance to MTA station entrances. Actual walk may vary.
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                Transit data unavailable — address could not be geocoded.
              </p>
            )}

            <a href={apt.url} target="_blank" rel="noopener noreferrer" className="w-full">
              <Button className="w-full" size="lg">
                View on StreetEasy →
              </Button>
            </a>
          </div>

        </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

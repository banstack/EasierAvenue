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
      ? "bg-green-500"
      : score >= 6
      ? "bg-blue-500"
      : score >= 4
      ? "bg-yellow-500"
      : "bg-red-500";

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

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-3xl p-0 overflow-hidden">
        {/* Hidden title for accessibility */}
        <DialogHeader className="sr-only">
          <DialogTitle>{apt.title}</DialogTitle>
        </DialogHeader>

        {/* 2×2 grid — rows share equal height */}
        <div className="grid grid-cols-2" style={{ gridTemplateRows: "280px 1fr" }}>

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
          <div className="p-7 flex flex-col gap-5 border-l border-border/50 overflow-y-auto">
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
            </div>
          </div>

          {/* ── Bottom-left: Score Breakdown ── */}
          <div className="p-7 border-t border-border/50 flex flex-col gap-5 overflow-y-auto">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Score Breakdown
            </h3>

            {breakdown ? (
              <>
                <div className="flex items-center gap-4 rounded-xl border bg-muted/30 px-4 py-3">
                  <div
                    className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl border ${scoreBgColor(breakdown.finalScore)}`}
                  >
                    <span className="text-2xl font-bold leading-none">{breakdown.finalScore}</span>
                    <span className="text-[10px] font-medium leading-tight mt-0.5">/ 10</span>
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{scoreLabel(breakdown.finalScore)}</p>
                    <p className="text-xs text-muted-foreground capitalize mt-0.5">
                      {displayNeighborhood} · {breakdown.sqftComponent ? "2 components" : "1 component"}, equal weight
                    </p>
                  </div>
                </div>

                <div className="space-y-5">
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

                  {breakdown.sqftComponent ? (
                    <ComponentRow
                      label="Price per ft² vs. neighborhood avg"
                      score={breakdown.sqftComponent.score}
                      detail={`$${breakdown.sqftComponent.aptPricePerSqft}/ft² vs. avg $${breakdown.sqftComponent.neighborhoodAvgPerSqft}/ft² (${breakdown.sqftComponent.sqft.toLocaleString()} ft²)`}
                    />
                  ) : (
                    <div className="rounded-xl border border-dashed border-border p-4 text-xs text-muted-foreground">
                      <strong>Price per ft²</strong> — not available. Final score uses price component only.
                    </div>
                  )}
                </div>

                {breakdown.sqftComponent && (
                  <div className="rounded-xl bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
                    Final = ({breakdown.priceComponent.score} + {breakdown.sqftComponent.score}) ÷ 2 ={" "}
                    <strong className="text-foreground">{breakdown.finalScore}</strong>
                  </div>
                )}

                <p className="text-[11px] text-muted-foreground/60 border-t border-border/40 pt-4 mt-auto">
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

          {/* ── Bottom-right: View on StreetEasy ── */}
          <div className="p-7 border-t border-l border-border/50 flex flex-col items-center justify-center gap-4">
            <p className="text-sm text-muted-foreground text-center leading-relaxed">
              View the full listing, additional photos, and contact the agent directly on StreetEasy.
            </p>
            <a href={apt.url} target="_blank" rel="noopener noreferrer" className="w-full">
              <Button className="w-full" size="lg">
                View on StreetEasy →
              </Button>
            </a>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}

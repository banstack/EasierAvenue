"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { scoreBgColor, scoreLabel, type ScoreBreakdown } from "@/lib/rating";

interface ScoreModalProps {
  open: boolean;
  onClose: () => void;
  breakdown: ScoreBreakdown;
  neighborhood: string;
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

export default function ScoreModal({
  open,
  onClose,
  breakdown,
  neighborhood,
}: ScoreModalProps) {
  const { finalScore, neighborhoodMedian, priceComponent, sqftComponent } = breakdown;
  const displayNeighborhood = neighborhood.replace(/-/g, " ");
  const componentCount = sqftComponent ? 2 : 1;

  const priceDetail =
    priceComponent.diffPct > 0
      ? `$${priceComponent.aptPrice.toLocaleString()}/mo is ${priceComponent.diffPct}% cheaper than the ${displayNeighborhood} median ($${neighborhoodMedian.toLocaleString()})`
      : priceComponent.diffPct < 0
      ? `$${priceComponent.aptPrice.toLocaleString()}/mo is ${Math.abs(priceComponent.diffPct)}% more expensive than the ${displayNeighborhood} median ($${neighborhoodMedian.toLocaleString()})`
      : `$${priceComponent.aptPrice.toLocaleString()}/mo is exactly at the ${displayNeighborhood} median`;

  const sqftDetail = sqftComponent
    ? `$${sqftComponent.aptPricePerSqft}/ft² vs. neighborhood avg of $${sqftComponent.neighborhoodAvgPerSqft}/ft² (${sqftComponent.sqft.toLocaleString()} ft²)`
    : null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Score Breakdown</DialogTitle>
        </DialogHeader>

        {/* Final score */}
        <div className="flex items-center gap-4 rounded-xl border bg-muted/30 px-4 py-3">
          <div
            className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl border ${scoreBgColor(finalScore)}`}
          >
            <span className="text-2xl font-bold leading-none">{finalScore}</span>
            <span className="text-[10px] font-medium leading-tight mt-0.5">/ 10</span>
          </div>
          <div>
            <p className="font-semibold text-sm">{scoreLabel(finalScore)}</p>
            <p className="text-xs text-muted-foreground capitalize mt-0.5">
              {displayNeighborhood} · {componentCount} component{componentCount > 1 ? "s" : ""}, equal weight
            </p>
          </div>
        </div>

        {/* How scoring works */}
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Score measures how affordable this apartment is relative to its neighborhood.
            Higher = better deal. Scale: 1 (overpriced) → 10 (exceptional value).
          </p>

          <div className="space-y-5">
            <ComponentRow
              label="Price vs. neighborhood median"
              score={priceComponent.score}
              detail={priceDetail}
            />

            {sqftComponent ? (
              <ComponentRow
                label="Price per ft² vs. neighborhood avg"
                score={sqftComponent.score}
                detail={sqftDetail!}
              />
            ) : (
              <div className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
                <strong>Price per ft²</strong> — not available (no sqft data for this listing).
                Final score uses price component only.
              </div>
            )}
          </div>

          {sqftComponent && (
            <div className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              Final score = ({priceComponent.score} + {sqftComponent.score}) ÷ 2 ={" "}
              <strong className="text-foreground">{finalScore}</strong>
            </div>
          )}

          {/* Source */}
          <p className="text-[11px] text-muted-foreground/60 border-t border-border/40 pt-3">
            Median rents sourced from{" "}
            <a
              href="https://streeteasy.com/blog/data-dashboard/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-muted-foreground"
            >
              StreetEasy Market Reports
            </a>{" "}
            &amp;{" "}
            <a
              href="https://www.zumper.com/blog/nyc-neighborhood-rent-prices/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-muted-foreground"
            >
              Zumper
            </a>
            , ~2024–2025. See the full{" "}
            <a
              href="/key"
              className="underline underline-offset-2 hover:text-muted-foreground"
            >
              Price Index
            </a>
            .
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

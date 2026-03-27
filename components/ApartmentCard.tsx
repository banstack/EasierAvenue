"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { scoreBgColor, scoreLabel, getScoreBreakdown } from "@/lib/rating";
import ScoreModal from "@/components/ScoreModal";
import type { Apartment } from "@/lib/db";

interface ApartmentCardProps {
  apartment: Apartment;
}

export default function ApartmentCard({ apartment: apt }: ApartmentCardProps) {
  const [modalOpen, setModalOpen] = useState(false);

  const score = apt.score;
  const hasScore = score !== null && score !== undefined;
  const breakdown = hasScore && apt.neighborhood
    ? getScoreBreakdown({
        price_num: apt.price_num,
        sqft_num: apt.sqft_num,
        neighborhood: apt.neighborhood,
      })
    : null;

  return (
    <>
      <a
        href={apt.url}
        target="_blank"
        rel="noopener noreferrer"
        className="group block h-full"
      >
        <Card className="h-full overflow-hidden border-border/60 bg-card transition-all duration-200 group-hover:border-primary/40 group-hover:shadow-lg group-hover:shadow-primary/10">
          {/* Image */}
          <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
            {apt.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={apt.image_url}
                alt={apt.title}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <svg
                  className="h-12 w-12 text-muted-foreground/30"
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

            {/* Score badge overlay */}
            {hasScore && (
              <div className="absolute top-2 right-2 flex items-start gap-1">
                <div
                  className={`
                    flex flex-col items-center rounded-xl border px-2.5 py-1.5
                    backdrop-blur-sm bg-background/80 ${scoreBgColor(score!)}
                  `}
                >
                  <span className="text-lg font-bold leading-none">{score}</span>
                  <span className="text-[10px] font-medium leading-tight mt-0.5">
                    {scoreLabel(score!)}
                  </span>
                </div>

                {/* Info icon — opens score breakdown modal */}
                {breakdown && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setModalOpen(true);
                    }}
                    aria-label="How this score was calculated"
                    className="
                      flex h-6 w-6 items-center justify-center rounded-full
                      bg-background/80 backdrop-blur-sm border border-border/60
                      text-muted-foreground hover:text-foreground hover:border-primary/40
                      transition-colors
                    "
                  >
                    <svg
                      className="h-3.5 w-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </button>
                )}
              </div>
            )}
          </div>

          <CardContent className="p-4 space-y-3">
            {/* Price */}
            <div className="flex items-start justify-between gap-2">
              <p className="text-2xl font-bold text-foreground">
                {apt.price !== "N/A" ? apt.price : "—"}
                <span className="text-sm font-normal text-muted-foreground">/mo</span>
              </p>
              {apt.neighborhood && (
                <Badge variant="secondary" className="shrink-0 text-xs capitalize">
                  {apt.neighborhood.replace(/-/g, " ")}
                </Badge>
              )}
            </div>

            {/* Title / address */}
            <p className="text-sm font-medium text-foreground line-clamp-2 leading-snug">
              {apt.title}
            </p>

            {/* Details row */}
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              {apt.bedrooms && apt.bedrooms !== "N/A" && (
                <span className="flex items-center gap-1">
                  <BedIcon />
                  {apt.bedrooms}
                </span>
              )}
              {apt.bathrooms && apt.bathrooms !== "N/A" && (
                <span className="flex items-center gap-1">
                  <BathIcon />
                  {apt.bathrooms}
                </span>
              )}
              {apt.sqft && apt.sqft !== "N/A" && (
                <span className="flex items-center gap-1">
                  <SqftIcon />
                  {apt.sqft}
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      </a>

      {breakdown && (
        <ScoreModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          breakdown={breakdown}
          neighborhood={apt.neighborhood ?? ""}
        />
      )}
    </>
  );
}

function BedIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M3 7v10M3 12h18M21 7v10M7 12V7h10v5" />
    </svg>
  );
}

function BathIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M4 12h16v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5zM4 12V6a2 2 0 012-2h2v8" />
    </svg>
  );
}

function SqftIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M4 4h6M4 4v6M20 20h-6M20 20v-6M4 20l16-16" />
    </svg>
  );
}

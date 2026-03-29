"use client";

import { useState } from "react";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { scoreBgColor, scoreLabel, getScoreBreakdown, getCombinedScore } from "@/lib/rating";
import ListingModal from "@/components/ListingModal";
import type { Apartment } from "@/lib/db";

interface ApartmentCardProps {
  apartment: Apartment;
}

export default function ApartmentCard({ apartment: apt }: ApartmentCardProps) {
  const [modalOpen, setModalOpen] = useState(false);

  const combinedScore = getCombinedScore(apt.score ?? null, apt.transit_score ?? null);
  const displayScore = combinedScore ?? apt.score;
  const hasDisplayScore = displayScore !== null && displayScore !== undefined;
  const breakdown = hasDisplayScore && apt.neighborhood
    ? getScoreBreakdown({
        price_num: apt.price_num,
        sqft_num: apt.sqft_num,
        neighborhood: apt.neighborhood,
        transit_score: apt.transit_score,
      })
    : null;

  return (
    <>
      <div
        className="group block h-full cursor-pointer"
        onClick={() => setModalOpen(true)}
      >
        <Card className="h-full overflow-hidden border-border/60 bg-card transition-all duration-200 group-hover:border-primary/40 group-hover:shadow-lg group-hover:shadow-primary/10">
          {/* Image */}
          <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
            {apt.image_url ? (
              <Image
                src={apt.image_url}
                alt={apt.title}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                className="object-cover transition-transform duration-300 group-hover:scale-105"
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

          </div>

          <CardContent className="p-4 space-y-3">
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

            <p className="text-sm font-medium text-foreground line-clamp-2 leading-snug">
              {apt.title}
            </p>

            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              {apt.bedrooms && apt.bedrooms !== "N/A" && (
                <span className="flex items-center gap-1"><BedIcon />{apt.bedrooms}</span>
              )}
              {apt.bathrooms && apt.bathrooms !== "N/A" && (
                <span className="flex items-center gap-1"><BathIcon />{apt.bathrooms}</span>
              )}
              {apt.sqft && apt.sqft !== "N/A" && (
                <span className="flex items-center gap-1"><SqftIcon />{apt.sqft}</span>
              )}
            </div>

            {hasDisplayScore && (
              <div className="flex gap-3">
                <div className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-xs font-semibold ${scoreBgColor(displayScore!)}`}>
                  <DollarIcon />
                  {apt.transit_score !== null && apt.transit_score !== undefined && <WalkingIcon />}
                  <span>{displayScore}</span>
                  <span className="font-normal text-[10px]">{scoreLabel(displayScore!)}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <ListingModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        apartment={apt}
        breakdown={breakdown}
      />
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

function DollarIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
    </svg>
  );
}

function WalkingIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      {/* Head */}
      <circle cx="12" cy="4" r="1.8" strokeWidth={1.5} />
      {/* Torso leaning forward */}
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M12 6.5l-1 5" />
      {/* Arms: back arm forward, front arm back */}
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M11 9l-2.5 2M11 9l2 1.5" />
      {/* Legs: striding */}
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M11 11.5l-2 4.5M11 11.5l2.5 4" />
      {/* Feet */}
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M9 16l-1.5 1.5M13.5 15.5l1.5 1" />
    </svg>
  );
}

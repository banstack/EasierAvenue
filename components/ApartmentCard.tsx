"use client";

import { useState } from "react";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { scoreBgColor, scoreLabel, getScoreBreakdown } from "@/lib/rating";
import ListingModal from "@/components/ListingModal";
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

            {/* Score badge — top right */}
            {hasScore && (
              <div className="absolute top-2 right-2">
                <div className={`flex flex-col items-center rounded-xl border px-2.5 py-1.5 ${scoreBgColor(score!)}`}>
                  <span className="text-lg font-bold leading-none">{score}</span>
                  <span className="text-[10px] font-medium leading-tight mt-0.5">
                    {scoreLabel(score!)}
                  </span>
                </div>
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

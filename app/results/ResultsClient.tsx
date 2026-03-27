"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import ApartmentCard from "@/components/ApartmentCard";
import ApartmentCardSkeleton from "@/components/ApartmentCardSkeleton";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Apartment } from "@/lib/db";

interface SearchResult {
  apartments: Apartment[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  fromCache: boolean;
  stale?: boolean;
  seTotal?: number | null;
  pagesScraped?: number;
  error?: string;
}

export default function ResultsClient() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const neighborhood = searchParams.get("neighborhood") ?? "";
  const beds = searchParams.get("beds") ?? "";
  const baths = searchParams.get("baths") ?? "";
  const minPrice = searchParams.get("minPrice") ?? "";
  const maxPrice = searchParams.get("maxPrice") ?? "";
  const page = parseInt(searchParams.get("page") ?? "1", 10);

  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const search = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          neighborhood,
          beds: beds || undefined,
          baths: baths || undefined,
          minPrice: minPrice ? parseInt(minPrice) : undefined,
          maxPrice: maxPrice ? parseInt(maxPrice) : undefined,
          page,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
      } else {
        setResult(data);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [neighborhood, beds, baths, minPrice, maxPrice, page]);

  useEffect(() => {
    if (neighborhood) search();
  }, [neighborhood, search]);

  function goToPage(p: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(p));
    router.push(`/results?${params.toString()}`);
  }

  const displayNeighborhood = neighborhood.replace(/-/g, " ");

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar>
        <div className="flex items-center gap-2 flex-wrap text-sm text-muted-foreground">
          <span className="capitalize font-medium text-foreground">{displayNeighborhood}</span>
          {beds && (
            <Badge variant="outline" className="text-xs capitalize">
              {beds === "studio" ? "Studio" : `${beds} bed${beds !== "1" ? "s" : ""}`}
            </Badge>
          )}
          {baths && (
            <Badge variant="outline" className="text-xs">
              {baths} bath{baths !== "1" ? "s" : ""}
            </Badge>
          )}
          {(minPrice || maxPrice) && (
            <Badge variant="outline" className="text-xs">
              {minPrice ? `$${parseInt(minPrice).toLocaleString()}` : "Any"}
              {" – "}
              {maxPrice ? `$${parseInt(maxPrice).toLocaleString()}` : "Any"}
            </Badge>
          )}
        </div>
        <Link href="/">
          <Button variant="outline" size="sm">New Search</Button>
        </Link>
      </Navbar>

      {/* Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-8">
        {/* Status line */}
        {!loading && result && (
          <div className="flex flex-wrap items-center gap-3 mb-6 text-sm text-muted-foreground">
            <span>
              {result.total} apartment{result.total !== 1 ? "s" : ""} found
            </span>
            {result.fromCache ? (
              <Badge variant="secondary" className="text-xs">
                {result.stale ? "Stale cache" : "Cached"}
              </Badge>
            ) : (
              <>
                <Badge variant="secondary" className="text-xs text-primary">
                  Live
                </Badge>
                {result.pagesScraped && result.pagesScraped > 1 && (
                  <span className="text-xs text-muted-foreground/70">
                    {result.pagesScraped} pages scraped
                    {result.seTotal
                      ? ` · ${result.seTotal.toLocaleString()} on StreetEasy`
                      : ""}
                  </span>
                )}
              </>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-center mb-6">
            <p className="text-destructive font-medium">{error}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={search}>
              Retry
            </Button>
          </div>
        )}

        {/* Skeleton grid */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <ApartmentCardSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Results grid */}
        {!loading && result && result.apartments.length > 0 && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {result.apartments.map((apt) => (
                <ApartmentCard key={apt.id} apartment={apt} />
              ))}
            </div>

            {/* Pagination */}
            {result.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-10">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => goToPage(page - 1)}
                >
                  ← Previous
                </Button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(result.totalPages, 7) }, (_, i) => {
                    const p = i + 1;
                    return (
                      <Button
                        key={p}
                        variant={p === page ? "default" : "ghost"}
                        size="sm"
                        className="w-9 h-9 p-0"
                        onClick={() => goToPage(p)}
                      >
                        {p}
                      </Button>
                    );
                  })}
                  {result.totalPages > 7 && (
                    <span className="text-muted-foreground px-2">…</span>
                  )}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= result.totalPages}
                  onClick={() => goToPage(page + 1)}
                >
                  Next →
                </Button>
              </div>
            )}
          </>
        )}

        {/* Empty state */}
        {!loading && result && result.apartments.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <div className="text-6xl">🏙️</div>
            <h2 className="text-xl font-semibold">No apartments found</h2>
            <p className="text-muted-foreground max-w-sm">
              Try broadening your search — fewer filters, a wider price range, or a different neighborhood.
            </p>
            <Link href="/">
              <Button>Modify Search</Button>
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}

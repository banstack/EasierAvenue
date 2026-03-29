"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCw } from "lucide-react";
import PixelRobot from "@/components/PixelRobot";
import { getCombinedScore } from "@/lib/rating";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import ApartmentCard from "@/components/ApartmentCard";
import ApartmentCardSkeleton from "@/components/ApartmentCardSkeleton";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Apartment } from "@/lib/db";

type SortKey = "score" | "price_asc" | "price_desc" | "sqft" | "transit";

type ScrapePhase = "idle" | "initial" | "scraping" | "complete";

interface Progress {
  page: number;
  totalPages: number;
  count: number;
}

interface CompleteResult {
  apartments: Apartment[];
  total: number;
  fromCache: boolean;
  stale?: boolean;
  scrapedCount?: number;
  cachedAt?: number;
}


const LOADING_MESSAGES = [
  "Sneaking past StreetEasy's bouncer…",
  "Pretending to be a normal human browser…",
  "Bribing the listing gods with fake user-agents…",
  "Teaching a bot to apartment hunt so you don't have to…",
  "Harvesting data like a digital landlord…",
  "Politely asking StreetEasy to share its listings (it doesn't know)…",
  "Deploying robot minions across 15 pages…",
  "Sipping coffee while the scraper does the heavy lifting…",
  "Reading HTML so you never have to…",
  "Doing 1,500 milliseconds of ethical waiting between pages…",
  "Inspecting DOM nodes like a very nosy neighbor…",
  "Calculating transit scores for apartments you'll probably never visit…",
  "Cross-referencing 300+ subway stations just for you…",
  "Parsing price-per-sqft because your landlord won't tell you…",
  "Loading complete information takes a moment — hang tight!",
];


function formatRelativeTime(unixSeconds: number): string {
  const mins = Math.floor((Date.now() / 1000 - unixSeconds) / 60);
  if (mins < 1) return "just now";
  return `${mins} minute${mins !== 1 ? "s" : ""} ago`;
}

export default function ResultsClient() {
  const searchParams = useSearchParams();
  const neighborhood = searchParams.get("neighborhood") ?? "";
  const beds = searchParams.get("beds") ?? "";
  const baths = searchParams.get("baths") ?? "";
  const minPrice = searchParams.get("minPrice") ?? "";
  const maxPrice = searchParams.get("maxPrice") ?? "";

  // Client-side page (after sort/filter)
  const [clientPage, setClientPage] = useState(1);
  const PAGE_SIZE = 20;

  // Displayed apartments — replaced with first batch, then with final sorted set
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [phase, setPhase] = useState<ScrapePhase>("idle");

  // Client-side sort/filter
  const [sortBy, setSortBy] = useState<SortKey>("score");
  const [minScore, setMinScore] = useState<number>(0);
  const [bedsFilter, setBedsFilter] = useState<string>("any");

  // Reset to page 1 whenever filters/sort change
  useEffect(() => { setClientPage(1); }, [sortBy, minScore, bedsFilter]);

  const [progress, setProgress] = useState<Progress | null>(null);
  const [result, setResult] = useState<CompleteResult | null>(null);
  const [error, setError] = useState("");
  const [cachedAt, setCachedAt] = useState<number | null>(null);
  const [relativeTime, setRelativeTime] = useState<string>("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);

  // Live-update "X minutes ago" label
  useEffect(() => {
    if (!cachedAt) { setRelativeTime(""); return; }
    setRelativeTime(formatRelativeTime(cachedAt));
    const id = setInterval(() => setRelativeTime(formatRelativeTime(cachedAt)), 60_000);
    return () => clearInterval(id);
  }, [cachedAt]);

  // Rotate loading messages while fetching
  useEffect(() => {
    if (phase === "idle" || phase === "scraping") {
      setLoadingMsgIdx(0);
      const id = setInterval(() => setLoadingMsgIdx((i) => (i + 1) % LOADING_MESSAGES.length), 3000);
      return () => clearInterval(id);
    }
  }, [phase]);

  // AbortController ref — cancels in-flight stream when deps change
  const abortRef = useRef<AbortController | null>(null);
  // Ref mirror of apartments so search() can check .length without being a dep
  const apartmentsRef = useRef<Apartment[]>([]);
  useEffect(() => { apartmentsRef.current = apartments; }, [apartments]);

  // All apartments after sort/filter (no pagination — used for counts + pagination math)
  const filteredApartments = useMemo(() => {
    let list = [...apartments];

    // Filter: min score (uses combined score)
    if (minScore > 0) {
      list = list.filter((a) => {
        const combined = getCombinedScore(a.score ?? null, a.transit_score ?? null);
        return combined !== null && combined >= minScore;
      });
    }

    // Filter: beds
    if (bedsFilter !== "any") {
      list = list.filter((a) => {
        if (!a.bedrooms) return false;
        const lower = a.bedrooms.toLowerCase();
        if (bedsFilter === "studio") return lower.includes("studio");
        if (bedsFilter === "4+") {
          const n = parseInt(a.bedrooms);
          return !isNaN(n) && n >= 4;
        }
        return lower.startsWith(bedsFilter);
      });
    }

    // Sort
    list.sort((a, b) => {
      if (sortBy === "score") {
        const aScore = getCombinedScore(a.score ?? null, a.transit_score ?? null) ?? 0;
        const bScore = getCombinedScore(b.score ?? null, b.transit_score ?? null) ?? 0;
        return bScore - aScore;
      }
      if (sortBy === "price_asc") {
        return (a.price_num ?? Infinity) - (b.price_num ?? Infinity);
      }
      if (sortBy === "price_desc") {
        return (b.price_num ?? 0) - (a.price_num ?? 0);
      }
      if (sortBy === "sqft") {
        return (b.sqft_num ?? 0) - (a.sqft_num ?? 0);
      }
      if (sortBy === "transit") {
        return (b.transit_score ?? 0) - (a.transit_score ?? 0);
      }
      return 0;
    });

    return list;
  }, [apartments, sortBy, minScore, bedsFilter]);

  // Current page slice — this is what actually renders in the grid
  const pagedApartments = useMemo(() => {
    const start = (clientPage - 1) * PAGE_SIZE;
    return filteredApartments.slice(start, start + PAGE_SIZE);
  }, [filteredApartments, clientPage, PAGE_SIZE]);

  const totalFilteredPages = Math.ceil(filteredApartments.length / PAGE_SIZE);

  const search = useCallback(async (force = false) => {
    // Cancel any previous request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setPhase("idle");
    if (!force || apartmentsRef.current.length === 0) setApartments([]);
    setProgress(null);
    setResult(null);
    setError("");
    setCachedAt(null);

    const body = JSON.stringify({
      neighborhood,
      beds: beds || undefined,
      baths: baths || undefined,
      minPrice: minPrice ? parseInt(minPrice) : undefined,
      maxPrice: maxPrice ? parseInt(maxPrice) : undefined,
      force: force || undefined,
    });

    let res: Response;
    try {
      res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        signal: controller.signal,
      });
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError("Network error. Please try again.");
      setPhase("complete");
      return;
    }

    const contentType = res.headers.get("content-type") ?? "";

    // --- Cache hit: plain JSON response ---
    if (contentType.includes("application/json")) {
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
      } else {
        setApartments(data.apartments);
        setResult(data);
        if (data.cachedAt) setCachedAt(data.cachedAt);
      }
      setPhase("complete");
      return;
    }

    // --- Live scrape: SSE stream ---
    if (!res.body) {
      setError("No response body.");
      setPhase("complete");
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    const parseEvents = (chunk: string) => {
      buffer += chunk;
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";
      return parts
        .map((p) => p.replace(/^data: /, "").trim())
        .filter(Boolean)
        .map((s) => { try { return JSON.parse(s); } catch { return null; } })
        .filter(Boolean);
    };

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const events = parseEvents(decoder.decode(value, { stream: true }));

        for (const event of events) {
          if (event.type === "initial") {
            // First page results — show immediately, reveal progress bar
            setApartments(event.apartments);
            setProgress({ page: 1, totalPages: event.totalPages, count: event.apartments.length });
            setPhase("scraping");
          } else if (event.type === "progress") {
            setProgress({ page: event.page, totalPages: event.totalPages, count: event.count });
          } else if (event.type === "complete") {
            setApartments(event.apartments);
            setResult(event);
            if (event.cachedAt) setCachedAt(event.cachedAt);
            setProgress(null);
            setPhase("complete");
          } else if (event.type === "error") {
            setError(event.message);
            setPhase("complete");
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError("Stream interrupted. Please try again.");
      setPhase("complete");
    }
  }, [neighborhood, beds, baths, minPrice, maxPrice]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await search(true);
    setIsRefreshing(false);
  }, [search]);

  useEffect(() => {
    if (neighborhood) search();
    return () => abortRef.current?.abort();
  }, [neighborhood, search]);

  const displayNeighborhood = neighborhood.replace(/-/g, " ");
  const isLoading = phase === "idle";
  const isScraping = phase === "scraping";
  const isDone = phase === "complete";

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

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-8">

        {/* Progress bar — shown while scraping pages 2..N */}
        {isScraping && progress && (
          <div className="mb-6 space-y-3">
            <div className="rounded-xl border border-border/50 bg-muted/20 px-5 py-4 flex items-start gap-4">
              <PixelRobot msgIdx={loadingMsgIdx} />
              <div className="space-y-1.5 min-w-0">
                <AnimatePresence mode="wait">
                  <motion.p
                    key={loadingMsgIdx}
                    className="text-sm font-medium text-foreground"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.25 }}
                  >
                    {LOADING_MESSAGES[loadingMsgIdx]}
                  </motion.p>
                </AnimatePresence>
                <p className="text-xs text-muted-foreground">
                  Scores, transit data, and concessions won&apos;t be complete until all pages are loaded.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Page {progress.page} of {progress.totalPages}</span>
              <span>{progress.count} found so far</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${(progress.page / progress.totalPages) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Status line + sort/filter toolbar */}
        {(isDone || isScraping) && apartments.length > 0 && (
          <div className="flex flex-col gap-3 mb-6">
            {/* Status line */}
            {isDone && result && (
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span>
                  {filteredApartments.length === result.total
                    ? `${result.total} apartment${result.total !== 1 ? "s" : ""} found`
                    : `${filteredApartments.length} of ${result.total} shown`}
                </span>
                {result.fromCache ? (
                  <>
                    <Badge variant="secondary" className="text-xs">
                      {result.stale ? "Stale" : "Cached"}
                    </Badge>
                    {relativeTime && (
                      <span className="text-xs text-muted-foreground/70">Updated {relativeTime}</span>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1.5 text-xs px-2"
                      disabled={isRefreshing}
                      onClick={handleRefresh}
                    >
                      <RotateCw className={`h-3 w-3 ${isRefreshing ? "animate-spin" : ""}`} />
                      {isRefreshing ? "Refreshing…" : "Refresh"}
                    </Button>
                  </>
                ) : (
                  <>
                    <Badge variant="secondary" className="text-xs text-primary">Live</Badge>
                    {relativeTime && (
                      <span className="text-xs text-muted-foreground/70">Updated {relativeTime}</span>
                    )}
                    {result.scrapedCount && (
                      <span className="text-xs text-muted-foreground/70">
                        {result.scrapedCount} scraped from StreetEasy
                      </span>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Sort / filter toolbar */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Sort */}
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
                <SelectTrigger className="h-8 w-44 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="score">Best Score</SelectItem>
                  <SelectItem value="price_asc">Price: Low → High</SelectItem>
                  <SelectItem value="price_desc">Price: High → Low</SelectItem>
                  <SelectItem value="sqft">Largest First</SelectItem>
                  <SelectItem value="transit">Best Transit</SelectItem>
                </SelectContent>
              </Select>

              {/* Min score filter */}
              <div className="flex items-center gap-1">
                {([0, 5, 6, 7, 8] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setMinScore(s)}
                    className={`h-8 px-3 rounded-md text-xs font-medium transition-colors border ${
                      minScore === s
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-transparent text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                    }`}
                  >
                    {s === 0 ? "Any score" : `${s}+`}
                  </button>
                ))}
              </div>

              {/* Beds quick filter — only show if search wasn't already scoped to specific beds */}
              {!beds && (
                <div className="flex items-center gap-1">
                  {(["any", "studio", "1", "2", "3", "4+"] as const).map((b) => (
                    <button
                      key={b}
                      onClick={() => setBedsFilter(b)}
                      className={`h-8 px-3 rounded-md text-xs font-medium transition-colors border capitalize ${
                        bedsFilter === b
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-transparent text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                      }`}
                    >
                      {b === "any" ? "Any beds" : b === "studio" ? "Studio" : `${b} bed${b !== "1" ? "s" : ""}`}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-center mb-6">
            <p className="text-destructive font-medium">{error}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => search()}>
              Retry
            </Button>
          </div>
        )}

        {/* Initial skeleton + loading message */}
        {isLoading && (
          <div className="space-y-6">
            <div className="rounded-xl border border-border/50 bg-muted/20 px-5 py-4 flex items-start gap-4">
              <PixelRobot msgIdx={loadingMsgIdx} />
              <div className="space-y-1.5 min-w-0">
                <AnimatePresence mode="wait">
                  <motion.p
                    key={loadingMsgIdx}
                    className="text-sm font-medium text-foreground"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.25 }}
                  >
                    {LOADING_MESSAGES[loadingMsgIdx]}
                  </motion.p>
                </AnimatePresence>
                <p className="text-xs text-muted-foreground">
                  We&apos;re web scraping StreetEasy across multiple pages — this takes 20–60 seconds.{" "}
                  <span className="text-muted-foreground/70">Scores, transit data, and concessions won&apos;t appear until loading is complete.</span>
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <ApartmentCardSkeleton key={i} />
              ))}
            </div>
          </div>
        )}

        {/* Apartments grid */}
        {pagedApartments.length > 0 && (
          <>
            <motion.div
              key={clientPage}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
              initial="hidden"
              animate="show"
              variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}
            >
              {pagedApartments.map((apt) => (
                <motion.div
                  key={apt.id}
                  variants={{
                    hidden: { opacity: 0, y: 16 },
                    show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
                  }}
                >
                  <ApartmentCard apartment={apt} />
                </motion.div>
              ))}
            </motion.div>

            {/* Client-side pagination */}
            {isDone && totalFilteredPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-10">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={clientPage <= 1}
                  onClick={() => setClientPage((p) => p - 1)}
                >
                  ← Previous
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(totalFilteredPages, 7) }, (_, i) => {
                    const p = i + 1;
                    return (
                      <Button
                        key={p}
                        variant={p === clientPage ? "default" : "ghost"}
                        size="sm"
                        className="w-9 h-9 p-0"
                        onClick={() => setClientPage(p)}
                      >
                        {p}
                      </Button>
                    );
                  })}
                  {totalFilteredPages > 7 && (
                    <span className="text-muted-foreground px-2">…</span>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={clientPage >= totalFilteredPages}
                  onClick={() => setClientPage((p) => p + 1)}
                >
                  Next →
                </Button>
              </div>
            )}
          </>
        )}

        {/* Empty state — no results after filters */}
        {isDone && apartments.length > 0 && filteredApartments.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <p className="text-lg font-semibold">No apartments match your filters</p>
            <p className="text-muted-foreground text-sm">Try loosening the score threshold or bed count.</p>
            <Button variant="outline" size="sm" onClick={() => { setMinScore(0); setBedsFilter("any"); }}>
              Clear filters
            </Button>
          </div>
        )}

        {/* Empty state — no results at all */}
        {isDone && apartments.length === 0 && !error && (
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

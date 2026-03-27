import Link from "next/link";
import Navbar from "@/components/Navbar";
import { NEIGHBORHOODS_BY_BOROUGH, NEIGHBORHOOD_MEDIAN_RENTS } from "@/data/neighborhoods";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const SOURCES = [
  {
    name: "StreetEasy Market Reports",
    url: "https://streeteasy.com/blog/data-dashboard/",
    detail: "Neighborhood-level median asking rent data, NYC rental market",
  },
  {
    name: "Zumper NYC Rent Report",
    url: "https://www.zumper.com/blog/nyc-neighborhood-rent-prices/",
    detail: "Monthly median rent by neighborhood across all five boroughs",
  },
  {
    name: "NYC Open Data — Housing & Buildings",
    url: "https://opendata.cityofnewyork.us/",
    detail: "Reference for borough-level rental benchmarks",
  },
];

// Highest median in the dataset, used to size the bars
const MAX_MEDIAN = Math.max(...Object.values(NEIGHBORHOOD_MEDIAN_RENTS));

function RentBar({ price }: { price: number }) {
  const pct = (price / MAX_MEDIAN) * 100;
  const color =
    price >= 5000
      ? "bg-red-500/70"
      : price >= 4000
      ? "bg-orange-500/70"
      : price >= 3200
      ? "bg-yellow-500/70"
      : price >= 2500
      ? "bg-blue-500/70"
      : "bg-green-500/70";

  return (
    <div className="relative h-1.5 w-full rounded-full bg-muted overflow-hidden">
      <div
        className={`absolute left-0 top-0 h-full rounded-full ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function PriceTier({ price }: { price: number }) {
  if (price >= 5000) return <span className="text-[10px] font-medium text-red-400">Premium</span>;
  if (price >= 4000) return <span className="text-[10px] font-medium text-orange-400">High</span>;
  if (price >= 3200) return <span className="text-[10px] font-medium text-yellow-400">Mid-High</span>;
  if (price >= 2500) return <span className="text-[10px] font-medium text-blue-400">Mid</span>;
  return <span className="text-[10px] font-medium text-green-400">Affordable</span>;
}

export default function KeyPage() {
  // Only show named neighborhoods (slug !== borough-level slugs used in All X entries)
  const boroughEntries = Object.entries(NEIGHBORHOODS_BY_BOROUGH).filter(
    ([borough]) => borough !== "All NYC"
  );

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar>
        <Link href="/">
          <Button variant="outline" size="sm">Search</Button>
        </Link>
      </Navbar>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-10 space-y-12">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Neighborhood Price Index</h1>
          <p className="mt-2 text-muted-foreground max-w-2xl">
            Approximate median asking rents used to calculate affordability scores.
            Scores compare a listing&apos;s price to its neighborhood&apos;s median —
            the further below median, the higher the score.
          </p>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
          {[
            { label: "Affordable", color: "bg-green-500/70", range: "< $2,500" },
            { label: "Mid", color: "bg-blue-500/70", range: "$2,500–$3,199" },
            { label: "Mid-High", color: "bg-yellow-500/70", range: "$3,200–$3,999" },
            { label: "High", color: "bg-orange-500/70", range: "$4,000–$4,999" },
            { label: "Premium", color: "bg-red-500/70", range: "$5,000+" },
          ].map(({ label, color, range }) => (
            <span key={label} className="flex items-center gap-1.5">
              <span className={`inline-block h-2.5 w-2.5 rounded-full ${color}`} />
              {label} <span className="text-muted-foreground/60">({range})</span>
            </span>
          ))}
        </div>

        {/* Borough sections */}
        {boroughEntries.map(([borough, hoods]) => {
          // Skip "All X" entries — show only specific neighborhoods
          const specific = hoods
            .filter((h) => h.code !== null)
            .sort((a, b) => (NEIGHBORHOOD_MEDIAN_RENTS[b.slug] ?? 0) - (NEIGHBORHOOD_MEDIAN_RENTS[a.slug] ?? 0));
          return (
            <section key={borough}>
              <h2 className="text-lg font-semibold mb-4">{borough}</h2>
              <div className="rounded-xl border border-border/60 overflow-hidden divide-y divide-border/40">
                {specific.map((hood, i) => {
                  const median = NEIGHBORHOOD_MEDIAN_RENTS[hood.slug];
                  if (!median) return null;
                  return (
                    <div
                      key={hood.slug}
                      className={`flex items-center gap-4 px-4 py-3 ${
                        i % 2 === 0 ? "bg-card" : "bg-muted/20"
                      }`}
                    >
                      <div className="w-44 shrink-0">
                        <p className="text-sm font-medium leading-tight">{hood.name}</p>
                        <PriceTier price={median} />
                      </div>
                      <div className="flex-1">
                        <RentBar price={median} />
                      </div>
                      <div className="w-24 text-right shrink-0">
                        <p className="text-sm font-semibold tabular-nums">
                          ${median.toLocaleString()}
                        </p>
                        <p className="text-[10px] text-muted-foreground">median/mo</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}

        <Separator />

        {/* Sources */}
        <section>
          <h2 className="text-lg font-semibold mb-1">Sources</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Median figures are approximate, derived from the following public sources.
            Data reflects NYC rental market conditions circa 2024–2025 and is refreshed periodically.
          </p>
          <div className="space-y-3">
            {SOURCES.map((s) => (
              <div key={s.name} className="flex items-start gap-3">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <div>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    {s.name}
                  </a>
                  <p className="text-xs text-muted-foreground">{s.detail}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Note: All figures are estimates for informational purposes. Actual market rents
            vary by unit size, floor, amenities, and time of listing.
          </p>
        </section>
      </main>
    </div>
  );
}

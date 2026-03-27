"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import { NEIGHBORHOODS_BY_BOROUGH } from "@/data/neighborhoods";

const BEDS = [
  { value: "studio", label: "Studio" },
  { value: "1", label: "1" },
  { value: "2", label: "2" },
  { value: "3", label: "3" },
  { value: "4+", label: "4+" },
];

const BATHS = [
  { value: "1", label: "1" },
  { value: "1.5", label: "1.5" },
  { value: "2", label: "2" },
  { value: "2.5", label: "2.5" },
  { value: "3+", label: "3+" },
];

function priceOptions() {
  const opts: { value: string; label: string }[] = [];
  for (let p = 500; p <= 10000; p += 500) {
    opts.push({ value: String(p), label: `$${p.toLocaleString()}` });
  }
  return opts;
}

const PRICES = priceOptions();

interface DropdownProps {
  placeholder: string;
  value: string;
  onChange: (v: string | null) => void;
  children: React.ReactNode;
  wide?: boolean;
}

function InlineSelect({ placeholder, value, onChange, children, wide }: DropdownProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        className={`
          inline-flex h-auto py-0.5 px-2 text-2xl md:text-4xl font-semibold
          border-0 border-b-2 border-primary/60 rounded-none bg-transparent
          text-primary shadow-none focus:ring-0 focus:border-primary
          hover:border-primary transition-colors cursor-pointer
          ${wide ? "min-w-[200px]" : "min-w-[120px]"}
          ${!value ? "text-muted-foreground" : ""}
        `}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-72">{children}</SelectContent>
    </Select>
  );
}

export default function PromptCreator() {
  const router = useRouter();
  const [beds, setBeds] = useState("");
  const [baths, setBaths] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");

  const set = (setter: (v: string) => void) => (v: string | null) => setter(v ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function isValid() {
    return neighborhood.length > 0;
  }

  async function handleSearch() {
    if (!isValid()) {
      setError("Please select at least a neighborhood.");
      return;
    }
    setError("");
    setLoading(true);

    const params = new URLSearchParams({ neighborhood });
    if (beds) params.set("beds", beds);
    if (baths) params.set("baths", baths);
    if (minPrice) params.set("minPrice", minPrice);
    if (maxPrice) params.set("maxPrice", maxPrice);

    router.push(`/results?${params.toString()}`);
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <div className="flex flex-col items-center justify-center flex-1 px-4 gap-12">
      {/* Brand */}
      <div className="text-center">
        <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
          Easier<span className="text-primary">Avenue</span>
        </h1>
        <p className="text-muted-foreground mt-2 text-lg">
          NYC apartment search, smarter.
        </p>
      </div>

      {/* Prompt card */}
      <div className="w-full max-w-4xl rounded-2xl border border-border bg-card p-8 md:p-12 shadow-2xl shadow-primary/5">
        <p className="text-muted-foreground text-sm uppercase tracking-widest mb-6 font-medium">
          Tell us what you&apos;re looking for
        </p>

        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-4 text-2xl md:text-4xl font-semibold text-foreground leading-relaxed">
          <span>I&apos;m looking for a</span>

          <InlineSelect
            placeholder="beds"
            value={beds}
            onChange={set(setBeds)}
          >
            {BEDS.map((b) => (
              <SelectItem key={b.value} value={b.value}>
                {b.label}
              </SelectItem>
            ))}
          </InlineSelect>

          <span>bed</span>

          <InlineSelect
            placeholder="baths"
            value={baths}
            onChange={set(setBaths)}
          >
            {BATHS.map((b) => (
              <SelectItem key={b.value} value={b.value}>
                {b.label}
              </SelectItem>
            ))}
          </InlineSelect>

          <span>bath apartment in</span>

          <InlineSelect
            placeholder="neighborhood"
            value={neighborhood}
            onChange={set(setNeighborhood)}
            wide
          >
            {Object.entries(NEIGHBORHOODS_BY_BOROUGH).map(([borough, hoods]) => (
              <SelectGroup key={borough}>
                <SelectLabel>{borough}</SelectLabel>
                {hoods.map((n) => (
                  <SelectItem key={n.slug} value={n.slug}>
                    {n.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </InlineSelect>

          <span>. My ideal price is</span>

          <InlineSelect
            placeholder="$min"
            value={minPrice}
            onChange={set(setMinPrice)}
          >
            {PRICES.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </InlineSelect>

          <span>to</span>

          <InlineSelect
            placeholder="$max"
            value={maxPrice}
            onChange={set(setMaxPrice)}
          >
            {PRICES.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </InlineSelect>

          <span>.</span>
        </div>

        {error && (
          <p className="mt-4 text-sm text-destructive">{error}</p>
        )}

        <div className="mt-10 flex items-center gap-4">
          <Button
            size="lg"
            onClick={handleSearch}
            disabled={loading || !isValid()}
            className="px-10 text-base font-semibold"
          >
            {loading ? "Searching…" : "Find Apartments"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Only neighborhood is required
          </p>
        </div>
      </div>
      </div>
    </div>
  );
}

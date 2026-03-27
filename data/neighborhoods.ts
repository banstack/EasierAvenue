export interface Neighborhood {
  name: string;
  slug: string;
  code: number | null;
  borough: string;
}

export const NEIGHBORHOODS_BY_BOROUGH: Record<string, Neighborhood[]> = {
  "All NYC": [{ name: "All of NYC", slug: "nyc", code: null, borough: "All NYC" }],
  Manhattan: [
    { name: "All Manhattan", slug: "manhattan", code: null, borough: "Manhattan" },
    { name: "Upper West Side", slug: "upper-west-side", code: 302, borough: "Manhattan" },
    { name: "Upper East Side", slug: "upper-east-side", code: 301, borough: "Manhattan" },
    { name: "Midtown", slug: "midtown", code: 109, borough: "Manhattan" },
    { name: "Chelsea", slug: "chelsea", code: 106, borough: "Manhattan" },
    { name: "Hell's Kitchen", slug: "hells-kitchen", code: 107, borough: "Manhattan" },
    { name: "Gramercy / Murray Hill", slug: "gramercy", code: 111, borough: "Manhattan" },
    { name: "East Village", slug: "east-village", code: 112, borough: "Manhattan" },
    { name: "West Village", slug: "west-village", code: 113, borough: "Manhattan" },
    { name: "Lower East Side", slug: "lower-east-side", code: 114, borough: "Manhattan" },
    { name: "SoHo", slug: "soho", code: 115, borough: "Manhattan" },
    { name: "Tribeca", slug: "tribeca", code: 116, borough: "Manhattan" },
    { name: "Financial District", slug: "financial-district", code: 117, borough: "Manhattan" },
    { name: "Harlem", slug: "harlem", code: 118, borough: "Manhattan" },
    { name: "Washington Heights", slug: "washington-heights", code: 119, borough: "Manhattan" },
  ],
  Brooklyn: [
    { name: "All Brooklyn", slug: "brooklyn", code: null, borough: "Brooklyn" },
    { name: "Brooklyn Heights", slug: "brooklyn-heights", code: 203, borough: "Brooklyn" },
    { name: "Williamsburg", slug: "williamsburg", code: 204, borough: "Brooklyn" },
    { name: "Park Slope", slug: "park-slope", code: 206, borough: "Brooklyn" },
    { name: "Bushwick", slug: "bushwick", code: 207, borough: "Brooklyn" },
    { name: "DUMBO", slug: "dumbo", code: 208, borough: "Brooklyn" },
    { name: "Crown Heights", slug: "crown-heights", code: 209, borough: "Brooklyn" },
    { name: "Bed-Stuy", slug: "bedford-stuyvesant", code: 210, borough: "Brooklyn" },
    { name: "Carroll Gardens", slug: "carroll-gardens", code: 212, borough: "Brooklyn" },
    { name: "Cobble Hill", slug: "cobble-hill", code: 213, borough: "Brooklyn" },
    { name: "Fort Greene", slug: "fort-greene", code: 214, borough: "Brooklyn" },
    { name: "Sunset Park", slug: "sunset-park", code: 216, borough: "Brooklyn" },
    { name: "Bay Ridge", slug: "bay-ridge", code: 217, borough: "Brooklyn" },
  ],
  Queens: [
    { name: "All Queens", slug: "queens", code: null, borough: "Queens" },
    { name: "Long Island City", slug: "long-island-city", code: 411, borough: "Queens" },
    { name: "Astoria", slug: "astoria", code: 412, borough: "Queens" },
    { name: "Jackson Heights", slug: "jackson-heights", code: 413, borough: "Queens" },
    { name: "Flushing", slug: "flushing", code: 414, borough: "Queens" },
    { name: "Forest Hills", slug: "forest-hills", code: 415, borough: "Queens" },
    { name: "Sunnyside", slug: "sunnyside", code: 416, borough: "Queens" },
  ],
  Bronx: [
    { name: "All Bronx", slug: "bronx", code: null, borough: "Bronx" },
    { name: "Riverdale", slug: "riverdale", code: 501, borough: "Bronx" },
    { name: "Fordham", slug: "fordham", code: 502, borough: "Bronx" },
  ],
};

export const ALL_NEIGHBORHOODS: Neighborhood[] = Object.values(NEIGHBORHOODS_BY_BOROUGH).flat();

export function getNeighborhoodBySlug(slug: string): Neighborhood | undefined {
  return ALL_NEIGHBORHOODS.find((n) => n.slug === slug);
}

export function buildStreetEasyUrl(params: {
  neighborhood: string;
  beds?: string;
  minPrice?: number;
  maxPrice?: number;
}): string {
  const { neighborhood, beds, minPrice, maxPrice } = params;
  const filters: string[] = [];

  if (minPrice && maxPrice) {
    filters.push(`price:${minPrice}-${maxPrice}`);
  } else if (maxPrice) {
    filters.push(`price:-${maxPrice}`);
  } else if (minPrice) {
    filters.push(`price:${minPrice}-`);
  }

  if (beds && beds !== "any") {
    if (beds === "studio") {
      filters.push("beds:0");
    } else if (beds === "4+") {
      filters.push("beds%3E=4");
    } else {
      filters.push(`beds:${beds}`);
    }
  }

  const base = `https://streeteasy.com/for-rent/${neighborhood}`;
  return filters.length > 0 ? `${base}/${filters.join("|")}` : base;
}

// Neighborhood median rents (approximate, used for scoring)
// Higher price = more desirable area. Scores normalized to 1-10.
export const NEIGHBORHOOD_MEDIAN_RENTS: Record<string, number> = {
  tribeca: 6500,
  soho: 5800,
  "west-village": 5500,
  "financial-district": 4800,
  chelsea: 4700,
  "upper-east-side": 4500,
  "upper-west-side": 4200,
  "east-village": 4000,
  midtown: 4000,
  "hells-kitchen": 3800,
  gramercy: 3800,
  "lower-east-side": 3600,
  harlem: 3200,
  "washington-heights": 2800,
  "brooklyn-heights": 4200,
  dumbo: 4500,
  "carroll-gardens": 3800,
  "cobble-hill": 3700,
  "park-slope": 3600,
  "fort-greene": 3500,
  williamsburg: 3800,
  "crown-heights": 3000,
  "bedford-stuyvesant": 2900,
  bushwick: 2700,
  "sunset-park": 2500,
  "bay-ridge": 2400,
  "long-island-city": 3500,
  astoria: 3000,
  "forest-hills": 2800,
  sunnyside: 2600,
  "jackson-heights": 2400,
  flushing: 2300,
  riverdale: 2500,
  fordham: 1900,
  nyc: 3500,
  manhattan: 4500,
  brooklyn: 3200,
  queens: 2700,
  bronx: 2200,
};

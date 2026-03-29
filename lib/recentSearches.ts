const RECENT_SEARCHES_KEY = "ea_recent_searches";
const MAX_RECENT_SEARCHES = 5;

export interface RecentSearch {
  id: string;
  neighborhood: string;
  beds: string;
  baths: string;
  minPrice: string;
  maxPrice: string;
  savedAt: number;
}

export interface SearchParams {
  neighborhood: string;
  beds: string;
  baths: string;
  minPrice: string;
  maxPrice: string;
}

function buildSearchId(params: SearchParams): string {
  return `${params.neighborhood}|${params.beds}|${params.baths}|${params.minPrice}|${params.maxPrice}`;
}

export function loadRecentSearches(): RecentSearch[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) ?? "[]") as RecentSearch[];
  } catch {
    return [];
  }
}

export function saveRecentSearch(params: SearchParams): void {
  if (typeof window === "undefined") return;
  const id = buildSearchId(params);
  const existing = loadRecentSearches().filter((s) => s.id !== id);
  const updated = [{ ...params, id, savedAt: Date.now() }, ...existing].slice(0, MAX_RECENT_SEARCHES);
  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
}

type NeighborhoodLookup = (slug: string) => { name: string } | undefined;

export function buildSearchLabel(search: RecentSearch, getNeighborhoodBySlug: NeighborhoodLookup): string {
  const parts: string[] = [];

  if (search.beds) {
    parts.push(search.beds === "studio" ? "Studio" : `${search.beds} bed`);
  }
  if (search.baths) {
    parts.push(`${search.baths} bath`);
  }

  parts.push(getNeighborhoodBySlug(search.neighborhood)?.name ?? search.neighborhood);

  if (search.minPrice && search.maxPrice) {
    parts.push(`$${Number(search.minPrice).toLocaleString()}–$${Number(search.maxPrice).toLocaleString()}`);
  } else if (search.minPrice) {
    parts.push(`from $${Number(search.minPrice).toLocaleString()}`);
  } else if (search.maxPrice) {
    parts.push(`up to $${Number(search.maxPrice).toLocaleString()}`);
  }

  return parts.join(" · ");
}

export function buildSearchUrl(params: SearchParams): string {
  const p = new URLSearchParams({ neighborhood: params.neighborhood });
  if (params.beds) p.set("beds", params.beds);
  if (params.baths) p.set("baths", params.baths);
  if (params.minPrice) p.set("minPrice", params.minPrice);
  if (params.maxPrice) p.set("maxPrice", params.maxPrice);
  return `/results?${p.toString()}`;
}

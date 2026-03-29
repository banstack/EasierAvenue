export interface Coordinates {
  lat: number;
  lng: number;
}

const STREET_KEYWORDS =
  /\b(street|avenue|ave|road|rd|place|pl|drive|dr|blvd|boulevard|lane|ln|way|court|ct|broadway)\b/i;

/**
 * Returns true if the string looks like a geocodeable street address.
 * Requires a digit somewhere AND a street-type keyword — filters out
 * pure neighborhood names like "Upper East Side".
 */
function looksLikeAddress(s: string): boolean {
  return /\d/.test(s) && STREET_KEYWORDS.test(s);
}

/**
 * Pick the best geocodeable string for a listing:
 *   1. Use the title if it looks like a street address (title from StreetEasy
 *      alt text often IS the full address, e.g. "250 East 87th Street 9G")
 *   2. Fall back to the address field (which the scraper sometimes truncates)
 */
function bestAddressString(item: {
  address: string | null;
  title: string;
}): string | null {
  if (looksLikeAddress(item.title)) return item.title;
  if (item.address && looksLikeAddress(item.address)) return item.address;
  return null;
}

/**
 * Batch-geocode up to 10,000 addresses in a single Census Geocoder request.
 * Free, no API key, ~3–5 seconds for a full batch.
 *
 * Returns a Map of listing ID → coordinates for every address that matched.
 */
export async function batchGeocode(
  items: Array<{ id: string; address: string | null; title: string }>
): Promise<Map<string, Coordinates>> {
  const rows: Array<{ id: string; street: string }> = [];

  for (const item of items) {
    const street = bestAddressString(item);
    if (street) rows.push({ id: item.id, street });
  }

  console.log(`Geocoding: ${rows.length}/${items.length} listings have geocodeable addresses`);
  if (rows.length === 0) return new Map();

  // CSV: ID, Street, City, State, ZIP  (Census format)
  const csv = rows
    .map(({ id, street }) => `"${id}","${street.replace(/"/g, "")}","New York","NY",""`)
    .join("\n");

  const formData = new FormData();
  formData.append(
    "addressFile",
    new Blob([csv], { type: "text/plain" }),
    "addresses.csv"
  );
  formData.append("benchmark", "Public_AR_Current");

  let text: string;
  try {
    const res = await fetch(
      "https://geocoding.geo.census.gov/geocoder/locations/addressbatch",
      { method: "POST", body: formData }
    );
    if (!res.ok) {
      console.warn(`Census geocoder returned HTTP ${res.status}`);
      return new Map();
    }
    text = await res.text();
  } catch (err) {
    console.warn("Census geocoder request failed:", err);
    return new Map();
  }

  // Response CSV columns:
  //   ID, InputAddress, MatchStatus, MatchType, MatchedAddress, "lng,lat", TigerID, Side
  //
  // NOTE: The coordinate field is longitude-first: "-73.9522,40.7789"
  const results = new Map<string, Coordinates>();

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Split on commas that are outside quotes
    const fields = trimmed
      .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
      .map((f) => f.replace(/^"|"$/g, "").trim());

    const id          = fields[0];
    const matchStatus = fields[2]; // "Match" | "No_Match" | "Tie"
    const coordField  = fields[5]; // "-73.9522,40.7789"

    if (!id || !coordField) continue;
    if (matchStatus !== "Match" && matchStatus !== "Tie") continue;

    // Census returns lng,lat — not lat,lng
    const [lngStr, latStr] = coordField.split(",");
    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);

    if (!isNaN(lat) && !isNaN(lng)) {
      results.set(id, { lat, lng });
    }
  }

  console.log(`Census geocoder: ${results.size}/${rows.length} addresses matched`);
  return results;
}

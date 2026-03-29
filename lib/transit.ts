import stations from "@/data/subway-stations.json";

export interface SubwayStation {
  name: string;
  lines: string[];
  borough: string;
  lat: number;
  lng: number;
}

export interface TransitBreakdown {
  transitScore: number;
  nearestStation: SubwayStation;
  distanceMiles: number;
  walkMinutes: number;
  nearbyStations: Array<{ station: SubwayStation; distanceMiles: number }>;
}

/** Haversine distance in miles between two lat/lng points. */
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8; // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function distanceToScore(miles: number): number {
  if (miles < 0.1)  return 10;
  if (miles < 0.25) return 8;
  if (miles < 0.5)  return 6;
  if (miles < 0.75) return 4;
  if (miles < 1.0)  return 2;
  return 1;
}

export function transitScoreColor(score: number): string {
  if (score >= 8) return "text-green-400";
  if (score >= 6) return "text-blue-400";
  if (score >= 4) return "text-yellow-400";
  return "text-red-400";
}

export function transitScoreBgColor(score: number): string {
  if (score >= 8) return "bg-green-950/80 border-green-800/60 text-green-300";
  if (score >= 6) return "bg-blue-950/80 border-blue-800/60 text-blue-300";
  if (score >= 4) return "bg-yellow-950/80 border-yellow-800/60 text-yellow-300";
  return "bg-red-950/80 border-red-800/60 text-red-300";
}

export function transitScoreLabel(score: number): string {
  if (score >= 8) return "Excellent";
  if (score >= 6) return "Good";
  if (score >= 4) return "Fair";
  return "Poor";
}

export function getTransitBreakdown(lat: number, lng: number): TransitBreakdown {
  const allStations = stations as SubwayStation[];

  const withDistance = allStations.map((s) => ({
    station: s,
    distanceMiles: Math.round(haversineDistance(lat, lng, s.lat, s.lng) * 100) / 100,
  }));

  withDistance.sort((a, b) => a.distanceMiles - b.distanceMiles);

  const nearest = withDistance[0];
  const walkMinutes = Math.round((nearest.distanceMiles / 0.04) ); // ~4 min/0.25mi walking pace
  const score = distanceToScore(nearest.distanceMiles);

  return {
    transitScore: score,
    nearestStation: nearest.station,
    distanceMiles: nearest.distanceMiles,
    walkMinutes,
    nearbyStations: withDistance.slice(0, 5),
  };
}

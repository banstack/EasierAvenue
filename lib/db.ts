import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_DIR = process.env.DB_DIR || path.join(process.cwd(), "data");
const DB_PATH = path.join(DB_DIR, "apartments.db");

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (_db) return _db;

  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  initSchema(_db);
  return _db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS apartments (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      price TEXT NOT NULL,
      price_num INTEGER,
      address TEXT,
      neighborhood TEXT,
      url TEXT NOT NULL,
      bedrooms TEXT,
      bathrooms TEXT,
      sqft TEXT,
      sqft_num INTEGER,
      image_url TEXT,
      score REAL,
      cached_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE INDEX IF NOT EXISTS idx_neighborhood ON apartments(neighborhood);
    CREATE INDEX IF NOT EXISTS idx_cached_at ON apartments(cached_at);

    CREATE TABLE IF NOT EXISTS neighborhood_stats (
      neighborhood TEXT PRIMARY KEY,
      median_price INTEGER NOT NULL,
      avg_price_per_sqft REAL,
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `);
}

export interface Apartment {
  id: string;
  title: string;
  price: string;
  price_num: number | null;
  address: string | null;
  neighborhood: string | null;
  url: string;
  bedrooms: string | null;
  bathrooms: string | null;
  sqft: string | null;
  sqft_num: number | null;
  image_url: string | null;
  score: number | null;
  cached_at: number;
}

const CACHE_TTL_SECONDS = 10 * 60; // 10 minutes

export function getCachedApartments(params: {
  neighborhood: string;
  beds?: string;
  baths?: string;
  minPrice?: number;
  maxPrice?: number;
  page?: number;
  pageSize?: number;
}): { apartments: Apartment[]; total: number; fromCache: boolean } {
  const db = getDb();
  const { neighborhood, beds, baths, minPrice, maxPrice, page = 1, pageSize = 20 } = params;

  const cutoff = Math.floor(Date.now() / 1000) - CACHE_TTL_SECONDS;

  // Check if we have fresh data for this search
  const freshCount = db
    .prepare(
      `SELECT COUNT(*) as cnt FROM apartments
       WHERE neighborhood = ? AND cached_at > ?`
    )
    .get(neighborhood, cutoff) as { cnt: number };

  const fromCache = freshCount.cnt > 0;

  // Build filter query
  const conditions: string[] = ["neighborhood = ?"];
  const values: (string | number)[] = [neighborhood];

  if (beds && beds !== "any") {
    const bedsNum = beds === "studio" ? 0 : parseInt(beds);
    if (!isNaN(bedsNum)) {
      conditions.push("CAST(REPLACE(REPLACE(bedrooms, ' bed', ''), 'Studio', '0') AS INTEGER) = ?");
      values.push(bedsNum);
    }
  }

  if (minPrice) {
    conditions.push("price_num >= ?");
    values.push(minPrice);
  }

  if (maxPrice) {
    conditions.push("price_num <= ?");
    values.push(maxPrice);
  }

  const where = conditions.join(" AND ");
  const offset = (page - 1) * pageSize;

  const total = (
    db.prepare(`SELECT COUNT(*) as cnt FROM apartments WHERE ${where}`).get(...values) as { cnt: number }
  ).cnt;

  const apartments = db
    .prepare(
      `SELECT * FROM apartments WHERE ${where}
       ORDER BY score DESC NULLS LAST, cached_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(...values, pageSize, offset) as Apartment[];

  return { apartments, total, fromCache };
}

export function saveApartments(apartments: Apartment[]) {
  const db = getDb();
  const insert = db.prepare(`
    INSERT OR REPLACE INTO apartments
      (id, title, price, price_num, address, neighborhood, url,
       bedrooms, bathrooms, sqft, sqft_num, image_url, score, cached_at)
    VALUES
      (@id, @title, @price, @price_num, @address, @neighborhood, @url,
       @bedrooms, @bathrooms, @sqft, @sqft_num, @image_url, @score, @cached_at)
  `);

  const insertMany = db.transaction((apts: Apartment[]) => {
    for (const apt of apts) {
      insert.run(apt);
    }
  });

  insertMany(apartments);
}

export function getNeighborhoodStats(
  neighborhood: string
): { median_price: number; avg_price_per_sqft: number | null } | null {
  const db = getDb();
  return db
    .prepare("SELECT median_price, avg_price_per_sqft FROM neighborhood_stats WHERE neighborhood = ?")
    .get(neighborhood) as { median_price: number; avg_price_per_sqft: number | null } | null;
}

export function upsertNeighborhoodStats(
  neighborhood: string,
  median_price: number,
  avg_price_per_sqft: number | null
) {
  const db = getDb();
  db.prepare(`
    INSERT OR REPLACE INTO neighborhood_stats (neighborhood, median_price, avg_price_per_sqft, updated_at)
    VALUES (?, ?, ?, unixepoch())
  `).run(neighborhood, median_price, avg_price_per_sqft);
}

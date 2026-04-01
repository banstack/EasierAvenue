-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "apartments" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "price" TEXT NOT NULL,
    "price_num" BIGINT,
    "address" TEXT,
    "neighborhood" TEXT,
    "url" TEXT NOT NULL,
    "bedrooms" TEXT,
    "bathrooms" TEXT,
    "sqft" TEXT,
    "sqft_num" BIGINT,
    "image_url" TEXT,
    "score" DOUBLE PRECISION,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "transit_score" DOUBLE PRECISION,
    "net_effective_price" BIGINT,
    "months_free" DOUBLE PRECISION,
    "lease_term" TEXT,
    "price_reduction" BIGINT,
    "first_seen_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "apartments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "neighborhood_stats" (
    "neighborhood" TEXT NOT NULL,
    "median_price" BIGINT NOT NULL,
    "avg_price_per_sqft" DOUBLE PRECISION,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "neighborhood_stats_pkey" PRIMARY KEY ("neighborhood")
);

-- CreateTable
CREATE TABLE "scrape_locks" (
    "neighborhood" TEXT NOT NULL,
    "locked_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scrape_locks_pkey" PRIMARY KEY ("neighborhood")
);

-- CreateIndex
CREATE INDEX "apartments_neighborhood_idx" ON "apartments"("neighborhood");

-- CreateIndex
CREATE INDEX "apartments_last_seen_at_idx" ON "apartments"("last_seen_at");

-- CreateIndex
CREATE INDEX "apartments_first_seen_at_idx" ON "apartments"("first_seen_at");

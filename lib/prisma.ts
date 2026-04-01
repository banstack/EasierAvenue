import { PrismaClient } from "@/lib/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  // Prefer the private internal URL on Railway (no SSL hop needed).
  // Fall back to the public DATABASE_URL with SSL for external access.
  const privateUrl = process.env.DATABASE_PRIVATE_URL;
  const publicUrl = process.env.DATABASE_URL;
  const connectionString = privateUrl ?? publicUrl;

  if (!connectionString) {
    throw new Error("Neither DATABASE_PRIVATE_URL nor DATABASE_URL is set");
  }

  const ssl = !privateUrl ? { rejectUnauthorized: false } : undefined;

  const adapter = new PrismaPg({ connectionString, ssl });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

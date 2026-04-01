import { PrismaClient } from "@/lib/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";

let _client: PrismaClient | undefined;

function getClient(): PrismaClient {
  if (_client) return _client;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const adapter = new PrismaPg({ connectionString, ssl: { rejectUnauthorized: false } });
  _client = new PrismaClient({ adapter });
  return _client;
}

// Proxy defers client initialization until the first actual query,
// so importing this module during Next.js build doesn't require a DB connection.
export const prisma = new Proxy({} as PrismaClient, {
  get(_, prop, receiver) {
    const client = getClient();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

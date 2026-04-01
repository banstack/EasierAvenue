import { PrismaClient } from "@/lib/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";

let _client: PrismaClient | undefined;

function getClient(): PrismaClient {
  if (_client) return _client;

  const privateUrl = process.env.DATABASE_PRIVATE_URL;
  const publicUrl = process.env.DATABASE_URL;
  const connectionString = privateUrl ?? publicUrl;

  if (!connectionString) {
    throw new Error("Neither DATABASE_PRIVATE_URL nor DATABASE_URL is set");
  }

  const ssl = !privateUrl ? { rejectUnauthorized: false } : undefined;
  const adapter = new PrismaPg({ connectionString, ssl });
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

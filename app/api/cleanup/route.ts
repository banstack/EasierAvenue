import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;

  if (!process.env.CRON_SECRET || auth !== expected) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

  const [deletedApartments, deletedLocks] = await Promise.all([
    prisma.apartment.deleteMany({
      where: { last_seen_at: { lt: threeDaysAgo } },
    }),
    prisma.scrapeLock.deleteMany({
      where: { locked_at: { lt: fiveMinutesAgo } },
    }),
  ]);

  return new Response(
    JSON.stringify({
      deletedApartments: deletedApartments.count,
      deletedLocks: deletedLocks.count,
    }),
    { headers: { "Content-Type": "application/json" } }
  );
}

/**
 * Shared Mastra storage + memory factory.
 *
 * Postgres (Neon) via @mastra/pg. The connection string comes exclusively from
 * the environment so the built bundle stays host-agnostic and serverless-safe
 * (no host-local file path — works on Vercel / Mastra Cloud out of the box):
 *   - MASTRA_DB_URL = a Postgres connection string. On Neon, use the *pooled*
 *     endpoint (…-pooler.…neon.tech/…?sslmode=require) so serverless functions
 *     don't exhaust connections.
 * Mastra creates its own `mastra_*` prefixed tables, so it coexists with the
 * Prisma/better-auth tables in the same database. Server-only.
 */
import { PostgresStore } from "@mastra/pg";
import { Memory } from "@mastra/memory";

const connectionString = process.env.MASTRA_DB_URL;
if (!connectionString) {
  throw new Error(
    "MASTRA_DB_URL is not set — copy .env.example to .env for local dev, " +
      "or configure a Postgres (Neon) connection string in your deploy env.",
  );
}

export const storage = new PostgresStore({ id: "classroomsim", connectionString });

/** Short conversation memory bound to the shared store (one per agent). */
export function makeMemory(): Memory {
  return new Memory({
    storage,
    options: { lastMessages: 10, semanticRecall: false },
  });
}

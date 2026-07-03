/**
 * Shared Mastra storage + memory factory.
 *
 * LibSQL (pure JS, no native build). The URL comes exclusively from the
 * environment so the built bundle stays host-agnostic:
 *   - local dev: a local SQLite URL (see .env.example)
 *   - Mastra Cloud / prod: a hosted libsql://… (Turso) or Postgres URL, with
 *     MASTRA_DB_AUTH_TOKEN set for authenticated remotes.
 * Server-only.
 */
import { LibSQLStore } from "@mastra/libsql";
import { Memory } from "@mastra/memory";

const url = process.env.MASTRA_DB_URL;
if (!url) {
  throw new Error(
    "MASTRA_DB_URL is not set — copy .env.example to .env for local dev, " +
      "or configure a hosted libsql:// URL on Mastra Cloud.",
  );
}

export const storage = new LibSQLStore({
  id: "classroomsim",
  url,
  authToken: process.env.MASTRA_DB_AUTH_TOKEN,
});

/** Short conversation memory bound to the shared store (one per agent). */
export function makeMemory(): Memory {
  return new Memory({
    storage,
    options: { lastMessages: 10, semanticRecall: false },
  });
}

/**
 * Shared Mastra storage + memory factory.
 *
 * SQLite-on-disk via LibSQL (pure JS, no native build). Used both to register
 * storage on the Mastra instance and to give each agent persistent memory.
 * Server-only.
 */
import { LibSQLStore } from "@mastra/libsql";
import { Memory } from "@mastra/memory";

const url = process.env.MASTRA_DB_URL ?? "file:./mastra.db";

export const storage = new LibSQLStore({ id: "classroomsim", url });

/** Short conversation memory bound to the shared store (one per agent). */
export function makeMemory(): Memory {
  return new Memory({
    storage,
    options: { lastMessages: 10, semanticRecall: false },
  });
}

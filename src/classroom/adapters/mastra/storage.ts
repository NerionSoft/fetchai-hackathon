/**
 * Mastra storage — in-process LibSQL (`:memory:`).
 *
 * The ClassroomSim loop runs synchronously within a single request and never
 * needs cross-invocation persistence, so we use an ephemeral in-memory store:
 *   - zero network / DB latency (pure RAM, in-process),
 *   - serverless-safe (a fresh store per invocation is exactly what we want),
 *   - no external database dependency for the loop.
 *
 * This keeps a full run to a few seconds even on serverless with the platform's
 * short function timeout. (Auth/Prisma persistence is entirely separate and
 * still uses Neon via DATABASE_URL.)
 */
import { LibSQLStore } from "@mastra/libsql";

export const storage = new LibSQLStore({ id: "classroomsim", url: ":memory:" });

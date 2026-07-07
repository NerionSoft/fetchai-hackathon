/**
 * Error code → HTTP status mapping for the classroom hexagone.
 *
 * Register these in `instrumentation.ts` once the shared api-handler is enabled
 * (it is intentionally disabled today — ClassroomSim boots without a DB/auth, so
 * loading the api-handler would transitively require DATABASE_URL). Kept here as
 * the single source of truth for when that wiring is turned on.
 */
export const classroomErrorMappings: Record<string, number> = {
  NO_RESTITUTION: 422,
};

// ClassroomSim boots WITHOUT a database or auth. The starter's hexagone
// error-mapping registration is intentionally disabled here, because importing
// the api-handler transitively loads better-auth → prisma → env (which requires
// DATABASE_URL). Re-enable per-hexagone registration once a real DB is wired.
export function register() {}

/**
 * Classroom domain — public barrel.
 *
 * The single source of truth for the loop's data contract (value objects +
 * entity schemas). These Zod schemas ARE the contract passed between agents
 * through the application use case; they contain ZERO runtime dependency on any
 * agent framework, so they are safe to import from both the server (use case /
 * adapters) and the client (React result panels).
 */
export * from "./value-objects/axes";
export * from "./entities/lesson";
export * from "./entities/student-restitution";
export * from "./entities/teacher-diagnosis";
export * from "./entities/fact-check";
export * from "./entities/production";
export * from "./entities/loop-result";

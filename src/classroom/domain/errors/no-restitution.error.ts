import { DomainError } from "@/shared/errors/domain-error";

/**
 * Raised by the simulate step when not a single student-agent produced a
 * restitution — the loop cannot proceed. Usually means real providers are
 * selected but no API key is configured (enable mock mode to run key-free).
 */
export class NoRestitutionError extends DomainError {
  constructor() {
    super(
      "NO_RESTITUTION",
      "No restitution was produced — check the API keys or enable mock mode.",
    );
  }
}

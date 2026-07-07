/**
 * Presentation-only color helpers for the classroom scene. Pure, client-safe.
 * (Agent hue derivation lives in the domain — see `agent-color.ts` — because the
 * server stamps it onto the cast.)
 */

/** Pastille color per provider (fixed, recognizable). */
export const PROVIDER_COLORS: Record<string, string> = {
  anthropic: "#d97757",
  openai: "#10a37f",
  google: "#4285f4",
  deepseek: "#7c3aed",
  mock: "#6b7280",
};

/** First non-space character, uppercased, for the circle label. */
export function initialFor(label: string): string {
  return (label.trim()[0] ?? "?").toUpperCase();
}

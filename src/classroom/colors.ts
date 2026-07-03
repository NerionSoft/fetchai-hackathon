/**
 * Deterministic color derivation — the same studentId always yields the same
 * hue, so an agent keeps its color from one loop to the next. Pure, no deps.
 */

/** FNV-1a 32-bit hash → stable integer from a string. */
function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Stable HSL fill for an agent bubble, derived from its id. */
export function colorForId(id: string): { hue: number; fill: string; stroke: string } {
  const hue = hashString(id) % 360;
  return {
    hue,
    fill: `hsl(${hue} 65% 55%)`,
    stroke: `hsl(${hue} 70% 32%)`,
  };
}

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

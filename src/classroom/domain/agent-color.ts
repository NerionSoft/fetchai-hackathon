/**
 * Deterministic color derivation — the same agent id always yields the same hue,
 * so an agent keeps its color from one loop to the next. Used server-side to
 * stamp the scene cast and client-side to render it. Pure, no deps.
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

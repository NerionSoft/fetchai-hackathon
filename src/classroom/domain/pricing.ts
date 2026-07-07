/**
 * Rough provider pricing — used only for the on-screen cost estimate. Pure data
 * + a pure function; no runtime dependency.
 */
import type { Provider } from "./value-objects/axes";

/** Rough USD cost per 1M tokens. */
export const COST_PER_MTOK: Record<Provider, { input: number; output: number }> = {
  anthropic: { input: 3, output: 15 },
  openai: { input: 0.4, output: 1.6 },
  google: { input: 0.3, output: 2.5 },
  deepseek: { input: 0.28, output: 0.42 },
  mock: { input: 0, output: 0 },
};

export function estimateCostUsd(provider: Provider, inputTokens: number, outputTokens: number): number {
  const c = COST_PER_MTOK[provider];
  return (inputTokens / 1_000_000) * c.input + (outputTokens / 1_000_000) * c.output;
}

/**
 * ClassroomSim — runtime configuration & provider resolution.
 *
 * Budget-safe by default: even with API keys present, the loop runs on the
 * deterministic MOCK provider UNLESS the operator explicitly opts into real
 * providers via DEV_SINGLE_PROVIDER (one provider) or DEMO_MODE=true (all four).
 *
 * Server-only (reads process.env). Do NOT import from client components.
 */
import type { Provider } from "@/classroom/schemas";
import type { RealProvider } from "@/classroom/roster";

const REAL_PROVIDERS: RealProvider[] = ["anthropic", "openai", "google", "deepseek"];

/** Env var(s) holding each provider's API key (verified against the model router). */
const API_KEY_ENV: Record<RealProvider, string[]> = {
  anthropic: ["ANTHROPIC_API_KEY"],
  openai: ["OPENAI_API_KEY"],
  google: ["GOOGLE_GENERATIVE_AI_API_KEY", "GOOGLE_API_KEY"],
  deepseek: ["DEEPSEEK_API_KEY"],
};

/**
 * Default base / strong model id per provider (model ids WITHOUT the provider
 * prefix — it's added by `modelString`). Each is overridable via env:
 *   <PROVIDER>_MODEL (base)  and  <PROVIDER>_MODEL_STRONG (subtle profiles).
 * e.g. OPENAI_MODEL=gpt-4.1-mini  →  every OpenAI student uses openai/gpt-4.1-mini.
 */
const ENV_PREFIX: Record<RealProvider, string> = {
  anthropic: "ANTHROPIC",
  openai: "OPENAI",
  google: "GOOGLE",
  deepseek: "DEEPSEEK",
};

const DEFAULT_MODELS: Record<RealProvider, { base: string; strong: string }> = {
  anthropic: { base: "claude-sonnet-4.6", strong: "claude-opus-4.6" },
  openai: { base: "gpt-5.4-mini", strong: "gpt-5.4-mini" },
  google: { base: "gemini-2.5-flash", strong: "gemini-2.5-pro" },
  deepseek: { base: "deepseek-v3.2", strong: "deepseek-v3.2:thinking" },
};

/** Add the Model Router "provider/" prefix unless the id already carries one. */
function withPrefix(provider: RealProvider, modelId: string): string {
  return modelId.includes("/") ? modelId : `${provider}/${modelId}`;
}

/** Rough USD cost per 1M tokens — used only for the on-screen estimate. */
export const COST_PER_MTOK: Record<Provider, { input: number; output: number }> = {
  anthropic: { input: 3, output: 15 },
  openai: { input: 0.4, output: 1.6 },
  google: { input: 0.3, output: 2.5 },
  deepseek: { input: 0.28, output: 0.42 },
  mock: { input: 0, output: 0 },
};

function hasKey(p: RealProvider): boolean {
  return API_KEY_ENV[p].some((k) => !!process.env[k]);
}

export type RunMode = "mock" | "single" | "demo";

export interface RuntimeConfig {
  mode: RunMode;
  /** For "single" mode: the forced provider. */
  singleProvider?: RealProvider;
  /** Real providers that actually have a key configured. */
  availableProviders: RealProvider[];
}

export function getRuntimeConfig(): RuntimeConfig {
  const available = REAL_PROVIDERS.filter(hasKey);

  const forced = (process.env.DEV_SINGLE_PROVIDER ?? "").trim().toLowerCase();
  if (forced && (REAL_PROVIDERS as string[]).includes(forced)) {
    return { mode: "single", singleProvider: forced as RealProvider, availableProviders: available };
  }

  const demo = /^(1|true|yes|on)$/i.test((process.env.DEMO_MODE ?? "").trim());
  if (demo && available.length > 0) {
    return { mode: "demo", availableProviders: available };
  }

  // Default: deterministic mock — no spend, runs with zero keys.
  return { mode: "mock", availableProviders: available };
}

/**
 * Resolve the actual provider for a student.
 * - mock mode  → everyone is mock (no key needed, no failures).
 * - real modes → the real provider; if its key is missing, `missingKey` is true
 *   and the runner marks that student "failed" (grey) while the loop continues
 *   with the other students. (Teachers, by contrast, fall back to mock so the
 *   loop always completes — see resolveTeacherProvider.)
 */
export function resolveStudentProvider(
  cfg: RuntimeConfig,
  preferred: RealProvider,
): { provider: Provider; missingKey: boolean } {
  if (cfg.mode === "mock") return { provider: "mock", missingKey: false };

  if (cfg.mode === "single") {
    const p = cfg.singleProvider!;
    return { provider: p, missingKey: !cfg.availableProviders.includes(p) };
  }

  // demo: honor preferred provider; flag missing key as a failure in real mode.
  return { provider: preferred, missingKey: !cfg.availableProviders.includes(preferred) };
}

/** Mastra Model Router string for a real provider (strong tier for subtle profiles). */
export function modelString(provider: RealProvider, subtle: boolean): string {
  const envBase = process.env[`${ENV_PREFIX[provider]}_MODEL`]?.trim();
  const envStrong = process.env[`${ENV_PREFIX[provider]}_MODEL_STRONG`]?.trim();
  const d = DEFAULT_MODELS[provider];
  const id = subtle ? envStrong || envBase || d.strong : envBase || d.base;
  return withPrefix(provider, id);
}

export function estimateCostUsd(provider: Provider, inputTokens: number, outputTokens: number): number {
  const c = COST_PER_MTOK[provider];
  return (inputTokens / 1_000_000) * c.input + (outputTokens / 1_000_000) * c.output;
}

/**
 * High-level agent calls with the loop's resilience policy baked in:
 *  - callStudent : a missing key or runtime failure marks the student "en échec"
 *    (grey circle) and returns null; the loop continues with the other students.
 *  - callTeacher : a failure NEVER blocks the loop — it falls back to the
 *    deterministic mock brain so a complete diagnosis / rewrite / production is
 *    always produced. The fallback is announced via a `log` event.
 */
import type { z } from "zod";

import { agentMeta } from "../agents";
import { produceMock } from "../mock/mock-brain";
import { runAgentStreamed } from "./agent-call";
import type { AgentPrompt } from "./briefs";
import { getEmitter } from "./emitter";

function truncate(s: string, n = 240): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

interface CallParams<T> {
  runId: string;
  agentKey: string;
  schema: z.ZodType<T>;
  prompt: AgentPrompt;
  summary: (value: T) => string;
}

export async function callTeacher<T>(params: CallParams<T>): Promise<T> {
  const emit = getEmitter(params.runId);
  try {
    const obj = await runAgentStreamed(params);
    emit({ type: "agent-done", agentId: params.agentKey, summary: truncate(params.summary(obj)) });
    emit({ type: "agent-status", agentId: params.agentKey, status: "termine" });
    return obj;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    emit({
      type: "log",
      message: `Agent « ${params.agentKey} » en échec (${msg}). Repli sur le moteur déterministe pour ne pas bloquer la boucle.`,
    });
    const obj = params.schema.parse(produceMock(params.prompt.brief));
    emit({ type: "agent-done", agentId: params.agentKey, summary: truncate(params.summary(obj)) });
    emit({ type: "agent-status", agentId: params.agentKey, status: "termine" });
    return obj;
  }
}

export async function callStudent<T>(params: CallParams<T>): Promise<T | null> {
  const emit = getEmitter(params.runId);
  const meta = agentMeta[params.agentKey];

  if (meta.missingKey) {
    emit({ type: "agent-error", agentId: params.agentKey, message: `Clé API manquante (${meta.provider}).` });
    emit({ type: "agent-status", agentId: params.agentKey, status: "echec" });
    return null;
  }

  try {
    const obj = await runAgentStreamed(params);
    emit({ type: "agent-done", agentId: params.agentKey, summary: truncate(params.summary(obj)) });
    emit({ type: "agent-status", agentId: params.agentKey, status: "termine" });
    return obj;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    emit({ type: "agent-error", agentId: params.agentKey, message: msg });
    emit({ type: "agent-status", agentId: params.agentKey, status: "echec" });
    return null;
  }
}

/** Bounded-concurrency map — keeps real-provider fan-out within rate limits. */
export async function mapPool<I, O>(
  items: readonly I[],
  limit: number,
  fn: (item: I, index: number) => Promise<O>,
): Promise<O[]> {
  const results: O[] = new Array(items.length);
  let cursor = 0;
  async function worker(): Promise<void> {
    while (cursor < items.length) {
      const idx = cursor++;
      results[idx] = await fn(items[idx], idx);
    }
  }
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, () => worker());
  await Promise.all(workers);
  return results;
}

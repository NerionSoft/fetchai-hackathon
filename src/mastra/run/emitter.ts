/**
 * Per-run event side-channel.
 *
 * The SSE route registers an emitter under a runId; workflow steps (which only
 * receive the runId in their execute params) look it up to push live events and
 * to accumulate token usage / cost. A missing emitter resolves to a no-op so the
 * loop never crashes if the client disconnected.
 */
import type { ClassroomEvent } from "@/classroom/events";
import type { Provider } from "@/classroom/schemas";
import { estimateCostUsd } from "../config";

export type Emit = (event: ClassroomEvent) => void;

interface UsageAcc {
  input: number;
  output: number;
  calls: number;
  cost: number;
}

const emitters = new Map<string, Emit>();
const usages = new Map<string, UsageAcc>();

export function setEmitter(runId: string, fn: Emit): void {
  emitters.set(runId, fn);
  usages.set(runId, { input: 0, output: 0, calls: 0, cost: 0 });
}

export function clearEmitter(runId: string): void {
  emitters.delete(runId);
  usages.delete(runId);
}

export function getEmitter(runId: string): Emit {
  return emitters.get(runId) ?? (() => {});
}

export function addUsage(
  runId: string,
  provider: Provider,
  inputTokens: number,
  outputTokens: number,
): void {
  const u = usages.get(runId);
  if (!u) return;
  u.input += inputTokens;
  u.output += outputTokens;
  u.calls += 1;
  u.cost += estimateCostUsd(provider, inputTokens, outputTokens);
  getEmitter(runId)({
    type: "usage",
    inputTokens: u.input,
    outputTokens: u.output,
    estimatedCostUsd: Number(u.cost.toFixed(4)),
    calls: u.calls,
  });
}

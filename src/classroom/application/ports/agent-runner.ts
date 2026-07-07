/**
 * AgentRunner — outbound port the use case calls to run ONE agent.
 *
 * Given a prompt + the Zod schema of the expected output, an adapter runs the
 * agent (real provider or deterministic mock), streams text deltas back through
 * `onToken`, and resolves to a schema-valid object plus token usage. The use
 * case never learns which agent framework or provider is behind it.
 */
import type { ZodType } from "zod";

import type { AgentMeta } from "../events/classroom-event";
import type { AgentPrompt } from "@/classroom/domain/prompts/briefs";
import type { Provider } from "@/classroom/domain";

export interface AgentRunResult<T> {
  object: T;
  usage: { inputTokens: number; outputTokens: number };
  /** The provider that actually served the call (for cost accounting). */
  provider: Provider;
}

export interface AgentRunInput<T> {
  agentKey: string;
  prompt: AgentPrompt;
  schema: ZodType<T>;
  /** Called for every streamed text delta, so the live scene can fill in. */
  onToken?: (delta: string) => void;
}

export interface AgentRunner {
  /** The full static cast (students + staff), for the opening scene. */
  cast(): AgentMeta[];
  /** True when every agent is backed by the deterministic mock model. */
  readonly mock: boolean;
  /** The provider resolved for an agent key (to build briefs / pin identity). */
  provider(agentKey: string): Provider;
  run<T>(input: AgentRunInput<T>): Promise<AgentRunResult<T>>;
}

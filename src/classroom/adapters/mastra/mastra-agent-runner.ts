/**
 * MastraAgentRunner — implements the AgentRunner port with Mastra agents.
 *
 * Real providers use Mastra's validated `structuredOutput` (the streamed text is
 * the JSON being generated); mock-backed agents stream their JSON directly and we
 * parse it. Either way the caller gets a schema-valid object, and every text
 * delta is forwarded through `onToken` so the live SVG bubble fills in real time.
 *
 * Server-only.
 */
import "./mastra"; // ensure the Mastra instance (agents + storage) is constructed

import type { AgentMeta } from "@/classroom/application/events/classroom-event";
import type {
  AgentRunInput,
  AgentRunResult,
  AgentRunner,
} from "@/classroom/application/ports/agent-runner";
import type { Provider } from "@/classroom/domain";
import { colorForId } from "@/classroom/domain/agent-color";

import { agentMeta, mastraAgents, runtimeConfig } from "./agents";
import { isMockProvider } from "./model-router";
import { encodeBrief } from "../mock/brief-codec";

/**
 * Per-call output-token cap for REAL providers — bounds cost and guards against a
 * runaway generation. Tune via env; the default is generous enough for the
 * largest structured output (the diagnosis / evaluation sets) without truncating.
 * Mock agents are deterministic and free, so the cap is not applied to them.
 */
const MAX_OUTPUT_TOKENS = Number(process.env.CLASSROOM_MAX_OUTPUT_TOKENS ?? "8000");

interface StreamChunk {
  type?: string;
  payload?: { text?: string };
}

interface ModelOutput {
  fullStream: ReadableStream<StreamChunk>;
  text: Promise<string>;
  object: Promise<unknown>;
  usage: Promise<{ inputTokens?: number; outputTokens?: number } | undefined>;
}

export class MastraAgentRunner implements AgentRunner {
  readonly mock = runtimeConfig.mode === "mock";

  /** Static cast of every agent — order: students by class, then staff. */
  cast(): AgentMeta[] {
    return Object.values(agentMeta).map((m) => ({
      agentId: m.key,
      kind: m.kind,
      role: m.role,
      lane: m.lane,
      label: m.label,
      hue: colorForId(m.key).hue,
      provider: m.provider,
      level: m.level,
      style: m.style,
    }));
  }

  provider(agentKey: string): Provider {
    return agentMeta[agentKey].provider;
  }

  async run<T>({ agentKey, prompt, schema, onToken }: AgentRunInput<T>): Promise<AgentRunResult<T>> {
    const meta = agentMeta[agentKey];
    if (meta.missingKey) {
      throw new Error(`Missing API key (${meta.provider}).`);
    }

    const mock = isMockProvider(meta.provider);
    const agent = mastraAgents[agentKey];
    const userText = mock ? prompt.human + encodeBrief(prompt.brief) : prompt.human;

    const result = (await (mock
      ? agent.stream(userText)
      : agent.stream(userText, {
          structuredOutput: { schema },
          modelSettings: { maxOutputTokens: MAX_OUTPUT_TOKENS },
        }))) as unknown as ModelOutput;

    const reader = result.fullStream.getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value?.type === "text-delta") {
          const delta = value.payload?.text ?? "";
          if (delta) onToken?.(delta);
        }
      }
    } finally {
      reader.releaseLock();
    }

    let usage = { inputTokens: 0, outputTokens: 0 };
    try {
      const u = await result.usage;
      usage = { inputTokens: u?.inputTokens ?? 0, outputTokens: u?.outputTokens ?? 0 };
    } catch {
      /* usage is best-effort */
    }

    const object = mock ? (schema.parse(JSON.parse(await result.text)) as T) : ((await result.object) as T);
    return { object, usage, provider: meta.provider };
  }
}

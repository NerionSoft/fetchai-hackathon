/**
 * runAgentStreamed — one agent call, streamed to the live scene.
 *
 * Real providers use Mastra's validated `structuredOutput` (the streamed text is
 * the JSON being generated); the mock model streams its JSON directly and we
 * parse it. Either way the caller gets a schema-valid object, and every text
 * delta is forwarded as an `agent-token` event so the SVG bubble fills live.
 */
import type { z } from "zod";

import { agentMeta, mastraAgents } from "../agents";
import { encodeBrief } from "../mock/brief";
import { isMockProvider } from "../model-router";
import type { AgentPrompt } from "./briefs";
import { addUsage, getEmitter } from "./emitter";

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

export async function runAgentStreamed<T>(params: {
  runId: string;
  agentKey: string;
  schema: z.ZodType<T>;
  prompt: AgentPrompt;
}): Promise<T> {
  const { runId, agentKey, schema, prompt } = params;
  const emit = getEmitter(runId);
  const meta = agentMeta[agentKey];
  const mock = isMockProvider(meta.provider);
  const agent = mastraAgents[agentKey];
  const userText = mock ? prompt.human + encodeBrief(prompt.brief) : prompt.human;

  emit({ type: "agent-status", agentId: agentKey, status: "reflechit" });

  const result = (await (mock
    ? agent.stream(userText)
    : agent.stream(userText, { structuredOutput: { schema } }))) as unknown as ModelOutput;

  emit({ type: "agent-status", agentId: agentKey, status: "parle" });

  const reader = result.fullStream.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value?.type === "text-delta") {
        const delta = value.payload?.text ?? "";
        if (delta) emit({ type: "agent-token", agentId: agentKey, delta });
      }
    }
  } finally {
    reader.releaseLock();
  }

  try {
    const usage = await result.usage;
    addUsage(runId, meta.provider, usage?.inputTokens ?? 0, usage?.outputTokens ?? 0);
  } catch {
    /* usage is best-effort */
  }

  if (mock) {
    const text = await result.text;
    return schema.parse(JSON.parse(text));
  }
  // Real provider: structuredOutput already validated against the schema.
  return (await result.object) as T;
}

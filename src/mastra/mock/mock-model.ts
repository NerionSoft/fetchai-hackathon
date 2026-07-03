/**
 * Deterministic mock language model (AI-SDK v2 LanguageModel shape).
 *
 * It ignores the natural-language prompt and instead decodes the injected
 * `__MOCK__` brief, asks the mock brain for a schema-valid object, serializes it
 * to JSON, and STREAMS that JSON token-by-token so the live SVG bubbles fill in
 * real time — exactly like a real provider. No network, no keys, fully reproducible.
 *
 * Typed structurally against AI-SDK v5's `LanguageModelV2`; cast to Mastra's
 * accepted model type at the agent boundary (see model-router.ts).
 */
import { extractBrief } from "./brief";
import { produceMock } from "./mock-brain";

/** Minimal structural subset of AI-SDK v5 `LanguageModelV2` that Mastra consumes. */
export interface MockLanguageModel {
  readonly specificationVersion: "v2";
  readonly provider: string;
  readonly modelId: string;
  readonly supportedUrls: Record<string, RegExp[]>;
  doGenerate(options: unknown): Promise<{
    content: { type: "text"; text: string }[];
    finishReason: "stop";
    usage: { inputTokens: number; outputTokens: number; totalTokens: number };
    warnings: never[];
  }>;
  doStream(options: unknown): Promise<{
    stream: ReadableStream<unknown>;
  }>;
}

interface PromptMessage {
  role: string;
  content: string | Array<{ type: string; text?: string }>;
}

/** Flatten every text fragment of an AI-SDK prompt into one searchable string. */
function promptToText(options: unknown): string {
  const prompt = (options as { prompt?: PromptMessage[] })?.prompt;
  if (!Array.isArray(prompt)) return "";
  const parts: string[] = [];
  for (const msg of prompt) {
    if (typeof msg.content === "string") {
      parts.push(msg.content);
    } else if (Array.isArray(msg.content)) {
      for (const p of msg.content) {
        if (p.type === "text" && typeof p.text === "string") parts.push(p.text);
      }
    }
  }
  return parts.join("\n");
}

function roughTokens(text: string): number {
  return Math.max(1, Math.round(text.length / 4));
}

/** Produce the JSON output text for a given prompt by decoding its brief. */
function outputFor(options: unknown): { text: string; inputTokens: number } {
  const promptText = promptToText(options);
  const brief = extractBrief(promptText);
  const obj = brief
    ? produceMock(brief)
    : { error: "mock-model: no __MOCK__ brief found in prompt" };
  return { text: JSON.stringify(obj), inputTokens: roughTokens(promptText) };
}

/** Split text into small, stable chunks for a believable token stream. */
function tokenize(text: string): string[] {
  return text.match(/\s+|[^\s]+/g) ?? [text];
}

const TOKEN_DELAY_MS = Number(process.env.MOCK_TOKEN_DELAY_MS ?? "5");

export function createMockModel(modelId = "classroomsim/mock"): MockLanguageModel {
  return {
    specificationVersion: "v2",
    provider: "mock",
    modelId,
    supportedUrls: {},

    async doGenerate(options) {
      const { text, inputTokens } = outputFor(options);
      const outputTokens = roughTokens(text);
      return {
        content: [{ type: "text", text }],
        finishReason: "stop",
        usage: { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens },
        warnings: [],
      };
    },

    async doStream(options) {
      const { text, inputTokens } = outputFor(options);
      const outputTokens = roughTokens(text);
      const tokens = tokenize(text);

      const stream = new ReadableStream<unknown>({
        async start(controller) {
          controller.enqueue({ type: "stream-start", warnings: [] });
          controller.enqueue({ type: "text-start", id: "t1" });
          for (const tok of tokens) {
            controller.enqueue({ type: "text-delta", id: "t1", delta: tok });
            if (TOKEN_DELAY_MS > 0) {
              await new Promise((r) => setTimeout(r, TOKEN_DELAY_MS));
            }
          }
          controller.enqueue({ type: "text-end", id: "t1" });
          controller.enqueue({
            type: "finish",
            finishReason: "stop",
            usage: { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens },
          });
          controller.close();
        },
      });

      return { stream };
    },
  };
}

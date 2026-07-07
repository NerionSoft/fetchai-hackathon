/**
 * classroom.module.ts — the hexagone's composition root.
 *
 * Wires the concrete adapters (Mastra agent runner + deterministic mock fallback)
 * into the RunClassroomLoop use case and exports the pre-wired use case as the
 * hexagone's public API. Delivery routes import `runClassroomLoop` from here and
 * never touch the adapters directly (ADR-004).
 *
 * The MastraAgentRunner internally serves each agent from its resolved provider
 * (real or mock, per runtime config); the mock fallback guarantees teacher steps
 * always complete. Swapping the agent framework is a one-line change here.
 *
 * Server-only (constructing the runner builds the Mastra agents + storage).
 */
import { MastraAgentRunner } from "./adapters/mastra/mastra-agent-runner";
import { MockAgentFallback } from "./adapters/mock/mock-agent-fallback";
import { ServerPdfCodex } from "./adapters/pdf/pdf-codex";
import { RunClassroomLoopUseCase } from "./application/usecases/run-classroom-loop.usecase";

const runner = new MastraAgentRunner();
const fallback = new MockAgentFallback();
const pdfCodex = new ServerPdfCodex();

export const runClassroomLoop = new RunClassroomLoopUseCase(runner, fallback, pdfCodex);

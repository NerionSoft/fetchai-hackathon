/**
 * MockAgentFallback — implements the AgentFallback port with the deterministic
 * mock brain. Used when a teacher-agent call fails, so the loop always produces
 * a complete result. Pure, key-free, reproducible.
 */
import type { AgentFallback } from "@/classroom/application/ports/agent-fallback";
import type { AgentBrief } from "@/classroom/domain/prompts/agent-brief";

import { produceMock } from "./mock-brain";

export class MockAgentFallback implements AgentFallback {
  produce(brief: AgentBrief): unknown {
    return produceMock(brief);
  }
}

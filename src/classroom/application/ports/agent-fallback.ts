/**
 * AgentFallback — outbound port for the deterministic engine the use case falls
 * back to when a teacher-agent call fails, so the loop ALWAYS completes. Given a
 * brief, it returns an object the caller validates against the role's schema.
 */
import type { AgentBrief } from "@/classroom/domain/prompts/agent-brief";

export interface AgentFallback {
  produce(brief: AgentBrief): unknown;
}

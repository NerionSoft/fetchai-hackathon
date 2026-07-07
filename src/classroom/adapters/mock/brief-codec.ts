/**
 * Mock brief wire codec — encodes an AgentBrief into a compact, machine-readable
 * block appended to a prompt ONLY when that agent is backed by the mock model,
 * and extracts it back on the other side. The mock model decodes it (no natural-
 * language parsing) and the mock brain turns it into schema-valid output. Real
 * providers never see it.
 */
import type { AgentBrief } from "@/classroom/domain/prompts/agent-brief";

const START = "<<<MOCK_BRIEF>>>";
const END = "<<<END_MOCK_BRIEF>>>";

export function encodeBrief(brief: AgentBrief): string {
  return `\n\n${START}\n${JSON.stringify(brief)}\n${END}\n`;
}

export function extractBrief(promptText: string): AgentBrief | null {
  const start = promptText.indexOf(START);
  const end = promptText.indexOf(END);
  if (start === -1 || end === -1 || end < start) return null;
  const json = promptText.slice(start + START.length, end).trim();
  try {
    return JSON.parse(json) as AgentBrief;
  } catch {
    return null;
  }
}

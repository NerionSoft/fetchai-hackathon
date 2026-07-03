/**
 * ClassroomSim — SSE wire protocol (shared by the server runner and the client).
 *
 * One JSON object per SSE message. The scene (SVG circles) and result panels are
 * driven entirely by this event stream. Pure types + pure (de)serialization only.
 */
import type {
  ClassId,
  FactCheckReport,
  Level,
  LoopResult,
  PedagogicalProduction,
  Provider,
  Style,
  TeacherDiagnosis,
  LessonVersion,
} from "./schemas";

/** Visual state of an agent's circle, per the spec. */
export type AgentStatus = "waiting" | "thinking" | "speaking" | "done" | "failed";

/** Which SVG lane an agent lives in: a class scene, or the teaching staff row. */
export type Lane = ClassId | "staff";

export type AgentKind = "student" | "teacher";

/** Static description of one agent — emitted once up-front so the scene can render. */
export interface AgentMeta {
  agentId: string;
  kind: AgentKind;
  /** Role label, e.g. "diagnostician", or the student profile short name. */
  role: string;
  lane: Lane;
  label: string;
  hue: number;
  provider: Provider;
  level?: Level;
  style?: Style;
}

export type Phase =
  | "simulate"
  | "diagnose"
  | "rewrite"
  | "factcheck-lesson"
  | "produce"
  | "factcheck-production"
  | "done";

export type ResultPayload =
  | { kind: "diagnosis"; data: TeacherDiagnosis }
  | { kind: "lessonVersion"; data: LessonVersion }
  | { kind: "factCheckLesson"; data: FactCheckReport }
  | { kind: "production"; data: PedagogicalProduction }
  | { kind: "factCheckProduction"; data: FactCheckReport[] }
  | { kind: "loopResult"; data: LoopResult };

export type ClassroomEvent =
  /** First event: the full cast, so the front renders every circle immediately. */
  | { type: "loop-start"; lessonId: string; lessonTitle: string; agents: AgentMeta[]; mock: boolean }
  | { type: "phase"; phase: Phase; label: string }
  | { type: "agent-status"; agentId: string; status: AgentStatus }
  | { type: "agent-token"; agentId: string; delta: string }
  | { type: "agent-done"; agentId: string; summary: string }
  | { type: "agent-error"; agentId: string; message: string }
  | {
      type: "usage";
      inputTokens: number;
      outputTokens: number;
      estimatedCostUsd: number;
      calls: number;
    }
  | { type: "result"; payload: ResultPayload }
  | { type: "log"; message: string }
  | { type: "done" }
  | { type: "error"; message: string };

/** Encode an event as an SSE `data:` frame. */
export function encodeSSE(event: ClassroomEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

/** Parse one SSE `data:` line payload back into an event (client side). */
export function parseSSE(data: string): ClassroomEvent {
  return JSON.parse(data) as ClassroomEvent;
}

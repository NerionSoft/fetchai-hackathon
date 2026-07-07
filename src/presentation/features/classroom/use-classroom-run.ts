"use client";

/**
 * useClassroomRun — POSTs a lesson, reads the SSE stream with fetch-streaming,
 * and reduces ClassroomEvents into a render-ready state for the live scene and
 * the result panels.
 */
import { useCallback, useReducer, useRef } from "react";

import type { AgentMeta, AgentStatus, ClassroomEvent, Phase } from "@/classroom/application/events/classroom-event";
import { parseSSE } from "@/classroom/application/events/classroom-event";
import type {
  FactCheckReport,
  LessonVersion,
  LoopResult,
  PedagogicalProduction,
  TeacherDiagnosis,
} from "@/classroom/domain";

/** One source input as posted to the run route (PDFs carry base64 in `data`). */
export type LessonSourceInput =
  | { kind: "text"; text: string }
  | { kind: "pdf"; filename?: string; data: string };

/** The body posted to `/api/classroom/run` — legacy `markdown` and/or `inputs`. */
export interface RunRequest {
  title?: string;
  markdown?: string;
  inputs?: LessonSourceInput[];
}

export interface AgentView {
  meta: AgentMeta;
  status: AgentStatus;
  buffer: string;
  summary?: string;
  error?: string;
}

export interface UsageView {
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  calls: number;
}

export interface RunState {
  running: boolean;
  done: boolean;
  mock: boolean;
  phase: Phase | "idle";
  lessonTitle: string;
  agents: Record<string, AgentView>;
  order: string[];
  usage?: UsageView;
  logs: string[];
  diagnosis?: TeacherDiagnosis;
  lessonVersion?: LessonVersion;
  factCheckLesson?: FactCheckReport;
  production?: PedagogicalProduction;
  factCheckProduction?: FactCheckReport[];
  loopResult?: LoopResult;
  error?: string;
}

const initialState: RunState = {
  running: false,
  done: false,
  mock: true,
  phase: "idle",
  lessonTitle: "",
  agents: {},
  order: [],
  logs: [],
};

type Action = { type: "reset" } | { type: "event"; event: ClassroomEvent } | { type: "fatal"; message: string };

function patchAgent(state: RunState, id: string, patch: Partial<AgentView>): RunState {
  const cur = state.agents[id];
  if (!cur) return state;
  return { ...state, agents: { ...state.agents, [id]: { ...cur, ...patch } } };
}

function reducer(state: RunState, action: Action): RunState {
  if (action.type === "reset") return { ...initialState };
  if (action.type === "fatal") return { ...state, running: false, error: action.message };

  const e = action.event;
  switch (e.type) {
    case "loop-start": {
      const agents: Record<string, AgentView> = {};
      for (const m of e.agents) agents[m.agentId] = { meta: m, status: "waiting", buffer: "" };
      return {
        ...initialState,
        running: true,
        mock: e.mock,
        lessonTitle: e.lessonTitle,
        agents,
        order: e.agents.map((m) => m.agentId),
        phase: "simulate",
      };
    }
    case "phase":
      return { ...state, phase: e.phase };
    case "agent-status":
      return patchAgent(state, e.agentId, {
        status: e.status,
        ...(e.status === "thinking" ? { buffer: "" } : {}),
      });
    case "agent-token": {
      const cur = state.agents[e.agentId];
      if (!cur) return state;
      return patchAgent(state, e.agentId, { buffer: (cur.buffer + e.delta).slice(-2000) });
    }
    case "agent-done":
      return patchAgent(state, e.agentId, { status: "done", summary: e.summary });
    case "agent-error":
      return patchAgent(state, e.agentId, { status: "failed", error: e.message });
    case "usage":
      return {
        ...state,
        usage: {
          inputTokens: e.inputTokens,
          outputTokens: e.outputTokens,
          estimatedCostUsd: e.estimatedCostUsd,
          calls: e.calls,
        },
      };
    case "log":
      return { ...state, logs: [...state.logs, e.message] };
    case "result": {
      const p = e.payload;
      switch (p.kind) {
        case "diagnosis":
          return { ...state, diagnosis: p.data };
        case "lessonVersion":
          return { ...state, lessonVersion: p.data };
        case "factCheckLesson":
          return { ...state, factCheckLesson: p.data };
        case "production":
          return { ...state, production: p.data };
        case "factCheckProduction":
          return { ...state, factCheckProduction: p.data };
        case "loopResult":
          return { ...state, loopResult: p.data };
      }
      return state;
    }
    case "done":
      return { ...state, running: false, done: true, phase: "done" };
    case "error":
      return { ...state, running: false, error: e.message };
    default:
      return state;
  }
}

export function useClassroomRun() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const abortRef = useRef<AbortController | null>(null);

  const start = useCallback(async (request: RunRequest) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    dispatch({ type: "reset" });

    try {
      const res = await fetch("/api/classroom/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Failed to start (${res.status}). ${txt}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const frames = buf.split("\n\n");
        buf = frames.pop() ?? "";
        for (const frame of frames) {
          const line = frame.split("\n").find((l) => l.startsWith("data:"));
          if (!line) continue;
          try {
            dispatch({ type: "event", event: parseSSE(line.slice(5).trim()) });
          } catch {
            /* ignore malformed frame */
          }
        }
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      dispatch({ type: "fatal", message: err instanceof Error ? err.message : String(err) });
    }
  }, []);

  const stop = useCallback(() => abortRef.current?.abort(), []);

  return { state, start, stop };
}

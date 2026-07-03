/**
 * runLoop — drives one full ClassroomSim boucle and streams events to the caller.
 *
 * Registers a per-run emitter, emits the cast up-front (so the SVG scene renders
 * immediately), runs the Mastra workflow to completion, and returns the final
 * LoopResult (captured straight off the event stream).
 */
import { randomUUID } from "node:crypto";

import { colorForId } from "@/classroom/colors";
import type { AgentMeta, ClassroomEvent } from "@/classroom/events";
import type { Lesson, LoopResult } from "@/classroom/schemas";

import { agentMeta, runtimeConfig } from "../agents";
import { mastra } from "../index";
import { clearEmitter, setEmitter } from "./emitter";

/** Static cast of every agent — order: students by class, then staff. */
export function buildCast(): AgentMeta[] {
  return Object.values(agentMeta).map((m) => ({
    agentId: m.key,
    kind: m.kind,
    role: m.role,
    lane: m.lane,
    label: m.label,
    hue: colorForId(m.key).hue,
    provider: m.provider,
    niveau: m.niveau,
    style: m.style,
  }));
}

export async function runLoop(lesson: Lesson, emit: (event: ClassroomEvent) => void): Promise<LoopResult> {
  const runId = randomUUID();

  let captured: LoopResult | undefined;
  const wrapped = (event: ClassroomEvent) => {
    if (event.type === "result" && event.payload.kind === "loopResult") {
      captured = event.payload.data;
    }
    emit(event);
  };

  setEmitter(runId, wrapped);
  try {
    wrapped({
      type: "loop-start",
      lessonId: lesson.id,
      lessonTitle: lesson.title,
      agents: buildCast(),
      mock: runtimeConfig.mode === "mock",
    });

    const run = await mastra.getWorkflow("classroom-loop").createRun({ runId });
    await run.start({ inputData: { lesson, runId } });

    if (!captured) {
      throw new Error("La boucle s'est terminée sans produire de résultat final.");
    }

    wrapped({ type: "phase", phase: "done", label: "Terminé" });
    wrapped({ type: "done" });
    return captured;
  } finally {
    clearEmitter(runId);
  }
}

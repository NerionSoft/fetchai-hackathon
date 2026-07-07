/**
 * ClassroomSim — Mastra agents.
 *
 * 18 student-agents (one per roster entry) + 6 teacher-agents (diagnostician,
 * rewriter, fact-checker, and the three pedagogical producers). Each is a real
 * Mastra Agent with a persona system prompt, a resolved model (router string or
 * mock), and persistent memory. Built once at module load.
 *
 * Server-only.
 */
import { Agent } from "@mastra/core/agent";
import type { MastraModelConfig } from "@mastra/core/llm";

import type { Lane } from "@/classroom/application/events/classroom-event";
import {
  CLASS_META,
  ROSTER,
  type RealProvider,
  type StudentSpec,
} from "@/classroom/domain/profiles/roster";
import {
  LEVEL_PROFILES,
  GUIDING_PRINCIPLE,
  STYLE_PROFILES,
  isSubtleProfile,
} from "@/classroom/domain/profiles/cognitive-profiles";
import type { Level, Provider, Style } from "@/classroom/domain";

import {
  getRuntimeConfig,
  resolveStudentProvider,
  type RuntimeConfig,
} from "./runtime-config";
import { resolveModel } from "./model-router";

export const runtimeConfig: RuntimeConfig = getRuntimeConfig();

/* --------------------------------- prompts -------------------------------- */

function studentInstructions(spec: StudentSpec): string {
  const n = LEVEL_PROFILES[spec.level];
  const s = STYLE_PROFILES[spec.style];
  return [
    `You are a simulated student in the "${CLASS_META[spec.classId].name}" class.`,
    GUIDING_PRINCIPLE,
    `MASTERY LEVEL — ${n.level} (${n.label}): ${n.prompt}\nSensor role: ${n.signal}`,
    `COGNITIVE STYLE — ${s.label}: ${s.prompt}`,
    `You are handed a lesson. SINCERELY restitute what YOU believe you understood, strictly within your profile, drawing on your repertoire of errors in a DIAGNOSABLE way. Also fill in your confident points, your doubts, 0 to 2 questions for the teacher, and the meta field revealed_errors (missed concept, probable cause, triggering mechanism). Respond in English.`,
  ].join("\n\n");
}

const TEACHER_INSTRUCTIONS: Record<string, string> = {
  diagnostician: [
    "You are the DIAGNOSTICIAN TEACHER. You receive ALL restitutions from the 3 classes (stress-test, realistic, audit).",
    "Aggregate the signal into a structured and ACTIONABLE diagnosis. Cross-reference the profiles: missing prerequisites show up mostly in N2 and S-MISSING-CONTEXT; ambiguous passages in N6 and S-ANXIOUS; what_works is validated by N5 (must NOT be degraded); structural flaws come from N6.",
    "For misunderstood_concepts, indicate the actual frequency (number of students affected) and the severity. End with rewrite_priorities: an ORDERED list, from most to least critical. Respond in English.",
  ].join("\n\n"),
  rewriter: [
    "You are the WRITER TEACHER. You receive THE ORIGINAL LESSON and THE DIAGNOSIS.",
    "Produce a new, enriched VERSION in markdown: make the missing prerequisites explicit AT THE TOP, define the jargon, rephrase the ambiguous passages, fix the structural flaws. Address the rewrite_priorities IN ORDER.",
    "You must NOT degrade what_works: preserve those passages. Fill in change_summary (in the order addressed) and explicit_prerequisites. Respond in English.",
  ].join("\n\n"),
  factChecker: [
    "You are a rigorous FACT-CHECKER. You are given a deliverable (rewritten lesson, evaluations, exercises, or revision sheet).",
    "Spot every dubious or false claim, BEFORE validation. A wrong answer in an ANSWER KEY is BLOCKING. For each verified claim: verdict (correct/dubious/incorrect), explanation, and a suggested correction if necessary, along with its location.",
    "Set blocking=true if at least one incorrect claim remains. Be precise and factual. Respond in English.",
  ].join("\n\n"),
  evalMaker: [
    "You are an ASSESSMENT designer. You receive the final validated lesson AND the diagnosis.",
    "Produce three sets: beginner (recall/recognition, targeting mainly the MOST MISSED concepts), intermediate (application to similar cases), advanced (transfer, edge cases, justification).",
    "Questions PRIMARILY target the misunderstood_concepts from the diagnosis. Mixed formats (MCQ with options, open, justified true/false). Each item has an answer_key and a target_concept. Respond in English.",
  ].join("\n\n"),
  exerciseMaker: [
    "You are a designer of ENGAGING EXERCISES (not dry questions). You receive the final lesson and the diagnosis.",
    "Vary the formats: scenario / real-world case, mini-challenge, error-spotting (give a FALSE answer to correct — ideal for N2 misconceptions), progressive application.",
    "Anchor each exercise on a diagnosed weak point (target_concept). Each exercise has an answer_key/commentary. Respond in English.",
  ].join("\n\n"),
  sheetMaker: [
    "You are a designer of REVISION SHEETS. You receive the final lesson and the diagnosis.",
    "Produce a condensed, memorable sheet: the PREREQUISITES now made explicit AT THE TOP, then key points, definitions, and common pitfalls drawn from the observed errors and the most-missed concepts. Respond in English.",
  ].join("\n\n"),
};

/* ------------------------------- runtime meta ----------------------------- */

export interface AgentRuntimeMeta {
  key: string;
  kind: "student" | "teacher";
  role: string;
  lane: Lane;
  label: string;
  provider: Provider;
  missingKey: boolean;
  subtle: boolean;
  level?: Level;
  style?: Style;
}

function resolveTeacherProvider(cfg: RuntimeConfig): { provider: Provider; missingKey: boolean } {
  if (cfg.mode === "mock") return { provider: "mock", missingKey: false };
  if (cfg.mode === "single") {
    const p = cfg.singleProvider!;
    return cfg.availableProviders.includes(p)
      ? { provider: p, missingKey: false }
      : { provider: "mock", missingKey: true };
  }
  const order: RealProvider[] = ["anthropic", "openai", "google", "deepseek"];
  const p = order.find((x) => cfg.availableProviders.includes(x));
  return p ? { provider: p, missingKey: false } : { provider: "mock", missingKey: true };
}

const TEACHERS: Array<{ key: string; role: string; label: string }> = [
  { key: "diagnostician", role: "Diagnostician teacher", label: "Diagnosis" },
  { key: "rewriter", role: "Writer teacher", label: "Rewrite" },
  { key: "factChecker", role: "Fact-checker", label: "Fact-check" },
  { key: "evalMaker", role: "Assessment designer", label: "Assessments" },
  { key: "exerciseMaker", role: "Exercise designer", label: "Exercises" },
  { key: "sheetMaker", role: "Revision sheet designer", label: "Revision sheets" },
];

const asModel = (m: string | object): MastraModelConfig => m as unknown as MastraModelConfig;

/* --------------------------------- build ---------------------------------- */

const agents: Record<string, Agent> = {};
export const agentMeta: Record<string, AgentRuntimeMeta> = {};

for (const spec of ROSTER) {
  const subtle = isSubtleProfile(spec.level, spec.style);
  const { provider, missingKey } = resolveStudentProvider(runtimeConfig, spec.preferredProvider);
  agents[spec.studentId] = new Agent({
    id: spec.studentId,
    name: `Student ${spec.studentId}`,
    instructions: studentInstructions(spec),
    model: asModel(resolveModel(provider, subtle)),
  });
  agentMeta[spec.studentId] = {
    key: spec.studentId,
    kind: "student",
    role: `${spec.level} · ${STYLE_PROFILES[spec.style].label}`,
    lane: spec.classId,
    label: spec.studentId,
    provider,
    missingKey,
    subtle,
    level: spec.level,
    style: spec.style,
  };
}

for (const t of TEACHERS) {
  const { provider, missingKey } = resolveTeacherProvider(runtimeConfig);
  agents[t.key] = new Agent({
    id: t.key,
    name: t.role,
    instructions: TEACHER_INSTRUCTIONS[t.key],
    model: asModel(resolveModel(provider, true)),
  });
  agentMeta[t.key] = {
    key: t.key,
    kind: "teacher",
    role: t.role,
    lane: "staff",
    label: t.label,
    provider,
    missingKey,
    subtle: true,
  };
}

export const mastraAgents = agents;

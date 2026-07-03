/**
 * Mock brief — a compact, machine-readable block injected into an agent prompt
 * ONLY when that agent is backed by the mock model. The mock model decodes it
 * (no natural-language parsing) and the mock brain turns it into schema-valid
 * output. Real providers never see it.
 */
import type {
  ClassId,
  Level,
  Provider,
  Style,
  StudentRestitution,
  TeacherDiagnosis,
} from "@/classroom/schemas";

export type MockRole =
  | "student"
  | "diagnosis"
  | "rewrite"
  | "factcheck"
  | "evaluations"
  | "exercises"
  | "sheet";

export type FactCheckTarget = "lesson" | "evaluations" | "exercises" | "sheet";

export type MockBrief =
  | {
      role: "student";
      studentId: string;
      classId: ClassId;
      level: Level;
      style: Style;
      provider: Provider;
      lessonTitle: string;
      lessonMarkdown: string;
    }
  | { role: "diagnosis"; lessonTitle: string; lessonMarkdown: string; restitutions: StudentRestitution[] }
  | { role: "rewrite"; lessonTitle: string; lessonMarkdown: string; diagnosis: TeacherDiagnosis }
  | { role: "factcheck"; target: FactCheckTarget; title: string; content: string }
  | { role: "evaluations"; lessonTitle: string; lessonMarkdown: string; diagnosis: TeacherDiagnosis }
  | { role: "exercises"; lessonTitle: string; lessonMarkdown: string; diagnosis: TeacherDiagnosis }
  | { role: "sheet"; lessonTitle: string; lessonMarkdown: string; diagnosis: TeacherDiagnosis };

const START = "<<<MOCK_BRIEF>>>";
const END = "<<<END_MOCK_BRIEF>>>";

export function encodeBrief(brief: MockBrief): string {
  return `\n\n${START}\n${JSON.stringify(brief)}\n${END}\n`;
}

export function extractBrief(promptText: string): MockBrief | null {
  const start = promptText.indexOf(START);
  const end = promptText.indexOf(END);
  if (start === -1 || end === -1 || end < start) return null;
  const json = promptText.slice(start + START.length, end).trim();
  try {
    return JSON.parse(json) as MockBrief;
  } catch {
    return null;
  }
}

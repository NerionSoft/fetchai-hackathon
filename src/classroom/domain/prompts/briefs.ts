/**
 * Per-role prompt + brief builders.
 *
 * Each builder returns the human-readable prompt text (used by real providers)
 * AND the structured brief (consumed by the mock engine). The brief is only
 * appended to the prompt for mock-backed agents — see the Mastra agent runner.
 * Pure domain: text derived from the lesson and upstream artifacts.
 */
import type { Lesson } from "../entities/lesson";
import type { PedagogicalProduction } from "../entities/production";
import type { StudentRestitution } from "../entities/student-restitution";
import type { TeacherDiagnosis } from "../entities/teacher-diagnosis";
import type { Provider } from "../value-objects/axes";
import type { StudentSpec } from "../profiles/roster";
import type { AgentBrief, FactCheckTarget } from "./agent-brief";

export interface AgentPrompt {
  human: string;
  brief: AgentBrief;
}

export function buildStudent(spec: StudentSpec, provider: Provider, lesson: Lesson): AgentPrompt {
  return {
    human: `Here is the lesson to study:\n\n${lesson.markdown}\n\nNow restitute, staying true to your profile, what you believe you understood.`,
    brief: {
      role: "student",
      studentId: spec.studentId,
      classId: spec.classId,
      level: spec.level,
      style: spec.style,
      provider,
      lessonTitle: lesson.title,
      lessonMarkdown: lesson.markdown,
    },
  };
}

export function buildDiagnosis(lesson: Lesson, restitutions: StudentRestitution[]): AgentPrompt {
  return {
    human: `Original lesson:\n\n${lesson.markdown}\n\nStudent restitutions (JSON):\n${JSON.stringify(
      restitutions,
    )}\n\nProduce the structured diagnosis.`,
    brief: { role: "diagnosis", lessonTitle: lesson.title, lessonMarkdown: lesson.markdown, restitutions },
  };
}

export function buildRewrite(lesson: Lesson, diagnosis: TeacherDiagnosis): AgentPrompt {
  return {
    human: `Original lesson:\n\n${lesson.markdown}\n\nDiagnosis (JSON):\n${JSON.stringify(
      diagnosis,
    )}\n\nProduce the new enriched version.`,
    brief: { role: "rewrite", lessonTitle: lesson.title, lessonMarkdown: lesson.markdown, diagnosis },
  };
}

export function buildFactCheck(target: FactCheckTarget, title: string, content: string): AgentPrompt {
  return {
    human: `Verify the following deliverable (${target}) titled "${title}":\n\n${content}\n\nFlag any dubious or false claim, with a suggested correction.`,
    brief: { role: "factcheck", target, title, content },
  };
}

export function buildEvaluations(lesson: Lesson, diagnosis: TeacherDiagnosis): AgentPrompt {
  return {
    human: `Final validated lesson:\n\n${lesson.markdown}\n\nDiagnosis (JSON):\n${JSON.stringify(
      diagnosis,
    )}\n\nProduce the assessments across 3 levels, driven by the diagnosis.`,
    brief: { role: "evaluations", lessonTitle: lesson.title, lessonMarkdown: lesson.markdown, diagnosis },
  };
}

export function buildExercises(lesson: Lesson, diagnosis: TeacherDiagnosis): AgentPrompt {
  return {
    human: `Final validated lesson:\n\n${lesson.markdown}\n\nDiagnosis (JSON):\n${JSON.stringify(
      diagnosis,
    )}\n\nProduce engaging exercises anchored on the diagnosed weak points.`,
    brief: { role: "exercises", lessonTitle: lesson.title, lessonMarkdown: lesson.markdown, diagnosis },
  };
}

export function buildSheet(lesson: Lesson, diagnosis: TeacherDiagnosis): AgentPrompt {
  return {
    human: `Final validated lesson:\n\n${lesson.markdown}\n\nDiagnosis (JSON):\n${JSON.stringify(
      diagnosis,
    )}\n\nProduce a revision sheet (prerequisites made explicit at the top).`,
    brief: { role: "sheet", lessonTitle: lesson.title, lessonMarkdown: lesson.markdown, diagnosis },
  };
}

/** Serialize a production bundle's deliverable to plain text for fact-checking. */
export function productionPartToText(
  production: PedagogicalProduction,
  part: "evaluations" | "exercises" | "sheet",
): string {
  if (part === "evaluations") return JSON.stringify(production.evaluations, null, 2);
  if (part === "exercises") return JSON.stringify(production.exercises, null, 2);
  return JSON.stringify(production.sheet, null, 2);
}

/**
 * Per-role prompt + mock-brief builders.
 *
 * Each builder returns the human-readable prompt text (used by real providers)
 * AND the structured mock brief (decoded by the mock model). The brief is only
 * appended to the prompt for mock-backed agents — see runAgentStreamed.
 */
import type {
  Lesson,
  PedagogicalProduction,
  Provider,
  StudentRestitution,
  TeacherDiagnosis,
} from "@/classroom/schemas";
import type { StudentSpec } from "@/classroom/roster";
import type { FactCheckTarget, MockBrief } from "../mock/brief";

export interface AgentPrompt {
  human: string;
  brief: MockBrief;
}

export function buildStudent(spec: StudentSpec, provider: Provider, lesson: Lesson): AgentPrompt {
  return {
    human: `Voici la leçon à étudier :\n\n${lesson.markdown}\n\nRestitue maintenant, en restant fidèle à ton profil, ce que tu crois avoir compris.`,
    brief: {
      role: "student",
      studentId: spec.studentId,
      classId: spec.classId,
      niveau: spec.niveau,
      style: spec.style,
      provider,
      lessonTitle: lesson.title,
      lessonMarkdown: lesson.markdown,
    },
  };
}

export function buildDiagnosis(lesson: Lesson, restitutions: StudentRestitution[]): AgentPrompt {
  return {
    human: `Leçon originale :\n\n${lesson.markdown}\n\nRestitutions des élèves (JSON) :\n${JSON.stringify(
      restitutions,
    )}\n\nProduis le diagnostic structuré.`,
    brief: { role: "diagnosis", lessonTitle: lesson.title, lessonMarkdown: lesson.markdown, restitutions },
  };
}

export function buildRewrite(lesson: Lesson, diagnosis: TeacherDiagnosis): AgentPrompt {
  return {
    human: `Leçon originale :\n\n${lesson.markdown}\n\nDiagnostic (JSON) :\n${JSON.stringify(
      diagnosis,
    )}\n\nProduis la nouvelle version enrichie.`,
    brief: { role: "rewrite", lessonTitle: lesson.title, lessonMarkdown: lesson.markdown, diagnosis },
  };
}

export function buildFactCheck(target: FactCheckTarget, title: string, content: string): AgentPrompt {
  return {
    human: `Vérifie le livrable suivant (${target}) intitulé « ${title} » :\n\n${content}\n\nSignale toute affirmation douteuse ou fausse, corrigé inclus.`,
    brief: { role: "factcheck", target, title, content },
  };
}

export function buildEvaluations(lesson: Lesson, diagnosis: TeacherDiagnosis): AgentPrompt {
  return {
    human: `Leçon finale validée :\n\n${lesson.markdown}\n\nDiagnostic (JSON) :\n${JSON.stringify(
      diagnosis,
    )}\n\nProduis les évaluations sur 3 niveaux, pilotées par le diagnostic.`,
    brief: { role: "evaluations", lessonTitle: lesson.title, lessonMarkdown: lesson.markdown, diagnosis },
  };
}

export function buildExercices(lesson: Lesson, diagnosis: TeacherDiagnosis): AgentPrompt {
  return {
    human: `Leçon finale validée :\n\n${lesson.markdown}\n\nDiagnostic (JSON) :\n${JSON.stringify(
      diagnosis,
    )}\n\nProduis des exercices engageants ancrés sur les points faibles diagnostiqués.`,
    brief: { role: "exercices", lessonTitle: lesson.title, lessonMarkdown: lesson.markdown, diagnosis },
  };
}

export function buildFiche(lesson: Lesson, diagnosis: TeacherDiagnosis): AgentPrompt {
  return {
    human: `Leçon finale validée :\n\n${lesson.markdown}\n\nDiagnostic (JSON) :\n${JSON.stringify(
      diagnosis,
    )}\n\nProduis une fiche de révision (prérequis explicités en tête).`,
    brief: { role: "fiche", lessonTitle: lesson.title, lessonMarkdown: lesson.markdown, diagnosis },
  };
}

/** Serialize a production bundle's deliverable to plain text for fact-checking. */
export function productionPartToText(
  production: PedagogicalProduction,
  part: "evaluations" | "exercices" | "fiche",
): string {
  if (part === "evaluations") return JSON.stringify(production.evaluations, null, 2);
  if (part === "exercices") return JSON.stringify(production.exercices, null, 2);
  return JSON.stringify(production.fiche, null, 2);
}

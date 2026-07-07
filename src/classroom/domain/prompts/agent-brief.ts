/**
 * AgentBrief — the structured, machine-readable task descriptor for one agent
 * role. It is domain data: the builders in `briefs.ts` produce it from the
 * lesson and upstream artifacts, and it fully determines what a given agent
 * must do. The deterministic mock engine consumes it directly (no NL parsing);
 * real providers only ever see the human prompt built alongside it.
 */
import type { ClassId, Level, Provider, Style } from "../value-objects/axes";
import type { StudentRestitution } from "../entities/student-restitution";
import type { TeacherDiagnosis } from "../entities/teacher-diagnosis";

export type AgentRole =
  | "student"
  | "diagnosis"
  | "rewrite"
  | "factcheck"
  | "evaluations"
  | "exercises"
  | "sheet";

export type FactCheckTarget = "lesson" | "evaluations" | "exercises" | "sheet";

export type AgentBrief =
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

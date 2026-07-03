/**
 * ClassroomSim — data contract (single source of truth).
 *
 * These Zod schemas ARE the contract passed between Mastra agents through the
 * typed workflow steps. They contain ZERO runtime dependency on @mastra/* so
 * they are safe to import from both the server (agents/workflow) and the client
 * (React components rendering the result panels).
 *
 * Zod v4.
 */
import { z } from "zod";

/* -------------------------------------------------------------------------- */
/*  Axes: mastery level (axis 1) × cognitive style (axis 2) × provider         */
/* -------------------------------------------------------------------------- */

export const LEVELS = ["N0", "N1", "N2", "N3", "N4", "N5", "N6"] as const;
export const LevelSchema = z.enum(LEVELS);
export type Level = z.infer<typeof LevelSchema>;

/** Style codes are ASCII-safe (labels live in the human-facing catalog). */
export const STYLES = [
  "S-LITERAL",
  "S-ANALOGICAL",
  "S-SEQUENTIAL",
  "S-IMPATIENT",
  "S-ANXIOUS",
  "S-MISSING-CONTEXT",
] as const;
export const StyleSchema = z.enum(STYLES);
export type Style = z.infer<typeof StyleSchema>;

export const PROVIDERS = ["anthropic", "openai", "google", "deepseek", "mock"] as const;
export const ProviderSchema = z.enum(PROVIDERS);
export type Provider = z.infer<typeof ProviderSchema>;

export const CLASS_IDS = ["A", "B", "C"] as const;
export const ClassIdSchema = z.enum(CLASS_IDS);
export type ClassId = z.infer<typeof ClassIdSchema>;

/* -------------------------------------------------------------------------- */
/*  Lesson / LessonVersion                                                     */
/* -------------------------------------------------------------------------- */

export const LessonSchema = z.object({
  id: z.string(),
  title: z.string(),
  markdown: z.string(),
});
export type Lesson = z.infer<typeof LessonSchema>;

export const LessonVersionSchema = z.object({
  title: z.string().describe("Title of the rewritten lesson."),
  markdown: z.string().describe("The new enriched version, as complete markdown."),
  change_summary: z
    .array(z.string())
    .describe("List of changes made, in the order of the priorities addressed."),
  explicit_prerequisites: z
    .array(z.string())
    .describe("Prerequisites now made explicit at the top of the lesson."),
});
export type LessonVersion = z.infer<typeof LessonVersionSchema>;

/* -------------------------------------------------------------------------- */
/*  StudentRestitution — output of each student-agent                          */
/* -------------------------------------------------------------------------- */

export const RevealedErrorSchema = z.object({
  missed_concept: z.string().describe("The precise concept of the lesson that did not land."),
  probable_cause: z
    .string()
    .describe("Diagnosed cause: missing prerequisite, misleading analogy, ordering, jargon…"),
  triggered_by: z
    .string()
    .describe("Which mechanism of the profile (level × style) triggered the error."),
});
export type RevealedError = z.infer<typeof RevealedErrorSchema>;

export const StudentRestitutionSchema = z.object({
  studentId: z.string(),
  classId: ClassIdSchema,
  level: LevelSchema,
  style: StyleSchema,
  provider: ProviderSchema,
  what_i_understood: z
    .string()
    .describe("Sincere re-explanation of the lesson, according to the student's cognitive profile."),
  confident_points: z.array(z.string()).describe("The student's certainties (may be wrong)."),
  uncertain_points: z.array(z.string()),
  questions_for_teacher: z
    .array(z.string())
    .max(2)
    .describe("0 to 2 questions, consistent with the profile."),
  revealed_errors: z
    .array(RevealedErrorSchema)
    .describe("META FIELD — feeds the diagnosis directly."),
});
export type StudentRestitution = z.infer<typeof StudentRestitutionSchema>;

/* -------------------------------------------------------------------------- */
/*  TeacherDiagnosis — output of the diagnostician teacher-agent               */
/* -------------------------------------------------------------------------- */

export const MisunderstoodConceptSchema = z.object({
  concept: z.string(),
  affected_levels: z.array(LevelSchema),
  frequency: z.number().int().min(0).describe("Number of students who missed this concept."),
  severity: z.enum(["low", "medium", "high"]),
});

export const MissingPrerequisiteSchema = z.object({
  prerequisite: z.string(),
  evidence: z.string().describe("Quote/observation drawn mostly from N2 & S-MISSING-CONTEXT."),
});

export const AmbiguousPassageSchema = z.object({
  excerpt: z.string().describe("Excerpt of the original text that is problematic."),
  problem: z.string().describe("Drawn mostly from N6 & S-ANXIOUS."),
});

export const TeacherDiagnosisSchema = z.object({
  misunderstood_concepts: z.array(MisunderstoodConceptSchema),
  missing_prerequisites: z.array(MissingPrerequisiteSchema),
  ambiguous_passages: z.array(AmbiguousPassageSchema),
  what_works: z
    .array(z.string())
    .describe("Validated by N5 — the writer MUST NOT touch these."),
  structural_flaws: z.array(z.string()).describe("Drawn from N6."),
  rewrite_priorities: z
    .array(z.string())
    .describe("Ordered, actionable list, addressed in order by the writer."),
});
export type TeacherDiagnosis = z.infer<typeof TeacherDiagnosisSchema>;

/* -------------------------------------------------------------------------- */
/*  FactCheckReport                                                            */
/* -------------------------------------------------------------------------- */

export const FactCheckClaimSchema = z.object({
  claim: z.string().describe("The verified claim, quoted."),
  verdict: z.enum(["correct", "dubious", "incorrect"]),
  explanation: z.string(),
  suggested_correction: z.string().optional(),
  source_location: z
    .string()
    .describe("Where in the deliverable (lesson / assessment item / exercise answer key)."),
});
export type FactCheckClaim = z.infer<typeof FactCheckClaimSchema>;

export const FactCheckReportSchema = z.object({
  target: z
    .enum(["lesson", "evaluations", "exercises", "sheet"])
    .describe("Which deliverable was verified."),
  claims: z.array(FactCheckClaimSchema),
  blocking: z
    .boolean()
    .describe("true if at least one 'incorrect' claim remains (a wrong answer key = blocking)."),
  summary: z.string(),
});
export type FactCheckReport = z.infer<typeof FactCheckReportSchema>;

/* -------------------------------------------------------------------------- */
/*  Pedagogical production: Evaluation / Exercise / RevisionSheet              */
/* -------------------------------------------------------------------------- */

export const EvaluationItemSchema = z.object({
  type: z.enum(["mcq", "open", "true_false"]),
  statement: z.string(),
  options: z.array(z.string()).optional().describe("Present for MCQ."),
  answer_key: z.string(),
  target_concept: z.string().describe("The concept (from the diagnosis) that the item works on."),
});

export const EvaluationSchema = z.object({
  level: z.enum(["beginner", "intermediate", "advanced"]),
  items: z.array(EvaluationItemSchema),
});
export type Evaluation = z.infer<typeof EvaluationSchema>;

export const EvaluationSetSchema = z.object({
  beginner: EvaluationSchema,
  intermediate: EvaluationSchema,
  advanced: EvaluationSchema,
});
export type EvaluationSet = z.infer<typeof EvaluationSetSchema>;

export const ExerciseSchema = z.object({
  title: z.string(),
  format: z
    .enum(["scenario", "mini_challenge", "error_spotting", "progressive_application"])
    .describe("error_spotting ideally targets the N2 misconceptions."),
  statement: z.string(),
  answer_key: z.string().describe("Answer key / pedagogical commentary."),
  target_concept: z.string(),
  indicative_level: z.enum(["beginner", "intermediate", "advanced"]),
});
export type Exercise = z.infer<typeof ExerciseSchema>;

export const ExerciseSetSchema = z.object({
  exercises: z.array(ExerciseSchema),
});
export type ExerciseSet = z.infer<typeof ExerciseSetSchema>;

export const RevisionSheetSchema = z.object({
  title: z.string(),
  prerequisites: z.array(z.string()).describe("Placed at the top — now made explicit."),
  key_points: z.array(z.string()),
  definitions: z.array(z.object({ term: z.string(), def: z.string() })),
  common_pitfalls: z
    .array(z.string())
    .describe("Drawn from the revealed_errors and the most-missed concepts."),
});
export type RevisionSheet = z.infer<typeof RevisionSheetSchema>;

/* -------------------------------------------------------------------------- */
/*  Final aggregate of a loop                                                   */
/* -------------------------------------------------------------------------- */

export const PedagogicalProductionSchema = z.object({
  evaluations: EvaluationSetSchema,
  exercises: ExerciseSetSchema,
  sheet: RevisionSheetSchema,
});
export type PedagogicalProduction = z.infer<typeof PedagogicalProductionSchema>;

export const LoopResultSchema = z.object({
  lessonOriginal: LessonSchema,
  restitutions: z.array(StudentRestitutionSchema),
  diagnosis: TeacherDiagnosisSchema,
  lessonVersion: LessonVersionSchema,
  factCheckLesson: FactCheckReportSchema,
  production: PedagogicalProductionSchema,
  factCheckProduction: z.array(FactCheckReportSchema),
});
export type LoopResult = z.infer<typeof LoopResultSchema>;

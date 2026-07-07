/**
 * PedagogicalProduction — the diagnosis-driven deliverables the producer-agents
 * generate: multi-level evaluations, engaging exercises, and a revision sheet.
 * Pure Zod contract (v4).
 */
import { z } from "zod";

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

export const PedagogicalProductionSchema = z.object({
  evaluations: EvaluationSetSchema,
  exercises: ExerciseSetSchema,
  sheet: RevisionSheetSchema,
});
export type PedagogicalProduction = z.infer<typeof PedagogicalProductionSchema>;

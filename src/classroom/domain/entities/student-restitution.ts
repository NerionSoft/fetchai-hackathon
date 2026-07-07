/**
 * StudentRestitution — the output of each student-agent: a sincere, profile-
 * constrained re-explanation of the lesson, plus the meta field revealed_errors
 * that feeds the diagnosis directly. Pure Zod contract (v4).
 */
import { z } from "zod";

import { ClassIdSchema, LevelSchema, ProviderSchema, StyleSchema } from "../value-objects/axes";

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
    .describe("Ideally 0 to 2 questions, consistent with the profile (soft guidance, not enforced)."),
  revealed_errors: z
    .array(RevealedErrorSchema)
    .describe("META FIELD — feeds the diagnosis directly."),
});
export type StudentRestitution = z.infer<typeof StudentRestitutionSchema>;

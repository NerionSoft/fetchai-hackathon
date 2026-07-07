/**
 * TeacherDiagnosis — the diagnostician-agent's structured, actionable aggregate
 * over all student restitutions: misconceptions (severity + frequency), missing
 * prerequisites, ambiguous passages, what to preserve, and ordered rewrite
 * priorities. Pure Zod contract (v4).
 */
import { z } from "zod";

import { LevelSchema } from "../value-objects/axes";

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

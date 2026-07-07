/**
 * LoopResult — the final aggregate of one full ClassroomSim loop: the original
 * lesson, every restitution, the diagnosis, the rewritten version, and the
 * fact-checked pedagogical production. Pure Zod contract (v4).
 */
import { z } from "zod";

import { LessonSchema, LessonVersionSchema } from "./lesson";
import { StudentRestitutionSchema } from "./student-restitution";
import { TeacherDiagnosisSchema } from "./teacher-diagnosis";
import { FactCheckReportSchema } from "./fact-check";
import { PedagogicalProductionSchema } from "./production";

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

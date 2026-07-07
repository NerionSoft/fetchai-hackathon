/**
 * Lesson & LessonVersion — the material entering the loop and the rewritten
 * version the teacher-agents produce. Pure Zod contract (v4).
 */
import { z } from "zod";

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

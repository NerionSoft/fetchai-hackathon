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

/**
 * Derive a lesson title from its markdown: the first level-1 heading, else the
 * first non-empty line (handy for PDF-extracted text with no headings), capped
 * to a sane length; falls back to a default when nothing usable is found.
 */
export function titleFromMarkdown(md: string): string {
  const heading = md.match(/^#\s+(.+)$/m);
  if (heading) return heading[1].trim();
  const firstLine = md.split("\n").map((l) => l.trim()).find(Boolean);
  if (firstLine) return firstLine.replace(/^#+\s*/, "").slice(0, 80).trim();
  return "Untitled lesson";
}

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

/**
 * Input DTO for the run-classroom-loop use case: the raw lesson as posted by a
 * delivery adapter (SSE route, uAgent JSON route). Validates the markdown and
 * normalizes it into a domain Lesson (deriving id/title when omitted).
 */
import { randomUUID } from "node:crypto";
import { z } from "zod";

import type { Lesson } from "@/classroom/domain";

export const RunLoopInputSchema = z.object({
  id: z.string().optional(),
  title: z.string().optional(),
  markdown: z.string().min(1, "The lesson is empty."),
});
export type RunLoopInput = z.infer<typeof RunLoopInputSchema>;

function titleFromMarkdown(md: string): string {
  const m = md.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : "Untitled lesson";
}

/** Normalize a validated input into a domain Lesson. */
export function toLesson(input: RunLoopInput): Lesson {
  return {
    id: input.id ?? randomUUID(),
    title: input.title?.trim() || titleFromMarkdown(input.markdown),
    markdown: input.markdown,
  };
}

/**
 * Input DTO for the run-classroom-loop use case: the raw request as posted by a
 * delivery adapter (SSE route, uAgent JSON route). Accepts either the legacy
 * single `markdown` field or the new `inputs[]` array of text/PDF sources, and
 * normalizes both into the transport-agnostic `LessonSource[]` the use case ingests.
 *
 * PDF payloads travel as base64 in the JSON body (keeping the fetch-streaming SSE
 * pattern) and are decoded to bytes HERE, so the use case never sees base64.
 */
import { randomUUID } from "node:crypto";
import { z } from "zod";

import type { LessonSource, RunClassroomLoopParams } from "../usecases/run-classroom-loop.usecase";

const TextSourceSchema = z.object({
  kind: z.literal("text"),
  text: z.string().min(1, "A text input is empty."),
});
const PdfSourceSchema = z.object({
  kind: z.literal("pdf"),
  filename: z.string().optional(),
  /** The PDF file, base64-encoded. */
  data: z.string().min(1, "A PDF input is empty."),
});
const SourceSchema = z.discriminatedUnion("kind", [TextSourceSchema, PdfSourceSchema]);

export const RunLoopInputSchema = z
  .object({
    id: z.string().optional(),
    title: z.string().optional(),
    /** Legacy single-lesson field — equivalent to one text input. */
    markdown: z.string().optional(),
    /** New multi-source field: any mix of text and PDF inputs. */
    inputs: z.array(SourceSchema).optional(),
  })
  .refine((v) => (v.markdown && v.markdown.trim().length > 0) || (v.inputs && v.inputs.length > 0), {
    message: "Provide a lesson: either `markdown` or a non-empty `inputs` array.",
  });
export type RunLoopInput = z.infer<typeof RunLoopInputSchema>;

/** Normalize a validated input into the use case's params (decoding base64 PDFs). */
export function toRunParams(
  input: RunLoopInput,
  sink: RunClassroomLoopParams["sink"],
): RunClassroomLoopParams {
  const sources: LessonSource[] = [];
  if (input.markdown && input.markdown.trim()) sources.push({ kind: "text", text: input.markdown });
  for (const src of input.inputs ?? []) {
    if (src.kind === "text") sources.push({ kind: "text", text: src.text });
    else sources.push({ kind: "pdf", filename: src.filename, bytes: new Uint8Array(Buffer.from(src.data, "base64")) });
  }
  return { id: input.id ?? randomUUID(), title: input.title, sources, sink };
}

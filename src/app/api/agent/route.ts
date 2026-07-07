/**
 * POST /api/agent — runs a full ClassroomSim loop once and returns the whole
 * result as a single JSON response (NON-streaming, unlike /api/classroom/run).
 *
 * This is the JSON entrypoint consumed by the Fetch.ai uAgent bridge (the
 * Agentverse / ASI:One agent that fronts ClassroomSim): it POSTs the lesson
 * markdown, waits for the full loop to finish, and gets back the rebuilt dossier
 * markdown plus the raw LoopResult — no SSE frames to parse.
 */
import { z } from "zod";

import { buildMarkdown } from "@/classroom/adapters/export/markdown-dossier";
import { RunLoopInputSchema, toLesson } from "@/classroom/application/dto/run-loop-input";
import { NULL_SINK } from "@/classroom/application/ports/run-event-sink";
import { runClassroomLoop } from "@/classroom/classroom.module";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request): Promise<Response> {
  let input: z.infer<typeof RunLoopInputSchema>;
  try {
    input = RunLoopInputSchema.parse(await req.json());
  } catch (err) {
    const message = err instanceof z.ZodError ? err.issues.map((i) => i.message).join("; ") : "Invalid body";
    return Response.json({ error: message }, { status: 400 });
  }

  const lesson = toLesson(input);

  try {
    const result = await runClassroomLoop.execute({ lesson, sink: NULL_SINK });
    const dossier = buildMarkdown(result, { includeAnswerKeys: true });
    return Response.json({ title: lesson.title, dossier_markdown: dossier, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}

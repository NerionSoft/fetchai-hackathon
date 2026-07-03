/**
 * POST /api/agent — runs a full ClassroomSim boucle once and returns the whole
 * result as a single JSON response (NON-streaming, unlike /api/classroom/run).
 *
 * This is the JSON entrypoint consumed by the Fetch.ai uAgent bridge (the
 * Agentverse / ASI:One agent that fronts ClassroomSim): it POSTs the lesson
 * markdown, waits for the full boucle to finish, and gets back the rebuilt
 * dossier markdown plus the raw LoopResult — no SSE frames to parse.
 */
import { randomUUID } from "node:crypto";
import { z } from "zod";

import { buildMarkdown } from "@/classroom/export";
import type { Lesson } from "@/classroom/schemas";
import { runLoop } from "@/mastra/run/loop";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const BodySchema = z.object({
  id: z.string().optional(),
  title: z.string().optional(),
  markdown: z.string().min(1, "La leçon est vide."),
});

function titleFromMarkdown(md: string): string {
  const m = md.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : "Leçon sans titre";
}

export async function POST(req: Request): Promise<Response> {
  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch (err) {
    const message = err instanceof z.ZodError ? err.issues.map((i) => i.message).join("; ") : "Corps invalide";
    return Response.json({ error: message }, { status: 400 });
  }

  const lesson: Lesson = {
    id: body.id ?? randomUUID(),
    title: body.title?.trim() || titleFromMarkdown(body.markdown),
    markdown: body.markdown,
  };

  try {
    const result = await runLoop(lesson, () => {});
    const dossier = buildMarkdown(result, { includeCorriges: true });
    return Response.json({ title: lesson.title, dossier_markdown: dossier, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}

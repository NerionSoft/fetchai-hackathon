/**
 * POST /api/classroom/run — runs a full ClassroomSim loop and streams the
 * result as Server-Sent Events (one JSON `ClassroomEvent` per `data:` frame).
 *
 * The client reads this with fetch-streaming (not EventSource) so the lesson
 * markdown can be POSTed in the body.
 */
import { randomUUID } from "node:crypto";
import { z } from "zod";

import { encodeSSE, type ClassroomEvent } from "@/classroom/events";
import type { Lesson } from "@/classroom/schemas";
import { runLoop } from "@/mastra/run/loop";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const BodySchema = z.object({
  id: z.string().optional(),
  title: z.string().optional(),
  markdown: z.string().min(1, "The lesson is empty."),
});

function titleFromMarkdown(md: string): string {
  const m = md.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : "Untitled lesson";
}

export async function POST(req: Request): Promise<Response> {
  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch (err) {
    const message = err instanceof z.ZodError ? err.issues.map((i) => i.message).join("; ") : "Invalid body";
    return Response.json({ error: message }, { status: 400 });
  }

  const lesson: Lesson = {
    id: body.id ?? randomUUID(),
    title: body.title?.trim() || titleFromMarkdown(body.markdown),
    markdown: body.markdown,
  };

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const emit = (event: ClassroomEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(encodeSSE(event)));
        } catch {
          closed = true;
        }
      };

      try {
        await runLoop(lesson, emit);
      } catch (err) {
        emit({ type: "error", message: err instanceof Error ? err.message : String(err) });
      } finally {
        closed = true;
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

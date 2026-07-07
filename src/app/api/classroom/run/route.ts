/**
 * POST /api/classroom/run — runs a full ClassroomSim loop and streams the
 * result as Server-Sent Events (one JSON `ClassroomEvent` per `data:` frame).
 *
 * Thin delivery adapter: validates the body, builds an SSE RunEventSink, and
 * delegates to the pre-wired use case. The client reads this with fetch-streaming
 * (not EventSource) so the lesson markdown can be POSTed in the body.
 */
import { z } from "zod";

import { createSseRunEventSink } from "@/classroom/adapters/sse/sse-run-event-sink";
import { RunLoopInputSchema, toLesson } from "@/classroom/application/dto/run-loop-input";
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

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const sink = createSseRunEventSink(controller);
      try {
        await runClassroomLoop.execute({ lesson, sink });
      } catch (err) {
        sink.emit({ type: "error", message: err instanceof Error ? err.message : String(err) });
      } finally {
        sink.close();
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

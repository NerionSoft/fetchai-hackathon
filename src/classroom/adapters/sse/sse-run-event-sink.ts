/**
 * SSE implementation of the RunEventSink port. Encodes each ClassroomEvent as an
 * SSE `data:` frame and enqueues it on the response stream controller. Silently
 * becomes a no-op once the client disconnects (enqueue throws) so the loop never
 * crashes on a closed connection.
 */
import {
  encodeSSE,
  type ClassroomEvent,
} from "@/classroom/application/events/classroom-event";
import type { RunEventSink } from "@/classroom/application/ports/run-event-sink";

export interface SseRunEventSink extends RunEventSink {
  /** Stop emitting (client gone, or the loop finished). */
  close(): void;
}

export function createSseRunEventSink(
  controller: ReadableStreamDefaultController<Uint8Array>,
): SseRunEventSink {
  const encoder = new TextEncoder();
  let closed = false;
  return {
    emit(event: ClassroomEvent) {
      if (closed) return;
      try {
        controller.enqueue(encoder.encode(encodeSSE(event)));
      } catch {
        closed = true;
      }
    },
    close() {
      closed = true;
    },
  };
}

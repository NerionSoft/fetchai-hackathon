/**
 * RunEventSink — outbound port the use case pushes live loop events to. The SSE
 * route implements it; a no-op implementation drives the non-streaming
 * /api/agent path. Decouples orchestration from the delivery mechanism.
 */
import type { ClassroomEvent } from "../events/classroom-event";

export interface RunEventSink {
  emit(event: ClassroomEvent): void;
}

/** A sink that discards every event (non-streaming callers). */
export const NULL_SINK: RunEventSink = { emit: () => {} };

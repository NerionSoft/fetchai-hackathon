/**
 * UsageMeter — accumulates token usage / estimated cost across a single loop and
 * emits a running `usage` event through the sink after every agent call. One
 * instance per loop run (no global registry).
 */
import type { Provider } from "@/classroom/domain";
import { estimateCostUsd } from "@/classroom/domain/pricing";

import type { RunEventSink } from "../ports/run-event-sink";

export class UsageMeter {
  private input = 0;
  private output = 0;
  private calls = 0;
  private cost = 0;

  constructor(private readonly sink: RunEventSink) {}

  add(provider: Provider, inputTokens: number, outputTokens: number): void {
    this.input += inputTokens;
    this.output += outputTokens;
    this.calls += 1;
    this.cost += estimateCostUsd(provider, inputTokens, outputTokens);
    this.sink.emit({
      type: "usage",
      inputTokens: this.input,
      outputTokens: this.output,
      estimatedCostUsd: Number(this.cost.toFixed(4)),
      calls: this.calls,
    });
  }
}

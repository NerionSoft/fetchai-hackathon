/**
 * RunClassroomLoopUseCase — the deterministic ClassroomSim loop.
 *
 * Orchestrates the six phases (simulate → diagnose → rewrite → factCheck lesson
 * → produce → factCheck production) in plain, typed TypeScript. Each phase's Zod
 * output feeds the next. Live token streaming and progress are pushed through the
 * injected RunEventSink; agents are run through the AgentRunner port, so this
 * layer has ZERO dependency on any agent framework.
 *
 * Resilience policy:
 *  - a student call that fails marks that student "failed" and is skipped (the
 *    loop continues with the others); zero restitutions is fatal.
 *  - a teacher call that fails NEVER blocks — it falls back to the deterministic
 *    engine so a complete diagnosis / rewrite / production is always produced.
 */
import type { ZodType } from "zod";

import {
  type FactCheckReport,
  FactCheckReportSchema,
  type Lesson,
  LessonVersionSchema,
  type LessonVersion,
  type LoopResult,
  type PedagogicalProduction,
  EvaluationSetSchema,
  ExerciseSetSchema,
  RevisionSheetSchema,
  type StudentRestitution,
  StudentRestitutionSchema,
  type TeacherDiagnosis,
  TeacherDiagnosisSchema,
} from "@/classroom/domain";
import { ROSTER } from "@/classroom/domain/profiles/roster";
import {
  type AgentPrompt,
  buildDiagnosis,
  buildEvaluations,
  buildExercises,
  buildFactCheck,
  buildRewrite,
  buildSheet,
  buildStudent,
  productionPartToText,
} from "@/classroom/domain/prompts/briefs";
import { NoRestitutionError } from "@/classroom/domain/errors/no-restitution.error";

import type { AgentFallback } from "../ports/agent-fallback";
import type { AgentRunner } from "../ports/agent-runner";
import type { RunEventSink } from "../ports/run-event-sink";
import { mapPool } from "../support/concurrency";
import { UsageMeter } from "../support/usage-meter";

const DEFAULT_CONCURRENCY = Number(process.env.CLASSROOM_CONCURRENCY ?? "6");

function truncate(s: string, n = 240): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

/** Per-run context threaded through the phases. */
interface RunCtx {
  lesson: Lesson;
  sink: RunEventSink;
  meter: UsageMeter;
}

interface AgentCall<T> {
  agentKey: string;
  schema: ZodType<T>;
  prompt: AgentPrompt;
  summary: (value: T) => string;
}

export interface RunClassroomLoopParams {
  lesson: Lesson;
  sink: RunEventSink;
}

export class RunClassroomLoopUseCase {
  constructor(
    private readonly runner: AgentRunner,
    private readonly fallback: AgentFallback,
    private readonly concurrency: number = DEFAULT_CONCURRENCY,
  ) {}

  async execute({ lesson, sink }: RunClassroomLoopParams): Promise<LoopResult> {
    const ctx: RunCtx = { lesson, sink, meter: new UsageMeter(sink) };

    sink.emit({
      type: "loop-start",
      lessonId: lesson.id,
      lessonTitle: lesson.title,
      agents: this.runner.cast(),
      mock: this.runner.mock,
    });

    const restitutions = await this.simulate(ctx);
    const diagnosis = await this.diagnose(ctx, restitutions);
    const lessonVersion = await this.rewrite(ctx, diagnosis);
    const factCheckLesson = await this.factCheckLesson(ctx, lessonVersion);
    const production = await this.produce(ctx, lessonVersion, diagnosis);
    const factCheckProduction = await this.factCheckProduction(ctx, production);

    const loopResult: LoopResult = {
      lessonOriginal: lesson,
      restitutions,
      diagnosis,
      lessonVersion,
      factCheckLesson,
      production,
      factCheckProduction,
    };
    sink.emit({ type: "result", payload: { kind: "loopResult", data: loopResult } });
    sink.emit({ type: "phase", phase: "done", label: "Done" });
    sink.emit({ type: "done" });
    return loopResult;
  }

  /* ----------------------------- step 2 — simulate ------------------------- */

  private async simulate(ctx: RunCtx): Promise<StudentRestitution[]> {
    ctx.sink.emit({ type: "phase", phase: "simulate", label: "Simulating the classes" });

    const results = await mapPool(ROSTER, this.concurrency, async (spec) => {
      const provider = this.runner.provider(spec.studentId);
      const r = await this.callStudent(ctx, {
        agentKey: spec.studentId,
        schema: StudentRestitutionSchema,
        prompt: buildStudent(spec, provider, ctx.lesson),
        summary: (x) => x.what_i_understood,
      });
      if (!r) return null;
      // Pin the identity/profile fields to the known truth.
      return {
        ...r,
        studentId: spec.studentId,
        classId: spec.classId,
        level: spec.level,
        style: spec.style,
        provider,
      } satisfies StudentRestitution;
    });

    const restitutions = results.filter((x): x is StudentRestitution => x !== null);
    if (restitutions.length === 0) throw new NoRestitutionError();
    return restitutions;
  }

  /* ----------------------------- step 3 — diagnose ------------------------- */

  private async diagnose(ctx: RunCtx, restitutions: StudentRestitution[]): Promise<TeacherDiagnosis> {
    ctx.sink.emit({ type: "phase", phase: "diagnose", label: "Diagnosis" });
    const diagnosis = await this.callTeacher(ctx, {
      agentKey: "diagnostician",
      schema: TeacherDiagnosisSchema,
      prompt: buildDiagnosis(ctx.lesson, restitutions),
      summary: (d) => d.rewrite_priorities[0] ?? "Diagnosis produced",
    });
    ctx.sink.emit({ type: "result", payload: { kind: "diagnosis", data: diagnosis } });
    return diagnosis;
  }

  /* ----------------------------- step 4 — rewrite -------------------------- */

  private async rewrite(ctx: RunCtx, diagnosis: TeacherDiagnosis): Promise<LessonVersion> {
    ctx.sink.emit({ type: "phase", phase: "rewrite", label: "Rewrite" });
    const lessonVersion = await this.callTeacher(ctx, {
      agentKey: "rewriter",
      schema: LessonVersionSchema,
      prompt: buildRewrite(ctx.lesson, diagnosis),
      summary: (v) => v.change_summary[0] ?? v.title,
    });
    ctx.sink.emit({ type: "result", payload: { kind: "lessonVersion", data: lessonVersion } });
    return lessonVersion;
  }

  /* ------------------------ step 5 — fact-check lesson --------------------- */

  private async factCheckLesson(ctx: RunCtx, lessonVersion: LessonVersion): Promise<FactCheckReport> {
    ctx.sink.emit({ type: "phase", phase: "factcheck-lesson", label: "Fact-checking the lesson" });
    const report = await this.callTeacher(ctx, {
      agentKey: "factChecker",
      schema: FactCheckReportSchema,
      prompt: buildFactCheck("lesson", lessonVersion.title, lessonVersion.markdown),
      summary: (f) => f.summary,
    });
    ctx.sink.emit({ type: "result", payload: { kind: "factCheckLesson", data: report } });
    return report;
  }

  /* -------------------------- step 6a — production ------------------------- */

  private async produce(
    ctx: RunCtx,
    lessonVersion: LessonVersion,
    diagnosis: TeacherDiagnosis,
  ): Promise<PedagogicalProduction> {
    ctx.sink.emit({ type: "phase", phase: "produce", label: "Pedagogical production" });

    const finalLesson: Lesson = {
      id: ctx.lesson.id,
      title: lessonVersion.title,
      markdown: lessonVersion.markdown,
    };

    const [evaluations, exercises, sheet] = await Promise.all([
      this.callTeacher(ctx, {
        agentKey: "evalMaker",
        schema: EvaluationSetSchema,
        prompt: buildEvaluations(finalLesson, diagnosis),
        summary: () => "3-level assessments generated",
      }),
      this.callTeacher(ctx, {
        agentKey: "exerciseMaker",
        schema: ExerciseSetSchema,
        prompt: buildExercises(finalLesson, diagnosis),
        summary: (e) => `${e.exercises.length} exercises generated`,
      }),
      this.callTeacher(ctx, {
        agentKey: "sheetMaker",
        schema: RevisionSheetSchema,
        prompt: buildSheet(finalLesson, diagnosis),
        summary: (f) => f.title,
      }),
    ]);

    const production: PedagogicalProduction = { evaluations, exercises, sheet };
    ctx.sink.emit({ type: "result", payload: { kind: "production", data: production } });
    return production;
  }

  /* --------------------- step 6b — fact-check production ------------------- */

  private async factCheckProduction(
    ctx: RunCtx,
    production: PedagogicalProduction,
  ): Promise<FactCheckReport[]> {
    ctx.sink.emit({
      type: "phase",
      phase: "factcheck-production",
      label: "Fact-checking the materials",
    });

    const reports: FactCheckReport[] = [];
    for (const part of ["evaluations", "exercises", "sheet"] as const) {
      const rep = await this.callTeacher(ctx, {
        agentKey: "factChecker",
        schema: FactCheckReportSchema,
        prompt: buildFactCheck(part, part, productionPartToText(production, part)),
        summary: (f) => f.summary,
      });
      reports.push(rep);
    }
    ctx.sink.emit({ type: "result", payload: { kind: "factCheckProduction", data: reports } });
    return reports;
  }

  /* ------------------------------ agent calls ----------------------------- */

  /** Run one agent through the port, streaming tokens and metering usage. */
  private async runAgent<T>(ctx: RunCtx, call: AgentCall<T>): Promise<T> {
    ctx.sink.emit({ type: "agent-status", agentId: call.agentKey, status: "thinking" });
    let spoke = false;
    const res = await this.runner.run({
      agentKey: call.agentKey,
      prompt: call.prompt,
      schema: call.schema,
      onToken: (delta) => {
        if (!spoke) {
          spoke = true;
          ctx.sink.emit({ type: "agent-status", agentId: call.agentKey, status: "speaking" });
        }
        if (delta) ctx.sink.emit({ type: "agent-token", agentId: call.agentKey, delta });
      },
    });
    ctx.meter.add(res.provider, res.usage.inputTokens, res.usage.outputTokens);
    return res.object;
  }

  /** A teacher failure NEVER blocks the loop — fall back to the mock engine. */
  private async callTeacher<T>(ctx: RunCtx, call: AgentCall<T>): Promise<T> {
    let obj: T;
    try {
      obj = await this.runAgent(ctx, call);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      ctx.sink.emit({
        type: "log",
        message: `Agent "${call.agentKey}" failed (${msg}). Falling back to the deterministic engine to avoid blocking the loop.`,
      });
      obj = call.schema.parse(this.fallback.produce(call.prompt.brief));
    }
    ctx.sink.emit({ type: "agent-done", agentId: call.agentKey, summary: truncate(call.summary(obj)) });
    ctx.sink.emit({ type: "agent-status", agentId: call.agentKey, status: "done" });
    return obj;
  }

  /** A student failure marks that student "failed" and is skipped. */
  private async callStudent<T>(ctx: RunCtx, call: AgentCall<T>): Promise<T | null> {
    try {
      const obj = await this.runAgent(ctx, call);
      ctx.sink.emit({ type: "agent-done", agentId: call.agentKey, summary: truncate(call.summary(obj)) });
      ctx.sink.emit({ type: "agent-status", agentId: call.agentKey, status: "done" });
      return obj;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      ctx.sink.emit({ type: "agent-error", agentId: call.agentKey, message: msg });
      ctx.sink.emit({ type: "agent-status", agentId: call.agentKey, status: "failed" });
      return null;
    }
  }
}

/**
 * ClassroomSim — the Mastra workflow orchestrating the deterministic loop
 * (steps 2→6 of the product spec). Each step's typed Zod output feeds the next;
 * cross-step context is fetched via getInitData()/getStepResult().
 *
 * Live token streaming is carried out-of-band through the per-run emitter
 * (looked up by runId), so the visual layer never constrains the orchestration.
 */
import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";

import {
  EvaluationSetSchema,
  ExerciceSetSchema,
  FactCheckReportSchema,
  FicheRevisionSchema,
  type FactCheckReport,
  type Lesson,
  LessonSchema,
  LessonVersionSchema,
  LoopResultSchema,
  type LoopResult,
  type StudentRestitution,
  StudentRestitutionSchema,
  type TeacherDiagnosis,
  TeacherDiagnosisSchema,
  type LessonVersion,
  type PedagogicalProduction,
  PedagogicalProductionSchema,
} from "@/classroom/schemas";
import { ROSTER } from "@/classroom/roster";

import { agentMeta } from "./agents";
import {
  buildDiagnosis,
  buildEvaluations,
  buildExercices,
  buildFactCheck,
  buildFiche,
  buildRewrite,
  buildStudent,
  productionPartToText,
} from "./run/briefs";
import { callStudent, callTeacher, mapPool } from "./run/calls";
import { getEmitter } from "./run/emitter";

const CONCURRENCY = Number(process.env.CLASSROOM_CONCURRENCY ?? "6");

const InitSchema = z.object({ lesson: LessonSchema, runId: z.string() });
type Init = z.infer<typeof InitSchema>;

/* ----------------------------- step 2 — simulate -------------------------- */

const simulateStep = createStep({
  id: "simulate",
  inputSchema: InitSchema,
  outputSchema: z.object({ restitutions: z.array(StudentRestitutionSchema) }),
  execute: async ({ inputData }) => {
    const { lesson, runId } = inputData as Init;
    getEmitter(runId)({ type: "phase", phase: "simulate", label: "Simulation des classes" });

    const results = await mapPool(ROSTER, CONCURRENCY, async (spec) => {
      const meta = agentMeta[spec.studentId];
      const r = await callStudent({
        runId,
        agentKey: spec.studentId,
        schema: StudentRestitutionSchema,
        prompt: buildStudent(spec, meta.provider, lesson),
        summary: (x) => x.ce_que_jai_compris,
      });
      if (!r) return null;
      // Pin the identity/profile fields to the known truth.
      return {
        ...r,
        studentId: spec.studentId,
        classId: spec.classId,
        niveau: spec.niveau,
        style: spec.style,
        provider: meta.provider,
      } satisfies StudentRestitution;
    });

    const restitutions = results.filter((x): x is StudentRestitution => x !== null);
    if (restitutions.length === 0) {
      throw new Error("Aucune restitution produite — vérifie les clés API ou active le mode mock.");
    }
    return { restitutions };
  },
});

/* ----------------------------- step 3 — diagnose -------------------------- */

const diagnoseStep = createStep({
  id: "diagnose",
  inputSchema: z.object({ restitutions: z.array(StudentRestitutionSchema) }),
  outputSchema: z.object({ diagnosis: TeacherDiagnosisSchema }),
  execute: async ({ inputData, getInitData }) => {
    const { lesson, runId } = getInitData() as Init;
    getEmitter(runId)({ type: "phase", phase: "diagnose", label: "Diagnostic" });
    const diagnosis = await callTeacher({
      runId,
      agentKey: "diagnostician",
      schema: TeacherDiagnosisSchema,
      prompt: buildDiagnosis(lesson, inputData.restitutions),
      summary: (d) => d.priorites_de_reecriture[0] ?? "Diagnostic produit",
    });
    getEmitter(runId)({ type: "result", payload: { kind: "diagnosis", data: diagnosis } });
    return { diagnosis };
  },
});

/* ----------------------------- step 4 — rewrite --------------------------- */

const rewriteStep = createStep({
  id: "rewrite",
  inputSchema: z.object({ diagnosis: TeacherDiagnosisSchema }),
  outputSchema: z.object({ lessonVersion: LessonVersionSchema }),
  execute: async ({ inputData, getInitData }) => {
    const { lesson, runId } = getInitData() as Init;
    getEmitter(runId)({ type: "phase", phase: "rewrite", label: "Réécriture" });
    const lessonVersion = await callTeacher({
      runId,
      agentKey: "rewriter",
      schema: LessonVersionSchema,
      prompt: buildRewrite(lesson, inputData.diagnosis),
      summary: (v) => v.resume_des_changements[0] ?? v.title,
    });
    getEmitter(runId)({ type: "result", payload: { kind: "lessonVersion", data: lessonVersion } });
    return { lessonVersion };
  },
});

/* ------------------------ step 5 — fact-check lesson ---------------------- */

const factCheckLessonStep = createStep({
  id: "factCheckLesson",
  inputSchema: z.object({ lessonVersion: LessonVersionSchema }),
  outputSchema: z.object({ factCheckLesson: FactCheckReportSchema }),
  execute: async ({ inputData, getInitData }) => {
    const { runId } = getInitData() as Init;
    getEmitter(runId)({ type: "phase", phase: "factcheck-lesson", label: "Fact-check de la leçon" });
    const factCheckLesson = await callTeacher({
      runId,
      agentKey: "factChecker",
      schema: FactCheckReportSchema,
      prompt: buildFactCheck("lesson", inputData.lessonVersion.title, inputData.lessonVersion.markdown),
      summary: (f) => f.synthese,
    });
    getEmitter(runId)({ type: "result", payload: { kind: "factCheckLesson", data: factCheckLesson } });
    return { factCheckLesson };
  },
});

/* -------------------------- step 6a — production -------------------------- */

const produceStep = createStep({
  id: "produce",
  inputSchema: z.object({ factCheckLesson: FactCheckReportSchema }),
  outputSchema: z.object({ production: PedagogicalProductionSchema }),
  execute: async ({ getInitData, getStepResult }) => {
    const { lesson, runId } = getInitData() as Init;
    const { diagnosis } = getStepResult("diagnose") as { diagnosis: TeacherDiagnosis };
    const { lessonVersion } = getStepResult("rewrite") as { lessonVersion: LessonVersion };
    getEmitter(runId)({ type: "phase", phase: "produce", label: "Production pédagogique" });

    const finalLesson: Lesson = { id: lesson.id, title: lessonVersion.title, markdown: lessonVersion.markdown };

    const [evaluations, exercices, fiche] = await Promise.all([
      callTeacher({
        runId,
        agentKey: "evalMaker",
        schema: EvaluationSetSchema,
        prompt: buildEvaluations(finalLesson, diagnosis),
        summary: () => "Évaluations 3 niveaux générées",
      }),
      callTeacher({
        runId,
        agentKey: "exerciseMaker",
        schema: ExerciceSetSchema,
        prompt: buildExercices(finalLesson, diagnosis),
        summary: (e) => `${e.exercices.length} exercices générés`,
      }),
      callTeacher({
        runId,
        agentKey: "ficheMaker",
        schema: FicheRevisionSchema,
        prompt: buildFiche(finalLesson, diagnosis),
        summary: (f) => f.titre,
      }),
    ]);

    const production: PedagogicalProduction = { evaluations, exercices, fiche };
    getEmitter(runId)({ type: "result", payload: { kind: "production", data: production } });
    return { production };
  },
});

/* --------------------- step 6b — fact-check production -------------------- */

const factCheckProductionStep = createStep({
  id: "factCheckProduction",
  inputSchema: z.object({ production: PedagogicalProductionSchema }),
  outputSchema: LoopResultSchema,
  execute: async ({ inputData, getInitData, getStepResult }) => {
    const { lesson, runId } = getInitData() as Init;
    const emit = getEmitter(runId);
    emit({ type: "phase", phase: "factcheck-production", label: "Fact-check des supports" });

    const { production } = inputData;
    const reports: FactCheckReport[] = [];
    for (const part of ["evaluations", "exercices", "fiche"] as const) {
      const rep = await callTeacher({
        runId,
        agentKey: "factChecker",
        schema: FactCheckReportSchema,
        prompt: buildFactCheck(part, part, productionPartToText(production, part)),
        summary: (f) => f.synthese,
      });
      reports.push(rep);
    }
    emit({ type: "result", payload: { kind: "factCheckProduction", data: reports } });

    const { restitutions } = getStepResult("simulate") as { restitutions: StudentRestitution[] };
    const { diagnosis } = getStepResult("diagnose") as { diagnosis: TeacherDiagnosis };
    const { lessonVersion } = getStepResult("rewrite") as { lessonVersion: LessonVersion };
    const { factCheckLesson } = getStepResult("factCheckLesson") as { factCheckLesson: FactCheckReport };

    const loopResult: LoopResult = {
      lessonOriginal: lesson,
      restitutions,
      diagnosis,
      lessonVersion,
      factCheckLesson,
      production,
      factCheckProduction: reports,
    };
    emit({ type: "result", payload: { kind: "loopResult", data: loopResult } });
    return loopResult;
  },
});

export const classroomWorkflow = createWorkflow({
  id: "classroom-loop",
  inputSchema: InitSchema,
  outputSchema: LoopResultSchema,
})
  .then(simulateStep)
  .then(diagnoseStep)
  .then(rewriteStep)
  .then(factCheckLessonStep)
  .then(produceStep)
  .then(factCheckProductionStep)
  .commit();

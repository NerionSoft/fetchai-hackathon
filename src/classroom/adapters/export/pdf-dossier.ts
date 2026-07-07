/**
 * PDF exports of a loop's deliverables — client-safe. Each deliverable is built
 * as markdown (the single source of truth, see `markdown-dossier`) and rendered
 * through the `markdownToPdf` renderer with the dossier theme. Answer keys are
 * togglable (`includeAnswerKeys`) so a teacher can print statements only.
 *
 * Client-only — imported solely by the result panels.
 */
import type { LoopResult } from "@/classroom/domain";
import { markdownToPdf } from "@/classroom/adapters/pdf/markdown-to-pdf";
import { DOSSIER_THEME } from "@/classroom/application/ports/pdf-codex";

import {
  buildEvaluationsMarkdown,
  buildExercisesMarkdown,
  buildLessonMarkdown,
  buildMarkdown,
  buildSheetMarkdown,
  exportFilename,
} from "./markdown-dossier";

export function lessonPdf(r: LoopResult): Uint8Array {
  return markdownToPdf(buildLessonMarkdown(r), DOSSIER_THEME);
}

export function evaluationsPdf(r: LoopResult, includeAnswerKeys: boolean): Uint8Array {
  return markdownToPdf(buildEvaluationsMarkdown(r, { includeAnswerKeys }), DOSSIER_THEME);
}

export function exercisesPdf(r: LoopResult, includeAnswerKeys: boolean): Uint8Array {
  return markdownToPdf(buildExercisesMarkdown(r, { includeAnswerKeys }), DOSSIER_THEME);
}

export function sheetPdf(r: LoopResult): Uint8Array {
  return markdownToPdf(buildSheetMarkdown(r), DOSSIER_THEME);
}

export function dossierPdf(r: LoopResult, includeAnswerKeys: boolean): Uint8Array {
  return markdownToPdf(buildMarkdown(r, { includeAnswerKeys }), DOSSIER_THEME);
}

/** Trigger a browser download of rendered PDF bytes. */
export function savePdf(bytes: Uint8Array, result: LoopResult, suffix: string): void {
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${exportFilename(result)}-${suffix}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

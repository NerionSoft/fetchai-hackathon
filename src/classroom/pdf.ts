/**
 * Real PDF exports (client-side, via jsPDF). One document per deliverable
 * (rewritten lesson, evaluations, exercises, sheet) plus a full "dossier".
 * Answer keys are togglable (`includeAnswerKeys`) so a teacher can print statements only.
 *
 * Client-only — imported solely by the result panels.
 */
import { jsPDF } from "jspdf";

import type { Evaluation, LoopResult } from "./schemas";
import { exportFilename } from "./export";

type RGB = [number, number, number];
const FG: RGB = [24, 24, 27];
const MUTED: RGB = [113, 113, 122];
const ACCENT: RGB = [79, 70, 229];
const MARGIN = 48;

const LEVEL_LABEL: Record<Evaluation["level"], string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

function clean(s: string): string {
  return s.replace(/\*\*/g, "").replace(/`/g, "");
}

/** Thin layout helper over jsPDF: cursor, page breaks, headings, lists. */
class Pdf {
  doc: jsPDF;
  y: number;
  pageW: number;
  pageH: number;
  contentW: number;

  constructor() {
    this.doc = new jsPDF({ unit: "pt", format: "a4" });
    this.pageW = this.doc.internal.pageSize.getWidth();
    this.pageH = this.doc.internal.pageSize.getHeight();
    this.contentW = this.pageW - MARGIN * 2;
    this.y = MARGIN;
  }

  private ensure(space: number) {
    if (this.y + space > this.pageH - MARGIN) {
      this.doc.addPage();
      this.y = MARGIN;
    }
  }

  private write(
    text: string,
    opts: { size?: number; style?: "normal" | "bold" | "italic"; color?: RGB; gap?: number; indent?: number } = {},
  ) {
    const { size = 11, style = "normal", color = FG, gap = 5, indent = 0 } = opts;
    this.doc.setFont("helvetica", style);
    this.doc.setFontSize(size);
    this.doc.setTextColor(color[0], color[1], color[2]);
    const lines = this.doc.splitTextToSize(text, this.contentW - indent) as string[];
    const lh = size * 1.36;
    for (const ln of lines) {
      this.ensure(lh);
      this.doc.text(ln, MARGIN + indent, this.y);
      this.y += lh;
    }
    this.y += gap;
  }

  title(text: string) {
    this.ensure(40);
    this.write(text, { size: 21, style: "bold", gap: 4 });
    this.doc.setDrawColor(235, 235, 237);
    this.doc.line(MARGIN, this.y, this.pageW - MARGIN, this.y);
    this.y += 12;
  }
  h2(text: string) {
    this.ensure(26);
    this.y += 6;
    this.write(text, { size: 15, style: "bold", color: ACCENT, gap: 4 });
  }
  h3(text: string) {
    this.ensure(20);
    this.write(text, { size: 12.5, style: "bold", gap: 3 });
  }
  para(text: string) {
    this.write(text, { gap: 6 });
  }
  muted(text: string) {
    this.write(text, { size: 9.5, color: MUTED, gap: 6 });
  }
  answerKey(text: string) {
    this.write(`Answer key: ${text}`, { size: 10, style: "italic", color: ACCENT, gap: 7 });
  }
  bullet(text: string) {
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(11);
    this.doc.setTextColor(FG[0], FG[1], FG[2]);
    const lines = this.doc.splitTextToSize(text, this.contentW - 16) as string[];
    const lh = 11 * 1.36;
    this.ensure(lh);
    this.doc.text("•", MARGIN, this.y);
    for (const ln of lines) {
      this.ensure(lh);
      this.doc.text(ln, MARGIN + 14, this.y);
      this.y += lh;
    }
    this.y += 2;
  }
}

function renderMarkdown(p: Pdf, md: string) {
  const buf: string[] = [];
  const flush = () => {
    if (buf.length) {
      p.para(clean(buf.join(" ")));
      buf.length = 0;
    }
  };
  for (const raw of md.split("\n")) {
    const line = raw.replace(/\s+$/, "");
    if (/^#\s+/.test(line)) {
      flush();
      p.title(clean(line.replace(/^#\s+/, "")));
    } else if (/^##\s+/.test(line)) {
      flush();
      p.h2(clean(line.replace(/^##\s+/, "")));
    } else if (/^###\s+/.test(line)) {
      flush();
      p.h3(clean(line.replace(/^###\s+/, "")));
    } else if (/^\s*[-*]\s+/.test(line)) {
      flush();
      p.bullet(clean(line.replace(/^\s*[-*]\s+/, "")));
    } else if (/^\s{4,}\S/.test(line)) {
      flush();
      p.muted(line.trim());
    } else if (line.trim() === "") {
      flush();
    } else {
      buf.push(line.trim());
    }
  }
  flush();
}

/* ------------------------------- sections --------------------------------- */

function secEvaluations(p: Pdf, r: LoopResult, includeAnswerKeys: boolean) {
  p.h2("Evaluations");
  (["beginner", "intermediate", "advanced"] as const).forEach((lvl) => {
    p.h3(`Level ${LEVEL_LABEL[lvl]}`);
    r.production.evaluations[lvl].items.forEach((it, i) => {
      p.para(`${i + 1}. ${it.statement}`);
      p.muted(`(${it.type}) — target concept: ${it.target_concept}`);
      it.options?.forEach((o) => p.bullet(o));
      if (includeAnswerKeys) p.answerKey(it.answer_key);
    });
  });
}

function secExercises(p: Pdf, r: LoopResult, includeAnswerKeys: boolean) {
  p.h2("Exercises");
  r.production.exercises.exercises.forEach((ex, i) => {
    p.h3(`${i + 1}. ${ex.title}`);
    p.muted(`${ex.format} · ${ex.indicative_level} · concept: ${ex.target_concept}`);
    p.para(ex.statement);
    if (includeAnswerKeys) p.answerKey(ex.answer_key);
  });
}

function secSheet(p: Pdf, r: LoopResult) {
  const f = r.production.sheet;
  p.h2(f.title);
  p.h3("Prerequisites");
  f.prerequisites.forEach((x) => p.bullet(x));
  p.h3("Key points");
  f.key_points.forEach((x) => p.bullet(x));
  p.h3("Definitions");
  f.definitions.forEach((d) => p.bullet(`${d.term}: ${d.def}`));
  p.h3("Common pitfalls");
  f.common_pitfalls.forEach((x) => p.bullet(x));
}

function secDiagnosis(p: Pdf, r: LoopResult) {
  const d = r.diagnosis;
  p.h2("Diagnosis (summary)");
  p.h3("Misunderstood concepts");
  d.misunderstood_concepts.forEach((c) =>
    p.bullet(`${c.concept} — severity ${c.severity}, ${c.frequency} student(s)`),
  );
  p.h3("Missing prerequisites");
  d.missing_prerequisites.forEach((x) => p.bullet(`${x.prerequisite} — ${x.evidence}`));
  p.h3("Rewrite priorities");
  d.rewrite_priorities.forEach((x, i) => p.bullet(`${i + 1}. ${x}`));
}

/* ------------------------------- builders --------------------------------- */

export function lessonPdf(r: LoopResult): jsPDF {
  const p = new Pdf();
  renderMarkdown(p, r.lessonVersion.markdown);
  return p.doc;
}

export function evaluationsPdf(r: LoopResult, includeAnswerKeys: boolean): jsPDF {
  const p = new Pdf();
  p.title(`${r.lessonVersion.title} — Evaluations`);
  secEvaluations(p, r, includeAnswerKeys);
  return p.doc;
}

export function exercisesPdf(r: LoopResult, includeAnswerKeys: boolean): jsPDF {
  const p = new Pdf();
  p.title(`${r.lessonVersion.title} — Exercises`);
  secExercises(p, r, includeAnswerKeys);
  return p.doc;
}

export function sheetPdf(r: LoopResult): jsPDF {
  const p = new Pdf();
  p.title(`${r.lessonVersion.title} — Revision sheet`);
  secSheet(p, r);
  return p.doc;
}

export function dossierPdf(r: LoopResult, includeAnswerKeys: boolean): jsPDF {
  const p = new Pdf();
  p.title(`${r.lessonVersion.title} — Pedagogical dossier`);
  p.muted("Materials generated by ClassroomSim, driven by the diagnosis of the simulated classes.");
  p.h2("Lesson (rewritten version)");
  renderMarkdown(p, r.lessonVersion.markdown);
  secDiagnosis(p, r);
  secEvaluations(p, r, includeAnswerKeys);
  secExercises(p, r, includeAnswerKeys);
  secSheet(p, r);
  return p.doc;
}

/** Trigger a browser download of a built document. */
export function savePdf(doc: jsPDF, result: LoopResult, suffix: string): void {
  doc.save(`${exportFilename(result)}-${suffix}.pdf`);
}

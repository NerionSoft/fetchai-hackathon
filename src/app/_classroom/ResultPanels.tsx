"use client";

/**
 * Result layer — the structured deliverables (diagnosis, rewritten lesson with a
 * naive diff, fact-check reports, and the diagnosis-driven pedagogical supports)
 * plus printable exports. Rendered alongside the live SVG scene.
 */
import { useMemo, useState } from "react";

import { buildMarkdown, buildPrintableHtml, exportFilename } from "@/classroom/export";
import { dossierPdf, evaluationsPdf, exercisesPdf, sheetPdf, lessonPdf, savePdf } from "@/classroom/pdf";
import type { FactCheckReport } from "@/classroom/schemas";
import type { RunState } from "./use-classroom-run";

function download(filename: string, mime: string, content: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ border: "1px solid var(--border)", borderRadius: 14, padding: "16px 18px", marginBottom: 14, background: "var(--surface)" }}>
      <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--foreground)" }}>{title}</h3>
      {children}
    </section>
  );
}

const verdictColor: Record<string, string> = {
  correct: "#16a34a",
  dubious: "#d97706",
  incorrect: "#dc2626",
};

function FactCheck({ report }: { report: FactCheckReport }) {
  return (
    <div style={{ marginBottom: 10, fontSize: 13 }}>
      <strong>{report.target}</strong>{" "}
      {report.blocking ? (
        <span style={{ color: "#dc2626", fontWeight: 700 }}>⛔ blocking</span>
      ) : (
        <span style={{ color: "#16a34a" }}>✓ validated</span>
      )}
      <p style={{ margin: "4px 0", color: "#444" }}>{report.summary}</p>
      <ul style={{ margin: 0, paddingLeft: 18 }}>
        {report.claims.map((c, i) => (
          <li key={i} style={{ marginBottom: 3 }}>
            <span style={{ color: verdictColor[c.verdict] ?? "#444", fontWeight: 600 }}>[{c.verdict}]</span>{" "}
            {c.claim} — <em style={{ color: "#666" }}>{c.explanation}</em>
            {c.suggested_correction ? <span style={{ color: "#7c3aed" }}> → {c.suggested_correction}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Lines present in the new version but absent from the original. */
function addedLines(original: string, next: string): Set<string> {
  const orig = new Set(original.split("\n").map((l) => l.trim()));
  const added = new Set<string>();
  for (const l of next.split("\n")) {
    const t = l.trim();
    if (t && !orig.has(t)) added.add(t);
  }
  return added;
}

export function ResultPanels({ state }: { state: RunState }) {
  const { diagnosis, lessonVersion, factCheckLesson, production, factCheckProduction, loopResult } = state;
  const [withCorr, setWithCorr] = useState(true);

  const added = useMemo(
    () => (loopResult ? addedLines(loopResult.lessonOriginal.markdown, lessonVersion?.markdown ?? "") : new Set<string>()),
    [loopResult, lessonVersion],
  );

  const hasAny = diagnosis || lessonVersion || factCheckLesson || production;
  if (!hasAny) {
    return <p style={{ color: "#6b7280", fontSize: 14 }}>Results will appear here as the loop runs…</p>;
  }

  return (
    <div>
      {loopResult && (
        <Panel title="Exports">
          <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, marginBottom: 12, color: "var(--muted)" }}>
            <input type="checkbox" checked={withCorr} onChange={(e) => setWithCorr(e.target.checked)} />
            Include answer keys
          </label>

          <div style={subLabel}>PDF</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
            <button style={btn} onClick={() => savePdf(dossierPdf(loopResult, withCorr), loopResult, "dossier")}>
              Full dossier
            </button>
            <button style={btn} onClick={() => savePdf(lessonPdf(loopResult), loopResult, "lesson")}>
              Lesson
            </button>
            <button style={btn} onClick={() => savePdf(evaluationsPdf(loopResult, withCorr), loopResult, "evaluations")}>
              Evaluations
            </button>
            <button style={btn} onClick={() => savePdf(exercisesPdf(loopResult, withCorr), loopResult, "exercises")}>
              Exercises
            </button>
            <button style={btn} onClick={() => savePdf(sheetPdf(loopResult), loopResult, "sheet")}>
              Revision sheet
            </button>
          </div>

          <div style={subLabel}>Other formats</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              style={ghost}
              onClick={() =>
                download(`${exportFilename(loopResult)}.md`, "text/markdown", buildMarkdown(loopResult, { includeAnswerKeys: withCorr }))
              }
            >
              Markdown
            </button>
            <button
              style={ghost}
              onClick={() =>
                download(`${exportFilename(loopResult)}.html`, "text/html", buildPrintableHtml(loopResult, { includeAnswerKeys: withCorr }))
              }
            >
              Printable HTML
            </button>
          </div>
        </Panel>
      )}

      {diagnosis && (
        <Panel title="Diagnosis">
          <h4 style={h4}>Misunderstood concepts</h4>
          <ul style={ul}>
            {diagnosis.misunderstood_concepts.map((c, i) => (
              <li key={i}>
                <strong>{c.concept}</strong> — severity {c.severity}, {c.frequency} student(s){" "}
                <span style={{ color: "#6b7280" }}>[{c.affected_levels.join(", ")}]</span>
              </li>
            ))}
          </ul>
          <h4 style={h4}>Missing prerequisites</h4>
          <ul style={ul}>
            {diagnosis.missing_prerequisites.map((p, i) => (
              <li key={i}>
                <strong>{p.prerequisite}</strong> — <em style={{ color: "#666" }}>{p.evidence}</em>
              </li>
            ))}
          </ul>
          <h4 style={h4}>Ambiguous passages</h4>
          <ul style={ul}>
            {diagnosis.ambiguous_passages.map((p, i) => (
              <li key={i}>
                "{p.excerpt}" — {p.problem}
              </li>
            ))}
          </ul>
          <h4 style={h4}>What works (to preserve)</h4>
          <ul style={ul}>
            {diagnosis.what_works.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
          <h4 style={h4}>Rewrite priorities</h4>
          <ol style={ul}>
            {diagnosis.rewrite_priorities.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </Panel>
      )}

      {lessonVersion && (
        <Panel title="Rewritten lesson (diff vs original)">
          {lessonVersion.explicit_prerequisites.length > 0 && (
            <>
              <h4 style={h4}>Prerequisites now made explicit</h4>
              <ul style={ul}>
                {lessonVersion.explicit_prerequisites.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </>
          )}
          <h4 style={h4}>Changes</h4>
          <ul style={ul}>
            {lessonVersion.change_summary.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
          <h4 style={h4}>New version</h4>
          <pre style={pre}>
            {lessonVersion.markdown.split("\n").map((line, i) => {
              const isNew = added.has(line.trim()) && line.trim().length > 0;
              return (
                <div key={i} style={{ background: isNew ? "#dcfce7" : "transparent" }}>
                  {isNew ? "+ " : "  "}
                  {line}
                </div>
              );
            })}
          </pre>
        </Panel>
      )}

      {(factCheckLesson || factCheckProduction) && (
        <Panel title="Fact-check">
          {factCheckLesson && <FactCheck report={factCheckLesson} />}
          {factCheckProduction?.map((r, i) => (
            <FactCheck key={i} report={r} />
          ))}
        </Panel>
      )}

      {production && (
        <Panel title="Teaching materials">
          <h4 style={h4}>Evaluations</h4>
          {(["beginner", "intermediate", "advanced"] as const).map((lvl) => (
            <div key={lvl} style={{ marginBottom: 8 }}>
              <strong style={{ textTransform: "capitalize" }}>{lvl}</strong>
              <ul style={ul}>
                {production.evaluations[lvl].items.map((it, i) => (
                  <li key={i}>
                    <span style={{ color: "#6b7280" }}>({it.type})</span> {it.statement}{" "}
                    <em style={{ color: "#7c3aed" }}>→ {it.target_concept}</em>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <h4 style={h4}>Exercises</h4>
          <ul style={ul}>
            {production.exercises.exercises.map((ex, i) => (
              <li key={i}>
                <strong>{ex.title}</strong> <span style={{ color: "#6b7280" }}>({ex.format})</span> — {ex.statement}
              </li>
            ))}
          </ul>
          <h4 style={h4}>Revision sheet — {production.sheet.title}</h4>
          <ul style={ul}>
            {production.sheet.common_pitfalls.map((p, i) => (
              <li key={i}>⚠️ {p}</li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}

const btn: React.CSSProperties = {
  background: "#18181b",
  color: "#fff",
  border: "1px solid #18181b",
  borderRadius: 10,
  padding: "8px 14px",
  fontSize: 13,
  fontWeight: 500,
  cursor: "pointer",
};
const ghost: React.CSSProperties = {
  background: "#fff",
  color: "var(--foreground)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  padding: "8px 14px",
  fontSize: 13,
  cursor: "pointer",
};
const subLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  color: "var(--muted)",
  marginBottom: 6,
};
const h4: React.CSSProperties = {
  margin: "12px 0 5px",
  fontSize: 12,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  color: "var(--muted)",
};
const ul: React.CSSProperties = { margin: "0 0 6px", paddingLeft: 18, fontSize: 13, lineHeight: 1.55 };
const pre: React.CSSProperties = {
  background: "#fff",
  color: "var(--foreground)",
  padding: 12,
  borderRadius: 10,
  border: "1px solid var(--border)",
  fontSize: 11.5,
  lineHeight: 1.5,
  fontFamily: "var(--font-geist-mono, monospace)",
  overflowX: "auto",
  whiteSpace: "pre-wrap",
  maxHeight: 360,
  overflowY: "auto",
};

"use client";

/**
 * Result layer — the structured deliverables (diagnosis, rewritten lesson with a
 * naive diff, fact-check reports, and the diagnosis-driven pedagogical supports)
 * plus printable exports. Rendered alongside the live SVG scene.
 */
import { useMemo, useState } from "react";

import { buildMarkdown, buildPrintableHtml, exportFilename } from "@/classroom/export";
import { dossierPdf, evaluationsPdf, exercicesPdf, fichePdf, lessonPdf, savePdf } from "@/classroom/pdf";
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
  douteux: "#d97706",
  incorrect: "#dc2626",
};

function FactCheck({ report }: { report: FactCheckReport }) {
  return (
    <div style={{ marginBottom: 10, fontSize: 13 }}>
      <strong>{report.cible}</strong>{" "}
      {report.bloquant ? (
        <span style={{ color: "#dc2626", fontWeight: 700 }}>⛔ bloquant</span>
      ) : (
        <span style={{ color: "#16a34a" }}>✓ validé</span>
      )}
      <p style={{ margin: "4px 0", color: "#444" }}>{report.synthese}</p>
      <ul style={{ margin: 0, paddingLeft: 18 }}>
        {report.claims.map((c, i) => (
          <li key={i} style={{ marginBottom: 3 }}>
            <span style={{ color: verdictColor[c.verdict] ?? "#444", fontWeight: 600 }}>[{c.verdict}]</span>{" "}
            {c.affirmation} — <em style={{ color: "#666" }}>{c.explication}</em>
            {c.correction_suggeree ? <span style={{ color: "#7c3aed" }}> → {c.correction_suggeree}</span> : null}
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
    return <p style={{ color: "#6b7280", fontSize: 14 }}>Les résultats s’afficheront ici au fil de la boucle…</p>;
  }

  return (
    <div>
      {loopResult && (
        <Panel title="Exports">
          <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, marginBottom: 12, color: "var(--muted)" }}>
            <input type="checkbox" checked={withCorr} onChange={(e) => setWithCorr(e.target.checked)} />
            Inclure les corrigés
          </label>

          <div style={subLabel}>PDF</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
            <button style={btn} onClick={() => savePdf(dossierPdf(loopResult, withCorr), loopResult, "dossier")}>
              Dossier complet
            </button>
            <button style={btn} onClick={() => savePdf(lessonPdf(loopResult), loopResult, "lecon")}>
              Leçon
            </button>
            <button style={btn} onClick={() => savePdf(evaluationsPdf(loopResult, withCorr), loopResult, "evaluations")}>
              Évaluations
            </button>
            <button style={btn} onClick={() => savePdf(exercicesPdf(loopResult, withCorr), loopResult, "exercices")}>
              Exercices
            </button>
            <button style={btn} onClick={() => savePdf(fichePdf(loopResult), loopResult, "fiche")}>
              Fiche de révision
            </button>
          </div>

          <div style={subLabel}>Autres formats</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              style={ghost}
              onClick={() =>
                download(`${exportFilename(loopResult)}.md`, "text/markdown", buildMarkdown(loopResult, { includeCorriges: withCorr }))
              }
            >
              Markdown
            </button>
            <button
              style={ghost}
              onClick={() =>
                download(`${exportFilename(loopResult)}.html`, "text/html", buildPrintableHtml(loopResult, { includeCorriges: withCorr }))
              }
            >
              HTML imprimable
            </button>
          </div>
        </Panel>
      )}

      {diagnosis && (
        <Panel title="Diagnostic">
          <h4 style={h4}>Concepts mal compris</h4>
          <ul style={ul}>
            {diagnosis.concepts_mal_compris.map((c, i) => (
              <li key={i}>
                <strong>{c.concept}</strong> — gravité {c.gravite}, {c.frequence} élève(s){" "}
                <span style={{ color: "#6b7280" }}>[{c.niveaux_concernes.join(", ")}]</span>
              </li>
            ))}
          </ul>
          <h4 style={h4}>Prérequis manquants</h4>
          <ul style={ul}>
            {diagnosis.prerequis_manquants.map((p, i) => (
              <li key={i}>
                <strong>{p.prerequis}</strong> — <em style={{ color: "#666" }}>{p.preuve}</em>
              </li>
            ))}
          </ul>
          <h4 style={h4}>Passages ambigus</h4>
          <ul style={ul}>
            {diagnosis.passages_ambigus.map((p, i) => (
              <li key={i}>
                « {p.extrait} » — {p.probleme}
              </li>
            ))}
          </ul>
          <h4 style={h4}>Ce qui fonctionne (à préserver)</h4>
          <ul style={ul}>
            {diagnosis.ce_qui_fonctionne.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
          <h4 style={h4}>Priorités de réécriture</h4>
          <ol style={ul}>
            {diagnosis.priorites_de_reecriture.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </Panel>
      )}

      {lessonVersion && (
        <Panel title="Leçon réécrite (diff vs original)">
          {lessonVersion.prerequis_explicites.length > 0 && (
            <>
              <h4 style={h4}>Prérequis désormais explicités</h4>
              <ul style={ul}>
                {lessonVersion.prerequis_explicites.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </>
          )}
          <h4 style={h4}>Changements</h4>
          <ul style={ul}>
            {lessonVersion.resume_des_changements.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
          <h4 style={h4}>Nouvelle version</h4>
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
        <Panel title="Supports pédagogiques">
          <h4 style={h4}>Évaluations</h4>
          {(["debutant", "intermediaire", "avance"] as const).map((lvl) => (
            <div key={lvl} style={{ marginBottom: 8 }}>
              <strong style={{ textTransform: "capitalize" }}>{lvl}</strong>
              <ul style={ul}>
                {production.evaluations[lvl].items.map((it, i) => (
                  <li key={i}>
                    <span style={{ color: "#6b7280" }}>({it.type})</span> {it.enonce}{" "}
                    <em style={{ color: "#7c3aed" }}>→ {it.concept_cible}</em>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <h4 style={h4}>Exercices</h4>
          <ul style={ul}>
            {production.exercices.exercices.map((ex, i) => (
              <li key={i}>
                <strong>{ex.titre}</strong> <span style={{ color: "#6b7280" }}>({ex.format})</span> — {ex.enonce}
              </li>
            ))}
          </ul>
          <h4 style={h4}>Fiche de révision — {production.fiche.titre}</h4>
          <ul style={ul}>
            {production.fiche.pieges_frequents.map((p, i) => (
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

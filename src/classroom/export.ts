/**
 * Printable exports of a loop's deliverables — pure (client-safe).
 *
 * Two formats: structured Markdown and a standalone printable HTML document.
 * Corrigés are SEPARABLE: with `includeCorriges: false` only the énoncés are
 * emitted; with `true` the corrigés are gathered into a clearly delimited
 * trailing "Corrigés" section so a teacher can print one or both.
 */
import type { Evaluation, FicheRevision, LoopResult, TeacherDiagnosis } from "./schemas";

export interface ExportOptions {
  includeCorriges: boolean;
}

const NIVEAU_LABEL: Record<Evaluation["niveau"], string> = {
  debutant: "Débutant",
  intermediaire: "Intermédiaire",
  avance: "Avancé",
};

/* ------------------------------- Markdown --------------------------------- */

function evaluationMd(ev: Evaluation, withCorr: boolean): string {
  const lines = [`### Niveau ${NIVEAU_LABEL[ev.niveau]}`, ""];
  ev.items.forEach((it, i) => {
    lines.push(`**${i + 1}. (${it.type}) ${it.enonce}** _— ${it.concept_cible}_`);
    if (it.options?.length) it.options.forEach((o) => lines.push(`   - ${o}`));
    if (withCorr) lines.push(`   - _Corrigé :_ ${it.corrige}`);
    lines.push("");
  });
  return lines.join("\n");
}

function diagnosisMd(d: TeacherDiagnosis): string {
  const lines = ["## Diagnostic (synthèse)", ""];
  lines.push("**Concepts mal compris :**");
  d.concepts_mal_compris.forEach((c) =>
    lines.push(`- ${c.concept} — gravité ${c.gravite}, ${c.frequence} élève(s) [${c.niveaux_concernes.join(", ")}]`),
  );
  lines.push("", "**Prérequis manquants :**");
  d.prerequis_manquants.forEach((p) => lines.push(`- ${p.prerequis} — ${p.preuve}`));
  lines.push("", "**Ce qui fonctionne :**");
  d.ce_qui_fonctionne.forEach((s) => lines.push(`- ${s}`));
  lines.push("", "**Priorités de réécriture :**");
  d.priorites_de_reecriture.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
  return lines.join("\n");
}

function ficheMd(f: FicheRevision): string {
  const lines = [`## ${f.titre}`, "", "### Prérequis", ...f.prerequis.map((p) => `- ${p}`), ""];
  lines.push("### Points clés", ...f.points_cles.map((p) => `- ${p}`), "");
  lines.push("### Définitions", ...f.definitions.map((d) => `- **${d.terme}** : ${d.def}`), "");
  lines.push("### Pièges fréquents", ...f.pieges_frequents.map((p) => `- ${p}`));
  return lines.join("\n");
}

export function buildMarkdown(result: LoopResult, opts: ExportOptions): string {
  const { lessonVersion, diagnosis, production } = result;
  const out: string[] = [];
  out.push(`# ${lessonVersion.title} — Dossier pédagogique`, "");
  out.push("> Supports générés par ClassroomSim, pilotés par le diagnostic des classes simulées.", "");

  out.push("## Leçon (version réécrite)", "", lessonVersion.markdown, "");
  out.push(diagnosisMd(diagnosis), "");

  out.push("## Évaluations", "");
  (["debutant", "intermediaire", "avance"] as const).forEach((lvl) => {
    out.push(evaluationMd(production.evaluations[lvl], opts.includeCorriges));
  });

  out.push("## Exercices", "");
  production.exercices.exercices.forEach((ex, i) => {
    out.push(`### ${i + 1}. ${ex.titre} _(${ex.format}, ${ex.niveau_indicatif})_`);
    out.push(ex.enonce, "");
    if (opts.includeCorriges) out.push(`_Corrigé :_ ${ex.corrige}`, "");
  });

  out.push(ficheMd(production.fiche), "");

  if (opts.includeCorriges) {
    out.push("---", "", "## Corrigés (récapitulatif)", "");
    (["debutant", "intermediaire", "avance"] as const).forEach((lvl) => {
      out.push(`### Évaluation — ${NIVEAU_LABEL[lvl]}`);
      production.evaluations[lvl].items.forEach((it, i) => out.push(`${i + 1}. ${it.corrige}`));
      out.push("");
    });
    out.push("### Exercices");
    production.exercices.exercices.forEach((ex, i) => out.push(`${i + 1}. ${ex.titre} : ${ex.corrige}`));
  }

  return out.join("\n");
}

/* --------------------------------- HTML ----------------------------------- */

function esc(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] ?? c);
}

function mdParasToHtml(md: string): string {
  return md
    .split(/\n{2,}/)
    .map((block) => {
      const t = block.trim();
      if (!t) return "";
      const h = t.match(/^(#{1,4})\s+(.+)$/);
      if (h) return `<h${h[1].length}>${esc(h[2])}</h${h[1].length}>`;
      return `<p>${esc(t).replace(/\n/g, "<br/>")}</p>`;
    })
    .join("\n");
}

export function buildPrintableHtml(result: LoopResult, opts: ExportOptions): string {
  const body = mdParasToHtml(buildMarkdown(result, opts));
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(result.lessonVersion.title)} — Dossier pédagogique</title>
<style>
  :root { color-scheme: light; }
  body { font: 15px/1.6 -apple-system, Segoe UI, Roboto, sans-serif; max-width: 820px; margin: 2rem auto; padding: 0 1.25rem; color: #1a1a1a; }
  h1 { border-bottom: 3px solid #6d28d9; padding-bottom: .3rem; }
  h2 { margin-top: 2.2rem; color: #5b21b6; border-bottom: 1px solid #ddd; padding-bottom: .2rem; }
  h3 { margin-top: 1.4rem; color: #6d28d9; }
  blockquote { color: #555; border-left: 3px solid #c4b5fd; margin: 0; padding: .2rem 1rem; background: #faf5ff; }
  p { margin: .5rem 0; }
  @media print { body { margin: 0; max-width: none; } h2 { page-break-after: avoid; } }
</style>
</head>
<body>
${body}
</body>
</html>`;
}

/** Suggested download filename stem (no extension). */
export function exportFilename(result: LoopResult): string {
  return (
    result.lessonVersion.title
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 60) || "dossier-pedagogique"
  );
}

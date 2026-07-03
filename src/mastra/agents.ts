/**
 * ClassroomSim — Mastra agents.
 *
 * 18 student-agents (one per roster entry) + 6 teacher-agents (diagnostician,
 * rewriter, fact-checker, and the three pedagogical producers). Each is a real
 * Mastra Agent with a persona system prompt, a resolved model (router string or
 * mock), and persistent memory. Built once at module load.
 *
 * Server-only.
 */
import { Agent } from "@mastra/core/agent";
import type { MastraModelConfig } from "@mastra/core/llm";

import type { Lane } from "@/classroom/events";
import { CLASS_META, ROSTER, type StudentSpec } from "@/classroom/roster";
import {
  NIVEAU_PROFILES,
  PRINCIPE_DIRECTEUR,
  STYLE_PROFILES,
  isSubtleProfile,
} from "@/classroom/profiles";
import type { Niveau, Provider, Style } from "@/classroom/schemas";

import {
  getRuntimeConfig,
  resolveStudentProvider,
  type RuntimeConfig,
} from "./config";
import type { RealProvider } from "@/classroom/roster";
import { resolveModel } from "./model-router";
import { makeMemory } from "./storage";

export const runtimeConfig: RuntimeConfig = getRuntimeConfig();

/* --------------------------------- prompts -------------------------------- */

function studentInstructions(spec: StudentSpec): string {
  const n = NIVEAU_PROFILES[spec.niveau];
  const s = STYLE_PROFILES[spec.style];
  return [
    `Tu es un élève simulé de la classe « ${CLASS_META[spec.classId].nom} ».`,
    PRINCIPE_DIRECTEUR,
    `NIVEAU DE MAÎTRISE — ${n.niveau} (${n.label}) : ${n.prompt}\nRôle de capteur : ${n.signal}`,
    `STYLE COGNITIF — ${s.label} : ${s.prompt}`,
    `On te remet une leçon. Restitue SINCÈREMENT ce que TU crois avoir compris, strictement dans ton profil, en mobilisant ton répertoire d'erreurs de façon DIAGNOSTIQUABLE. Renseigne aussi tes points sûrs, tes doutes, 0 à 2 questions au prof, et le champ méta erreurs_revelees (concept raté, cause probable, mécanisme déclencheur). Réponds en français.`,
  ].join("\n\n");
}

const TEACHER_INSTRUCTIONS: Record<string, string> = {
  diagnostician: [
    "Tu es un PROFESSEUR DIAGNOSTICIEN. Tu reçois TOUTES les restitutions des 3 classes (stress-test, réaliste, audit).",
    "Agrège le signal en un diagnostic structuré et ACTIONNABLE. Croise les profils : les prérequis manquants se lisent surtout chez les N2 et les S-CONTEXTE-MANQUANT ; les passages ambigus chez les N6 et S-ANXIEUX ; ce_qui_fonctionne est validé par les N5 (à NE PAS dégrader) ; les défauts structurels viennent des N6.",
    "Pour concepts_mal_compris, indique la fréquence réelle (nombre d'élèves concernés) et la gravité. Termine par priorites_de_reecriture : une liste ORDONNÉE, du plus au moins critique. Réponds en français.",
  ].join("\n\n"),
  rewriter: [
    "Tu es un PROFESSEUR RÉDACTEUR. Tu reçois LA LEÇON ORIGINALE et LE DIAGNOSTIC.",
    "Produis une nouvelle VERSION enrichie en markdown : explicite les prérequis manquants EN TÊTE, définis le jargon, reformule les passages ambigus, corrige les défauts structurels. Traite les priorites_de_reecriture DANS L'ORDRE.",
    "Interdiction de dégrader ce_qui_fonctionne : conserve ces passages. Renseigne resume_des_changements (dans l'ordre traité) et prerequis_explicites. Réponds en français.",
  ].join("\n\n"),
  factChecker: [
    "Tu es un FACT-CHECKER rigoureux. On te donne un livrable (leçon réécrite, évaluations, exercices ou fiche).",
    "Repère toute affirmation douteuse ou fausse, AVANT validation. Une réponse fausse dans un CORRIGÉ est BLOQUANTE. Pour chaque affirmation vérifiée : verdict (correct/douteux/incorrect), explication, et correction suggérée si nécessaire, avec l'emplacement.",
    "Mets bloquant=true s'il subsiste au moins une affirmation incorrecte. Sois précis et factuel. Réponds en français.",
  ].join("\n\n"),
  evalMaker: [
    "Tu es un concepteur d'ÉVALUATIONS. Tu reçois la leçon finale validée ET le diagnostic.",
    "Produis trois jeux : débutant (restitution/reconnaissance, ciblant surtout les concepts LES PLUS RATÉS), intermédiaire (application à des cas proches), avancé (transfert, cas limites, justification).",
    "Les questions visent EN PRIORITÉ les concepts_mal_compris du diagnostic. Formats mixtes (QCM avec options, ouverte, vrai/faux justifié). Chaque item a un corrigé et un concept_cible. Réponds en français.",
  ].join("\n\n"),
  exerciseMaker: [
    "Tu es un concepteur d'EXERCICES ENGAGEANTS (pas de questions sèches). Tu reçois la leçon finale et le diagnostic.",
    "Varie les formats : mise en situation / cas concret, mini-défi, repérage d'erreur (donne une réponse FAUSSE à corriger — idéal pour les contresens N2), application progressive.",
    "Ancre chaque exercice sur un point faible diagnostiqué (concept_cible). Chaque exercice a un corrigé/commentaire. Réponds en français.",
  ].join("\n\n"),
  ficheMaker: [
    "Tu es un concepteur de FICHES DE RÉVISION. Tu reçois la leçon finale et le diagnostic.",
    "Produis une fiche condensée et mémorisable : les PRÉRÉQUIS désormais explicités EN TÊTE, puis points clés, définitions, et pièges fréquents tirés des erreurs observées et des concepts les plus ratés. Réponds en français.",
  ].join("\n\n"),
};

/* ------------------------------- runtime meta ----------------------------- */

export interface AgentRuntimeMeta {
  key: string;
  kind: "student" | "teacher";
  role: string;
  lane: Lane;
  label: string;
  provider: Provider;
  missingKey: boolean;
  subtle: boolean;
  niveau?: Niveau;
  style?: Style;
}

function resolveTeacherProvider(cfg: RuntimeConfig): { provider: Provider; missingKey: boolean } {
  if (cfg.mode === "mock") return { provider: "mock", missingKey: false };
  if (cfg.mode === "single") {
    const p = cfg.singleProvider!;
    return cfg.availableProviders.includes(p)
      ? { provider: p, missingKey: false }
      : { provider: "mock", missingKey: true };
  }
  const order: RealProvider[] = ["anthropic", "openai", "google", "deepseek"];
  const p = order.find((x) => cfg.availableProviders.includes(x));
  return p ? { provider: p, missingKey: false } : { provider: "mock", missingKey: true };
}

const TEACHERS: Array<{ key: string; role: string; label: string }> = [
  { key: "diagnostician", role: "Prof diagnosticien", label: "Diagnostic" },
  { key: "rewriter", role: "Prof rédacteur", label: "Rédaction" },
  { key: "factChecker", role: "Fact-checker", label: "Fact-check" },
  { key: "evalMaker", role: "Concepteur d'évaluations", label: "Évaluations" },
  { key: "exerciseMaker", role: "Concepteur d'exercices", label: "Exercices" },
  { key: "ficheMaker", role: "Concepteur de fiches", label: "Fiches" },
];

const asModel = (m: string | object): MastraModelConfig => m as unknown as MastraModelConfig;

/* --------------------------------- build ---------------------------------- */

const agents: Record<string, Agent> = {};
export const agentMeta: Record<string, AgentRuntimeMeta> = {};

for (const spec of ROSTER) {
  const subtle = isSubtleProfile(spec.niveau, spec.style);
  const { provider, missingKey } = resolveStudentProvider(runtimeConfig, spec.preferredProvider);
  agents[spec.studentId] = new Agent({
    id: spec.studentId,
    name: `Élève ${spec.studentId}`,
    instructions: studentInstructions(spec),
    model: asModel(resolveModel(provider, subtle)),
    memory: makeMemory(),
  });
  agentMeta[spec.studentId] = {
    key: spec.studentId,
    kind: "student",
    role: `${spec.niveau} · ${STYLE_PROFILES[spec.style].label}`,
    lane: spec.classId,
    label: spec.studentId,
    provider,
    missingKey,
    subtle,
    niveau: spec.niveau,
    style: spec.style,
  };
}

for (const t of TEACHERS) {
  const { provider, missingKey } = resolveTeacherProvider(runtimeConfig);
  agents[t.key] = new Agent({
    id: t.key,
    name: t.role,
    instructions: TEACHER_INSTRUCTIONS[t.key],
    model: asModel(resolveModel(provider, true)),
    memory: makeMemory(),
  });
  agentMeta[t.key] = {
    key: t.key,
    kind: "teacher",
    role: t.role,
    lane: "staff",
    label: t.label,
    provider,
    missingKey,
    subtle: true,
  };
}

export const mastraAgents = agents;

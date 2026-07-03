/**
 * ClassroomSim — data contract (single source of truth).
 *
 * These Zod schemas ARE the contract passed between Mastra agents through the
 * typed workflow steps. They contain ZERO runtime dependency on @mastra/* so
 * they are safe to import from both the server (agents/workflow) and the client
 * (React components rendering the result panels).
 *
 * Zod v4.
 */
import { z } from "zod";

/* -------------------------------------------------------------------------- */
/*  Axes : niveau de maîtrise (axe 1) × style cognitif (axe 2) × fournisseur   */
/* -------------------------------------------------------------------------- */

export const NIVEAUX = ["N0", "N1", "N2", "N3", "N4", "N5", "N6"] as const;
export const NiveauSchema = z.enum(NIVEAUX);
export type Niveau = z.infer<typeof NiveauSchema>;

/** Style codes are ASCII-safe (accents live in the human-facing catalog). */
export const STYLES = [
  "S-LITTERAL",
  "S-ANALOGIQUE",
  "S-SEQUENTIEL",
  "S-IMPATIENT",
  "S-ANXIEUX",
  "S-CONTEXTE-MANQUANT",
] as const;
export const StyleSchema = z.enum(STYLES);
export type Style = z.infer<typeof StyleSchema>;

export const PROVIDERS = ["anthropic", "openai", "google", "deepseek", "mock"] as const;
export const ProviderSchema = z.enum(PROVIDERS);
export type Provider = z.infer<typeof ProviderSchema>;

export const CLASS_IDS = ["A", "B", "C"] as const;
export const ClassIdSchema = z.enum(CLASS_IDS);
export type ClassId = z.infer<typeof ClassIdSchema>;

/* -------------------------------------------------------------------------- */
/*  Lesson / LessonVersion                                                     */
/* -------------------------------------------------------------------------- */

export const LessonSchema = z.object({
  id: z.string(),
  title: z.string(),
  markdown: z.string(),
});
export type Lesson = z.infer<typeof LessonSchema>;

export const LessonVersionSchema = z.object({
  title: z.string().describe("Titre de la leçon réécrite."),
  markdown: z.string().describe("La nouvelle version enrichie, en markdown complet."),
  resume_des_changements: z
    .array(z.string())
    .describe("Liste des modifications apportées, dans l'ordre des priorités traitées."),
  prerequis_explicites: z
    .array(z.string())
    .describe("Prérequis désormais rendus explicites en tête de leçon."),
});
export type LessonVersion = z.infer<typeof LessonVersionSchema>;

/* -------------------------------------------------------------------------- */
/*  StudentRestitution — sortie de chaque élève-agent                          */
/* -------------------------------------------------------------------------- */

export const ErreurReveleeSchema = z.object({
  concept_rate: z.string().describe("Le concept précis de la leçon qui n'est pas passé."),
  cause_probable: z
    .string()
    .describe("Cause diagnostiquée : prérequis manquant, analogie trompeuse, ordre, jargon…"),
  declenche_par: z
    .string()
    .describe("Quel mécanisme du profil (niveau × style) a déclenché l'erreur."),
});
export type ErreurRevelee = z.infer<typeof ErreurReveleeSchema>;

export const StudentRestitutionSchema = z.object({
  studentId: z.string(),
  classId: ClassIdSchema,
  niveau: NiveauSchema,
  style: StyleSchema,
  provider: ProviderSchema,
  ce_que_jai_compris: z
    .string()
    .describe("Reformulation sincère de la leçon, selon le profil cognitif de l'élève."),
  points_surs: z.array(z.string()).describe("Certitudes de l'élève (peuvent être fausses)."),
  points_de_doute: z.array(z.string()),
  questions_au_prof: z
    .array(z.string())
    .max(2)
    .describe("0 à 2 questions, cohérentes avec le profil."),
  erreurs_revelees: z
    .array(ErreurReveleeSchema)
    .describe("CHAMP MÉTA — alimente directement le diagnostic."),
});
export type StudentRestitution = z.infer<typeof StudentRestitutionSchema>;

/* -------------------------------------------------------------------------- */
/*  TeacherDiagnosis — sortie du prof-diagnosticien                            */
/* -------------------------------------------------------------------------- */

export const ConceptMalComprisSchema = z.object({
  concept: z.string(),
  niveaux_concernes: z.array(NiveauSchema),
  frequence: z.number().int().min(0).describe("Nombre d'élèves ayant raté ce concept."),
  gravite: z.enum(["faible", "moyenne", "elevee"]),
});

export const PrerequisManquantSchema = z.object({
  prerequis: z.string(),
  preuve: z.string().describe("Citation/observation tirée surtout de N2 & S-CONTEXTE-MANQUANT."),
});

export const PassageAmbiguSchema = z.object({
  extrait: z.string().describe("Extrait du texte original posant problème."),
  probleme: z.string().describe("Tiré surtout de N6 & S-ANXIEUX."),
});

export const TeacherDiagnosisSchema = z.object({
  concepts_mal_compris: z.array(ConceptMalComprisSchema),
  prerequis_manquants: z.array(PrerequisManquantSchema),
  passages_ambigus: z.array(PassageAmbiguSchema),
  ce_qui_fonctionne: z
    .array(z.string())
    .describe("Validé par N5 — le rédacteur NE DOIT PAS y toucher."),
  defauts_structurels: z.array(z.string()).describe("Tirés de N6."),
  priorites_de_reecriture: z
    .array(z.string())
    .describe("Liste ordonnée et actionnable, traitée dans l'ordre par le rédacteur."),
});
export type TeacherDiagnosis = z.infer<typeof TeacherDiagnosisSchema>;

/* -------------------------------------------------------------------------- */
/*  FactCheckReport                                                            */
/* -------------------------------------------------------------------------- */

export const FactCheckClaimSchema = z.object({
  affirmation: z.string().describe("L'affirmation vérifiée, citée."),
  verdict: z.enum(["correct", "douteux", "incorrect"]),
  explication: z.string(),
  correction_suggeree: z.string().optional(),
  source_emplacement: z
    .string()
    .describe("Où dans le livrable (leçon / item d'éval / corrigé d'exercice)."),
});
export type FactCheckClaim = z.infer<typeof FactCheckClaimSchema>;

export const FactCheckReportSchema = z.object({
  cible: z
    .enum(["lesson", "evaluations", "exercices", "fiche"])
    .describe("Quel livrable a été vérifié."),
  claims: z.array(FactCheckClaimSchema),
  bloquant: z
    .boolean()
    .describe("true si au moins une affirmation 'incorrect' subsiste (corrigé faux = bloquant)."),
  synthese: z.string(),
});
export type FactCheckReport = z.infer<typeof FactCheckReportSchema>;

/* -------------------------------------------------------------------------- */
/*  Production pédagogique : Evaluation / Exercice / FicheRevision             */
/* -------------------------------------------------------------------------- */

export const EvaluationItemSchema = z.object({
  type: z.enum(["qcm", "ouverte", "vrai_faux"]),
  enonce: z.string(),
  options: z.array(z.string()).optional().describe("Présent pour les QCM."),
  corrige: z.string(),
  concept_cible: z.string().describe("Le concept (issu du diagnostic) que l'item travaille."),
});

export const EvaluationSchema = z.object({
  niveau: z.enum(["debutant", "intermediaire", "avance"]),
  items: z.array(EvaluationItemSchema),
});
export type Evaluation = z.infer<typeof EvaluationSchema>;

export const EvaluationSetSchema = z.object({
  debutant: EvaluationSchema,
  intermediaire: EvaluationSchema,
  avance: EvaluationSchema,
});
export type EvaluationSet = z.infer<typeof EvaluationSetSchema>;

export const ExerciceSchema = z.object({
  titre: z.string(),
  format: z
    .enum(["mise_en_situation", "mini_defi", "reperage_erreur", "application_progressive"])
    .describe("reperage_erreur cible idéalement les contresens N2."),
  enonce: z.string(),
  corrige: z.string().describe("Corrigé / commentaire pédagogique."),
  concept_cible: z.string(),
  niveau_indicatif: z.enum(["debutant", "intermediaire", "avance"]),
});
export type Exercice = z.infer<typeof ExerciceSchema>;

export const ExerciceSetSchema = z.object({
  exercices: z.array(ExerciceSchema),
});
export type ExerciceSet = z.infer<typeof ExerciceSetSchema>;

export const FicheRevisionSchema = z.object({
  titre: z.string(),
  prerequis: z.array(z.string()).describe("Mis en tête — désormais explicités."),
  points_cles: z.array(z.string()),
  definitions: z.array(z.object({ terme: z.string(), def: z.string() })),
  pieges_frequents: z
    .array(z.string())
    .describe("Tirés des erreurs_revelees et des concepts les plus ratés."),
});
export type FicheRevision = z.infer<typeof FicheRevisionSchema>;

/* -------------------------------------------------------------------------- */
/*  Agrégat final d'une boucle                                                 */
/* -------------------------------------------------------------------------- */

export const PedagogicalProductionSchema = z.object({
  evaluations: EvaluationSetSchema,
  exercices: ExerciceSetSchema,
  fiche: FicheRevisionSchema,
});
export type PedagogicalProduction = z.infer<typeof PedagogicalProductionSchema>;

export const LoopResultSchema = z.object({
  lessonOriginal: LessonSchema,
  restitutions: z.array(StudentRestitutionSchema),
  diagnosis: TeacherDiagnosisSchema,
  lessonVersion: LessonVersionSchema,
  factCheckLesson: FactCheckReportSchema,
  production: PedagogicalProductionSchema,
  factCheckProduction: z.array(FactCheckReportSchema),
});
export type LoopResult = z.infer<typeof LoopResultSchema>;

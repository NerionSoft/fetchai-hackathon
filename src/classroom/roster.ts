/**
 * ClassroomSim — composition des 3 classes (18 élèves).
 *
 * Chaque élève = niveau (axe 1) × style (axe 2) × fournisseur préféré.
 * Le fournisseur préféré n'est qu'un INDICE : le model-router résout le modèle
 * réel selon les clés disponibles (ou bascule sur le mock). Les profils subtils
 * (N5, N6, S-ANXIEUX) reçoivent les meilleurs modèles ; les profils grossiers
 * (N0, N1, S-LITTERAL) tolèrent des modèles plus faibles.
 */
import type { ClassId, Niveau, Provider, Style } from "./schemas";

export type RealProvider = Exclude<Provider, "mock">;

export interface StudentSpec {
  studentId: string;
  classId: ClassId;
  niveau: Niveau;
  style: Style;
  preferredProvider: RealProvider;
}

export interface ClassMeta {
  classId: ClassId;
  nom: string;
  role: string;
}

export const CLASS_META: Record<ClassId, ClassMeta> = {
  A: {
    classId: "A",
    nom: "Stress-test",
    role: "Bas/milieu du spectre (N0–N3) : détecte ce que la leçon échoue à transmettre.",
  },
  B: {
    classId: "B",
    nom: "Classe réaliste",
    role: "Distribution équilibrée (dominante N2–N4) : simule une vraie salle hétérogène.",
  },
  C: {
    classId: "C",
    nom: "Audit qualité",
    role: "Haut du spectre (N4–N6) : N5 valide ce qui marche, N6 critique les défauts.",
  },
};

export const ROSTER: StudentSpec[] = [
  // ── Classe A — STRESS-TEST (N0–N3, styles variés) ──
  { studentId: "A1", classId: "A", niveau: "N0", style: "S-LITTERAL", preferredProvider: "deepseek" },
  { studentId: "A2", classId: "A", niveau: "N1", style: "S-SEQUENTIEL", preferredProvider: "deepseek" },
  { studentId: "A3", classId: "A", niveau: "N2", style: "S-CONTEXTE-MANQUANT", preferredProvider: "google" },
  { studentId: "A4", classId: "A", niveau: "N2", style: "S-IMPATIENT", preferredProvider: "openai" },
  { studentId: "A5", classId: "A", niveau: "N3", style: "S-ANALOGIQUE", preferredProvider: "google" },
  { studentId: "A6", classId: "A", niveau: "N3", style: "S-ANXIEUX", preferredProvider: "anthropic" },

  // ── Classe B — RÉALISTE (un peu de tout, dominante N2–N4) ──
  { studentId: "B1", classId: "B", niveau: "N1", style: "S-ANALOGIQUE", preferredProvider: "deepseek" },
  { studentId: "B2", classId: "B", niveau: "N2", style: "S-SEQUENTIEL", preferredProvider: "google" },
  { studentId: "B3", classId: "B", niveau: "N3", style: "S-LITTERAL", preferredProvider: "openai" },
  { studentId: "B4", classId: "B", niveau: "N3", style: "S-CONTEXTE-MANQUANT", preferredProvider: "google" },
  { studentId: "B5", classId: "B", niveau: "N4", style: "S-IMPATIENT", preferredProvider: "openai" },
  { studentId: "B6", classId: "B", niveau: "N5", style: "S-ANXIEUX", preferredProvider: "anthropic" },

  // ── Classe C — AUDIT QUALITÉ (N4–N6 ; N5 valide, N6 critique) ──
  { studentId: "C1", classId: "C", niveau: "N4", style: "S-ANALOGIQUE", preferredProvider: "google" },
  { studentId: "C2", classId: "C", niveau: "N5", style: "S-SEQUENTIEL", preferredProvider: "openai" },
  { studentId: "C3", classId: "C", niveau: "N5", style: "S-CONTEXTE-MANQUANT", preferredProvider: "anthropic" },
  { studentId: "C4", classId: "C", niveau: "N6", style: "S-LITTERAL", preferredProvider: "anthropic" },
  { studentId: "C5", classId: "C", niveau: "N6", style: "S-ANXIEUX", preferredProvider: "anthropic" },
  { studentId: "C6", classId: "C", niveau: "N6", style: "S-IMPATIENT", preferredProvider: "openai" },
];

export function studentsOfClass(classId: ClassId): StudentSpec[] {
  return ROSTER.filter((s) => s.classId === classId);
}

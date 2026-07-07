/**
 * Composition of the 3 classes (18 students).
 *
 * Each student = level (axis 1) × style (axis 2) × preferred provider.
 * The preferred provider is only a HINT: the model-router adapter resolves the
 * actual model based on the available keys (or falls back to the mock).
 * Subtle profiles (N5, N6, S-ANXIOUS) get the best models; coarse profiles
 * (N0, N1, S-LITERAL) tolerate weaker models.
 */
import type { ClassId, Level, Provider, Style } from "../value-objects/axes";

export type RealProvider = Exclude<Provider, "mock">;

export interface StudentSpec {
  studentId: string;
  classId: ClassId;
  level: Level;
  style: Style;
  preferredProvider: RealProvider;
}

export interface ClassMeta {
  classId: ClassId;
  name: string;
  role: string;
}

export const CLASS_META: Record<ClassId, ClassMeta> = {
  A: {
    classId: "A",
    name: "Stress test",
    role: "Low/mid spectrum (N0–N3): detects what the lesson fails to convey.",
  },
  B: {
    classId: "B",
    name: "Realistic class",
    role: "Balanced distribution (mostly N2–N4): simulates a real, heterogeneous classroom.",
  },
  C: {
    classId: "C",
    name: "Quality audit",
    role: "High end of the spectrum (N4–N6): N5 validates what works, N6 critiques the flaws.",
  },
};

export const ROSTER: StudentSpec[] = [
  // ── Class A — STRESS TEST (N0–N3, varied styles) ──
  { studentId: "A1", classId: "A", level: "N0", style: "S-LITERAL", preferredProvider: "deepseek" },
  { studentId: "A2", classId: "A", level: "N1", style: "S-SEQUENTIAL", preferredProvider: "deepseek" },
  { studentId: "A3", classId: "A", level: "N2", style: "S-MISSING-CONTEXT", preferredProvider: "google" },
  { studentId: "A4", classId: "A", level: "N2", style: "S-IMPATIENT", preferredProvider: "openai" },
  { studentId: "A5", classId: "A", level: "N3", style: "S-ANALOGICAL", preferredProvider: "google" },
  { studentId: "A6", classId: "A", level: "N3", style: "S-ANXIOUS", preferredProvider: "anthropic" },

  // ── Class B — REALISTIC (a bit of everything, mostly N2–N4) ──
  { studentId: "B1", classId: "B", level: "N1", style: "S-ANALOGICAL", preferredProvider: "deepseek" },
  { studentId: "B2", classId: "B", level: "N2", style: "S-SEQUENTIAL", preferredProvider: "google" },
  { studentId: "B3", classId: "B", level: "N3", style: "S-LITERAL", preferredProvider: "openai" },
  { studentId: "B4", classId: "B", level: "N3", style: "S-MISSING-CONTEXT", preferredProvider: "google" },
  { studentId: "B5", classId: "B", level: "N4", style: "S-IMPATIENT", preferredProvider: "openai" },
  { studentId: "B6", classId: "B", level: "N5", style: "S-ANXIOUS", preferredProvider: "anthropic" },

  // ── Class C — QUALITY AUDIT (N4–N6; N5 validates, N6 critiques) ──
  { studentId: "C1", classId: "C", level: "N4", style: "S-ANALOGICAL", preferredProvider: "google" },
  { studentId: "C2", classId: "C", level: "N5", style: "S-SEQUENTIAL", preferredProvider: "openai" },
  { studentId: "C3", classId: "C", level: "N5", style: "S-MISSING-CONTEXT", preferredProvider: "anthropic" },
  { studentId: "C4", classId: "C", level: "N6", style: "S-LITERAL", preferredProvider: "anthropic" },
  { studentId: "C5", classId: "C", level: "N6", style: "S-ANXIOUS", preferredProvider: "anthropic" },
  { studentId: "C6", classId: "C", level: "N6", style: "S-IMPATIENT", preferredProvider: "openai" },
];

export function studentsOfClass(classId: ClassId): StudentSpec[] {
  return ROSTER.filter((s) => s.classId === classId);
}

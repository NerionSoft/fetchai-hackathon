/**
 * Classroom domain — the modeling axes (value objects).
 *
 * A student-agent is a point in: mastery level (axis 1) × cognitive style
 * (axis 2) × LLM provider. These enums are the vocabulary the whole hexagone
 * (domain, application, adapters) speaks. Zero runtime dependency on any
 * framework — safe to import from server and client alike. Zod v4.
 */
import { z } from "zod";

export const LEVELS = ["N0", "N1", "N2", "N3", "N4", "N5", "N6"] as const;
export const LevelSchema = z.enum(LEVELS);
export type Level = z.infer<typeof LevelSchema>;

/** Style codes are ASCII-safe (labels live in the human-facing catalog). */
export const STYLES = [
  "S-LITERAL",
  "S-ANALOGICAL",
  "S-SEQUENTIAL",
  "S-IMPATIENT",
  "S-ANXIOUS",
  "S-MISSING-CONTEXT",
] as const;
export const StyleSchema = z.enum(STYLES);
export type Style = z.infer<typeof StyleSchema>;

export const PROVIDERS = ["anthropic", "openai", "google", "deepseek", "mock"] as const;
export const ProviderSchema = z.enum(PROVIDERS);
export type Provider = z.infer<typeof ProviderSchema>;

export const CLASS_IDS = ["A", "B", "C"] as const;
export const ClassIdSchema = z.enum(CLASS_IDS);
export type ClassId = z.infer<typeof ClassIdSchema>;

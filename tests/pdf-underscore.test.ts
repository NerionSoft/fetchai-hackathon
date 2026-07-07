import { extractText, getDocumentProxy } from "unpdf";
import { expect, test } from "vitest";

import { markdownToPdf } from "@/classroom/adapters/pdf/markdown-to-pdf";

// Mirrors exactly what markdown-dossier's builders emit (emphasis + answer keys).
const md = [
  "# Photosynthesis — Evaluations",
  "",
  "## Evaluations",
  "",
  "### Level Beginner",
  "",
  "**1. (mcq) What gas is released?** _— gas exchange_",
  "   - Oxygen",
  "   - _Answer key:_ Oxygen",
  "",
  "## Exercises",
  "",
  "### 1. Leaf diagram _(open, intermediate)_",
  "Label the parts of a leaf.",
  "",
  "_Answer key:_ See diagram in the sheet.",
  "",
  "The term _chlorophyll_ absorbs light. Field target_concept stays intact.",
].join("\n");

test("no literal emphasis underscores survive into the rendered PDF", async () => {
  const bytes = markdownToPdf(md);
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: true });
  // Snake_case field names must survive; emphasis underscores must be gone.
  expect(text).toContain("target_concept");
  const stray = [...text.matchAll(/\S*_\S*/g)].map((m) => m[0]).filter((w) => w !== "target_concept");
  expect(stray).toEqual([]);
  expect(text).toContain("Answer key: Oxygen");
  expect(text).toContain("(open, intermediate)");
});

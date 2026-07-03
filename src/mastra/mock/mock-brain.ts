/**
 * mock-brain.ts — the deterministic "fake LLM brain" for ClassroomSim's
 * zero-API-key demo mode.
 *
 * PURE TypeScript. No `@mastra/*` imports, no I/O, no randomness, no Date.now().
 * Same input → same output. Every branch returns an object that satisfies the
 * corresponding Zod schema in "@/classroom/schemas".
 *
 * The brain is LESSON-AWARE *generically*: it extracts structure from the
 * dropped lesson markdown (title, headings, bold terms, first sentences) and
 * references those extracted strings in the generated content. It therefore
 * works for ANY lesson, while the seeded demo lesson (interets-composes.md)
 * naturally surfaces its 3 deliberate flaws:
 *   (1) the jargon "compounding" is used but never actually defined,
 *   (2) the implicit prerequisite hidden behind "you just multiply by the
 *       rate" — the %→coefficient (1+rate) conversion is never explained,
 *   (3) the vague "A point of caution" passage about compounding frequency.
 *
 * Content is in ENGLISH, sincere and diagnosable (no "I didn't get any of
 * it", no textspeak, no gibberish) — it respects the GUIDING_PRINCIPLE.
 */

import type { MockBrief } from "./brief";
import type {
  Evaluation,
  EvaluationSet,
  Exercise,
  ExerciseSet,
  FactCheckClaim,
  FactCheckReport,
  Level,
  LessonVersion,
  RevealedError,
  RevisionSheet,
  StudentRestitution,
  TeacherDiagnosis,
} from "@/classroom/schemas";

/* ========================================================================== */
/*  Stable pseudo-variety helpers (no randomness)                              */
/* ========================================================================== */

/** FNV-1a 32-bit hash of a string — deterministic, dependency-free. */
function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    // h *= 16777619 (FNV prime), kept in 32-bit unsigned range.
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Deterministically pick one element of `arr` from a stable seed string. */
function pick<T>(arr: readonly T[], seed: string): T {
  if (arr.length === 0) throw new Error("pick() on empty array");
  return arr[fnv1a(seed) % arr.length];
}

/* ========================================================================== */
/*  Lesson-extraction helpers (generic, pure)                                  */
/* ========================================================================== */

interface LessonShape {
  title: string;
  /** Section headings declared with `## ` (in order). */
  headings: string[];
  /** Bold terms declared with `**term**` (deduped, in order). */
  boldTerms: string[];
  /** First non-empty sentences of the body (deduped, in order). */
  firstSentences: string[];
  /** The whole markdown (for substring probing). */
  raw: string;
  /** Lowercased markdown (for case-insensitive probing). */
  lower: string;
}

/** First `# ` heading, falling back to a provided title or a generic label. */
function extractTitle(markdown: string, fallback?: string): string {
  const lines = markdown.split("\n");
  for (const line of lines) {
    const m = /^#\s+(.+?)\s*$/.exec(line);
    if (m) return m[1].trim();
  }
  if (fallback && fallback.trim()) return fallback.trim();
  return "Lesson";
}

/** All `## ` section headings, in document order. */
function extractHeadings(markdown: string): string[] {
  const out: string[] = [];
  for (const line of markdown.split("\n")) {
    const m = /^##\s+(.+?)\s*$/.exec(line);
    if (m) out.push(m[1].trim());
  }
  return out;
}

/** All `**term**` bold spans, deduped, in document order. */
function extractBoldTerms(markdown: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const re = /\*\*(.+?)\*\*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(markdown)) !== null) {
    const term = m[1].trim();
    if (term && !seen.has(term.toLowerCase())) {
      seen.add(term.toLowerCase());
      out.push(term);
    }
  }
  return out;
}

/**
 * First sentences of the prose body. We strip heading lines, code/indented
 * blocks, then split paragraphs on sentence boundaries and keep the leading
 * sentence of each paragraph (deduped).
 */
function extractFirstSentences(markdown: string, limit = 6): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const rawLine of markdown.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith("#")) continue; // headings
    if (rawLine.startsWith("    ") || rawLine.startsWith("\t")) continue; // code block
    if (line.startsWith("|") || line.startsWith(">")) continue; // tables / quotes
    // Take the first sentence-ish chunk of this line.
    const sentence = (/^(.+?[.!?])(\s|$)/.exec(line)?.[1] ?? line).trim();
    const key = sentence.toLowerCase();
    if (sentence.length >= 12 && !seen.has(key)) {
      seen.add(key);
      out.push(sentence);
      if (out.length >= limit) break;
    }
  }
  return out;
}

function analyzeLesson(markdown: string, fallbackTitle?: string): LessonShape {
  return {
    title: extractTitle(markdown, fallbackTitle),
    headings: extractHeadings(markdown),
    boldTerms: extractBoldTerms(markdown),
    firstSentences: extractFirstSentences(markdown),
    raw: markdown,
    lower: markdown.toLowerCase(),
  };
}

/** Does the lesson literally contain (case-insensitive) this needle? */
function lessonHas(lesson: LessonShape, needle: string): boolean {
  return lesson.lower.includes(needle.toLowerCase());
}

/** The first concept-ish anchor we can name from the lesson. */
function primaryConcept(lesson: LessonShape): string {
  return lesson.boldTerms[0] ?? lesson.title;
}

/** A safe, generic "core notion" string referencing the lesson. */
function coreNotion(lesson: LessonShape): string {
  return lesson.title;
}

/* ========================================================================== */
/*  Demo-flaw detection (generic, but lights up on interets-composes.md)        */
/* ========================================================================== */

interface FlawSignals {
  /** A jargon term used but (heuristically) not defined nearby. */
  undefinedJargon: string | null;
  /** True when the lesson hides a %→coefficient style implicit prerequisite. */
  impliedPercentPrereq: boolean;
  /** True when a "point of caution"-style vague passage exists. */
  vagueVigilance: boolean;
  /** The vague passage extract, if any. */
  vagueExtract: string | null;
  /** The "you just need to…" oversimplification extract, if any. */
  oversimplifyExtract: string | null;
}

const VIGILANCE_HINTS = [
  "point of caution",
  "careful",
  "worth noting",
  "keep in mind",
  "you should always",
];

const OVERSIMPLIFY_HINTS = [
  "you just",
  "all you need to",
  "simply",
  "nothing more than",
];

/** Heuristic: a bold term is "undefined jargon" if it is not followed shortly
 *  by a definitional marker ("that's", "denotes", "means", "is defined as"). */
function detectUndefinedJargon(lesson: LessonShape): string | null {
  for (const term of lesson.boldTerms) {
    const idx = lesson.lower.indexOf(term.toLowerCase());
    if (idx === -1) continue;
    const window = lesson.lower.slice(idx, idx + 160);
    const defined = /(that's|that is|denotes|refers to|means|is defined as)/.test(window);
    if (!defined) return term;
  }
  // Fallback: the canonical demo jargon.
  if (lessonHas(lesson, "compounding")) return "compounding";
  return lesson.boldTerms[0] ?? null;
}

function firstSentenceContaining(lesson: LessonShape, needles: string[]): string | null {
  for (const s of lesson.firstSentences) {
    const low = s.toLowerCase();
    if (needles.some((n) => low.includes(n))) return s;
  }
  // Probe the full text line by line if not in first sentences.
  for (const rawLine of lesson.raw.split("\n")) {
    const line = rawLine.trim();
    const low = line.toLowerCase();
    if (line && !line.startsWith("#") && needles.some((n) => low.includes(n))) {
      const sentence = (/^(.+?[.!?])(\s|$)/.exec(line)?.[1] ?? line).trim();
      return sentence;
    }
  }
  return null;
}

function detectFlaws(lesson: LessonShape): FlawSignals {
  const vagueExtract = firstSentenceContaining(lesson, VIGILANCE_HINTS);
  const oversimplifyExtract = firstSentenceContaining(lesson, OVERSIMPLIFY_HINTS);
  // %→coefficient implicit prerequisite: a percentage notation appears AND the
  // lesson speaks of "multiply by the rate" without converting % to (1+rate).
  const mentionsPercent = /%|percent|percentage/.test(lesson.lower);
  const mentionsMultiplyByRate =
    /multiply by the rate|multiplied by the rate|apply the rate/.test(lesson.lower);
  const definesCoefficient = /\(1\s*\+|1\s*\+\s*rate|multiplying coefficient/.test(
    lesson.lower,
  );
  const impliedPercentPrereq =
    (mentionsPercent && mentionsMultiplyByRate) ||
    (mentionsPercent && /multiply/.test(lesson.lower) && !definesCoefficient);

  return {
    undefinedJargon: detectUndefinedJargon(lesson),
    impliedPercentPrereq,
    vagueVigilance: vagueExtract !== null,
    vagueExtract,
    oversimplifyExtract,
  };
}

/* ========================================================================== */
/*  STUDENT branch                                                             */
/* ========================================================================== */

function produceStudent(brief: Extract<MockBrief, { role: "student" }>): StudentRestitution {
  const { studentId, classId, level, style, provider, lessonMarkdown, lessonTitle } = brief;
  const lesson = analyzeLesson(lessonMarkdown, lessonTitle);
  const flaws = detectFlaws(lesson);

  const seed = `${studentId}|${level}|${style}|${lesson.title}`;
  const jargon = flaws.undefinedJargon ?? primaryConcept(lesson);
  const concept = coreNotion(lesson);
  const firstIdea = lesson.firstSentences[0] ?? `the topic "${concept}"`;
  const lastHeading = lesson.headings[lesson.headings.length - 1] ?? concept;

  let what_i_understood = "";
  let confident_points: string[] = [];
  let uncertain_points: string[] = [];
  let questions_for_teacher: string[] = [];
  const revealed_errors: RevealedError[] = [];

  /* ---- Axis 1: mastery level --------------------------------------------- */
  switch (level) {
    case "N0": {
      // Parrots the jargon with no real content.
      what_i_understood =
        `The lesson is about "${concept}", and above all about "${jargon}". ` +
        `It's the "${jargon}" that explains everything, through the mechanism of "${jargon}" ` +
        `when you put "${jargon}" into practice. That's the gist of it, as far as I can tell.`;
      confident_points = [`The key word is "${jargon}".`];
      uncertain_points = [
        `I couldn't really tell you what "${jargon}" actually means.`,
      ];
      revealed_errors.push({
        missed_concept: jargon,
        probable_cause: "jargon used but never actually defined",
        triggered_by: "N0: mimics the form/vocabulary of the lesson with no real content behind it",
      });
      break;
    }
    case "N1": {
      // Keeps an isolated fragment (first or last) as the whole point.
      const fragment = pick([firstIdea, lastHeading], seed) ?? firstIdea;
      what_i_understood =
        `What I remember most is "${fragment}". ` +
        `To me, that's the heart of the lesson; everything else revolves around it.`;
      confident_points = [`I can restate "${fragment}" without any trouble.`];
      uncertain_points = [
        `I can't connect this fragment to the rest of the lesson (about "${concept}").`,
      ];
      revealed_errors.push({
        missed_concept: `the big picture of "${concept}"`,
        probable_cause: "no explicit throughline: I'm mistaking a detail for the whole picture",
        triggered_by: "N1: retains isolated fragments with no sense of the overall structure",
      });
      break;
    }
    case "N2": {
      // Structured but FALSE coherent model.
      if (flaws.impliedPercentPrereq) {
        what_i_understood =
          `I've got it: to go from one year to the next, you just multiply ` +
          `the capital by the rate. With €1,000 at 5%, I multiply by 0.05 every year, ` +
          `so I gain €50 a year, always the same amount. Everything follows neatly from that.`;
        confident_points = [
          "You multiply the capital by the rate (0.05) to get next year's amount.",
          "The yearly gain is constant: €50 on €1,000.",
        ];
        uncertain_points = [
          "I don't really see how this would be any different from simple interest, then.",
        ];
        revealed_errors.push({
          missed_concept: "converting the rate into a multiplying coefficient (1 + rate)",
          probable_cause:
            "an implicit prerequisite goes unaddressed: the lesson says to 'multiply by the rate' " +
            "without ever explaining the shift from 5% to the coefficient (1 + 0.05)",
          triggered_by: "N2: a coherent line of reasoning built on a wrong premise — the student is confident about it",
        });
      } else {
        const wrongAnchor = pick(lesson.boldTerms.length ? lesson.boldTerms : [concept], seed);
        what_i_understood =
          `I've built a coherent explanation: everything follows from "${wrongAnchor}", ` +
          `and I logically deduce the rest from there. I'm confident in my reasoning.`;
        confident_points = [`My reasoning starting from "${wrongAnchor}" holds up perfectly.`];
        uncertain_points = ["I don't see where it could break down, and maybe that's exactly the problem."];
        revealed_errors.push({
          missed_concept: `the premise of "${wrongAnchor}"`,
          probable_cause: "an implicit prerequisite the lesson never locks down",
          triggered_by: "N2: a structured but false model, built on a wrong foundation",
        });
      }
      break;
    }
    case "N3": {
      // Knows WHAT/HOW, fails WHEN/WHY.
      what_i_understood =
        `I can apply the procedure for "${concept}": I follow the steps described ` +
        `(${lesson.headings.slice(0, 2).map((h) => `"${h}"`).join(", ") || "the steps"}) ` +
        `and I get a result. What I couldn't tell you is WHEN it doesn't work.`;
      confident_points = ["I can carry out the calculation / procedure from start to finish."];
      uncertain_points = ["I don't know why we do it this way, or in which cases it changes."];
      revealed_errors.push({
        missed_concept: `the WHY behind "${concept}"`,
        probable_cause: "the lesson explains WHAT to do but not WHY",
        triggered_by: "N3: literal, procedural mastery, blind to exceptions",
      });
      break;
    }
    case "N4": {
      // Functional, slight over-generalization, misses fine nuances.
      what_i_understood =
        `I understand the idea of "${concept}" and the reasons behind it, and I can apply it ` +
        `to similar cases. I do tend to apply the rule as-is everywhere, though.`;
      confident_points = [
        `The principle of "${concept}" is clear, and I apply it to standard cases.`,
      ];
      uncertain_points = [
        "I'm not sure about the edge cases, or the exact conditions where the rule changes.",
      ];
      if (flaws.vagueVigilance) {
        uncertain_points.push(
          `The passage "${flaws.vagueExtract}" stays vague to me about what exactly changes.`,
        );
      }
      revealed_errors.push({
        missed_concept: "fine nuances and edge cases",
        probable_cause: "slight over-generalization: the lesson glosses over the nuances",
        triggered_by: "N4: functional understanding, but misses the nuances",
      });
      break;
    }
    case "N5": {
      // Validates what works; near-zero errors.
      what_i_understood =
        `I understand "${concept}" in depth: I can tell the rule apart from the exception, ` +
        `and I can transfer it to a new context. The progression from "${firstIdea}" ` +
        `is clear and well laid out.`;
      confident_points = [
        `The overall logic of "${concept}" is solid and well explained.`,
        lesson.headings[0]
          ? `The section "${lesson.headings[0]}" sets up the principle correctly.`
          : "The principle is set up correctly.",
      ];
      uncertain_points = [];
      // N5 reveals (almost) no errors — leave revealed_errors empty.
      break;
    }
    case "N6": {
      // Critiques the MATERIAL.
      what_i_understood =
        `On substance, I've mastered "${concept}". But the material itself is problematic: ` +
        (flaws.impliedPercentPrereq
          ? `there's a contradiction between "multiply by the rate" and the formula using (1 + rate), ` +
            `and the ambiguity around the rate/frequency is never resolved.`
          : `several passages are ambiguous or contradictory, and the ordering is questionable.`);
      confident_points = ["The subject itself is clear to me; it's the writing that I'd criticize."];
      uncertain_points = [];
      if (flaws.vagueVigilance && flaws.vagueExtract) {
        uncertain_points.push(
          `The passage "${flaws.vagueExtract}" claims there's a pitfall without ever saying which one.`,
        );
        revealed_errors.push({
          missed_concept: flaws.vagueExtract,
          probable_cause: "a vague passage: a risk is flagged but never spelled out (compounding frequency)",
          triggered_by: "N6: meta-critique of the material, spots the unsaid",
        });
      }
      if (flaws.impliedPercentPrereq) {
        revealed_errors.push({
          missed_concept: "contradiction between 'multiply by the rate' and the (1 + rate) formula",
          probable_cause:
            "an internal inconsistency: the procedural text contradicts the final formula, " +
            "the shift from % to coefficient is never spelled out",
          triggered_by: "N6: spots a contradiction and a flawed ordering",
        });
      }
      if (revealed_errors.length === 0) {
        revealed_errors.push({
          missed_concept: `the structure of the material on "${concept}"`,
          probable_cause: "ambiguities and unstated assumptions in the writing",
          triggered_by: "N6: critiques the structure and flaws of the material",
        });
      }
      break;
    }
  }

  /* ---- Axis 2: cognitive style (shapes expression / adds signals) -------- */
  switch (style) {
    case "S-LITERAL": {
      confident_points.push(`I can recite the passage "${firstIdea}" almost word for word.`);
      if (level !== "N5") {
        revealed_errors.push({
          missed_concept: `rephrasing "${concept}"`,
          probable_cause: "unable to transform the text: verbatim copying of the material",
          triggered_by: "S-LITERAL: surface-level recitation with no rephrasing",
        });
      }
      break;
    }
    case "S-ANALOGICAL": {
      what_i_understood += ` To me it's like a recipe you follow step by step: ` +
        `I map that image onto "${concept}".`;
      if (level !== "N5") {
        revealed_errors.push({
          missed_concept: `analogy applied to "${concept}"`,
          probable_cause: "a misleading everyday analogy where the concept doesn't actually fit it",
          triggered_by: "S-ANALOGICAL: conceptual false friend via a forced analogy",
        });
      }
      break;
    }
    case "S-SEQUENTIAL": {
      confident_points.push("I can go through the steps in the order given.");
      uncertain_points.push("But I lose the overall meaning by following it step by step.");
      break;
    }
    case "S-IMPATIENT": {
      what_i_understood += ` I skipped the definitions to get straight to the application.`;
      if (level !== "N5") {
        revealed_errors.push({
          missed_concept: `the conditions of validity for "${concept}"`,
          probable_cause: "skipped prerequisites and definitions: a rule applied outside its valid conditions",
          triggered_by: "S-IMPATIENT: jumps straight to the application",
        });
      }
      break;
    }
    case "S-ANXIOUS": {
      // Over-interprets, adds imaginary conditions, wants reassurance.
      uncertain_points.push(
        `What if there's a hidden condition I missed? I'm worried I'll get it wrong.`,
      );
      if (flaws.vagueVigilance && flaws.vagueExtract && level !== "N5") {
        uncertain_points.push(
          `The passage "${flaws.vagueExtract}" worries me: I imagine all sorts of unstated special cases.`,
        );
      }
      questions_for_teacher.push("Are there any particular conditions I really shouldn't overlook?");
      if (level !== "N5") {
        revealed_errors.push({
          missed_concept: `over-interpretation of "${concept}"`,
          probable_cause: "adds imaginary conditions: overcomplicates a simple point",
          triggered_by: "S-ANXIOUS: over-interpretation and a need for reassurance",
        });
      }
      break;
    }
    case "S-MISSING-CONTEXT": {
      // Bumps on assumed-known notions (e.g. percentages).
      const assumedNotion = /%|percent|percentage/.test(lesson.lower)
        ? "percentages"
        : "concepts assumed to be already known";
      uncertain_points.push(
        `Honestly, I get stuck on ${assumedNotion}: the lesson assumes I know them but never reviews them.`,
      );
      questions_for_teacher.push(`Could you go over ${assumedNotion}? I don't have that background.`);
      revealed_errors.push({
        missed_concept: assumedNotion,
        probable_cause: "assumed prior knowledge but missing: the lesson never restates the prerequisite",
        triggered_by: "S-MISSING-CONTEXT: missing a prerequisite the lesson assumes is already known",
      });
      break;
    }
  }

  // Clamp questions to the schema max (≤ 2), deterministically keeping the
  // first ones produced.
  questions_for_teacher = questions_for_teacher.slice(0, 2);

  // Ensure non-empty arrays where it reads better, but schema only requires
  // presence (length 0 is valid for every array here).
  return {
    studentId,
    classId,
    level,
    style,
    provider,
    what_i_understood,
    confident_points,
    uncertain_points,
    questions_for_teacher,
    revealed_errors,
  };
}

/* ========================================================================== */
/*  DIAGNOSIS branch — aggregates over restitutions                            */
/* ========================================================================== */

type Severity = "low" | "medium" | "high";

function severityFromFrequency(freq: number): Severity {
  if (freq >= 3) return "high";
  if (freq === 2) return "medium";
  return "low";
}

function produceDiagnosis(
  brief: Extract<MockBrief, { role: "diagnosis" }>,
): TeacherDiagnosis {
  const { restitutions, lessonMarkdown, lessonTitle } = brief;
  const lesson = analyzeLesson(lessonMarkdown, lessonTitle);

  /* ---- misunderstood_concepts: aggregate revealed_errors by concept ------ */
  const conceptMap = new Map<
    string,
    { concept: string; levels: Set<Level>; frequency: number }
  >();
  for (const r of restitutions) {
    // Each restitution counts at most once per distinct missed_concept.
    const seenThisStudent = new Set<string>();
    for (const e of r.revealed_errors) {
      const key = e.missed_concept.trim().toLowerCase();
      if (!key) continue;
      let entry = conceptMap.get(key);
      if (!entry) {
        entry = { concept: e.missed_concept, levels: new Set(), frequency: 0 };
        conceptMap.set(key, entry);
      }
      entry.levels.add(r.level);
      if (!seenThisStudent.has(key)) {
        entry.frequency += 1;
        seenThisStudent.add(key);
      }
    }
  }

  const misunderstood_concepts = Array.from(conceptMap.values())
    // Deterministic ordering: most frequent first, then alphabetical.
    .sort((a, b) => b.frequency - a.frequency || a.concept.localeCompare(b.concept))
    .map((entry) => ({
      concept: entry.concept,
      affected_levels: Array.from(entry.levels).sort() as Level[],
      frequency: entry.frequency,
      severity: severityFromFrequency(entry.frequency),
    }));

  /* ---- missing_prerequisites: esp. from N2 & S-MISSING-CONTEXT ----------- */
  const prereqSeen = new Set<string>();
  const missing_prerequisites: TeacherDiagnosis["missing_prerequisites"] = [];
  for (const r of restitutions) {
    const isPrereqSource = r.level === "N2" || r.style === "S-MISSING-CONTEXT";
    if (!isPrereqSource) continue;
    for (const e of r.revealed_errors) {
      const key = e.missed_concept.trim().toLowerCase();
      if (!key || prereqSeen.has(key)) continue;
      // Only count prerequisite-flavoured causes.
      if (/prerequisite|assumed|coefficient|premise|percentage|percent/.test(
        e.probable_cause.toLowerCase() + " " + key,
      )) {
        prereqSeen.add(key);
        missing_prerequisites.push({
          prerequisite: e.missed_concept,
          evidence: `Observed with ${r.level}/${r.style} (${r.studentId}): "${e.probable_cause}"`,
        });
      }
    }
  }
  // Demo guarantee: if the lesson hides the %→coefficient prerequisite and no
  // restitution surfaced it explicitly, add it from the material itself.
  if (
    missing_prerequisites.length === 0 &&
    detectFlaws(lesson).impliedPercentPrereq
  ) {
    missing_prerequisites.push({
      prerequisite: "Converting a percentage rate into a multiplying coefficient (1 + rate)",
      evidence:
        "The lesson says to 'multiply by the rate' without ever explaining the shift from 5% to (1 + 0.05).",
    });
  }

  /* ---- ambiguous_passages: esp. from N6 & S-ANXIOUS ---------------------- */
  const ambiguousSeen = new Set<string>();
  const ambiguous_passages: TeacherDiagnosis["ambiguous_passages"] = [];
  for (const r of restitutions) {
    const isAmbiguousSource = r.level === "N6" || r.style === "S-ANXIOUS";
    if (!isAmbiguousSource) continue;
    for (const e of r.revealed_errors) {
      const key = e.missed_concept.trim().toLowerCase();
      if (!key || ambiguousSeen.has(key)) continue;
      ambiguousSeen.add(key);
      ambiguous_passages.push({
        excerpt: e.missed_concept,
        problem: `Flagged by ${r.level}/${r.style}: ${e.probable_cause}`,
      });
    }
  }
  // Demo guarantee: surface the vague vigilance passage from the material.
  const flaws = detectFlaws(lesson);
  if (flaws.vagueVigilance && flaws.vagueExtract) {
    const key = flaws.vagueExtract.trim().toLowerCase();
    if (!ambiguousSeen.has(key)) {
      ambiguousSeen.add(key);
      ambiguous_passages.push({
        excerpt: flaws.vagueExtract,
        problem:
          "A risk is flagged (the effect of compounding frequency) but never spelled out: the reader doesn't know what to check.",
      });
    }
  }

  /* ---- what_works: validated by N5 --------------------------------------- */
  const what_works: string[] = [];
  const worksSeen = new Set<string>();
  for (const r of restitutions) {
    if (r.level !== "N5") continue;
    for (const p of r.confident_points) {
      const key = p.trim().toLowerCase();
      if (key && !worksSeen.has(key)) {
        worksSeen.add(key);
        what_works.push(p);
      }
    }
  }
  if (what_works.length === 0) {
    // Fallback: validate the lesson's opening structure generically.
    if (lesson.headings[0]) {
      what_works.push(`The section "${lesson.headings[0]}" sets up the principle correctly.`);
    }
    if (lesson.firstSentences[0]) {
      what_works.push(
        `The opening "${lesson.firstSentences[0]}" frames the stakes and motivation well.`,
      );
    }
    if (what_works.length === 0) {
      what_works.push("The overall progression of the lesson is easy to follow.");
    }
  }

  /* ---- structural_flaws: from N6 ------------------------------------------ */
  const structural_flaws: string[] = [];
  const flawSeen = new Set<string>();
  for (const r of restitutions) {
    if (r.level !== "N6") continue;
    for (const e of r.revealed_errors) {
      const sentence = `${e.missed_concept} — ${e.probable_cause}`;
      const key = sentence.toLowerCase();
      if (!flawSeen.has(key)) {
        flawSeen.add(key);
        structural_flaws.push(sentence);
      }
    }
  }
  if (structural_flaws.length === 0) {
    if (flaws.undefinedJargon) {
      structural_flaws.push(
        `The term "${flaws.undefinedJargon}" is used as a keystone but never defined.`,
      );
    }
    if (flaws.impliedPercentPrereq) {
      structural_flaws.push(
        "Internal contradiction: 'multiply by the rate' in the text vs. the formula using (1 + rate).",
      );
    }
    if (structural_flaws.length === 0) {
      structural_flaws.push("The lesson has a few wording ambiguities that should be cleared up.");
    }
  }

  /* ---- rewrite_priorities: ordered, actionable ---------------------------- */
  const rewrite_priorities: string[] = [];
  // 1) Add explicit prerequisites.
  if (missing_prerequisites.length > 0) {
    rewrite_priorities.push(
      "Add an explicit 'Prerequisites' section at the top: " +
        missing_prerequisites.map((p) => p.prerequisite).join("; ") +
        ".",
    );
  } else {
    rewrite_priorities.push("Make the assumed prerequisites explicit at the top of the lesson.");
  }
  // 2) Define jargon.
  if (flaws.undefinedJargon) {
    rewrite_priorities.push(
      `Define the term "${flaws.undefinedJargon}" the first time it appears.`,
    );
  }
  // 3) Resolve the highest-severity misunderstood concepts.
  for (const c of misunderstood_concepts.filter((c) => c.severity === "high")) {
    rewrite_priorities.push(
      `Clear up the frequent misunderstanding around "${c.concept}" (missed by ${c.frequency} students).`,
    );
  }
  // 4) Disambiguate flagged passages.
  for (const p of ambiguous_passages) {
    rewrite_priorities.push(`Disambiguate the passage "${p.excerpt}".`);
  }
  // 5) Fix structural defects, last.
  if (flaws.impliedPercentPrereq) {
    rewrite_priorities.push(
      "Reconcile the text and the formula: show the shift from 5% to the coefficient (1 + 0.05).",
    );
  }

  return {
    misunderstood_concepts,
    missing_prerequisites,
    ambiguous_passages,
    what_works,
    structural_flaws,
    rewrite_priorities,
  };
}

/* ========================================================================== */
/*  REWRITE branch                                                             */
/* ========================================================================== */

function produceRewrite(
  brief: Extract<MockBrief, { role: "rewrite" }>,
): LessonVersion {
  const { lessonMarkdown, lessonTitle, diagnosis } = brief;
  const lesson = analyzeLesson(lessonMarkdown, lessonTitle);
  const flaws = detectFlaws(lesson);

  // Build explicit prerequisites: from diagnosis first, then a sensible default.
  const explicit_prerequisites: string[] = [];
  const prereqSeen = new Set<string>();
  for (const p of diagnosis.missing_prerequisites) {
    const key = p.prerequisite.trim().toLowerCase();
    if (key && !prereqSeen.has(key)) {
      prereqSeen.add(key);
      explicit_prerequisites.push(p.prerequisite);
    }
  }
  if (explicit_prerequisites.length === 0) {
    explicit_prerequisites.push(
      flaws.impliedPercentPrereq
        ? "Know how to convert a percentage into a multiplying coefficient (5% → 1 + 0.05 = 1.05)."
        : "Master the basic notions the lesson assumes are already known.",
    );
  }

  // Jargon definitions.
  const jargon = flaws.undefinedJargon;
  const jargonDef =
    jargon && jargon.toLowerCase() === "compounding"
      ? "**Compounding**: adding the interest earned back to the capital, so that in the next period interest is calculated on this larger total."
      : jargon
        ? `**${jargon}**: key term of the lesson, now explicitly defined the first time it appears.`
        : null;

  // Assemble the enriched markdown.
  const parts: string[] = [];
  parts.push(`# ${lesson.title}`);
  parts.push("");
  parts.push("## Prerequisites");
  parts.push(
    "Before reading this lesson, make sure you have the following background (made explicit following the diagnosis):",
  );
  parts.push("");
  for (const p of explicit_prerequisites) parts.push(`- ${p}`);
  parts.push("");

  if (jargonDef) {
    parts.push("## Definitions");
    parts.push(jargonDef);
    parts.push("");
  }

  // Preserve the original body, but annotate the flagged passages instead of
  // removing what works.
  parts.push("## Lesson (enriched version)");
  parts.push("");
  let body = lessonMarkdown;
  // Drop the original top-level title line to avoid duplication.
  body = body.replace(/^#\s+.*(\r?\n)?/, "").trimStart();
  parts.push(body);
  parts.push("");

  // Address rewrite_priorities in order via clarifications.
  parts.push("## Clarifications added (following the diagnosis)");
  parts.push("");
  if (diagnosis.rewrite_priorities.length === 0) {
    parts.push("- Minor rewording to clear up the remaining ambiguities.");
  } else {
    diagnosis.rewrite_priorities.forEach((prio, i) => {
      parts.push(`${i + 1}. ${prio}`);
    });
  }
  parts.push("");
  if (flaws.impliedPercentPrereq) {
    parts.push(
      "> Important clarification: 'multiply by the rate' is a misleading shortcut. " +
        "To go from one year to the next, you multiply the capital by the **coefficient** " +
        "(1 + rate), i.e. 1.05 for 5%. This is what sets compound interest apart from simple interest.",
    );
    parts.push("");
  }
  if (flaws.vagueVigilance && flaws.vagueExtract) {
    parts.push(
      `> On the passage "${flaws.vagueExtract}": the point of caution concerns the ` +
        "**compounding frequency** (annual, monthly…). At an equal nominal rate, more frequent " +
        "compounding produces a higher effective return.",
    );
    parts.push("");
  }

  // Re-affirm what works — explicitly NOT removed.
  if (diagnosis.what_works.length > 0) {
    parts.push("## What already worked (kept as-is)");
    for (const ok of diagnosis.what_works) parts.push(`- ${ok}`);
    parts.push("");
  }

  const markdown = parts.join("\n").trimEnd() + "\n";

  // change_summary, in the order priorities were addressed.
  const change_summary: string[] = [];
  change_summary.push(
    "Added an explicit 'Prerequisites' section at the top of the lesson: " +
      explicit_prerequisites.join("; ") +
      ".",
  );
  if (jargonDef) {
    change_summary.push(`Explicitly defined the term "${jargon}" at the start of the lesson.`);
  }
  diagnosis.rewrite_priorities.forEach((prio) => {
    change_summary.push(`Addressed priority: ${prio}`);
  });
  if (flaws.impliedPercentPrereq) {
    change_summary.push(
      "Reconciled the text and the formula via the coefficient (1 + rate).",
    );
  }
  if (flaws.vagueVigilance) {
    change_summary.push("Spelled out the point of caution (compounding frequency).");
  }
  change_summary.push(
    "Kept all validated passages unchanged (what_works left untouched).",
  );

  return {
    title: lesson.title,
    markdown,
    change_summary,
    explicit_prerequisites,
  };
}

/* ========================================================================== */
/*  FACTCHECK branch                                                           */
/* ========================================================================== */

function produceFactCheck(
  brief: Extract<MockBrief, { role: "factcheck" }>,
): FactCheckReport {
  const { target, title, content } = brief;
  const lesson = analyzeLesson(content, title);
  const flaws = detectFlaws(lesson);
  const where =
    target === "lesson"
      ? "lesson"
      : target === "evaluations"
        ? "assessment item"
        : target === "exercises"
          ? "exercise answer key"
          : "revision sheet";

  const claims: FactCheckClaim[] = [];

  // Claim 1: the formula (correct if present).
  if (/\(1\s*\+|final value|capital\s*[×x*]/.test(lesson.lower)) {
    claims.push({
      claim: "final value = capital × (1 + rate) ^ number of periods",
      verdict: "correct",
      explanation:
        "The compound interest formula is exact: the capital grows geometrically via the coefficient (1 + rate).",
      source_location: `${where}: formula section`,
    });
  }

  // Claim 2: the "multiply by the rate" shortcut (dubious — misleading).
  if (flaws.impliedPercentPrereq && flaws.oversimplifyExtract) {
    claims.push({
      claim: flaws.oversimplifyExtract,
      verdict: "dubious",
      explanation:
        "Misleading phrasing: 'multiply by the rate' (0.05) would give only the interest, " +
        "not the new capital. Going from one year to the next requires multiplying by (1 + rate).",
      suggested_correction:
        "Replace with: 'you multiply the capital by the coefficient (1 + rate), i.e. 1.05 for 5%'.",
      source_location: `${where}: principle / example section`,
    });
  }

  // Claim 3: the vague vigilance passage (dubious — imprecise, not false).
  if (flaws.vagueVigilance && flaws.vagueExtract) {
    claims.push({
      claim: flaws.vagueExtract,
      verdict: "dubious",
      explanation:
        "Correct but too imprecise to verify: it flags a risk " +
        "(compounding frequency affects the return) without naming or quantifying it.",
      suggested_correction:
        "Specify that it is the compounding frequency that changes the effective return at an equal nominal rate.",
      source_location: `${where}: point of caution`,
    });
  }

  // Always include at least one "correct" anchor claim so the report is useful.
  if (claims.length === 0) {
    claims.push({
      claim: `The subject covered is "${lesson.title}".`,
      verdict: "correct",
      explanation: "The content checked does match the stated subject.",
      source_location: `${where}: title`,
    });
  }

  // blocking only if any verdict is "incorrect" (none here by construction).
  const blocking = claims.some((c) => c.verdict === "incorrect");

  const nbDubious = claims.filter((c) => c.verdict === "dubious").length;
  const summary = blocking
    ? `Fact-check of the ${where}: at least one claim is incorrect — a blocking correction is required before publishing.`
    : nbDubious > 0
      ? `Fact-check of the ${where}: no blocking factual errors, but ${nbDubious} imprecise wording(s) ` +
        "should be clarified (notably the shortcut on the rate and the point of caution)."
      : `Fact-check of the ${where}: no factual errors found, content is accurate.`;

  return { target, claims, blocking, summary };
}

/* ========================================================================== */
/*  EVALUATIONS branch                                                         */
/* ========================================================================== */

/** Ordered list of the most-missed concepts from the diagnosis. */
function mostMissedConcepts(diagnosis: TeacherDiagnosis): string[] {
  return diagnosis.misunderstood_concepts
    .slice()
    .sort((a, b) => b.frequency - a.frequency || a.concept.localeCompare(b.concept))
    .map((c) => c.concept);
}

function produceEvaluations(
  brief: Extract<MockBrief, { role: "evaluations" }>,
): EvaluationSet {
  const { lessonMarkdown, lessonTitle, diagnosis } = brief;
  const lesson = analyzeLesson(lessonMarkdown, lessonTitle);
  const flaws = detectFlaws(lesson);
  const concept = coreNotion(lesson);
  const missed = mostMissedConcepts(diagnosis);
  const jargon = flaws.undefinedJargon ?? primaryConcept(lesson);
  const c0 = missed[0] ?? jargon;
  const c1 = missed[1] ?? concept;

  const beginner: Evaluation = {
    level: "beginner",
    items: [
      {
        type: "mcq",
        statement: `What does the term "${jargon}" refer to in the lesson "${lesson.title}"?`,
        options: [
          "Adding the interest to the capital, so that it in turn earns interest.",
          "Withdrawing the interest at each period.",
          "A tax levied on savings.",
          "The name of the bank managing the investment.",
        ],
        answer_key:
          "Answer: adding the interest to the capital (compounding). A recognition item targeting the undefined jargon.",
        target_concept: jargon,
      },
      {
        type: "true_false",
        statement: "With compound interest, the gain is always the same every year.",
        answer_key:
          "False: the gain increases year after year because the interest itself earns interest.",
        target_concept: c1,
      },
      {
        type: "open",
        statement: `Rephrase the main idea of "${concept}" in your own words.`,
        answer_key:
          "Expected answer: the interest is added to the capital and itself earns interest in the following period.",
        target_concept: concept,
      },
    ],
  };

  const intermediate: Evaluation = {
    level: "intermediate",
    items: [
      {
        type: "open",
        statement:
          "You invest €1,000 at 5%. Calculate the capital after 2 years, justifying the coefficient used.",
        answer_key:
          "1000 × 1.05 = 1050, then 1050 × 1.05 = 1102.50 €. The coefficient is (1 + 0.05) = 1.05, not 0.05.",
        target_concept: c0,
      },
      {
        type: "mcq",
        statement: "To go from one year to the next, what do you multiply the capital by?",
        options: ["by 0.05", "by 1.05", "by 5", "by 105"],
        answer_key: "Answer: by 1.05 (the coefficient 1 + rate). Multiplying by 0.05 gives only the interest.",
        target_concept: "multiplying coefficient (1 + rate)",
      },
      {
        type: "true_false",
        statement: "Over a long period, the gap between simple and compound interest stays negligible.",
        answer_key: "False: the gap becomes considerable because compound growth is geometric.",
        target_concept: c1,
      },
    ],
  };

  const advanced: Evaluation = {
    level: "advanced",
    items: [
      {
        type: "open",
        statement:
          "At a nominal rate of 5%, explain why monthly compounding earns more than annual compounding (edge case / transfer).",
        answer_key:
          "The compounding frequency increases the effective return: (1 + 0.05/12)^12 > 1.05. This is the point of caution the lesson left implicit.",
        target_concept: flaws.vagueExtract ?? "compounding frequency",
      },
      {
        type: "mcq",
        statement:
          "Does an investment double faster at 5% compound or 5% simple, and why?",
        options: [
          "Compound, because the growth is geometric.",
          "Simple, because the gain is constant.",
          "Same in both cases.",
          "Impossible to determine.",
        ],
        answer_key:
          "Answer: compound — geometric growth outpaces the linear growth of simple interest.",
        target_concept: c1,
      },
      {
        type: "open",
        statement:
          "Critique the sentence 'you just multiply by the rate': is it accurate? Rephrase it rigorously.",
        answer_key:
          "Inaccurate: multiplying by the rate (0.05) gives the interest, not the new capital. You must multiply by (1 + rate).",
        target_concept: c0,
      },
    ],
  };

  return { beginner, intermediate, advanced };
}

/* ========================================================================== */
/*  EXERCISES branch                                                           */
/* ========================================================================== */

function produceExercises(
  brief: Extract<MockBrief, { role: "exercises" }>,
): ExerciseSet {
  const { lessonMarkdown, lessonTitle, diagnosis } = brief;
  const lesson = analyzeLesson(lessonMarkdown, lessonTitle);
  const flaws = detectFlaws(lesson);
  const concept = coreNotion(lesson);
  const missed = mostMissedConcepts(diagnosis);
  const c0 = missed[0] ?? primaryConcept(lesson);

  const exercises: Exercise[] = [
    {
      title: "Spot the reasoning error",
      format: "error_spotting",
      statement:
        "A student writes: 'For €1,000 at 5%, I multiply by 0.05 every year, so I gain €50 a year, always the same.' " +
        "Identify and correct the error.",
      answer_key:
        "Error (N2 misconception): multiplying by 0.05 gives only one year's interest, and the model described is actually SIMPLE interest. " +
        "For compound interest, you multiply the capital by (1 + 0.05) = 1.05, and the gain increases every year.",
      target_concept: flaws.impliedPercentPrereq
        ? "multiplying coefficient (1 + rate)"
        : c0,
      indicative_level: "intermediate",
    },
    {
      title: `Real-world scenario: "${concept}" in everyday life`,
      format: "scenario",
      statement:
        "You invest €2,000 at 4% per year for 3 years, compound interest. Estimate, then calculate, the final value.",
      answer_key:
        "2000 × 1.04^3 ≈ 2000 × 1.1249 = 2249.73 €. The coefficient (1 + rate) is applied three times.",
      target_concept: concept,
      indicative_level: "intermediate",
    },
    {
      title: "Mini-challenge: compound vs simple",
      format: "mini_challenge",
      statement:
        "Without a calculator, say which earns more over 10 years: €1,000 at 5% simple or at 5% compound? Justify in one sentence.",
      answer_key:
        "Compound: every year the interest itself earns interest, so growth is geometric and outpaces the linear growth of simple interest.",
      target_concept: missed[1] ?? "difference between simple and compound interest",
      indicative_level: "beginner",
    },
    {
      title: "Progressive application: from year 1 to year n",
      format: "progressive_application",
      statement:
        "Step 1: calculate the capital after 1 year (€1,000 at 5%). Step 2: after 2 years. Step 3: write the general formula after n years.",
      answer_key:
        "Step 1: 1000 × 1.05 = 1050. Step 2: 1050 × 1.05 = 1102.50. Step 3: 1000 × 1.05^n. The exponent n emerges.",
      target_concept: "compound interest formula",
      indicative_level: "advanced",
    },
  ];

  // If the lesson surfaced a vague vigilance passage, add a transfer exercise.
  if (flaws.vagueVigilance && flaws.vagueExtract) {
    exercises.push({
      title: "Edge case: compounding frequency",
      format: "scenario",
      statement:
        "Two savings accounts both advertise 5%: one compounds annually, the other monthly. Which should you choose, and why?",
      answer_key:
        "The monthly one: at an equal nominal rate, compounding more often increases the effective return — (1 + 0.05/12)^12 > 1.05. This is the point of caution the lesson left vague.",
      target_concept: flaws.vagueExtract,
      indicative_level: "advanced",
    });
  }

  return { exercises };
}

/* ========================================================================== */
/*  SHEET branch                                                               */
/* ========================================================================== */

function produceSheet(
  brief: Extract<MockBrief, { role: "sheet" }>,
): RevisionSheet {
  const { lessonMarkdown, lessonTitle, diagnosis } = brief;
  const lesson = analyzeLesson(lessonMarkdown, lessonTitle);
  const flaws = detectFlaws(lesson);
  const concept = coreNotion(lesson);

  // Prerequisites FIRST/explicit — from diagnosis, with a generic fallback.
  const prerequisites: string[] = [];
  const prereqSeen = new Set<string>();
  for (const p of diagnosis.missing_prerequisites) {
    const key = p.prerequisite.trim().toLowerCase();
    if (key && !prereqSeen.has(key)) {
      prereqSeen.add(key);
      prerequisites.push(p.prerequisite);
    }
  }
  if (prerequisites.length === 0) {
    prerequisites.push(
      flaws.impliedPercentPrereq
        ? "Convert a percentage into a coefficient: 5% → 1 + 0.05 = 1.05."
        : "Master the basic notions assumed by the lesson.",
    );
  }

  // key_points — drawn from headings + the core mechanism.
  const key_points: string[] = [];
  if (flaws.impliedPercentPrereq) {
    key_points.push("You go from one period to the next by multiplying by the coefficient (1 + rate), not by the rate.");
  }
  key_points.push("Interest is added to the capital and itself earns interest (the snowball effect).");
  key_points.push("General formula: final value = capital × (1 + rate) ^ number of periods.");
  for (const h of lesson.headings) {
    if (!/key takeaway|point of caution|careful/i.test(h)) {
      key_points.push(`See the section "${h}".`);
    }
    if (key_points.length >= 6) break;
  }

  // definitions — define the jargon and the coefficient.
  const definitions: { term: string; def: string }[] = [];
  const jargon = flaws.undefinedJargon;
  if (jargon && jargon.toLowerCase() === "compounding") {
    definitions.push({
      term: "Compounding",
      def: "Adding the interest earned back to the capital, so that in the next period interest is calculated on this larger total.",
    });
  } else if (jargon) {
    definitions.push({
      term: jargon,
      def: `Key term of the lesson "${lesson.title}", now explicitly defined.`,
    });
  }
  definitions.push({
    term: "Multiplying coefficient",
    def: "The factor (1 + rate) by which the capital is multiplied each period (1.05 for 5%).",
  });
  definitions.push({
    term: "Compound interest",
    def: "Interest calculated each period on the capital plus previously earned interest, as opposed to simple interest.",
  });

  // common_pitfalls — from diagnosis concepts + error flavour.
  const common_pitfalls: string[] = [];
  const pitfallSeen = new Set<string>();
  for (const c of mostMissedConcepts(diagnosis)) {
    const key = c.toLowerCase();
    if (!pitfallSeen.has(key)) {
      pitfallSeen.add(key);
      common_pitfalls.push(`Frequently misunderstood: "${c}".`);
    }
    if (common_pitfalls.length >= 5) break;
  }
  if (flaws.impliedPercentPrereq) {
    common_pitfalls.push("Pitfall: multiplying by 0.05 (the rate) instead of 1.05 (the coefficient) — confuses compound with simple interest.");
  }
  if (flaws.vagueVigilance) {
    common_pitfalls.push("Pitfall: ignoring the compounding frequency, which changes the effective return at an equal rate.");
  }
  if (common_pitfalls.length === 0) {
    common_pitfalls.push(`Check your understanding of the key points of "${concept}".`);
  }

  return {
    title: `Revision sheet — ${lesson.title}`,
    prerequisites,
    key_points,
    definitions,
    common_pitfalls,
  };
}

/* ========================================================================== */
/*  Public entry point                                                         */
/* ========================================================================== */

/**
 * Turn a decoded MockBrief into schema-valid output. Deterministic and pure.
 * The return type is intentionally `unknown` (matching the requested API): the
 * caller validates it against the role's Zod schema.
 */
export function produceMock(brief: MockBrief): unknown {
  switch (brief.role) {
    case "student":
      return produceStudent(brief);
    case "diagnosis":
      return produceDiagnosis(brief);
    case "rewrite":
      return produceRewrite(brief);
    case "factcheck":
      return produceFactCheck(brief);
    case "evaluations":
      return produceEvaluations(brief);
    case "exercises":
      return produceExercises(brief);
    case "sheet":
      return produceSheet(brief);
    default: {
      // Exhaustiveness guard — every role is handled above.
      const _never: never = brief;
      return _never;
    }
  }
}

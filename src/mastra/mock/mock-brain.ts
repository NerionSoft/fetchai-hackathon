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
 *   (1) the jargon "capitalisation" is used but never defined,
 *   (2) the implicit prerequisite hidden behind "il suffit de multiplier par le
 *       taux" — the %→coefficient (1+taux) conversion is never explained,
 *   (3) the vague "Un point de vigilance" passage about compounding frequency.
 *
 * Content is in FRENCH, sincere and diagnosable (no "j'ai rien compris", no SMS,
 * no gibberish) — it respects the PRINCIPE_DIRECTEUR.
 */

import type { MockBrief } from "./brief";
import type {
  ErreurRevelee,
  Evaluation,
  EvaluationSet,
  Exercice,
  ExerciceSet,
  FactCheckClaim,
  FactCheckReport,
  FicheRevision,
  LessonVersion,
  Niveau,
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
  return "Leçon";
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
  /** True when a "point de vigilance"-style vague passage exists. */
  vagueVigilance: boolean;
  /** The vague passage extract, if any. */
  vagueExtract: string | null;
  /** The "il suffit de…" oversimplification extract, if any. */
  oversimplifyExtract: string | null;
}

const VIGILANCE_HINTS = [
  "point de vigilance",
  "attention",
  "à noter",
  "remarque",
  "il faut donc toujours",
];

const OVERSIMPLIFY_HINTS = [
  "il suffit de",
  "il suffit",
  "tout simplement",
  "rien de plus",
];

/** Heuristic: a bold term is "undefined jargon" if it is not followed shortly
 *  by a definitional marker ("c'est", "désigne", "signifie", ":", "="). */
function detectUndefinedJargon(lesson: LessonShape): string | null {
  for (const term of lesson.boldTerms) {
    const idx = lesson.lower.indexOf(term.toLowerCase());
    if (idx === -1) continue;
    const window = lesson.lower.slice(idx, idx + 160);
    const defined =
      /(c'est|c’est|désigne|designe|signifie|veut dire|se définit|défini comme|defini comme)/.test(
        window,
      );
    if (!defined) return term;
  }
  // Fallback: the canonical demo jargon.
  if (lessonHas(lesson, "capitalisation")) return "capitalisation";
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
  // lesson speaks of "multiplier par le taux" without converting % to (1+taux).
  const mentionsPercent = /%|pour cent|pourcentage/.test(lesson.lower);
  const mentionsMultiplyByRate =
    /multiplier par le taux|multiplier par le|appliquer le taux/.test(lesson.lower);
  const definesCoefficient = /\(1\s*\+|1\s*\+\s*taux|coefficient multiplicateur/.test(
    lesson.lower,
  );
  const impliedPercentPrereq =
    (mentionsPercent && mentionsMultiplyByRate) ||
    (mentionsPercent && /multiplier/.test(lesson.lower) && !definesCoefficient);

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
  const { studentId, classId, niveau, style, provider, lessonMarkdown, lessonTitle } = brief;
  const lesson = analyzeLesson(lessonMarkdown, lessonTitle);
  const flaws = detectFlaws(lesson);

  const seed = `${studentId}|${niveau}|${style}|${lesson.title}`;
  const jargon = flaws.undefinedJargon ?? primaryConcept(lesson);
  const concept = coreNotion(lesson);
  const firstIdea = lesson.firstSentences[0] ?? `le sujet « ${concept} »`;
  const lastHeading = lesson.headings[lesson.headings.length - 1] ?? concept;

  let ce_que_jai_compris = "";
  let points_surs: string[] = [];
  let points_de_doute: string[] = [];
  let questions_au_prof: string[] = [];
  const erreurs_revelees: ErreurRevelee[] = [];

  /* ---- Axe 1 : niveau de maîtrise --------------------------------------- */
  switch (niveau) {
    case "N0": {
      // Parrots the jargon with no real content.
      ce_que_jai_compris =
        `La leçon parle de « ${concept} » et surtout de la « ${jargon} ». ` +
        `C'est la « ${jargon} » qui explique tout, grâce au mécanisme de « ${jargon} » ` +
        `quand on met en œuvre la « ${jargon} ». Voilà l'essentiel selon moi.`;
      points_surs = [`Le mot-clé important est « ${jargon} ».`];
      points_de_doute = [
        `Je ne saurais pas vraiment redire ce que « ${jargon} » désigne concrètement.`,
      ];
      erreurs_revelees.push({
        concept_rate: jargon,
        cause_probable: "jargon employé mais non défini",
        declenche_par: "N0 : imitation de la forme/vocabulaire savant sans contenu réel",
      });
      break;
    }
    case "N1": {
      // Keeps an isolated fragment (first or last) as the whole point.
      const fragment = pick([firstIdea, lastHeading], seed) ?? firstIdea;
      ce_que_jai_compris =
        `Ce que j'ai retenu, c'est surtout « ${fragment} ». ` +
        `Pour moi, c'est le cœur de la leçon ; le reste tourne autour de ça.`;
      points_surs = [`« ${fragment} » est un point que je sais redire.`];
      points_de_doute = [
        `Je n'arrive pas à relier ce fragment au reste de la leçon (« ${concept} »).`,
      ];
      erreurs_revelees.push({
        concept_rate: `vue d'ensemble de « ${concept} »`,
        cause_probable: "absence de fil conducteur explicite : je prends un détail pour le tout",
        declenche_par: "N1 : rétention de fragments isolés sans structure globale",
      });
      break;
    }
    case "N2": {
      // Structured but FALSE coherent model.
      if (flaws.impliedPercentPrereq) {
        ce_que_jai_compris =
          `J'ai bien compris : pour passer d'une année à l'autre, il suffit de multiplier ` +
          `le capital par le taux. Avec 1 000 € à 5 %, je multiplie par 0,05 chaque année, ` +
          `donc je gagne 50 € par an, toujours pareil. Tout se déduit proprement de là.`;
        points_surs = [
          "On multiplie le capital par le taux (0,05) pour obtenir l'année suivante.",
          "Le gain annuel est constant : 50 € sur 1 000 €.",
        ];
        points_de_doute = [
          "Je ne vois pas en quoi ce serait différent des intérêts simples, du coup.",
        ];
        erreurs_revelees.push({
          concept_rate: "conversion du taux en coefficient multiplicateur (1 + taux)",
          cause_probable:
            "prérequis implicite non verrouillé : la leçon dit « multiplier par le taux » " +
            "sans expliquer le passage de 5 % au coefficient (1 + 0,05)",
          declenche_par: "N2 : raisonnement cohérent bâti sur une prémisse erronée, l'élève est sûr de lui",
        });
      } else {
        const wrongAnchor = pick(lesson.boldTerms.length ? lesson.boldTerms : [concept], seed);
        ce_que_jai_compris =
          `J'ai construit une explication cohérente : tout part de « ${wrongAnchor} », ` +
          `et j'en déduis logiquement le reste. Je suis sûr de mon raisonnement.`;
        points_surs = [`Mon raisonnement à partir de « ${wrongAnchor} » se tient parfaitement.`];
        points_de_doute = ["Je ne vois pas où ça pourrait coincer, et c'est peut-être ça le problème."];
        erreurs_revelees.push({
          concept_rate: `prémisse de « ${wrongAnchor} »`,
          cause_probable: "prérequis implicite mal verrouillé par la leçon",
          declenche_par: "N2 : modèle structuré mais faux, posé sur une base erronée",
        });
      }
      break;
    }
    case "N3": {
      // Knows WHAT/HOW, fails WHEN/WHY.
      ce_que_jai_compris =
        `Je sais appliquer la procédure de « ${concept} » : je suis les étapes décrites ` +
        `(${lesson.headings.slice(0, 2).map((h) => `« ${h} »`).join(", ") || "les étapes"}) ` +
        `et j'obtiens un résultat. En revanche, je ne saurais pas dire QUAND ça ne marche pas.`;
      points_surs = ["Je sais dérouler le calcul / la procédure jusqu'au bout."];
      points_de_doute = ["Je ne sais pas pourquoi on procède ainsi, ni dans quels cas ça change."];
      erreurs_revelees.push({
        concept_rate: `le POURQUOI de « ${concept} »`,
        cause_probable: "la leçon explique à FAIRE mais pas à COMPRENDRE",
        declenche_par: "N3 : maîtrise procédurale littérale, aveugle aux exceptions",
      });
      break;
    }
    case "N4": {
      // Functional, slight over-generalization, misses fine nuances.
      ce_que_jai_compris =
        `Je comprends l'idée de « ${concept} » et ses raisons, et je sais l'appliquer ` +
        `à des cas proches. J'ai tendance à généraliser la règle telle quelle partout.`;
      points_surs = [
        `Le principe de « ${concept} » est clair, je l'applique aux cas standards.`,
      ];
      points_de_doute = [
        "Je ne suis pas sûr des cas limites ni des conditions exactes où la règle change.",
      ];
      if (flaws.vagueVigilance) {
        points_de_doute.push(
          `Le passage « ${flaws.vagueExtract} » reste flou pour moi sur ce qui change précisément.`,
        );
      }
      erreurs_revelees.push({
        concept_rate: "nuances fines et cas limites",
        cause_probable: "sur-généralisation légère : nuances survolées par la leçon",
        declenche_par: "N4 : compréhension fonctionnelle mais nuances ratées",
      });
      break;
    }
    case "N5": {
      // Validates what works; near-zero errors.
      ce_que_jai_compris =
        `J'ai compris « ${concept} » en profondeur : je distingue la règle de l'exception ` +
        `et je peux transposer à un contexte nouveau. La progression « ${firstIdea} » ` +
        `est claire et bien posée.`;
      points_surs = [
        `La logique générale de « ${concept} » est solide et bien expliquée.`,
        lesson.headings[0]
          ? `La section « ${lesson.headings[0]} » pose correctement le principe.`
          : "Le principe est correctement posé.",
      ];
      points_de_doute = [];
      // N5 reveals (almost) no errors — leave erreurs_revelees empty.
      break;
    }
    case "N6": {
      // Critiques the MATERIAL.
      ce_que_jai_compris =
        `Sur le fond, je maîtrise « ${concept} ». Mais le support lui-même pose problème : ` +
        (flaws.impliedPercentPrereq
          ? `il y a une contradiction entre « multiplier par le taux » et la formule en (1 + taux), ` +
            `et l'ambiguïté sur le taux/la fréquence n'est jamais levée.`
          : `plusieurs passages sont ambigus ou contradictoires et l'ordre d'exposition est discutable.`);
      points_surs = ["Le sujet lui-même m'est clair ; c'est la rédaction que je critique."];
      points_de_doute = [];
      if (flaws.vagueVigilance && flaws.vagueExtract) {
        points_de_doute.push(
          `Le passage « ${flaws.vagueExtract} » affirme qu'il y a un piège sans jamais dire lequel.`,
        );
        erreurs_revelees.push({
          concept_rate: flaws.vagueExtract,
          cause_probable: "passage vague : un risque est annoncé mais jamais explicité (fréquence de capitalisation)",
          declenche_par: "N6 : critique méta du matériel, repère le non-dit",
        });
      }
      if (flaws.impliedPercentPrereq) {
        erreurs_revelees.push({
          concept_rate: "contradiction « multiplier par le taux » vs formule (1 + taux)",
          cause_probable:
            "incohérence interne : le texte procédural contredit la formule finale, " +
            "le passage du % au coefficient n'est jamais explicité",
          declenche_par: "N6 : détection d'une contradiction et d'un ordre défaillant",
        });
      }
      if (erreurs_revelees.length === 0) {
        erreurs_revelees.push({
          concept_rate: `structure du support « ${concept} »`,
          cause_probable: "ambiguïtés et non-dits dans la rédaction",
          declenche_par: "N6 : critique de la structure et des défauts du support",
        });
      }
      break;
    }
  }

  /* ---- Axe 2 : style cognitif (module l'expression / ajoute des signaux) -- */
  switch (style) {
    case "S-LITTERAL": {
      points_surs.push(`Je peux réciter le passage « ${firstIdea} » presque mot pour mot.`);
      if (niveau !== "N5") {
        erreurs_revelees.push({
          concept_rate: `reformulation de « ${concept} »`,
          cause_probable: "incapacité à transformer le texte : collage littéral au support",
          declenche_par: "S-LITTERAL : récitation de surface sans reformulation",
        });
      }
      break;
    }
    case "S-ANALOGIQUE": {
      ce_que_jai_compris += ` Pour moi, c'est comme une recette qu'on suit pas à pas : ` +
        `je plaque cette image sur « ${concept} ».`;
      if (niveau !== "N5") {
        erreurs_revelees.push({
          concept_rate: `analogie sur « ${concept} »`,
          cause_probable: "analogie du quotidien trompeuse là où le concept ne s'y prête pas",
          declenche_par: "S-ANALOGIQUE : faux-ami conceptuel via analogie plaquée",
        });
      }
      break;
    }
    case "S-SEQUENTIEL": {
      points_surs.push("Je sais enchaîner les étapes dans l'ordre indiqué.");
      points_de_doute.push("Mais je perds le sens global en suivant pas à pas.");
      break;
    }
    case "S-IMPATIENT": {
      ce_que_jai_compris += ` J'ai sauté les définitions pour aller direct à l'application.`;
      if (niveau !== "N5") {
        erreurs_revelees.push({
          concept_rate: `conditions de validité de « ${concept} »`,
          cause_probable: "prérequis et définitions sautés : règle utilisée hors de ses conditions",
          declenche_par: "S-IMPATIENT : passage direct à l'application",
        });
      }
      break;
    }
    case "S-ANXIEUX": {
      // Over-interprets, adds imaginary conditions, wants reassurance.
      points_de_doute.push(
        `Et s'il y avait une condition cachée que je n'ai pas vue ? Je crains de mal faire.`,
      );
      if (flaws.vagueVigilance && flaws.vagueExtract && niveau !== "N5") {
        points_de_doute.push(
          `Le passage « ${flaws.vagueExtract} » m'inquiète : je suppose plein de cas particuliers non dits.`,
        );
      }
      questions_au_prof.push("Est-ce qu'il y a des conditions particulières à ne surtout pas oublier ?");
      if (niveau !== "N5") {
        erreurs_revelees.push({
          concept_rate: `sur-interprétation de « ${concept} »`,
          cause_probable: "ajout de conditions imaginaires : complexification d'un point simple",
          declenche_par: "S-ANXIEUX : sur-interprétation et besoin de réassurance",
        });
      }
      break;
    }
    case "S-CONTEXTE-MANQUANT": {
      // Bumps on assumed-known notions (e.g. percentages).
      const assumedNotion = /%|pour cent|pourcentage/.test(lesson.lower)
        ? "les pourcentages"
        : "des notions tenues pour acquises";
      points_de_doute.push(
        `Honnêtement, je bute sur ${assumedNotion} : la leçon les suppose connus mais ne les rappelle pas.`,
      );
      questions_au_prof.push(`Pouvez-vous rappeler ${assumedNotion} ? Je n'ai pas ce prérequis.`);
      erreurs_revelees.push({
        concept_rate: assumedNotion,
        cause_probable: "acquis supposé connu mais absent : la leçon ne rappelle pas le prérequis",
        declenche_par: "S-CONTEXTE-MANQUANT : manque d'un prérequis tenu pour acquis",
      });
      break;
    }
  }

  // Clamp questions to the schema max (≤ 2), deterministically keeping the
  // first ones produced.
  questions_au_prof = questions_au_prof.slice(0, 2);

  // Ensure non-empty arrays where it reads better, but schema only requires
  // presence (length 0 is valid for every array here).
  return {
    studentId,
    classId,
    niveau,
    style,
    provider,
    ce_que_jai_compris,
    points_surs,
    points_de_doute,
    questions_au_prof,
    erreurs_revelees,
  };
}

/* ========================================================================== */
/*  DIAGNOSIS branch — aggregates over restitutions                            */
/* ========================================================================== */

type Gravite = "faible" | "moyenne" | "elevee";

function graviteFromFrequence(freq: number): Gravite {
  if (freq >= 3) return "elevee";
  if (freq === 2) return "moyenne";
  return "faible";
}

function produceDiagnosis(
  brief: Extract<MockBrief, { role: "diagnosis" }>,
): TeacherDiagnosis {
  const { restitutions, lessonMarkdown, lessonTitle } = brief;
  const lesson = analyzeLesson(lessonMarkdown, lessonTitle);

  /* ---- concepts_mal_compris : aggregate erreurs_revelees by concept ------ */
  const conceptMap = new Map<
    string,
    { concept: string; niveaux: Set<Niveau>; frequence: number }
  >();
  for (const r of restitutions) {
    // Each restitution counts at most once per distinct concept_rate.
    const seenThisStudent = new Set<string>();
    for (const e of r.erreurs_revelees) {
      const key = e.concept_rate.trim().toLowerCase();
      if (!key) continue;
      let entry = conceptMap.get(key);
      if (!entry) {
        entry = { concept: e.concept_rate, niveaux: new Set(), frequence: 0 };
        conceptMap.set(key, entry);
      }
      entry.niveaux.add(r.niveau);
      if (!seenThisStudent.has(key)) {
        entry.frequence += 1;
        seenThisStudent.add(key);
      }
    }
  }

  const concepts_mal_compris = Array.from(conceptMap.values())
    // Deterministic ordering: most frequent first, then alphabetical.
    .sort((a, b) => b.frequence - a.frequence || a.concept.localeCompare(b.concept))
    .map((entry) => ({
      concept: entry.concept,
      niveaux_concernes: Array.from(entry.niveaux).sort() as Niveau[],
      frequence: entry.frequence,
      gravite: graviteFromFrequence(entry.frequence),
    }));

  /* ---- prerequis_manquants : esp. from N2 & S-CONTEXTE-MANQUANT ---------- */
  const prereqSeen = new Set<string>();
  const prerequis_manquants: TeacherDiagnosis["prerequis_manquants"] = [];
  for (const r of restitutions) {
    const isPrereqSource = r.niveau === "N2" || r.style === "S-CONTEXTE-MANQUANT";
    if (!isPrereqSource) continue;
    for (const e of r.erreurs_revelees) {
      const key = e.concept_rate.trim().toLowerCase();
      if (!key || prereqSeen.has(key)) continue;
      // Only count prerequisite-flavoured causes.
      if (/prérequis|prerequis|acquis|coefficient|prémisse|premisse|pourcentage|pour cent/.test(
        e.cause_probable.toLowerCase() + " " + key,
      )) {
        prereqSeen.add(key);
        prerequis_manquants.push({
          prerequis: e.concept_rate,
          preuve: `Observé chez ${r.niveau}/${r.style} (${r.studentId}) : « ${e.cause_probable} »`,
        });
      }
    }
  }
  // Demo guarantee: if the lesson hides the %→coefficient prerequisite and no
  // restitution surfaced it explicitly, add it from the material itself.
  if (
    prerequis_manquants.length === 0 &&
    detectFlaws(lesson).impliedPercentPrereq
  ) {
    prerequis_manquants.push({
      prerequis: "Conversion d'un taux en pourcentage vers le coefficient multiplicateur (1 + taux)",
      preuve:
        "La leçon dit « multiplier par le taux » sans jamais expliquer le passage de 5 % à (1 + 0,05).",
    });
  }

  /* ---- passages_ambigus : esp. from N6 & S-ANXIEUX ----------------------- */
  const ambiguSeen = new Set<string>();
  const passages_ambigus: TeacherDiagnosis["passages_ambigus"] = [];
  for (const r of restitutions) {
    const isAmbiguSource = r.niveau === "N6" || r.style === "S-ANXIEUX";
    if (!isAmbiguSource) continue;
    for (const e of r.erreurs_revelees) {
      const key = e.concept_rate.trim().toLowerCase();
      if (!key || ambiguSeen.has(key)) continue;
      ambiguSeen.add(key);
      passages_ambigus.push({
        extrait: e.concept_rate,
        probleme: `Signalé par ${r.niveau}/${r.style} : ${e.cause_probable}`,
      });
    }
  }
  // Demo guarantee: surface the vague vigilance passage from the material.
  const flaws = detectFlaws(lesson);
  if (flaws.vagueVigilance && flaws.vagueExtract) {
    const key = flaws.vagueExtract.trim().toLowerCase();
    if (!ambiguSeen.has(key)) {
      ambiguSeen.add(key);
      passages_ambigus.push({
        extrait: flaws.vagueExtract,
        probleme:
          "Un risque est annoncé (effet de la fréquence de capitalisation) mais jamais explicité : le lecteur ne sait pas quoi vérifier.",
      });
    }
  }

  /* ---- ce_qui_fonctionne : validated by N5 ------------------------------- */
  const ce_qui_fonctionne: string[] = [];
  const fonctionneSeen = new Set<string>();
  for (const r of restitutions) {
    if (r.niveau !== "N5") continue;
    for (const p of r.points_surs) {
      const key = p.trim().toLowerCase();
      if (key && !fonctionneSeen.has(key)) {
        fonctionneSeen.add(key);
        ce_qui_fonctionne.push(p);
      }
    }
  }
  if (ce_qui_fonctionne.length === 0) {
    // Fallback: validate the lesson's opening structure generically.
    if (lesson.headings[0]) {
      ce_qui_fonctionne.push(`La section « ${lesson.headings[0]} » pose correctement le principe.`);
    }
    if (lesson.firstSentences[0]) {
      ce_qui_fonctionne.push(
        `L'accroche « ${lesson.firstSentences[0]} » situe bien l'enjeu et la motivation.`,
      );
    }
    if (ce_qui_fonctionne.length === 0) {
      ce_qui_fonctionne.push("La progression générale de la leçon est compréhensible.");
    }
  }

  /* ---- defauts_structurels : from N6 ------------------------------------- */
  const defauts_structurels: string[] = [];
  const defautSeen = new Set<string>();
  for (const r of restitutions) {
    if (r.niveau !== "N6") continue;
    for (const e of r.erreurs_revelees) {
      const sentence = `${e.concept_rate} — ${e.cause_probable}`;
      const key = sentence.toLowerCase();
      if (!defautSeen.has(key)) {
        defautSeen.add(key);
        defauts_structurels.push(sentence);
      }
    }
  }
  if (defauts_structurels.length === 0) {
    if (flaws.undefinedJargon) {
      defauts_structurels.push(
        `Le terme « ${flaws.undefinedJargon} » est employé comme clé de voûte mais jamais défini.`,
      );
    }
    if (flaws.impliedPercentPrereq) {
      defauts_structurels.push(
        "Contradiction interne : « multiplier par le taux » dans le texte vs formule en (1 + taux).",
      );
    }
    if (defauts_structurels.length === 0) {
      defauts_structurels.push("La leçon présente quelques ambiguïtés de rédaction à lever.");
    }
  }

  /* ---- priorites_de_reecriture : ordered, actionable --------------------- */
  const priorites_de_reecriture: string[] = [];
  // 1) Add explicit prerequisites.
  if (prerequis_manquants.length > 0) {
    priorites_de_reecriture.push(
      "Ajouter une section « Prérequis » explicite en tête : " +
        prerequis_manquants.map((p) => p.prerequis).join(" ; ") +
        ".",
    );
  } else {
    priorites_de_reecriture.push("Expliciter les prérequis supposés en tête de leçon.");
  }
  // 2) Define jargon.
  if (flaws.undefinedJargon) {
    priorites_de_reecriture.push(
      `Définir le terme « ${flaws.undefinedJargon} » dès sa première occurrence.`,
    );
  }
  // 3) Resolve the highest-gravity misunderstood concepts.
  for (const c of concepts_mal_compris.filter((c) => c.gravite === "elevee")) {
    priorites_de_reecriture.push(
      `Lever le malentendu fréquent sur « ${c.concept} » (raté par ${c.frequence} élèves).`,
    );
  }
  // 4) Disambiguate flagged passages.
  for (const p of passages_ambigus) {
    priorites_de_reecriture.push(`Désambiguïser le passage « ${p.extrait} ».`);
  }
  // 5) Fix structural defects, last.
  if (flaws.impliedPercentPrereq) {
    priorites_de_reecriture.push(
      "Réconcilier le texte et la formule : montrer le passage de 5 % au coefficient (1 + 0,05).",
    );
  }

  return {
    concepts_mal_compris,
    prerequis_manquants,
    passages_ambigus,
    ce_qui_fonctionne,
    defauts_structurels,
    priorites_de_reecriture,
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
  const prerequis_explicites: string[] = [];
  const prereqSeen = new Set<string>();
  for (const p of diagnosis.prerequis_manquants) {
    const key = p.prerequis.trim().toLowerCase();
    if (key && !prereqSeen.has(key)) {
      prereqSeen.add(key);
      prerequis_explicites.push(p.prerequis);
    }
  }
  if (prerequis_explicites.length === 0) {
    prerequis_explicites.push(
      flaws.impliedPercentPrereq
        ? "Savoir convertir un pourcentage en coefficient multiplicateur (5 % → 1 + 0,05 = 1,05)."
        : "Maîtriser les notions de base que la leçon suppose connues.",
    );
  }

  // Jargon definitions.
  const jargon = flaws.undefinedJargon;
  const jargonDef =
    jargon && jargon.toLowerCase() === "capitalisation"
      ? "**Capitalisation** : le fait d'ajouter les intérêts gagnés au capital, de sorte que la période suivante les intérêts sont calculés sur ce total augmenté."
      : jargon
        ? `**${jargon}** : terme clé de la leçon, désormais défini explicitement dès sa première occurrence.`
        : null;

  // Assemble the enriched markdown.
  const parts: string[] = [];
  parts.push(`# ${lesson.title}`);
  parts.push("");
  parts.push("## Prérequis");
  parts.push(
    "Avant de lire cette leçon, assurez-vous de maîtriser les acquis suivants (rendus explicites suite au diagnostic) :",
  );
  parts.push("");
  for (const p of prerequis_explicites) parts.push(`- ${p}`);
  parts.push("");

  if (jargonDef) {
    parts.push("## Définitions");
    parts.push(jargonDef);
    parts.push("");
  }

  // Preserve the original body, but annotate the flagged passages instead of
  // removing what works.
  parts.push("## Leçon (version enrichie)");
  parts.push("");
  let body = lessonMarkdown;
  // Drop the original top-level title line to avoid duplication.
  body = body.replace(/^#\s+.*(\r?\n)?/, "").trimStart();
  parts.push(body);
  parts.push("");

  // Address priorites_de_reecriture in order via clarifications.
  parts.push("## Clarifications ajoutées (suite au diagnostic)");
  parts.push("");
  if (diagnosis.priorites_de_reecriture.length === 0) {
    parts.push("- Reformulations mineures pour lever les ambiguïtés résiduelles.");
  } else {
    diagnosis.priorites_de_reecriture.forEach((prio, i) => {
      parts.push(`${i + 1}. ${prio}`);
    });
  }
  parts.push("");
  if (flaws.impliedPercentPrereq) {
    parts.push(
      "> Précision importante : « multiplier par le taux » est un raccourci trompeur. " +
        "Pour passer d'une année à la suivante on multiplie le capital par le **coefficient** " +
        "(1 + taux), soit 1,05 pour 5 %. C'est ce qui distingue les intérêts composés des intérêts simples.",
    );
    parts.push("");
  }
  if (flaws.vagueVigilance && flaws.vagueExtract) {
    parts.push(
      `> À propos du passage « ${flaws.vagueExtract} » : le point de vigilance concerne la ` +
        "**fréquence de capitalisation** (annuelle, mensuelle…). À taux nominal égal, une " +
        "capitalisation plus fréquente produit un rendement effectif plus élevé.",
    );
    parts.push("");
  }

  // Re-affirm what works — explicitly NOT removed.
  if (diagnosis.ce_qui_fonctionne.length > 0) {
    parts.push("## Ce qui fonctionnait déjà (conservé)");
    for (const ok of diagnosis.ce_qui_fonctionne) parts.push(`- ${ok}`);
    parts.push("");
  }

  const markdown = parts.join("\n").trimEnd() + "\n";

  // resume_des_changements, in the order priorities were treated.
  const resume_des_changements: string[] = [];
  resume_des_changements.push(
    "Ajout d'une section « Prérequis » explicite en tête de leçon : " +
      prerequis_explicites.join(" ; ") +
      ".",
  );
  if (jargonDef) {
    resume_des_changements.push(`Définition explicite du terme « ${jargon}» en début de leçon.`);
  }
  diagnosis.priorites_de_reecriture.forEach((prio) => {
    resume_des_changements.push(`Traitement de la priorité : ${prio}`);
  });
  if (flaws.impliedPercentPrereq) {
    resume_des_changements.push(
      "Réconciliation du texte et de la formule via le coefficient (1 + taux).",
    );
  }
  if (flaws.vagueVigilance) {
    resume_des_changements.push("Explicitation du point de vigilance (fréquence de capitalisation).");
  }
  resume_des_changements.push(
    "Conservation intégrale des passages validés (ce_qui_fonctionne non modifié).",
  );

  return {
    title: lesson.title,
    markdown,
    resume_des_changements,
    prerequis_explicites,
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
      ? "leçon"
      : target === "evaluations"
        ? "item d'évaluation"
        : target === "exercices"
          ? "corrigé d'exercice"
          : "fiche de révision";

  const claims: FactCheckClaim[] = [];

  // Claim 1: the formula (correct if present).
  if (/\(1\s*\+|valeur finale|capital\s*[×x*]/.test(lesson.lower)) {
    claims.push({
      affirmation: "valeur finale = capital × (1 + taux) ^ nombre de périodes",
      verdict: "correct",
      explication:
        "La formule de capitalisation composée est exacte : le capital croît géométriquement avec le coefficient (1 + taux).",
      source_emplacement: `${where} : section formule`,
    });
  }

  // Claim 2: the "multiplier par le taux" shortcut (douteux — misleading).
  if (flaws.impliedPercentPrereq && flaws.oversimplifyExtract) {
    claims.push({
      affirmation: flaws.oversimplifyExtract,
      verdict: "douteux",
      explication:
        "Formulation trompeuse : « multiplier par le taux » (0,05) donnerait les intérêts seuls, " +
        "pas le nouveau capital. Le passage d'une année à l'autre se fait en multipliant par (1 + taux).",
      correction_suggeree:
        "Remplacer par : « on multiplie le capital par le coefficient (1 + taux), soit 1,05 pour 5 % ».",
      source_emplacement: `${where} : section principe / exemple`,
    });
  }

  // Claim 3: the vague vigilance passage (douteux — imprecise, not false).
  if (flaws.vagueVigilance && flaws.vagueExtract) {
    claims.push({
      affirmation: flaws.vagueExtract,
      verdict: "douteux",
      explication:
        "Affirmation correcte mais trop imprécise pour être vérifiable : elle annonce un risque " +
        "(la fréquence de capitalisation modifie le rendement) sans le nommer ni le quantifier.",
      correction_suggeree:
        "Préciser que c'est la fréquence de capitalisation qui change le rendement effectif à taux nominal égal.",
      source_emplacement: `${where} : point de vigilance`,
    });
  }

  // Always include at least one "correct" anchor claim so the report is useful.
  if (claims.length === 0) {
    claims.push({
      affirmation: `Le sujet traité est « ${lesson.title} ».`,
      verdict: "correct",
      explication: "Le contenu vérifié correspond bien au sujet annoncé.",
      source_emplacement: `${where} : titre`,
    });
  }

  // bloquant only if any verdict is "incorrect" (none here by construction).
  const bloquant = claims.some((c) => c.verdict === "incorrect");

  const nbDouteux = claims.filter((c) => c.verdict === "douteux").length;
  const synthese = bloquant
    ? `Vérification de la ${where} : au moins une affirmation est incorrecte — correction bloquante requise avant diffusion.`
    : nbDouteux > 0
      ? `Vérification de la ${where} : aucune erreur factuelle bloquante, mais ${nbDouteux} formulation(s) ` +
        "imprécise(s) à clarifier (notamment le raccourci sur le taux et le point de vigilance)."
      : `Vérification de la ${where} : aucune erreur factuelle détectée, contenu exact.`;

  return { cible: target, claims, bloquant, synthese };
}

/* ========================================================================== */
/*  EVALUATIONS branch                                                         */
/* ========================================================================== */

/** Ordered list of the most-missed concepts from the diagnosis. */
function mostMissedConcepts(diagnosis: TeacherDiagnosis): string[] {
  return diagnosis.concepts_mal_compris
    .slice()
    .sort((a, b) => b.frequence - a.frequence || a.concept.localeCompare(b.concept))
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

  const debutant: Evaluation = {
    niveau: "debutant",
    items: [
      {
        type: "qcm",
        enonce: `Que désigne le terme « ${jargon} » dans la leçon « ${lesson.title} » ?`,
        options: [
          "Le fait d'ajouter les intérêts au capital, qui produit alors lui-même des intérêts.",
          "Le retrait des intérêts à chaque période.",
          "Un impôt prélevé sur l'épargne.",
          "Le nom de la banque qui gère le placement.",
        ],
        corrige:
          "Réponse : le fait d'ajouter les intérêts au capital (capitalisation). Item de reconnaissance ciblant le jargon non défini.",
        concept_cible: jargon,
      },
      {
        type: "vrai_faux",
        enonce: "Avec des intérêts composés, le gain de chaque année est toujours identique.",
        corrige:
          "Faux : le gain augmente d'année en année car les intérêts produisent à leur tour des intérêts.",
        concept_cible: c1,
      },
      {
        type: "ouverte",
        enonce: `Reformulez avec vos propres mots l'idée principale de « ${concept} ».`,
        corrige:
          "Réponse attendue : les intérêts s'ajoutent au capital et produisent eux-mêmes des intérêts à la période suivante.",
        concept_cible: concept,
      },
    ],
  };

  const intermediaire: Evaluation = {
    niveau: "intermediaire",
    items: [
      {
        type: "ouverte",
        enonce:
          "On place 1 000 € à 5 %. Calculez le capital au bout de 2 ans en justifiant le coefficient utilisé.",
        corrige:
          "1000 × 1,05 = 1050 puis 1050 × 1,05 = 1102,50 €. Le coefficient est (1 + 0,05) = 1,05, et non 0,05.",
        concept_cible: c0,
      },
      {
        type: "qcm",
        enonce: "Pour passer d'une année à la suivante, par quoi multiplie-t-on le capital ?",
        options: ["par 0,05", "par 1,05", "par 5", "par 105"],
        corrige: "Réponse : par 1,05 (le coefficient 1 + taux). Multiplier par 0,05 ne donne que les intérêts.",
        concept_cible: "coefficient multiplicateur (1 + taux)",
      },
      {
        type: "vrai_faux",
        enonce: "Sur une longue durée, l'écart entre intérêts simples et composés reste négligeable.",
        corrige: "Faux : l'écart devient considérable car la croissance composée est géométrique.",
        concept_cible: c1,
      },
    ],
  };

  const avance: Evaluation = {
    niveau: "avance",
    items: [
      {
        type: "ouverte",
        enonce:
          "À taux nominal de 5 %, expliquez pourquoi une capitalisation mensuelle rapporte plus qu'une capitalisation annuelle (cas limite / transfert).",
        corrige:
          "La fréquence de capitalisation augmente le rendement effectif : (1 + 0,05/12)^12 > 1,05. C'est le point de vigilance que la leçon laissait implicite.",
        concept_cible: flaws.vagueExtract ?? "fréquence de capitalisation",
      },
      {
        type: "qcm",
        enonce:
          "Un placement double-t-il plus vite à 5 % composé ou à 5 % simple, et pourquoi ?",
        options: [
          "Composé, car la croissance est géométrique.",
          "Simple, car le gain est constant.",
          "Identique dans les deux cas.",
          "Impossible à déterminer.",
        ],
        corrige:
          "Réponse : composé — la croissance géométrique l'emporte sur la croissance linéaire des intérêts simples.",
        concept_cible: c1,
      },
      {
        type: "ouverte",
        enonce:
          "Critiquez la phrase « il suffit de multiplier par le taux » : est-elle exacte ? Reformulez-la rigoureusement.",
        corrige:
          "Inexacte : multiplier par le taux (0,05) donne les intérêts, pas le nouveau capital. Il faut multiplier par (1 + taux).",
        concept_cible: c0,
      },
    ],
  };

  return { debutant, intermediaire, avance };
}

/* ========================================================================== */
/*  EXERCICES branch                                                           */
/* ========================================================================== */

function produceExercices(
  brief: Extract<MockBrief, { role: "exercices" }>,
): ExerciceSet {
  const { lessonMarkdown, lessonTitle, diagnosis } = brief;
  const lesson = analyzeLesson(lessonMarkdown, lessonTitle);
  const flaws = detectFlaws(lesson);
  const concept = coreNotion(lesson);
  const missed = mostMissedConcepts(diagnosis);
  const c0 = missed[0] ?? primaryConcept(lesson);

  const exercices: Exercice[] = [
    {
      titre: "Repérer l'erreur de raisonnement",
      format: "reperage_erreur",
      enonce:
        "Un élève écrit : « Pour 1 000 € à 5 %, je multiplie par 0,05 chaque année, donc je gagne 50 € par an, toujours pareil. » " +
        "Identifiez et corrigez l'erreur.",
      corrige:
        "Erreur (contresens N2) : multiplier par 0,05 ne donne que les intérêts d'une année, et le modèle décrit en réalité des intérêts SIMPLES. " +
        "Pour des intérêts composés, on multiplie le capital par (1 + 0,05) = 1,05, et le gain augmente chaque année.",
      concept_cible: flaws.impliedPercentPrereq
        ? "coefficient multiplicateur (1 + taux)"
        : c0,
      niveau_indicatif: "intermediaire",
    },
    {
      titre: `Mise en situation : « ${concept} » dans la vraie vie`,
      format: "mise_en_situation",
      enonce:
        "Vous placez 2 000 € à 4 % par an pendant 3 ans, intérêts composés. Estimez puis calculez la valeur finale.",
      corrige:
        "2000 × 1,04^3 ≈ 2000 × 1,1249 = 2249,73 €. On applique le coefficient (1 + taux) trois fois.",
      concept_cible: concept,
      niveau_indicatif: "intermediaire",
    },
    {
      titre: "Mini-défi : composé vs simple",
      format: "mini_defi",
      enonce:
        "Sans calculatrice, dites lequel rapporte le plus sur 10 ans : 1 000 € à 5 % simple ou à 5 % composé ? Justifiez en une phrase.",
      corrige:
        "Le composé : chaque année les intérêts produisent eux-mêmes des intérêts, la croissance est géométrique et dépasse la croissance linéaire du simple.",
      concept_cible: missed[1] ?? "différence intérêts simples / composés",
      niveau_indicatif: "debutant",
    },
    {
      titre: "Application progressive : de l'année 1 à l'année n",
      format: "application_progressive",
      enonce:
        "Étape 1 : calculez le capital après 1 an (1 000 € à 5 %). Étape 2 : après 2 ans. Étape 3 : écrivez la formule générale après n années.",
      corrige:
        "Étape 1 : 1000 × 1,05 = 1050. Étape 2 : 1050 × 1,05 = 1102,50. Étape 3 : 1000 × 1,05^n. On voit apparaître l'exposant n.",
      concept_cible: "formule de capitalisation composée",
      niveau_indicatif: "avance",
    },
  ];

  // If the lesson surfaced a vague vigilance passage, add a transfer exercise.
  if (flaws.vagueVigilance && flaws.vagueExtract) {
    exercices.push({
      titre: "Cas limite : la fréquence de capitalisation",
      format: "mise_en_situation",
      enonce:
        "Deux livrets affichent 5 % : l'un capitalise annuellement, l'autre mensuellement. Lequel choisir et pourquoi ?",
      corrige:
        "Le mensuel : à taux nominal égal, capitaliser plus souvent augmente le rendement effectif — (1 + 0,05/12)^12 > 1,05. C'est le point de vigilance que la leçon laissait flou.",
      concept_cible: flaws.vagueExtract,
      niveau_indicatif: "avance",
    });
  }

  return { exercices };
}

/* ========================================================================== */
/*  FICHE branch                                                               */
/* ========================================================================== */

function produceFiche(
  brief: Extract<MockBrief, { role: "fiche" }>,
): FicheRevision {
  const { lessonMarkdown, lessonTitle, diagnosis } = brief;
  const lesson = analyzeLesson(lessonMarkdown, lessonTitle);
  const flaws = detectFlaws(lesson);
  const concept = coreNotion(lesson);

  // Prérequis FIRST/explicit — from diagnosis, with a generic fallback.
  const prerequis: string[] = [];
  const prereqSeen = new Set<string>();
  for (const p of diagnosis.prerequis_manquants) {
    const key = p.prerequis.trim().toLowerCase();
    if (key && !prereqSeen.has(key)) {
      prereqSeen.add(key);
      prerequis.push(p.prerequis);
    }
  }
  if (prerequis.length === 0) {
    prerequis.push(
      flaws.impliedPercentPrereq
        ? "Convertir un pourcentage en coefficient : 5 % → 1 + 0,05 = 1,05."
        : "Maîtriser les notions de base supposées par la leçon.",
    );
  }

  // points_cles — drawn from headings + the core mechanism.
  const points_cles: string[] = [];
  if (flaws.impliedPercentPrereq) {
    points_cles.push("On passe d'une période à l'autre en multipliant par le coefficient (1 + taux), pas par le taux.");
  }
  points_cles.push("Les intérêts s'ajoutent au capital et produisent eux-mêmes des intérêts (effet boule de neige).");
  points_cles.push("Formule générale : valeur finale = capital × (1 + taux) ^ nombre de périodes.");
  for (const h of lesson.headings) {
    if (!/retenir|point de vigilance|attention/i.test(h)) {
      points_cles.push(`Voir la section « ${h} ».`);
    }
    if (points_cles.length >= 6) break;
  }

  // definitions — define the jargon and the coefficient.
  const definitions: { terme: string; def: string }[] = [];
  const jargon = flaws.undefinedJargon;
  if (jargon && jargon.toLowerCase() === "capitalisation") {
    definitions.push({
      terme: "Capitalisation",
      def: "Ajout des intérêts gagnés au capital, de sorte que la période suivante les intérêts portent sur ce total augmenté.",
    });
  } else if (jargon) {
    definitions.push({
      terme: jargon,
      def: `Terme clé de la leçon « ${lesson.title} », ici défini explicitement.`,
    });
  }
  definitions.push({
    terme: "Coefficient multiplicateur",
    def: "Le facteur (1 + taux) par lequel on multiplie le capital à chaque période (1,05 pour 5 %).",
  });
  definitions.push({
    terme: "Intérêts composés",
    def: "Intérêts calculés à chaque période sur le capital augmenté des intérêts précédents, par opposition aux intérêts simples.",
  });

  // pieges_frequents — from diagnosis concepts + erreurs flavour.
  const pieges_frequents: string[] = [];
  const piegeSeen = new Set<string>();
  for (const c of mostMissedConcepts(diagnosis)) {
    const key = c.toLowerCase();
    if (!piegeSeen.has(key)) {
      piegeSeen.add(key);
      pieges_frequents.push(`Mal compris fréquemment : « ${c} ».`);
    }
    if (pieges_frequents.length >= 5) break;
  }
  if (flaws.impliedPercentPrereq) {
    pieges_frequents.push("Piège : multiplier par 0,05 (le taux) au lieu de 1,05 (le coefficient) — confond composé et simple.");
  }
  if (flaws.vagueVigilance) {
    pieges_frequents.push("Piège : ignorer la fréquence de capitalisation, qui change le rendement effectif à taux égal.");
  }
  if (pieges_frequents.length === 0) {
    pieges_frequents.push(`Vérifiez votre compréhension des points clés de « ${concept} ».`);
  }

  return {
    titre: `Fiche de révision — ${lesson.title}`,
    prerequis,
    points_cles,
    definitions,
    pieges_frequents,
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
    case "exercices":
      return produceExercices(brief);
    case "fiche":
      return produceFiche(brief);
    default: {
      // Exhaustiveness guard — every role is handled above.
      const _never: never = brief;
      return _never;
    }
  }
}

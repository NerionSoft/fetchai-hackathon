# Koro ClassroomSim — Agentic Lesson Diagnosis & Pedagogical Content Generator

Koro ClassroomSim is an AI teaching assistant and EdTech agent for education professionals that turns any raw lesson into a complete, classroom-ready pedagogical dossier. Send it a lesson written in Markdown and it runs a **multi-agent simulation**: 15 to 18 simulated student-agents — spanning varied mastery levels and cognitive learning styles — attempt to restitute (re-explain) your lesson, surfacing exactly where understanding breaks down. Teacher-agents then diagnose student misconceptions, detect missing prerequisites, flag ambiguous passages, rewrite and improve the lesson, fact-check every claim, and generate multi-level evaluations (quizzes with answer keys), engaging exercises, and a revision sheet. It is a full lesson-planning, curriculum-design, misconception-detection, quiz-generation and exercise-generation pipeline for teachers, tutors, instructional designers, and course creators. It reads and produces content in **French** (French education / éducation, pédagogie) as well as English.

## What it does

- **Simulates a diverse virtual classroom** — 15-18 student-agents mixing mastery levels (novice to expert) and learning styles (literal, analogical, sequential, impatient, anxious, missing-context) to stress-test whether a lesson actually teaches.
- **Diagnoses learning gaps** — aggregates the simulated restitutions into a structured diagnosis: misunderstood concepts (with severity and frequency), missing prerequisites, ambiguous passages, structural flaws, and what already works well.
- **Rewrites and improves the lesson** — produces an enriched version that makes hidden prerequisites explicit, defines undefined jargon, and resolves ambiguity, ordered by diagnostic priority.
- **Fact-checks the content** — verifies claims in both the rewritten lesson and the generated materials, flagging incorrect statements (a wrong answer key is treated as blocking).
- **Generates multi-level evaluations / quizzes** — three tiers (beginner / intermediate / advanced) of QCM (multiple choice), open questions, and true/false items, each with an answer key (corrigé) and the target concept it assesses.
- **Generates exercises** — situational challenges, mini-challenges, error-spotting, and progressive-application tasks with worked corrections.
- **Builds a revision sheet (fiche de révision)** — prerequisites up front, key points, definitions, and common pitfalls drawn from the observed student errors.
- **Returns everything as a single Markdown dossier** — ready to read, print, or paste into your course materials.

## How to use

Simply send your lesson content as Markdown text in the ASI:One chat. The agent runs the full simulation and returns a complete pedagogical dossier as Markdown. No setup, no upload — paste the lesson and go.

Example natural-language queries a teacher might send:

- "Here is my lesson on compound interest — find what students will misunderstand and rewrite it, then give me quizzes and exercises."
- "Diagnose the weak points in this Markdown lesson and generate a beginner / intermediate / advanced evaluation with answer keys."
- "Voici ma leçon de SVT en français : détecte les prérequis manquants, corrige le jargon, et produis une fiche de révision et des exercices."

## Input

A single lesson written in **Markdown**, starting with a `# Title` heading followed by the lesson body (sections, definitions, examples). Content may be in French or English. No other configuration is required — the lesson text is the only input.

## Output

A complete **pedagogical dossier (dossier pédagogique)** in Markdown, containing:

- **Rewritten lesson** — the improved, prerequisite-explicit version.
- **Diagnosis** — misunderstood concepts (severity + frequency), missing prerequisites, ambiguous passages, what works, and ordered rewrite priorities.
- **Evaluations by level** — beginner, intermediate, and advanced quizzes (QCM / open / true-false) each with its answer key (corrigé).
- **Exercises** — engaging, concept-targeted tasks with worked corrections.
- **Revision sheet** — prerequisites, key points, definitions, and common pitfalls.

Answer keys (corrigés) are clearly delimited so a teacher can share the questions alone or the full corrected version.

## Domain / keywords

education, edtech, e-learning, pedagogy, teaching assistant, lesson planning, lesson diagnosis, misconception detection, prerequisite detection, quiz generation, evaluation generation, exercise generation, revision sheet, curriculum design, instructional design, course creation, fact-checking, multi-agent simulation, student modeling, learning styles, formative assessment, answer keys, French education, éducation, pédagogie, fiche de révision, teacher tools, tutoring

## Powered by

Built on the **Mastra** agentic runtime (typed multi-agent workflow: simulate → diagnose → rewrite → fact-check → produce) and exposed through the **Fetch.ai uAgents chat protocol**, making it discoverable and callable on **Agentverse** and searchable via **ASI:One**.

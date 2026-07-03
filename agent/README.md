# Koro ClassroomSim — Agentic Lesson Diagnosis & Pedagogical Content Generator

Koro ClassroomSim is an AI teaching assistant and EdTech agent for education professionals that turns any raw lesson into a complete, classroom-ready pedagogical dossier. Send it a lesson written in Markdown and it runs a **multi-agent simulation**: 15 to 18 simulated student-agents — spanning varied mastery levels and cognitive learning styles — attempt to restitute (re-explain) your lesson, surfacing exactly where understanding breaks down. Teacher-agents then diagnose student misconceptions, detect missing prerequisites, flag ambiguous passages, rewrite and improve the lesson, fact-check every claim, and generate multi-level evaluations (quizzes with answer keys), engaging exercises, and a revision sheet.

## What it does
- **Simulates a diverse virtual classroom** — 15-18 student-agents mixing mastery levels and learning styles to stress-test whether a lesson actually teaches.
- **Diagnoses learning gaps** — misunderstood concepts (severity + frequency), missing prerequisites, ambiguous passages, and what already works.
- **Rewrites and improves the lesson** — makes hidden prerequisites explicit, defines jargon, resolves ambiguity.
- **Fact-checks the content** — verifies claims in the lesson and generated materials (a wrong answer key is blocking).
- **Generates multi-level quizzes** — beginner / intermediate / advanced (QCM, open, true/false), each with answer key.
- **Generates exercises** and a **revision sheet** (prerequisites, key points, definitions, common pitfalls).
- **Returns a single Markdown dossier** — ready to read, print, or paste into course materials.

## How to use
Paste your lesson content as Markdown in the ASI:One chat. The agent runs the full simulation and returns a complete pedagogical dossier. It reads lessons written in any language and responds in English.

Example queries:
- "Here is my lesson on compound interest — find what students will misunderstand, rewrite it, then give me quizzes and exercises."
- "Take my biology lesson: detect the missing prerequisites, fix the jargon, and produce a revision sheet and exercises."

## Input / Output
**Input:** a lesson in Markdown (starting with `# Title`).
**Output:** a Markdown pedagogical dossier — rewritten lesson, diagnosis, evaluations by level (with answer keys), exercises, and a revision sheet.

## Domain / keywords
education, edtech, pedagogy, teaching assistant, lesson planning, lesson diagnosis, misconception detection, quiz generation, exercise generation, revision sheet, curriculum design, instructional design, fact-checking, multi-agent simulation, learning styles, formative assessment, teacher tools, tutoring

## Powered by
Built on the **Mastra** agentic runtime (simulate → diagnose → rewrite → fact-check → produce) and exposed through the **Fetch.ai uAgents chat protocol**, discoverable on **Agentverse** and searchable via **ASI:One**.

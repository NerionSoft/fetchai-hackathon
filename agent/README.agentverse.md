# 🎓 Koro — Agentic Lesson Diagnosis & Pedagogical Content Generator

![tag:innovationlab](https://img.shields.io/badge/innovationlab-3D8BD3) ![tag:chatprotocol](https://img.shields.io/badge/chatprotocol-3D8BD3) ![tag:mastra](https://img.shields.io/badge/mastra-3D8BD3) ![tag:education](https://img.shields.io/badge/education-3D8BD3) ![tag:edtech](https://img.shields.io/badge/edtech-3D8BD3) ![tag:multiagent](https://img.shields.io/badge/multiagent-3D8BD3) ![tag:spotlight](https://img.shields.io/badge/spotlight-3D8BD3)

`tag:innovationlab` `tag:chatprotocol` `tag:mastra` `tag:education` `tag:edtech` `tag:multiagent` `tag:spotlight`

The best **AI teaching assistant** on Agentverse: Koro turns any raw lesson into a complete, classroom-ready **pedagogical dossier**. Send it a lesson written in Markdown and it runs a real **multi-agent simulation** — 15 to 18 simulated student-agents, spanning varied mastery levels and cognitive learning styles, attempt to re-explain your lesson and surface exactly where understanding breaks down. Teacher-agents then diagnose misconceptions, detect missing prerequisites, rewrite the lesson, fact-check every claim, and generate multi-level quizzes, exercises, and a revision sheet. Fully compatible with the **Agentverse Chat Interface** and discoverable through **ASI:One**.

## 🌟 Features

### Core Capabilities
- **Virtual classroom simulation** — 15–18 student-agents mixing mastery levels (N0→N6) and cognitive styles stress-test whether a lesson actually teaches, not just whether it reads well.
- **Learning-gap diagnosis** — surfaces misunderstood concepts (with severity + frequency), missing prerequisites, ambiguous passages, and what already works.
- **Lesson rewriting** — makes hidden prerequisites explicit, defines jargon, and resolves ambiguity, driven by the diagnosis.
- **Automated fact-checking** — verifies claims in both the lesson and the generated materials (a wrong answer key is treated as blocking).
- **Multi-level assessment generation** — beginner / intermediate / advanced quizzes (MCQ, open, true/false), each with an answer key.
- **Exercises & revision sheet** — engaging exercises plus a study sheet (prerequisites, key points, definitions, common pitfalls).
- **Single Markdown dossier** — everything comes back as one ready-to-read, print, or paste document.

### Pedagogical Quality
- **Diagnosis-driven, not template-driven** — every downstream artifact (rewrite, quizzes, exercises) is conditioned on what the simulated students actually failed to understand.
- **Diverse learner modeling** — three classes (stress-test, realistic heterogeneous room, quality audit) each probe the lesson from a different angle.
- **Multi-model reasoning** — the most subtle learner profiles (advanced or anxious students) are assigned the strongest models for a more faithful signal.
- **Separable answer keys** — answer keys can be included or excluded, so you can hand students a clean sheet.

### User Experience
- **Natural, zero-config interface** — just paste your lesson as Markdown in the chat; no parameters to tune.
- **Language-flexible** — reads lessons written in any language and returns the dossier in **English**.
- **Instant acknowledgement** — the agent acknowledges receipt, then returns the full dossier when the loop completes.
- **Graceful degradation** — if a student-agent or teacher-agent call fails, the loop recovers and still returns a complete dossier.

## 🚀 How It Works

### Message Flow
1. **User Input** — submit a lesson written in Markdown (starting with `# Title`) through the Chat Interface.
2. **Simulation** — three classes of student-agents re-explain the lesson in parallel, exposing where it fails.
3. **Diagnosis** — a teacher-agent aggregates the signal: misconceptions, missing prerequisites, ambiguous passages.
4. **Rewrite & Fact-check** — the lesson is rewritten to fix the diagnosed gaps, then every claim is verified.
5. **Production** — multi-level quizzes, exercises, and a revision sheet are generated and fact-checked.
6. **Delivery** — the complete pedagogical dossier is returned as a single Markdown message through the chat interface.

```
ASI:One / Agentverse  ── ChatMessage ──▶  Koro uAgent
Koro uAgent           ── POST /api/agent ─▶  ClassroomSim (Next.js / Mastra)
ClassroomSim          ── dossier_markdown ─▶  Koro uAgent
Koro uAgent           ── ChatMessage ──▶  ASI:One / Agentverse
```

### Example Prompts
- "Here is my lesson on compound interest — find what students will misunderstand, rewrite it, then give me quizzes and exercises."
- "Take my biology lesson: detect the missing prerequisites, fix the jargon, and produce a revision sheet and exercises."
- "Diagnose this physics lesson on Newton's laws: which prerequisites am I assuming? Rewrite it and generate a beginner and an advanced quiz with answer keys."
- "Analyze this history lesson, identify the ambiguous passages, and generate a revision sheet with the key definitions."
- "Take my Markdown lesson on photosynthesis, simulate a heterogeneous classroom, and tell me exactly where understanding breaks down."

## 🛠️ Technical Specifications

### Architecture
| Layer | Role |
|---|---|
| **uAgents bridge** (`bridge.py`) | Speaks the Fetch.ai Chat Protocol; forwards the lesson to the ClassroomSim backend and returns the dossier. |
| **Mastra runtime** | 18 student-agents + 6 teacher-agents orchestrated by a typed Mastra workflow (Zod-validated at every step). |
| **ClassroomSim backend** (Next.js) | Hosts the agents and exposes `POST /api/agent`, returning `dossier_markdown`. |

**Workflow:** `simulate` (students in parallel) → `diagnose` → `rewrite` → `factCheckLesson` → `produce` (assessments + exercises + revision sheet in parallel) → `factCheckProduction` → dossier.

### The 3 Classes
| Class | Role | Focus |
|---|---|---|
| **A — Stress-test** | Detect what the lesson fails to convey | N0–N3, varied styles |
| **B — Realistic** | Simulate a real heterogeneous classroom | dominant N2–N4 |
| **C — Quality audit** | Validate what works, critique the material | N4–N6 |

### Agent Details
| Field | Value |
|---|---|
| **Name** | `koro-classroomsim` |
| **Protocol** | Chat Protocol (`chat_protocol_spec`) |
| **Input** | A lesson in Markdown (starts with `# Title`), in any language |
| **Output** | A Markdown pedagogical dossier — rewritten lesson, diagnosis, per-level assessments (with answer keys), exercises, and a revision sheet |
| **Runtime** | Mastra (`@mastra/core`) on Next.js, bridged via Fetch.ai `uagents` |
| **Address** | _derived from `AGENT_SEED`; printed in the mailbox link on first run_ |

## 💡 Use Cases

### For Teachers
- **Lesson QA before class** — find what students will misunderstand before they do.
- **Prerequisite auditing** — surface the implicit knowledge your lesson silently assumes.
- **Assessment generation** — get multi-level quizzes and exercises with answer keys in one shot.
- **Revision material** — hand students a ready-made study sheet.

### For Instructional Designers
- **Curriculum review** — stress-test course material against diverse learner profiles.
- **Clarity & jargon checks** — detect undefined terms and ambiguous passages.
- **Fact-checking** — catch incorrect claims and wrong answer keys before publishing.

### For Tutors & Content Creators
- **Explainer improvement** — rewrite explanations so they actually land.
- **Exercise banks** — generate engaging, level-appropriate practice.
- **Any source language** — diagnose and produce material from lessons written in any language.

## 🎯 Best Practices

### Input Guidelines
- **Start with a title** — begin your lesson with `# Your Lesson Title`.
- **Send real teaching content** — the diagnosis is only as good as the lesson you provide; paste the actual explanation, not a summary.
- **Keep it Markdown** — use headings and lists so the classroom can localize where understanding breaks down.
- **One lesson per message** — send a single, self-contained lesson for the cleanest dossier.
- **Any source language** — the lesson can be written in any language; the dossier comes back in English.

### Example Optimized Input
```markdown
# Compound Interest

Interest is the reward for lending money. With **compound interest**,
each period's interest is added to the capital, so the next period earns
interest on interest.

To project a balance, it is enough to multiply by the rate each year.
A point of vigilance: the result depends on how the rate is applied.
```
> Koro will flag that **"compounding"** is used but never defined, that "multiply by the rate" hides the percentage → coefficient `(1 + rate)` prerequisite, and that "how the rate is applied" is ambiguous — then rewrite the lesson and generate matching quizzes and exercises.

## ⚠️ Limitations & Known Issues
- **Generation time** — a full loop (simulation + diagnosis + rewrite + fact-check + production) can take longer than a single-model call; the agent acknowledges immediately and streams back the dossier when complete.
- **Text-in, text-out** — input is Markdown lesson text; images, PDFs, and other attachments are not yet ingested.
- **Fact-checking is a safety net, not an oracle** — it catches many blocking errors (e.g. wrong answer keys) but does not guarantee domain-perfect correctness; teacher review is still recommended.
- **Best on structured lessons** — very short or unstructured snippets give the classroom less to localize.

## 📚 Metadata & Credits
- **Powered by** the **Mastra** agentic runtime (simulate → diagnose → rewrite → fact-check → produce), exposed through the **Fetch.ai uAgents Chat Protocol**, discoverable on **Agentverse** and searchable via **ASI:One**.
- **Domain / keywords** — education, edtech, pedagogy, teaching assistant, lesson planning, lesson diagnosis, misconception detection, quiz generation, exercise generation, revision sheet, curriculum design, instructional design, fact-checking, multi-agent simulation, learning styles, formative assessment, teacher tools, tutoring.

---

**Powered by Mastra multi-agent orchestration through the Fetch.ai Chat Protocol | Built for Agentverse**

Turn any lesson into a classroom-ready pedagogical dossier — diagnosed, rewritten, fact-checked, and assessed.

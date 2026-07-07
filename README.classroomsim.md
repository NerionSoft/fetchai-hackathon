# ClassroomSim

An autonomous **pedagogical improvement loop**, built with **Mastra** (TypeScript agentic framework) on **Next.js 16 (App Router)**.

A teacher submits a lesson. Multi-model **classes of student-agents** re-explain it, a **diagnostician teacher-agent** aggregates the signal, a **writer teacher-agent** rewrites the lesson, a **fact-checker** validates it, and then agents produce **assessments, exercises, and revision sheets** — all **driven by the diagnosis** and visible **live** (token-by-token streaming) in an **SVG** scene.

> This is not an API-call wrapper: these are real Mastra agents (roles, system prompts, memory) orchestrated by a Zod-typed application use case (hexagonal ports & adapters).

---

## Quick start (zero API key)

By default, ClassroomSim runs on a **deterministic mock provider**: the full loop (18 student-agents + teacher agents + live SVG + exportable materials) works **without any API key** and without a database.

```bash
pnpm install
pnpm dev
# → http://localhost:3000
```

1. Click **"Load demo lesson"** (the "Compound Interest" lesson, with deliberate flaws).
2. Click **"Run the loop"**.
3. Watch the 3 classes re-explain live, then see the diagnosis, rewrite, fact-check, and materials appear. The full loop takes ~8s in mock mode.
4. Download the materials via the **export** buttons.

`pnpm build` is not required for the demo. (Note: the starter includes a sample hexagonal API, `src/app/api/example-hexagone`, which depends on `DATABASE_URL`; it is not used by ClassroomSim and is only compiled on demand in dev.)

---

## Modes & environment variables

See `.env.example`. ClassroomSim **does not need** `DATABASE_URL` or `BETTER_AUTH_SECRET` (the starter's auth is disabled).

| Variable | Default | Role |
|---|---|---|
| `MASTRA_DB_URL` | `file:./mastra.db` | Mastra storage (SQLite via LibSQL, on disk, serverless) |
| `DEV_SINGLE_PROVIDER` | _(unset)_ | Forces **all** students onto a single provider: `anthropic`\|`openai`\|`google`\|`deepseek` |
| `DEMO_MODE` | `false` | Enables **multi-provider** mode (each student on their preferred provider) |
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `GOOGLE_GENERATIVE_AI_API_KEY` / `DEEPSEEK_API_KEY` | _(unset)_ | Real keys (only needed for the modes above) |
| `OPENAI_MODEL` (and `_STRONG`) | `gpt-5.4-mini` | OpenAI model (the `openai/` prefix is added automatically) |
| `ANTHROPIC_MODEL` / `GOOGLE_MODEL` / `DEEPSEEK_MODEL` (+ `_STRONG`) | built-in defaults | Per-provider model override |
| `CLASSROOM_CONCURRENCY` | `6` | Concurrent student calls (bounds actual fan-out) |
| `MOCK_TOKEN_DELAY_MS` | `5` | Mock streaming pace (0 = instant) |

Default models: OpenAI = `gpt-5.4-mini`, Anthropic = `claude-sonnet-4.6`, Google = `gemini-2.5-flash`, DeepSeek = `deepseek-v3.2` ("strong" tier for subtle N5/N6/anxious profiles). Pin a different one via `<PROVIDER>_MODEL`.

**Mode selection** (in priority order):

1. `DEV_SINGLE_PROVIDER=<p>` set → **single** mode (all students on `<p>`).
2. otherwise `DEMO_MODE=true` **and** at least one key present → **demo** mode (4 real providers).
3. otherwise → **mock** mode (deterministic, no key needed). *This is the safe default for budget.*

Example — **OpenAI only, with `gpt-5.4-mini`** (default OpenAI model):

```bash
# .env
DEV_SINGLE_PROVIDER=openai
OPENAI_API_KEY=sk-...
# (gpt-5.4-mini is already the default; for a different model: OPENAI_MODEL=gpt-4o-mini)
```

---

## The 3 classes

15-18 students per loop, each student = **mastery level** (N0→N6) × **cognitive style** (S-*) × **provider**.

| Class | Role | Focus |
|---|---|---|
| **A — Stress test** | Detect what the lesson fails to convey | N0–N3, varied styles |
| **B — Realistic** | Simulate a real, heterogeneous classroom | mostly N2–N4 |
| **C — Quality audit** | N5 validates what works, N6 critiques the material | N4–N6 |

Subtle profiles (N5, N6, S-ANXIOUS) get the best models; coarse profiles tolerate weaker models. (See `domain/profiles/roster.ts` and `domain/profiles/cognitive-profiles.ts`.)

---

## Architecture

ClassroomSim is a self-contained **hexagone** (bounded context) following the
starter's ports & adapters convention (ADR-001/004).

```
src/classroom/
  domain/                     Pure business rules (client + server safe, framework-free)
    value-objects/axes.ts     Level / Style / Provider / ClassId enums
    entities/                 Zod contract: lesson, student-restitution, teacher-diagnosis,
                              fact-check, production, loop-result
    profiles/                 N0-N6 level catalogs, S-* style catalogs, the 3-class roster
    prompts/                  agent-brief (structured task) + briefs (prompt builders)
    agent-color.ts            Deterministic hue per agent id
    pricing.ts                Per-provider cost table + estimate
    errors/                   Domain errors (NoRestitutionError)
    index.ts                  Domain barrel

  application/                Orchestration (depends only on domain)
    usecases/run-classroom-loop.usecase.ts   The 6-phase loop + resilience policy
    ports/                    AgentRunner · AgentFallback · RunEventSink
    events/classroom-event.ts SSE protocol (discriminated union)
    dto/run-loop-input.ts     markdown → Lesson validation
    support/                  mapPool (concurrency), UsageMeter (cost accounting)

  adapters/                   Concrete implementations of the ports
    mastra/                   AgentRunner via Mastra: agents, model-router, runtime-config,
                              mastra instance, storage (in-memory LibSQL)
    mock/                     Deterministic engine: mock LanguageModel, mock brain,
                              brief codec, MockAgentFallback
    sse/                      RunEventSink over Server-Sent Events
    export/                   markdown-dossier + pdf-dossier (jsPDF)
    http/error-mappings.ts    Error code → HTTP status

  classroom.module.ts         Composition root (wires adapters → use case)

src/presentation/features/classroom/   SSE hook + SVG scene + result panels + exports
src/app/
  page.tsx            Submission + live scene + result panels
  api/classroom/run   Route Handler POST → SSE (Web Streams), delegates to the use case
  api/classroom/demo  Route GET → demo lesson
  api/agent           Route POST → full dossier JSON (Fetch.ai uAgent bridge)

content/lessons/interets-composes.md   Demo lesson (deliberate flaws)
```

**Loop flow** (the use case runs each phase; each typed output feeds the next):
`simulate` (students in parallel) → `diagnose` → `rewrite` → `factCheckLesson` → `produce` (assessment + exercises + sheet in parallel) → `factCheckProduction` → `LoopResult`.

**Streaming**: each `agent.stream()` has its `text-delta`s forwarded (via the runner's `onToken` callback) to the injected `RunEventSink`, which the SSE route serializes as events (the visuals never constrain the orchestration). The frontend (fetch-streaming) drives the state of the SVG circles.

---

## Live scene (SVG)

- Each agent = an **SVG circle** (deterministic color derived from studentId) in front of a "board".
- **Speech bubble** above it, filled token by token while streaming.
- **States**: `waiting` (dimmed) · `thinking` (pulsing "…" bubble) · `speaking` (streaming bubble) · `done` (condensed summary) · `failed` (grayed-out circle + ✕).
- **Badges**: level (N0–N6), style (S-*), provider color dot.
- The visuals never block the loop: if rendering fails, the results remain accessible as text in the panels.

---

## Exports

From the **Exports** panel, a **"Include answer keys"** checkbox (so answer keys can be *excluded*), then:

**PDF** (real `.pdf` files, generated client-side via jsPDF):

- **Full package** — rewritten lesson + diagnosis summary + assessments + exercises + sheet.
- **Lesson** — the rewritten version alone.
- **Assessments** — all 3 levels, with inline answer keys (optional).
- **Exercises** — engaging exercises, with optional answer keys/comments.
- **Revision sheet** — prerequisites up front, key points, definitions, common pitfalls.

**Other formats**: **Markdown** and **printable HTML** (`@media print`).

Implementation: `adapters/export/pdf-dossier.ts` (jsPDF) and `adapters/export/markdown-dossier.ts` (Markdown/HTML) — both pure and client-side.

---

## Demo lesson & deliberate flaws

`content/lessons/interets-composes.md` contains **three diagnosable flaws**:

1. **Undefined jargon** — the term "compounding" is used (in bold) but never defined.
2. **Implicit prerequisite** — "you just multiply by the rate" assumes the percentage → coefficient `(1 + rate)` conversion, which is never explained (and induces the N2 misconception "×0.05").
3. **Ambiguous passage** — "A point of caution" states that the result depends on "the way it is applied" without specifying the compounding frequency.

The loop detects them: the diagnosis surfaces them under `missing_prerequisites` / `ambiguous_passages` / rewrite priorities, and the rewritten version makes the prerequisites explicit and defines the jargon.

---

## Resilience & cost

- A **student** whose key is missing (real mode) or whose call fails → marked **"failed"** (grayed-out circle), the class continues.
- A **teacher** whose call fails → **automatic fallback to the deterministic mock engine** so the loop always completes (announced in the log).
- The students in a class are launched **in parallel** (concurrency bounded by `CLASSROOM_CONCURRENCY`).
- A **token counter / estimated cost** is displayed live (approximate cost table in `domain/pricing.ts`).

---

## Decisions & TODO

**Decisions made** (the simplest ones that preserve intent):

- **Stack**: ClassroomSim is a self-contained **hexagone** (`src/classroom/`) following the starter's ports & adapters convention (ADR-001/004) — `domain` (pure, framework-free) → `application` (the use case + ports) → `adapters` (Mastra runner, mock engine, SSE, export), wired by `classroom.module.ts`. Orchestration is a plain typed use case (not a Mastra workflow); Mastra is demoted to an `AgentRunner` adapter. Persistence uses Mastra's in-memory `LibSQLStore`, not Prisma; the starter's auth (`proxy.ts`, `instrumentation.ts`) is neutralized so the app starts without a DB.
- **Mock by default**: a deterministic `LanguageModelV2` model + a TS "mock brain" produce schema-valid, profile-consistent output per role, streamed token by token. The 4 real providers are enabled via flags.
- **Structured output**: the real providers use `structuredOutput` (Zod-validated); the streamed text is thus the JSON being generated — the bubble displays it live, then shows a **condensed summary** at the end (same for the mock). Uniform and honest.
- **Generic mock**: the mock brain extracts title/sections/terms from any lesson; the numeric values in the examples are written for the demo finance lesson.
- **Diff**: the "rewritten lesson" panel highlights added lines using a simple heuristic (not a full diff).

**TODO / ideas**:

- Real Model Router fallback across providers (beyond the mock fallback for teachers).
- Server-side PDF export (pdfkit) — the current PDF export is generated client-side (jsPDF).
- Cross-loop memory actually used (agents remembering previous lessons).
- Vitest unit tests on the mock brain and the diagnosis aggregations.
- Per-class streaming breakdown via the workflow's native events (`run.stream`).

---

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript 5 · **@mastra/core 1.42** + `@mastra/libsql` + `@mastra/memory` · Zod 4 · pnpm · Node ≥ 22.13.

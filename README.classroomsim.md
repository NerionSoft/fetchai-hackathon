# ClassroomSim

Une boucle d'**amélioration pédagogique autonome**, construite avec **Mastra** (framework agentique TypeScript) sur **Next.js 16 (App Router)**.

Un professeur dépose une leçon. Des **classes d'élèves-agents** multi-modèles la restituent, un **prof-agent diagnosticien** agrège le signal, un **prof-agent rédacteur** réécrit la leçon, un **fact-checker** valide, puis des agents produisent **évaluations, exercices et fiches de révision** — le tout **piloté par le diagnostic** et visible **en direct** (streaming token par token) dans une scène **SVG**.

> Ce n'est pas un wrapper d'appels API : ce sont de vrais agents Mastra (rôles, system prompts, mémoire) orchestrés par un workflow Mastra typé par Zod.

---

## Démarrage rapide (zéro clé API)

Par défaut, ClassroomSim tourne sur un **fournisseur mock déterministe** : la boucle complète (18 élèves-agents + agents enseignants + live SVG + supports exportables) fonctionne **sans aucune clé API** et sans base de données.

```bash
pnpm install
pnpm dev
# → http://localhost:3000
```

1. Cliquez **« Charger la leçon de démo »** (leçon « Les intérêts composés », avec défauts volontaires).
2. Cliquez **« Lancer la boucle »**.
3. Regardez les 3 classes restituer en direct, puis le diagnostic, la réécriture, le fact-check et les supports apparaître. La boucle complète prend ~8 s en mock.
4. Téléchargez les supports via les boutons d'**export**.

`pnpm build` n'est pas requis pour la démo. (Note : le starter contient un exemple d'API hexagonale `src/app/api/example-hexagone` qui dépend de `DATABASE_URL` ; il n'est pas utilisé par ClassroomSim et n'est compilé qu'à la demande en dev.)

---

## Modes & variables d'environnement

Voir `.env.example`. ClassroomSim **n'a pas besoin** de `DATABASE_URL` ni `BETTER_AUTH_SECRET` (l'auth du starter est désactivée).

| Variable | Défaut | Rôle |
|---|---|---|
| `MASTRA_DB_URL` | `file:./mastra.db` | Stockage Mastra (SQLite via LibSQL, sur disque, sans serveur) |
| `DEV_SINGLE_PROVIDER` | _(absent)_ | Force **tous** les élèves sur un seul fournisseur : `anthropic`\|`openai`\|`google`\|`deepseek` |
| `DEMO_MODE` | `false` | Active le mode **multi-fournisseurs** (chaque élève sur son fournisseur préféré) |
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `GOOGLE_GENERATIVE_AI_API_KEY` / `DEEPSEEK_API_KEY` | _(absent)_ | Clés réelles (uniquement pour les modes ci-dessus) |
| `OPENAI_MODEL` (et `_STRONG`) | `gpt-5.4-mini` | Modèle OpenAI (préfixe `openai/` ajouté automatiquement) |
| `ANTHROPIC_MODEL` / `GOOGLE_MODEL` / `DEEPSEEK_MODEL` (+ `_STRONG`) | défauts intégrés | Override du modèle par fournisseur |
| `CLASSROOM_CONCURRENCY` | `6` | Appels d'élèves en parallèle (limite le fan-out réel) |
| `MOCK_TOKEN_DELAY_MS` | `5` | Cadence du streaming mock (0 = instantané) |

Modèles par défaut : OpenAI = `gpt-5.4-mini`, Anthropic = `claude-sonnet-4.6`, Google = `gemini-2.5-flash`, DeepSeek = `deepseek-v3.2` (tier « strong » pour les profils subtils N5/N6/anxieux). Pinnez-en un autre via `<PROVIDER>_MODEL`.

**Sélection du mode** (par ordre de priorité) :

1. `DEV_SINGLE_PROVIDER=<p>` défini → mode **single** (tous les élèves sur `<p>`).
2. sinon `DEMO_MODE=true` **et** au moins une clé présente → mode **demo** (4 fournisseurs réels).
3. sinon → mode **mock** (déterministe, sans clé). *C'est le défaut sûr pour le budget.*

Exemple — **uniquement OpenAI avec `gpt-5.4-mini`** (modèle OpenAI par défaut) :

```bash
# .env
DEV_SINGLE_PROVIDER=openai
OPENAI_API_KEY=sk-...
# (gpt-5.4-mini est déjà le défaut ; pour un autre modèle : OPENAI_MODEL=gpt-4o-mini)
```

---

## Les 3 classes

15-18 élèves par boucle, chaque élève = **niveau de maîtrise** (N0→N6) × **style cognitif** (S-*) × **fournisseur**.

| Classe | Rôle | Concentration |
|---|---|---|
| **A — Stress-test** | Détecter ce que la leçon échoue à transmettre | N0–N3, styles variés |
| **B — Réaliste** | Simuler une vraie salle hétérogène | dominante N2–N4 |
| **C — Audit qualité** | N5 valide ce qui marche, N6 critique le support | N4–N6 |

Les profils subtils (N5, N6, S-ANXIEUX) reçoivent les meilleurs modèles ; les profils grossiers tolèrent des modèles plus faibles. (Voir `src/classroom/roster.ts` et `src/classroom/profiles.ts`.)

---

## Architecture

```
src/classroom/        Domaine pur (client + serveur, AUCUN import @mastra)
  schemas.ts          Contrat de données Zod (StudentRestitution, TeacherDiagnosis, …)
  profiles.ts         Catalogues niveaux N0-N6 + styles S-* (→ system prompts)
  roster.ts           Composition des 3 classes
  colors.ts           Couleur déterministe par studentId
  events.ts           Protocole SSE (union discriminée)
  export.ts           Export Markdown / HTML imprimable

src/mastra/           Runtime agentique (serveur uniquement)
  config.ts           Flags, détection des clés, tiers de modèles, table de coûts
  model-router.ts     provider/model string OU modèle mock
  agents.ts           18 élèves + 6 enseignants (instructions + modèle + mémoire)
  workflow.ts         Workflow Mastra : 6 steps typés Zod, .commit()
  storage.ts          LibSQLStore (SQLite) + mémoire
  index.ts            Instance Mastra (agents + workflow + storage)
  mock/               Modèle mock LanguageModelV2 + "mock brain" déterministe
  run/                emitter (SSE side-channel), agent-call, calls, briefs, loop

src/app/
  page.tsx            Dépôt + scène live + panneaux résultat
  _classroom/         Hook SSE + scène SVG + panneaux + exports
  api/classroom/run   Route Handler POST → SSE (Web Streams)
  api/classroom/demo  Route GET → leçon de démo

content/lessons/interets-composes.md   Leçon de démo (défauts volontaires)
```

**Flux du workflow** (chaque sortie typée alimente le step suivant) :
`simulate` (élèves en parallèle) → `diagnose` → `rewrite` → `factCheckLesson` → `produce` (éval + exercices + fiche en parallèle) → `factCheckProduction` → `LoopResult`.

**Streaming** : chaque `agent.stream()` voit ses `text-delta` réémis en événements SSE via un canal latéral indexé par `runId` (le visuel ne contraint jamais l'orchestration). Le front (fetch-streaming) pilote l'état des cercles SVG.

---

## Scène live (SVG)

- Chaque agent = un **cercle SVG** (couleur déterministe dérivée du studentId) devant un « tableau ».
- **Bulle de dialogue** au-dessus, remplie token par token pendant le streaming.
- **États** : `en attente` (atténué) · `réfléchit` (bulle « … » pulsée) · `parle` (bulle en streaming) · `terminé` (résumé condensé) · `en échec` (cercle grisé + ✕).
- **Badges** : niveau (N0–N6), style (S-*), pastille couleur du fournisseur.
- Le visuel ne bloque jamais la boucle : si le rendu échoue, les résultats restent accessibles en texte dans les panneaux.

---

## Exports

Depuis le panneau **Exports**, une case **« Inclure les corrigés »** (les corrigés sont donc *séparables*) puis :

**PDF** (vrais fichiers `.pdf`, générés côté client via jsPDF) :

- **Dossier complet** — leçon réécrite + synthèse du diagnostic + évaluations + exercices + fiche.
- **Leçon** — la version réécrite seule.
- **Évaluations** — les 3 niveaux, corrigés inline (optionnels).
- **Exercices** — exercices engageants, corrigés/commentaires optionnels.
- **Fiche de révision** — prérequis en tête, points clés, définitions, pièges.

**Autres formats** : **Markdown** et **HTML imprimable** (`@media print`).

Implémentation : `src/classroom/pdf.ts` (jsPDF) et `src/classroom/export.ts` (Markdown/HTML) — toutes pures et côté client.

---

## Leçon de démo & défauts volontaires

`content/lessons/interets-composes.md` contient **trois défauts diagnosticables** :

1. **Jargon non défini** — le terme « capitalisation » est employé (en gras) mais jamais défini.
2. **Prérequis implicite** — « il suffit de multiplier par le taux » suppose la conversion pourcentage → coefficient `(1 + taux)`, jamais expliquée (et induit le contresens N2 « ×0,05 »).
3. **Passage ambigu** — « Un point de vigilance » évoque que le résultat dépend de « la manière dont on l'applique » sans préciser la fréquence de capitalisation.

La boucle les détecte : le diagnostic les remonte en `prerequis_manquants` / `passages_ambigus` / priorités de réécriture, et la version réécrite explicite les prérequis et définit le jargon.

---

## Résilience & coût

- **Élève** dont la clé manque (mode réel) ou dont l'appel échoue → marqué **« en échec »** (cercle grisé), la classe continue.
- **Enseignant** dont l'appel échoue → **repli automatique sur le moteur mock déterministe** pour que la boucle se termine toujours (annoncé dans le journal).
- Les élèves d'une classe sont lancés **en parallèle** (concurrence bornée par `CLASSROOM_CONCURRENCY`).
- Un **compteur de tokens / coût estimé** s'affiche en direct (table de coûts approximative dans `config.ts`).

---

## Décisions & TODO

**Décisions prises** (les plus simples préservant l'intention) :

- **Stack** : on ne respecte pas les conventions hexagonales/auth/Postgres du starter (décision utilisateur). ClassroomSim vit dans `src/classroom` (domaine) + `src/mastra` (runtime) ; persistance via le `LibSQLStore` de Mastra (SQLite), pas Prisma. L'auth du starter (`proxy.ts`, `instrumentation.ts`) est neutralisée pour que l'app démarre sans DB.
- **Mock par défaut** : un modèle `LanguageModelV2` déterministe + un « mock brain » TS produisent une sortie schéma-valide et profil-cohérente par rôle, streamée token par token. Les 4 fournisseurs réels s'activent via les flags.
- **Sortie structurée** : les vrais fournisseurs utilisent `structuredOutput` (validé Zod) ; le texte streamé est donc le JSON en cours de génération — la bulle l'affiche en direct puis montre un **résumé condensé** à la fin (idem pour le mock). Uniforme et honnête.
- **Mock générique** : le mock brain extrait titre/sections/termes de n'importe quelle leçon ; les valeurs chiffrées des exemples sont écrites pour la leçon de finance de démo.
- **Diff** : le panneau « leçon réécrite » met en évidence les lignes ajoutées par heuristique simple (pas un diff complet).

**TODO / pistes** :

- Vrai fallback du Model Router entre fournisseurs (au-delà du repli mock pour les enseignants).
- Export PDF côté serveur (pdfkit) — l'export PDF actuel est généré côté client (jsPDF).
- Mémoire inter-boucles exploitée (les agents se souviennent des leçons précédentes).
- Tests unitaires Vitest sur le mock brain et les agrégations du diagnostic.
- Découpage par classe en streaming réel via les events natifs du workflow (`run.stream`).

---

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript 5 · **@mastra/core 1.42** + `@mastra/libsql` + `@mastra/memory` · Zod 4 · pnpm · Node ≥ 22.13.

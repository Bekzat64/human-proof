# HUMAN PROOF

> AI can do the task. Prove you can direct it.

**Live:** https://human-proof-sepia.vercel.app · no sign-up, no login, anywhere.

## What, who, why

**Who:** analysts in the US (25–45) looking for their next job.

**The pain:** every resume now says "proficient in AI". Hiring managers cannot tell who actually
checks an AI's work and who pastes whatever it says. Certificates prove attendance, not judgment.

**What:** a realistic analyst work simulation. You get a brief from your manager, a data table,
15 minutes and an AI copilot that is fast, confident and **deliberately seeded with subtle
errors**. You answer the brief; the app grades how you handled the AI. The output is a public
**Proof page**: score, every AI error you caught or missed, and a replay of how you worked, at a
link an employer can open and verify. A 3-minute **daily drill** ("spot the AI error") is the
on-ramp.

## Jury quick path (3 min)

1. **Landing** → https://human-proof-sepia.vercel.app
2. **Take the 3-minute drill** → 5 short AI answers, click the wrong sentence and say why (or "nothing wrong").
3. **Drill proof** → after submitting: your picks against the truth, then "Your shareable drill proof".
4. **Example proof** → from the landing page, "See an example proof" (`/p/demo-advanced`, marked DEMO).
5. **Employer view** → on that proof, or directly at `/p/demo-advanced/employer`: verdict, three bullets,
   key moments, and the "Would interview / Not yet" buttons.

Contrast: `/p/demo-developing` is a demo candidate who followed the AI's mistakes.

## Full path (15 min)

Landing → **Start the 15-minute simulation** → read Dana's brief, look at the table (sort, filter,
download CSV) → ask the copilot things like *"Is this normal for the industry?"* and *"Which
channel drove the increase?"* → ⚑ flag what you think is wrong → answer the 4 questions → submit →
your Proof page (score, AI errors caught, process replay, integrity notes) → share bar (copy link,
LinkedIn add-to-profile, resume line, image) → employer view → `/me` (history, streak, trend,
next step) → `/pricing` → a second simulation needs the Job-Search Pass (test-mode checkout,
no real charge) → `/stats`.

## Architecture

```
Browser (anonymous: hp_anon cookie set by proxy.ts, no accounts)
  │
  ├─ /sim/[id]  brief · data table · answer form · copilot chat · process capture
  │     │  POST /api/copilot  ── pickClaim (server) ─┬─ fixed claim sentence streamed first
  │     │                                            └─ LLM continues  │  or offline copilot
  │     │  POST /api/events   (flags, pastes, focus, edits, data views; zod-validated)
  │     └─ POST /api/submit  → grade (after the response) → /p/[id]
  │
  ├─ /p/[id]            public proof  · /p/[id]/employer · /p/[id]/opengraph-image
  ├─ /drill, /drill/[id] daily drill (5 items by New York date) · POST /api/drill/submit
  ├─ /me                history, streak, trend, next step, outcome check-in
  ├─ /pricing           POST /api/checkout → Stripe Checkout (test key) │ /checkout/demo
  └─ /stats             real rows only, n on every figure
        │
        ▼
Next.js 16 App Router on Vercel (server-only modules for DB, LLM, answer key)
  lib/variant.ts      seed → { publicData, groundTruth, traps }   (only publicData reaches the browser)
  lib/copilot*.ts     claim selection, model instructions (table only), offline copilot
  lib/grading/*       deterministic.ts (75 pts) · llm.ts / heuristic.ts (25 pts) · score.ts
  lib/integrity.ts    observations from the event log
        │
        ▼
Neon Postgres (Drizzle): attempts · events · feedback · passes
```

Stack: Next.js 16 (App Router, Turbopack) · TypeScript strict · Tailwind v4 + shadcn/ui · Vercel AI
SDK v7 (Anthropic / Google / OpenAI) · Neon Postgres + Drizzle · zod · vitest · pnpm · Vercel.

## Scoring model (v1)

| Dimension | Points | How |
|---|---|---|
| Correctness | 35 | Q1 September churn within ±0.3pp (20) · Q2 driving channel exact (15) |
| AI judgment | 30 | Split over the seeded errors actually shown. Per error: 60% if the final answer does not rely on it, 40% if it was flagged (× flag precision) |
| Reasoning & communication | 25 | 5 criteria × 0–5: evidence, cause, actionable, clear, states verification. LLM rubric, or a rule-based estimate labelled "estimated" |
| Process | 10 | Sorted/filtered/downloaded the data (3) · used the copilot (2) · questioned the AI (3) · within 15 min (2) |

Levels: 0–49 Developing · 50–74 Proficient · 75–100 Advanced. If no seeded error was shown, AI
judgment's 30 points move into Correctness so the total is still out of 100. Percentile is
computed at read time among real graded attempts and shows `n`; under 10 attempts it says
"Early pilot". Drill: 15 points for the right sentence + 5 for the right reason, per item.

## Integrity design

- **Seeded variants.** Every attempt gets a random seed. The dataset, the right answers and the
  exact wording of the AI's errors come from that seed, so answers cannot be shared between
  candidates. Generator guarantees are tested for seeds 1..1000.
- **Templated traps, never left to the LLM.** The server decides when an error appears (T1 is the
  opening message; T2 fires on benchmark questions, or on the 3rd message; T3 on cause/channel
  questions) and streams a fixed sentence first. A model, if configured, only continues after it.
- **Answer key stays on the server.** `groundTruth` and trap wording are `server-only`; the
  model's instructions contain only the table the candidate also has. Client bundles are checked
  for answer-key strings. Drill answers are scored on the server and never sent before submit.
- **Process capture.** Prompts, replies, flags, pastes (character count and target only, never
  the content), tab-away time, answer edits, data views, submit time. Shown as a replay and as
  neutral "Observed:" integrity notes; they never fail anyone on their own.
- **Flag precision.** Flagging a correct offline reply lowers flag credit; flagging most replies
  without a seeded error zeroes it ("indiscriminate"). Flags on model-written replies are counted
  neutrally, because a model can be wrong on its own.
- **Injection-safe grader.** Candidate text goes inside `<candidate_answer>` tags (angle brackets
  neutralised), is declared data, and text addressed to the grader caps the rubric. 75 of 100
  points are deterministic, so no answer can talk its way to a high total.
- **Rate limits** per visitor: 5 new simulations/hour, 10 drills/hour, 20 submits/hour,
  30 copilot messages per attempt (HTTP 429 with a friendly message).

## Offline copilot vs LLM mode

With no LLM key the app still works end to end: the **offline copilot** answers a fixed set of
questions from the correct aggregates (every reply is badged "Offline copilot"), and the
reasoning rubric is a **rule-based estimate** (shown as "estimated"). The seeded errors are the
same fixed sentences in both modes, so grading is identical.

Add a key and both switch over on the next request: set `LLM_PROVIDER` (`anthropic` | `google` |
`openai`) and the matching key (`ANTHROPIC_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`,
`OPENAI_API_KEY`), optionally `COPILOT_MODEL` / `GRADER_MODEL`, then:

1. `pnpm llm:check`: one T2 and one T3 copilot turn through the same code as `/api/copilot`, plus
   one grader call. Prints model IDs and latency, and checks that each seeded sentence streams first
   and the model continues without giving the exercise away. Exits 0 with "no key" when none is set,
   1 if any check fails.
2. Redeploy (`vercel deploy --prod`).
3. `pnpm regrade --heuristic-only` to re-score earlier attempts with the model rubric.

## Run locally

```bash
pnpm install
cp .env.example .env.local   # fill in DATABASE_URL (Neon); everything else is optional
pnpm db:push                 # create the tables
pnpm seed:demo               # the two demo proofs linked from the landing page
pnpm dev
```

| Command | What it does |
|---|---|
| `pnpm dev` / `pnpm build` | Dev server / production build |
| `pnpm test` | Vitest: scenario guarantees, grading, drill bank, stats, sharing |
| `pnpm lint` · `pnpm typecheck` | ESLint · `tsc --noEmit` |
| `pnpm db:push` · `pnpm db:studio` | Push the Drizzle schema · inspect data |
| `pnpm seed:demo` | Create or re-create the 2 demo proofs (idempotent, `is_demo = true`) |
| `pnpm llm:check` | LLM switch-on check: copilot (T2, T3) and grader calls, model IDs, latency |
| `pnpm regrade --heuristic-only` | Re-score "estimated" rubrics once an LLM key exists |
| `pnpm regrade --all` | Re-score every graded attempt with the current rules |

Optional env (see `.env.example`): `LLM_PROVIDER` + key, `STRIPE_SECRET_KEY` (test keys only;
without it checkout is a labelled demo), `QA_ANON_IDS` (test browsers to leave out of `/stats`).
`/dev/variant?seed=N` shows one generated variant with its answers in local dev; it is a 404 in
production.

## Honest limitations

- **Offline mode until an LLM key is set.** The live deployment currently runs the offline
  copilot and the estimated rubric; both are labelled on every page where they appear.
- **Employer feedback is unverified.** Anyone with the link can answer once per browser; `/stats`
  labels the rate "unverified".
- **No ID verification yet.** A proof shows what happened in the attempt, not who sat at the
  keyboard. ID-verified proofs are on the roadmap, not in the product.
- **Cookie-based identity.** No accounts by design (no sign-up anywhere). History, streak and the
  pass belong to one browser; clearing cookies starts over (including the free simulation).
- **Payments are test mode.** Stripe runs only with a test key; without one, checkout is a demo
  page that says "no real charge".
- **One scenario.** A single meal-kit churn case today; the engine is built for more.

Built in 24 hours for a hackathon. Full spec: [PLAN.md](PLAN.md).

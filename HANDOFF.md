# HANDOFF.md — continue HUMAN PROOF in a new agent session

> You are continuing a project another coding agent (Claude Code) built over the last ~8 hours.
> **Read in this order before doing anything:** this file → `CLAUDE.md` (rules + STAGE REPORT format) → `PLAN.md` (spec).
> Then run `git log --oneline -20`, `pnpm test`, `pnpm build` to confirm the state matches this file.
> Work one stage at a time, then print the STAGE REPORT (format in CLAUDE.md) and stop.

## Hard deadline
**12:00 Nov 15 (Astana, UTC+5).** Feature freeze 09:45. The submission needs a live URL that works end-to-end without login, a public repo, and a ≤10-slide PDF deck.

## Where things are
- Prod: https://human-proof-sepia.vercel.app
- Repo: https://github.com/Bekzat64/human-proof (public)
- Vercel project: humanproof1/human-proof. **Git integration may not be connected yet: deploy with `vercel --prod`.** If CSS looks stale after a deploy, redeploy with `vercel --prod --force` (build cache issue seen once).
- DB: Neon Postgres via Drizzle. `pnpm db:push` (add `--force` when running non-interactively).
- Tests: `pnpm test` (vitest, 101 passing after Stage 5).

## Stack (do not change)
Next.js 16 App Router (`proxy.ts`, not `middleware.ts`; **Cache Components OFF**) · TS strict · Tailwind v4 + shadcn/ui · Vercel AI SDK v7 (`generateText` + `Output.object`; `generateObject` was removed) · `@ai-sdk/anthropic|google|openai` · Drizzle + Neon · zod · vitest · pnpm.

## Done (Stages 0–5)
- **0 Setup:** anonymous `hp_anon` cookie (1 year, httpOnly), `/api/health`, global error/not-found pages.
- **1 Scenario engine:** seeded meal-kit churn variant → `{publicData, groundTruth, traps}`; groundTruth/traps are `server-only`; `/dev/variant?seed=N` returns 404 in prod; a pinned-fingerprint test guards the generator (**changing the generator changes every stored attempt**).
- **2 Simulation:** `/sim/new` → `/sim/[id]` (owner-only, real 404 for others). Brief, form with localStorage draft, data table with CSV export, 15-min timer, copilot with ⚑ flags, event capture. Chat history is rebuilt from the `events` table.
- **3 Grading v1:** Correctness 35 / AI judgment 30 / Reasoning 25 / Process 10. Traps: T1 is a templated opener; **T2/T3 are templated claim sentences streamed first, then the LLM continues** (no retry logic). Flag credit = 40% × precision. The copilot system prompt holds only table aggregates, no conclusions. "Inspected data" counts only user sort/filter/download. Grading is idempotent; `pnpm regrade --all` and `pnpm regrade --heuristic-only` exist.
- **LLM layer:** `lib/llm.ts` reads `LLM_PROVIDER` (anthropic|google|openai), `COPILOT_MODEL`, `GRADER_MODEL`; `isLlmAvailable()`. **No API key is set yet**, so the app runs on the **offline copilot** (deterministic, labelled with an "Offline copilot" badge) and a **heuristic rubric** (labelled "estimated").
- **4 Proof pages:** `/p/[id]` credential view (traps caught, bars, replay with 5 free events, integrity notes), owner share bar (link / LinkedIn / resume line / image), visitor drill CTA, `/p/[id]/employer` with feedback (one per visitor; owner blocked), OG images, per-proof metadata.
- **5 Drill + /me:** 15-item bank; 5 items a day by New York date; 3-min timer; scored on the server; drill proof pages; streak (first on-time drill per day counts; the rest are "practice run"). `/me` has history, trend, next step and outcome check-in. Landing has both CTAs.

## Deviations log (already accepted)
- Brief states the churn definition (cancellations ÷ start subs); September promo sign-up peak in the data.
- `feedback` has `anon_id` and a unique index on (attempt, anon, kind). New event type `drill_answer`.
- Temperature 0 is sent only to google/openai (Anthropic rejects it).
- Flags on LLM-written non-trap replies are neutral ("Flagged N other replies"); hard false-flag wording applies only to offline replies.

## Open issues / known risks
1. **LLM key missing.** The jury criterion is "core value is real, not faked". When a key arrives: set it in Vercel (+ `LLM_PROVIDER`, model IDs) → redeploy → run 5 trials of the copilot → `pnpm regrade --heuristic-only` → check that the "estimated" tags disappear on new proofs.
2. **Flag spam in LLM mode** (fix in Stage 6, see below).
3. Daily drill items are the same for everyone, so answers can leak. Accepted: drills are practice and do not prove anything; only the first on-time drill counts toward the streak.
4. Anonymous employer feedback can be repeated by clearing cookies. Label it "unverified" everywhere.
5. QA rows are in the DB. Run `pnpm db:reset-test --yes` **before** real testers arrive and before reading `/stats`.
6. The LinkedIn add-to-profile form has not been checked while signed in (the human will check).

## Remaining stages

### Stage 6 — Pricing + outcomes + stats (PLAN §12–13)
```
Read HANDOFF.md, CLAUDE.md, PLAN.md. Implement Stage 6 only.

0. Fix flag spam: if flags > 50% of AI messages in an attempt, zero the flag share for all traps and add the integrity note "Flagged most replies (indiscriminate)". Test it.

1. /pricing: Free (daily drill, 1 full simulation, basic proof) vs Job-Search Pass $19/week (unlimited simulations, full replay, employer view link, new scenarios; "ID-verified proof — coming soon" shown as a roadmap item, not faked).
2. Checkout: if STRIPE_SECRET_KEY exists → Stripe Checkout (test mode) → return URL → /api/checkout/verify retrieves the session → passes row (7 days). If no key → "Demo checkout" page clearly labelled "Test mode — no real charge" that creates the pass. Both paths create the same passes row.
3. Gating via the real hasActivePass(anonId): a 2nd+ simulation needs a pass (friendly paywall card, not an error); full replay needs the owner's pass. Drills always free.
4. /stats (public): real rows only (exclude isDemo and QA anonIds): total sims, total drills, % of sims that missed ≥1 exposed AI error, most-missed trap, average score per dimension, drill accuracy by error type, employer "would interview" rate labelled "unverified". Always show n. Empty state when n=0.
5. Footer link to /stats and /pricing.

Acceptance on prod: 2nd sim hits the paywall → checkout (Stripe test card 4242… or demo) → pass active → 2nd sim starts, full replay unlocked → /stats renders with n.
STAGE REPORT, then stop.
```

### Stage 7 — Landing + demo seeds + polish (feature freeze at 09:45)
```
Read HANDOFF.md, CLAUDE.md, PLAN.md. Implement Stage 7 only.
1. Landing: headline "AI can do the task. Prove you can direct it." Sub-line naming the user (analysts job-hunting in the US) and the pain (every resume says "proficient in AI"). Primary CTA: 3-minute drill. Secondary: 15-minute simulation. A "How it works" strip with 3 steps (work with a seeded AI copilot → catch its mistakes → share a Proof page employers can verify). Link to one demo proof. Link to /stats.
2. Seed 2 demo proofs (isDemo=true, visible DEMO watermark, excluded from stats/percentiles): one Advanced, one Developing (followed the AI's errors). Script `pnpm seed:demo` (idempotent).
3. Rate limits per anonId (PLAN §14): 5 new sims/hour, 30 copilot messages/attempt, 20 submits/hour; friendly messages.
4. Polish: every page has loading/empty/error states; mobile check at 390px; no console errors; favicon + site title; 404 copy.
5. README: what / who / why, live link, a 3-step demo path for jurors, architecture diagram (text), scoring model, integrity design, how to run locally, honest limitations (offline mode, unverified feedback, no ID verification yet).
STAGE REPORT, then stop.
```

### Stage 8 — QA as a juror + final submit (09:45–11:30)
```
Read HANDOFF.md. Stage 8: no new features.
1. Fresh incognito on prod: landing → drill → drill proof → sim (all 3 traps) → proof → employer view → feedback → /me → pricing → checkout → 2nd sim → /stats. Fix only blocking bugs.
2. Run `pnpm db:reset-test --yes` only if QA rows pollute /stats (ask the human first).
3. Final `pnpm test`, `pnpm build`, deploy, re-run the smoke path. Report anything broken.
STAGE REPORT, then stop.
```

## How the human works with you
After each stage the human pastes your STAGE REPORT to a separate strategy chat, which may send back corrected prompts. Keep reports in the exact CLAUDE.md format, list every deviation, and never claim something was verified unless you actually verified it.

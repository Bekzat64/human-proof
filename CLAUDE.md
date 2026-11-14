# CLAUDE.md — HUMAN PROOF

## What this is
Hackathon project (24h, deadline 12:00 Nov 15). B2C web app for US analysts 25–45:
a realistic work simulation with an AI copilot that is deliberately seeded with subtle errors,
graded into a public, shareable Proof page. **Full spec: PLAN.md — read it before every stage.**

Jury requirements: works end-to-end in production, **no sign-up/login anywhere**, public repo (they read the code).

## Stack
Next.js (App Router) + TypeScript strict · Tailwind + shadcn/ui · Vercel AI SDK + Anthropic ·
Neon Postgres + Drizzle · zod · Stripe Checkout (test) · Vercel · pnpm.

## Commands
- `pnpm dev` — local dev
- `pnpm build` — must pass before every report
- `pnpm lint`
- `pnpm db:push` — drizzle-kit push schema to Neon
- `pnpm db:studio` — inspect data

## Working rules
1. Implement **only the stage requested**. Do not start the next stage.
2. Follow PLAN.md. If you must deviate (library, schema, scoring), do it, keep it minimal, and list it under "Deviations" in the report.
3. After acceptance criteria pass: `pnpm build` → commit `stage-N: <summary>` → push → smoke-test the production URL → print the STAGE REPORT → stop.
4. Ask the human only for things you cannot do: API keys, account setup, product decisions. Put them under "Needs from human".
5. Never commit secrets. Keys live in Vercel env + local `.env.local`. Keep `.env.example` updated.
6. Never present fake data as real. Demo records use `isDemo=true` and show a DEMO watermark. `/stats` uses real rows only.

## Code conventions
- Server-only code for LLM calls, DB, Stripe (`import 'server-only'`).
- Validate every API input with zod; return typed JSON errors.
- Scenario/drill content lives in `lib/scenarios/` as typed TS, not in the DB.
- Trap logic is server-controlled and deterministic (see PLAN.md §5–6). Never rely on the LLM alone to produce a trap.
- Grading: deterministic parts in `lib/grading/deterministic.ts`, LLM rubric in `lib/grading/llm.ts` (generateObject + zod, temperature 0, candidate text inside `<candidate_answer>` tags treated as data).
- Small components, shadcn primitives, no extra UI libraries.
- Every page needs loading, empty and error states (jury will click around).
- Prefer simple over clever. No new dependency without listing it in the report.

## STAGE REPORT format (print exactly this, ≤20 lines, no extra prose)

```
## STAGE REPORT — Stage <N>: <name>
Status: ✅ done | ⚠️ partial | ❌ blocked
Done:
- <max 5 bullets>
Not done / cut:
- <or "none">
Deviations from PLAN.md:
- <or "none">
New deps: <list or "none">
Prod URL: <url> — smoke test: pass/fail (<what was clicked>)
Build/lint: pass/fail
Known bugs / risks:
- <or "none">
Needs from human:
- <or "none">
Time spent: <~h:mm>
Next: Stage <N+1> — <name>
```

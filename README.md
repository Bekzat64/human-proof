# HUMAN PROOF

> AI can do the task. HUMAN PROOF shows you can direct it.

A realistic analyst work simulation with an AI copilot that is deliberately seeded with subtle
errors. The output is a public Proof page with evidence — process replay, traps caught, rubric —
not a badge. No sign-up or login anywhere.

Built in a 24-hour hackathon. Full spec: [PLAN.md](PLAN.md).

## Stack

Next.js (App Router) · TypeScript strict · Tailwind + shadcn/ui · Neon Postgres + Drizzle · pnpm · Vercel.

## Run locally

```bash
pnpm install
cp .env.example .env.local   # then fill in DATABASE_URL
pnpm db:push                 # create tables in your Neon database
pnpm dev
```

`GET /api/health` reports whether the app can reach the database and the schema is in place.

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Local dev server |
| `pnpm build` | Production build |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm db:push` | Push the Drizzle schema to Neon |
| `pnpm db:studio` | Inspect data in Drizzle Studio |

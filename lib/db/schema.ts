import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// Enum-like columns are plain `text` with a TS-level enum: fully typed in
// Drizzle, and no Postgres enum types to migrate while the schema is moving.

export const ATTEMPT_KINDS = ["sim", "drill"] as const;
/** active → submitted (answers in, awaiting grading) → graded. */
export const ATTEMPT_STATUSES = ["active", "submitted", "graded"] as const;
export const EVENT_TYPES = [
  "prompt",
  "ai_response",
  "flag",
  "paste",
  "blur",
  "focus",
  "answer_edit",
  "data_view",
  "submit",
] as const;
export const FEEDBACK_SOURCES = ["employer", "candidate"] as const;
export const PASS_STATUSES = ["active"] as const;

/** One simulation or drill run by an anonymous visitor. */
export const attempts = pgTable(
  "attempts",
  {
    id: text("id").primaryKey(), // nanoid; doubles as the public Proof page id
    anonId: text("anon_id").notNull(),
    kind: text("kind", { enum: ATTEMPT_KINDS }).notNull(),
    scenarioId: text("scenario_id").notNull(),
    seed: integer("seed").notNull(), // variant seed → dataset, ground truth, trap values
    status: text("status", { enum: ATTEMPT_STATUSES }).notNull().default("active"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    answer: jsonb("answer"),
    score: jsonb("score"), // breakdown, level, LLM feedback, employerSummary
    total: integer("total"),
    isDemo: boolean("is_demo").notNull().default(false), // demo rows are watermarked and excluded from /stats
  },
  (t) => [
    index("attempts_anon_idx").on(t.anonId),
    index("attempts_scenario_status_idx").on(t.scenarioId, t.status),
  ],
);

/** Process-capture log: what the candidate did during an attempt. */
export const events = pgTable(
  "events",
  {
    id: serial("id").primaryKey(),
    attemptId: text("attempt_id")
      .notNull()
      .references(() => attempts.id, { onDelete: "cascade" }),
    ts: timestamp("ts", { withTimezone: true }).notNull().defaultNow(),
    type: text("type", { enum: EVENT_TYPES }).notNull(),
    payload: jsonb("payload"),
  },
  (t) => [index("events_attempt_idx").on(t.attemptId, t.ts)],
);

/** Employer verdicts on a proof and candidate outcome check-ins. */
export const feedback = pgTable(
  "feedback",
  {
    id: serial("id").primaryKey(),
    attemptId: text("attempt_id")
      .notNull()
      .references(() => attempts.id, { onDelete: "cascade" }),
    source: text("source", { enum: FEEDBACK_SOURCES }).notNull(),
    anonId: text("anon_id"), // who left it; one row per visitor, attempt and source
    kind: text("kind").notNull(),
    value: jsonb("value"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("feedback_attempt_idx").on(t.attemptId),
    uniqueIndex("feedback_once_idx").on(t.attemptId, t.source, t.anonId),
  ],
);

/** Job-Search Pass purchases (Stripe Checkout, verified on the return URL). */
export const passes = pgTable(
  "passes",
  {
    id: serial("id").primaryKey(),
    anonId: text("anon_id").notNull(),
    stripeSessionId: text("stripe_session_id").notNull().unique(),
    status: text("status", { enum: PASS_STATUSES }).notNull().default("active"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("passes_anon_idx").on(t.anonId)],
);

export type Attempt = typeof attempts.$inferSelect;
export type NewAttempt = typeof attempts.$inferInsert;
export type AttemptEvent = typeof events.$inferSelect;
export type NewAttemptEvent = typeof events.$inferInsert;
export type Feedback = typeof feedback.$inferSelect;
export type NewFeedback = typeof feedback.$inferInsert;
export type Pass = typeof passes.$inferSelect;
export type NewPass = typeof passes.$inferInsert;

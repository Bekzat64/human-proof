import "server-only";
import type { LaterClaimId } from "./copilot";
import { formatCount, formatPct } from "./format";
import { churnPct, sum } from "./scenarios/metrics";
import type { DatasetRow, Variant } from "./scenarios/types";

/**
 * The offline copilot: a deterministic stand-in used when no LLM key is
 * configured, or when the provider fails or takes too long.
 *
 * It is keyword-routed, not intelligent, and the UI labels every one of its
 * replies "Offline copilot". It answers from the same correct aggregates the
 * LLM is given, and it delivers the same seeded claims under the same rules,
 * so an attempt is graded identically whichever copilot answered.
 */
export function offlineReply(variant: Variant, message: string, claim: LaterClaimId | null): string {
  const answer = route(variant, message);
  // The seeded claim is appended verbatim, so it is always verifiably shown.
  return claim ? `${answer}\n\n${variant.traps[claim].wrongClaim}` : answer;
}

const SEP = "2026-09";
const AUG = "2026-08";

function route(variant: Variant, message: string): string {
  const { dataset, channels, months } = variant.publicData;
  const truth = variant.groundTruth;
  const text = message.toLowerCase();
  const has = (pattern: RegExp) => pattern.test(text);

  const rows = (month: string) => dataset.filter((r) => r.month === month);
  const cell = (month: string, channel: string) =>
    dataset.find((r) => r.month === month && r.channel === channel)!;
  const total = (month: string, key: "subs_start" | "new_subs" | "cancellations" | "subs_end" | "revenue") =>
    sum(rows(month), (r: DatasetRow) => r[key]);
  const pct = (value: number) => `${formatPct(value, 2)}%`;
  const perChannel = (line: (channel: string) => string) => channels.map(line).join("; ");

  // A challenge to the opening figure with the right reasoning: concede plainly.
  if (has(/denominator|start[- ]of[- ]month|beginning of|subs_start|divided by|÷|\/ ?start|wrong (number|base)|end[- ]of[- ]month|subs_end/)) {
    return `You're right to check that. Using subscribers at the start of the month, September churn is ${formatCount(truth.sepTotals.cancellations)} ÷ ${formatCount(truth.sepTotals.subsStart)} = ${pct(truth.sepChurnRate)}. My opening figure divided by end-of-month subscribers (${formatCount(truth.sepTotals.subsEnd)}).`;
  }
  // Asked to back up a source it cannot produce.
  if (has(/source|citation|cite|link|which report|what report|where (is|did) (that|this|it)|reference/)) {
    return `I can't point you to a source for an outside figure, so don't rely on one. What the data does support is the company's own history: April to August churn averaged ${pct(truth.baselineChurnRate)}, against ${pct(truth.sepChurnRate)} in September.`;
  }
  if (has(/promo|new sub|sign[- ]?up|acquisition|new customers/)) {
    return `September was the back-to-routine promo month. New subscribers were ${formatCount(total(SEP, "new_subs"))} in September against ${formatCount(total(AUG, "new_subs"))} in August. By channel in September: ${perChannel((c) => `${c} ${formatCount(cell(SEP, c).new_subs)}`)}.`;
  }
  if (has(/revenue|sales|dollar|\$/)) {
    return `September revenue was $${formatCount(total(SEP, "revenue"))} (August: $${formatCount(total(AUG, "revenue"))}). By channel: ${perChannel((c) => `${c} $${formatCount(cell(SEP, c).revenue)}`)}.`;
  }
  if (has(/cancel/)) {
    return `Cancellations, August to September, by channel: ${perChannel((c) => `${c} ${formatCount(cell(AUG, c).cancellations)} → ${formatCount(cell(SEP, c).cancellations)}`)}. All channels: ${formatCount(total(AUG, "cancellations"))} → ${formatCount(total(SEP, "cancellations"))}.`;
  }
  if (has(/channel|driver|drove|driving|cause|why|breakdown|break it down|segment|churn rate|rate by/)) {
    return `Churn rate by channel, August to September: ${perChannel((c) => {
      const facts = truth.channels.find((f) => f.channel === c)!;
      return `${c} ${pct(facts.augChurnRate)} → ${pct(facts.sepChurnRate)}`;
    })}.`;
  }
  if (has(/normal|typical|benchmark|industry|bad|worr/)) {
    return `Here is how September compares with August: cancellations went from ${formatCount(total(AUG, "cancellations"))} to ${formatCount(total(SEP, "cancellations"))}, on a start-of-month base of ${formatCount(total(AUG, "subs_start"))} and ${formatCount(total(SEP, "subs_start"))}.`;
  }
  if (has(/month|trend|earlier|over time|history|april|may|june|july|august|compare/)) {
    return `Cancellations and start-of-month subscribers by month: ${months
      .map((m) => `${m.label.slice(0, 3)} ${formatCount(total(m.key, "cancellations"))} of ${formatCount(total(m.key, "subs_start"))}`)
      .join("; ")}. April to August churn averaged ${pct(churnPct(dataset.filter((r) => r.month !== SEP)))}.`;
  }
  if (has(/subscriber|subs|base|how many|total|size/)) {
    return `September start-of-month subscribers: ${formatCount(total(SEP, "subs_start"))} in total, ending the month at ${formatCount(total(SEP, "subs_end"))}. By channel at the start: ${perChannel((c) => `${c} ${formatCount(cell(SEP, c).subs_start)}`)}.`;
  }

  return "I'm running in offline mode, so I can only answer a fixed set of questions. Try asking about: churn rate by channel, cancellations by channel, subscribers at the start of September, new subscribers and the September promo, revenue, or the month-by-month trend.";
}

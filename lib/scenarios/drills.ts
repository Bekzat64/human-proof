import "server-only";
import type { DrillItem } from "../drill/types";

/**
 * Daily drill bank: 15 short "spot the AI error" items for analysts.
 *
 * Each item is a 1–2 sentence context, a small table, and an AI answer of
 * 3–5 sentences in which exactly one sentence is wrong, or none is. Every
 * error can be checked from the table alone in well under 30 seconds.
 *
 * Authoring rules (enforced by lib/drill/drills.test.ts):
 *  - sentences stand on their own: a later sentence never repeats or builds on
 *    the wrong one, so there is exactly one wrong sentence;
 *  - a fabricated source never names a real organisation;
 *  - wrong-math items carry a `check` that recomputes the true figure.
 *
 * Server-only: this file is the answer key.
 */

const n = (value: string | number) => Number(value);

export const DRILLS: DrillItem[] = [
  // ---------------------------------------------------------------- wrong math
  {
    id: "email-conversion",
    domain: "marketing",
    context: "Two email campaigns went out last quarter. You asked the AI how they converted.",
    table: {
      columns: ["Campaign", "Emails sent", "Orders"],
      rows: [
        ["Spring Sale", 40000, 1200],
        ["Summer Sale", 50000, 1250],
      ],
    },
    sentences: [
      "Spring Sale converted at 3.0%: 1,200 orders from 40,000 emails.",
      "Summer Sale converted at 3.5%.",
      "Summer Sale produced 50 more orders than Spring Sale.",
      "It was also sent to 10,000 more people.",
    ],
    wrongIndex: 1,
    reason: "wrong_math",
    explanation: "1,250 ÷ 50,000 is 2.5%, not 3.5%: Summer Sale converted worse than Spring Sale.",
    check: { claimed: 3.5, compute: (rows) => (n(rows[1][2]) / n(rows[1][1])) * 100 },
  },
  {
    id: "quarterly-growth",
    domain: "finance",
    context: "Finance shared quarterly revenue for the year and asked for the growth story.",
    table: {
      columns: ["Quarter", "Revenue ($k)"],
      rows: [
        ["Q1", 800],
        ["Q2", 920],
        ["Q3", 1012],
        ["Q4", 1063],
      ],
    },
    sentences: [
      "Revenue rose in each quarter after Q1.",
      "Q2 was up 15% on Q1, from $800k to $920k.",
      "Q3 was up 10% on Q2.",
      "Q4 was up 10% on Q3.",
    ],
    wrongIndex: 3,
    reason: "wrong_math",
    explanation: "$1,063k ÷ $1,012k is a 5% increase, not 10%: growth halved in Q4.",
    check: { claimed: 10, compute: (rows) => (n(rows[3][1]) / n(rows[2][1]) - 1) * 100 },
  },
  {
    id: "handle-time",
    domain: "ops",
    context: "Support tickets are split across two tiers. You asked for the overall average handle time.",
    table: {
      columns: ["Team", "Tickets", "Avg. handle time (min)"],
      rows: [
        ["Tier 1", 900, 6],
        ["Tier 2", 100, 26],
      ],
    },
    sentences: [
      "Tier 1 handled 900 of the 1,000 tickets.",
      "Tier 2 tickets took much longer, at 26 minutes each.",
      "Across all tickets, the average handle time was 16 minutes.",
      "Tier 2 accounted for 2,600 minutes of handling time in total.",
    ],
    wrongIndex: 2,
    reason: "wrong_math",
    explanation:
      "16 is the average of the two team averages. Weighted by tickets it is (900 × 6 + 100 × 26) ÷ 1,000 = 8 minutes.",
    check: {
      claimed: 16,
      compute: (rows) =>
        (n(rows[0][1]) * n(rows[0][2]) + n(rows[1][1]) * n(rows[1][2])) / (n(rows[0][1]) + n(rows[1][1])),
    },
  },
  {
    id: "regional-revenue-share",
    domain: "sales",
    context: "Closed deals by region for the quarter. You asked for a quick summary.",
    table: {
      columns: ["Region", "Closed deals", "Revenue ($k)"],
      rows: [
        ["East", 40, 600],
        ["West", 25, 500],
        ["Central", 35, 400],
      ],
    },
    sentences: [
      "The team closed 100 deals worth $1.5M in total.",
      "East brought in the most revenue, at $600k.",
      "West had the highest revenue per deal, at $20k.",
      "Central contributed 35% of revenue.",
    ],
    wrongIndex: 3,
    reason: "wrong_math",
    explanation: "Central is 35% of deals, not revenue: $400k ÷ $1,500k is about 27% of revenue.",
    check: {
      claimed: 35,
      compute: (rows) => (n(rows[2][2]) / (n(rows[0][2]) + n(rows[1][2]) + n(rows[2][2]))) * 100,
    },
  },
  {
    id: "retention-relative-change",
    domain: "product",
    context: "30-day retention for the last two signup cohorts. You asked how much it changed.",
    table: {
      columns: ["Cohort", "Signed up", "Active after 30 days"],
      rows: [
        ["March", 2000, 900],
        ["April", 2500, 1000],
      ],
    },
    sentences: [
      "March's 30-day retention was 45%: 900 of 2,000 users.",
      "April's was 40%: 1,000 of 2,500 users.",
      "April still retained 100 more users than March in absolute terms.",
      "Retention fell by 5 percentage points.",
      "In relative terms, that is a 5% decline.",
    ],
    wrongIndex: 4,
    reason: "wrong_math",
    explanation: "A drop from 45% to 40% is 5 points, but relative to 45% it is 5 ÷ 45, about an 11% decline.",
    check: {
      claimed: 5,
      compute: (rows) => {
        const march = n(rows[0][2]) / n(rows[0][1]);
        const april = n(rows[1][2]) / n(rows[1][1]);
        return ((march - april) / march) * 100;
      },
    },
  },

  // --------------------------------------------------------- fabricated source
  {
    id: "ad-click-through",
    domain: "marketing",
    context: "Last month's paid ads by channel. This table is the only data you gave the AI.",
    table: {
      columns: ["Channel", "Impressions", "Clicks"],
      rows: [
        ["Search", 200000, 6000],
        ["Social", 500000, 5000],
        ["Display", 800000, 4000],
      ],
    },
    sentences: [
      "Search had the highest click-through rate, at 3.0%.",
      "Social came in at 1.0% and Display at 0.5%.",
      "According to a 2024 industry survey, the average search click-through rate is 1.9%, so we are well ahead of the market.",
      "Search also delivered the most clicks despite having the fewest impressions.",
    ],
    wrongIndex: 2,
    reason: "fabricated_source",
    explanation:
      "The table has no market data. The survey and its 1.9% come from nowhere you can check, so the comparison cannot be used.",
  },
  {
    id: "on-time-shipping",
    domain: "ops",
    context: "Four weeks of warehouse shipping. This table is the only data you gave the AI.",
    table: {
      columns: ["Week", "Orders shipped", "Shipped on time"],
      rows: [
        ["Week 1", 1000, 940],
        ["Week 2", 1200, 1104],
        ["Week 3", 1100, 1045],
        ["Week 4", 1300, 1170],
      ],
    },
    sentences: [
      "On-time shipping ranged from 90% to 95% over the four weeks.",
      "Week 4 was the weakest, at 90%, on the highest volume.",
      "A recent logistics benchmark report puts best-in-class on-time shipping at 89%, so every week beat best-in-class.",
      "Week 3 was the strongest week, at 95%.",
    ],
    wrongIndex: 2,
    reason: "fabricated_source",
    explanation:
      "No benchmark was provided. The report and its 89% are unverifiable, so 'beat best-in-class' has no basis.",
  },
  {
    id: "software-spend",
    domain: "finance",
    context: "Annual software spend for three tools. This table is the only data you gave the AI.",
    table: {
      columns: ["Tool", "Seats", "Annual cost ($)"],
      rows: [
        ["CRM", 50, 60000],
        ["Analytics", 20, 36000],
        ["Design", 10, 7200],
      ],
    },
    sentences: [
      "We spend $103,200 a year across the three tools.",
      "Analytics is the most expensive per seat, at $1,800.",
      "A 2025 analyst study found that companies our size overpay for analytics software by 22% on average.",
      "The CRM is the largest line item, at $60,000.",
    ],
    wrongIndex: 2,
    reason: "fabricated_source",
    explanation:
      "Nothing in the table is about other companies. The study and its 22% cannot be traced, so it is not evidence of overpaying.",
  },
  {
    id: "nps-by-plan",
    domain: "product",
    context: "Latest NPS survey by plan. This table is the only data you gave the AI.",
    table: {
      columns: ["Plan", "Responses", "Promoters", "Detractors"],
      rows: [
        ["Free", 400, 120, 160],
        ["Pro", 250, 125, 50],
        ["Team", 100, 60, 10],
      ],
    },
    sentences: [
      "NPS is -10 on Free, 30 on Pro and 50 on Team.",
      "Team has the fewest responses, at 100.",
      "Research from a leading consultancy shows that an NPS above 40 doubles expansion revenue.",
      "Free is the only plan where detractors outnumber promoters.",
    ],
    wrongIndex: 2,
    reason: "fabricated_source",
    explanation:
      "The survey data says nothing about revenue. The unnamed research and its 'doubles' claim cannot be verified.",
  },

  // ---------------------------------------------------------- wrong conclusion
  {
    id: "rep-win-rate",
    domain: "sales",
    context: "Quarterly results for three sales reps. You asked who is closing best.",
    table: {
      columns: ["Rep", "Deals worked", "Deals won", "Revenue ($k)"],
      rows: [
        ["Avery", 80, 20, 400],
        ["Blake", 30, 15, 330],
        ["Casey", 50, 15, 300],
      ],
    },
    sentences: [
      "Avery won the most deals, 20, and the most revenue, $400k.",
      "Blake won 15 of the 30 deals worked.",
      "Casey's win rate was 30%.",
      "Avery therefore has the best win rate on the team.",
    ],
    wrongIndex: 3,
    reason: "wrong_conclusion",
    explanation: "Most wins is not best win rate: Avery won 25% of deals worked, Blake won 50%.",
  },
  {
    id: "ab-test-winner",
    domain: "marketing",
    context: "A landing-page test with uneven traffic. You asked which variant to keep.",
    table: {
      columns: ["Variant", "Visitors", "Sign-ups"],
      rows: [
        ["A", 4000, 200],
        ["B", 10000, 400],
      ],
    },
    sentences: [
      "Variant A converted 5.0% of visitors and variant B converted 4.0%.",
      "B received 2.5 times as much traffic as A.",
      "B produced twice as many sign-ups.",
      "So B is the better-performing page and we should roll it out.",
    ],
    wrongIndex: 3,
    reason: "wrong_conclusion",
    explanation: "B has more sign-ups only because it got more traffic. Per visitor, A converts better: 5.0% against 4.0%.",
  },
  {
    id: "defect-trend",
    domain: "ops",
    context: "Production and defects for the first quarter. You asked whether quality is improving.",
    table: {
      columns: ["Month", "Units produced", "Defective units"],
      rows: [
        ["January", 10000, 200],
        ["February", 8000, 176],
        ["March", 6000, 150],
      ],
    },
    sentences: [
      "Defective units fell from 200 in January to 150 in March.",
      "Production also fell, from 10,000 units to 6,000.",
      "The defect rate was 2.0% in January and 2.5% in March.",
      "Quality is therefore improving over the quarter.",
    ],
    wrongIndex: 3,
    reason: "wrong_conclusion",
    explanation: "Fewer defects only because fewer units were made. The defect rate rose from 2.0% to 2.5%: quality got worse.",
  },
  {
    id: "plan-profit",
    domain: "finance",
    context: "Monthly revenue and support cost by plan. You asked which plan contributes the most profit.",
    table: {
      columns: ["Plan", "Customers", "Monthly revenue ($)", "Monthly support cost ($)"],
      rows: [
        ["Basic", 500, 10000, 2000],
        ["Plus", 200, 12000, 3000],
        ["Enterprise", 10, 15000, 13500],
      ],
    },
    sentences: [
      "Enterprise brings in the most monthly revenue: $15,000 from just 10 customers.",
      "Plus earns $12,000 from 200 customers, or $60 per customer.",
      "Basic's support cost is 20% of its revenue.",
      "Enterprise is therefore the plan that contributes the most profit.",
    ],
    wrongIndex: 3,
    reason: "wrong_conclusion",
    explanation:
      "Most revenue is not most profit. After support cost Enterprise leaves $1,500, against $9,000 for Plus and $8,000 for Basic.",
  },

  // -------------------------------------------------------------- nothing wrong
  {
    id: "pipeline-stages",
    domain: "sales",
    context: "Open pipeline by stage. You asked for a summary before the forecast call.",
    table: {
      columns: ["Stage", "Deals", "Value ($k)"],
      rows: [
        ["Qualified", 40, 800],
        ["Proposal", 20, 500],
        ["Negotiation", 10, 300],
      ],
    },
    sentences: [
      "There are 70 open deals worth $1.6M in total.",
      "Qualified holds the most deals and the most value.",
      "The average Negotiation deal is worth $30k, the highest of the three stages.",
      "Proposal deals average $25k.",
    ],
    wrongIndex: null,
    reason: "none",
    explanation: "Every figure checks out against the table: 70 deals, $1.6M, and averages of $20k, $25k and $30k.",
  },
  {
    id: "feature-adoption",
    domain: "product",
    context: "The product had 9,000 weekly active users last week. The table shows how many of them used each feature.",
    table: {
      columns: ["Feature", "Users who used it"],
      rows: [
        ["Search", 6300],
        ["Export", 1800],
        ["Alerts", 2700],
      ],
    },
    sentences: [
      "Search is the most used feature, reaching 70% of weekly active users.",
      "Alerts reached 30% and Export 20%.",
      "Search was used by 3.5 times as many people as Export.",
      "Alerts had 900 more users than Export.",
    ],
    wrongIndex: null,
    reason: "none",
    explanation: "All four statements follow from the table and the 9,000 weekly active users.",
  },
];

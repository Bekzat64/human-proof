import { describe, expect, it } from "vitest";
import { answerSchema, countWords, draftToAnswerInput } from "../answers";
import { datasetToCsv } from "../csv";
import { buildVariant } from "../variant";
import { clientEventSchema, eventBatchSchema } from "./schema";

const at = 1_800_000_000_000;

describe("client events", () => {
  it("accepts each kind of event the browser may report", () => {
    const valid = [
      { type: "flag", at, payload: { messageId: "msg_1", note: "wrong denominator" } },
      { type: "paste", at, payload: { target: "q3", chars: 512 } },
      { type: "paste", at, payload: { target: "copilot", chars: 12 } },
      { type: "blur", at, payload: {} },
      { type: "focus", at, payload: { awayMs: 4200 } },
      { type: "answer_edit", at, payload: { field: "q4", chars: 80 } },
      { type: "data_view", at, payload: { action: "view" } },
      { type: "data_view", at, payload: { action: "sort", column: "cancellations", direction: "desc" } },
      { type: "data_view", at, payload: { action: "filter", channel: "Search" } },
      { type: "data_view", at, payload: { action: "download" } },
    ];
    for (const event of valid) {
      expect(clientEventSchema.safeParse(event).success, JSON.stringify(event)).toBe(true);
    }
  });

  it("refuses the event types only the server may write", () => {
    for (const type of ["prompt", "ai_response", "submit"]) {
      expect(clientEventSchema.safeParse({ type, at, payload: {} }).success, type).toBe(false);
    }
  });

  it("a paste can never carry the pasted text", () => {
    const withContent = { type: "paste", at, payload: { target: "q3", chars: 5, text: "hello" } };
    expect(clientEventSchema.safeParse(withContent).success).toBe(false);
  });

  it("a flag needs a note of at least 5 characters", () => {
    const flag = (note: string) => ({ type: "flag", at, payload: { messageId: "msg_1", note } });
    expect(clientEventSchema.safeParse(flag("no")).success).toBe(false);
    expect(clientEventSchema.safeParse(flag("    ")).success).toBe(false);
    expect(clientEventSchema.safeParse(flag("wrong")).success).toBe(true);
  });

  it("a batch holds 1 to 50 events", () => {
    const event = { type: "blur", at, payload: {} };
    const batch = (n: number) => ({ attemptId: "a1", events: Array.from({ length: n }, () => event) });
    expect(eventBatchSchema.safeParse(batch(0)).success).toBe(false);
    expect(eventBatchSchema.safeParse(batch(50)).success).toBe(true);
    expect(eventBatchSchema.safeParse(batch(51)).success).toBe(false);
  });
});

describe("answers", () => {
  const words = (n: number) => Array.from({ length: n }, () => "word").join(" ");
  const good = { q1: "8.3", q2: "Search", q3: words(120), q4: words(60) };

  it("counts words the way a person would", () => {
    expect(countWords("")).toBe(0);
    expect(countWords("  one   two\nthree ")).toBe(3);
  });

  it("accepts a complete answer and turns Q1 into a number", () => {
    const parsed = answerSchema.safeParse(draftToAnswerInput(good));
    expect(parsed.success).toBe(true);
    expect(parsed.data?.q1).toBe(8.3);
  });

  it("reads Q1 written with a comma or a percent sign", () => {
    expect(answerSchema.parse(draftToAnswerInput({ ...good, q1: "8,3 %" })).q1).toBe(8.3);
  });

  it("enforces the word limits: Q3 ≤ 120, Q4 ≤ 60", () => {
    expect(answerSchema.safeParse(draftToAnswerInput({ ...good, q3: words(121) })).success).toBe(false);
    expect(answerSchema.safeParse(draftToAnswerInput({ ...good, q4: words(61) })).success).toBe(false);
  });

  it("rejects missing or impossible answers", () => {
    for (const bad of [
      { ...good, q1: "" },
      { ...good, q1: "abc" },
      { ...good, q1: "140" },
      { ...good, q2: "" },
      { ...good, q2: "TikTok" },
      { ...good, q3: "   " },
    ]) {
      expect(answerSchema.safeParse(draftToAnswerInput(bad)).success, JSON.stringify(bad)).toBe(false);
    }
  });
});

describe("CSV export", () => {
  it("has a header of column keys and one line per row", () => {
    const { columns, dataset } = buildVariant(7).publicData;
    const lines = datasetToCsv(columns, dataset).trimEnd().split("\r\n");
    expect(lines[0]).toBe("month,channel,subs_start,new_subs,cancellations,subs_end,revenue");
    expect(lines).toHaveLength(25);
    const first = dataset[0];
    expect(lines[1]).toBe(
      [first.month, first.channel, first.subs_start, first.new_subs, first.cancellations, first.subs_end, first.revenue].join(","),
    );
  });
});

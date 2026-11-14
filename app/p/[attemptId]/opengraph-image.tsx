import { ImageResponse } from "next/og";
import type { Score } from "@/lib/grading/types";
import { getProofAttempt } from "@/lib/proof/load";
import { CREDENTIAL_NAME } from "@/lib/proof/share";
import { getBaseUrl } from "@/lib/site-url";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "HUMAN PROOF credential";

const NAVY = "#0b1124";
const VIOLET = "#a78bfa";
const MUTED = "#9aa3bd";

/** Share image for a proof: wordmark, level, score, errors caught, short URL. */
export default async function Image({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  const attempt = await getProofAttempt(attemptId);
  const graded = attempt && attempt.kind === "sim" && attempt.status === "graded" && attempt.score;
  const score = graded ? (attempt.score as Score) : null;
  const host = (await getBaseUrl()).replace(/^https?:\/\//, "");

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: NAVY,
          color: "#f4f5fa",
          padding: "64px 72px",
          borderTop: `10px solid ${VIOLET}`,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", fontSize: 30, fontWeight: 700, letterSpacing: 10 }}>HUMAN PROOF</div>
          {attempt?.isDemo ? (
            <div style={{ display: "flex", fontSize: 26, color: "#f87171", border: "2px solid #f87171", borderRadius: 999, padding: "6px 22px" }}>
              DEMO
            </div>
          ) : (
            <div style={{ display: "flex", fontSize: 24, color: MUTED }}>Proof of {CREDENTIAL_NAME}</div>
          )}
        </div>

        {score ? (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", fontSize: 128, lineHeight: 1, letterSpacing: -3 }}>{score.level}</div>
              <div style={{ display: "flex", fontSize: 44, color: VIOLET, marginTop: 28 }}>
                {score.dimensions.aiJudgment.exposed === 0
                  ? "Timed analyst simulation with an AI copilot"
                  : `Caught ${score.dimensions.aiJudgment.caught}/${score.dimensions.aiJudgment.exposed} AI errors`}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "baseline" }}>
              <div style={{ display: "flex", fontSize: 190, lineHeight: 1, fontWeight: 700 }}>{score.total}</div>
              <div style={{ display: "flex", fontSize: 48, color: MUTED, marginLeft: 12 }}>/100</div>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 84, lineHeight: 1.1 }}>Can you catch the AI&apos;s mistake?</div>
            <div style={{ display: "flex", fontSize: 40, color: VIOLET, marginTop: 24 }}>
              A 15-minute analyst simulation with a flawed AI copilot
            </div>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 28, color: MUTED }}>
          <div style={{ display: "flex" }}>{score ? `Verify: ${host}/p/${attemptId}` : host}</div>
        </div>
      </div>
    ),
    size,
  );
}

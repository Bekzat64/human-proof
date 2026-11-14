import { getAttempt } from "@/lib/attempts";
import { jsonError } from "@/lib/api";
import { gradeAttempt } from "@/lib/grading/compose";

export const maxDuration = 30;

/**
 * Polled by the Proof page while an attempt is being graded. Returns only the
 * status. If a submitted attempt has somehow not been graded yet, this grades
 * it (grading is idempotent), so a Proof page can never be stuck on "Grading…".
 */
export async function GET(_request: Request, { params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  const attempt = await getAttempt(attemptId);
  if (!attempt || attempt.kind !== "sim" || attempt.status === "active") {
    return jsonError("not_found", "This attempt does not exist.");
  }

  let status = attempt.status;
  if (status === "submitted" && (await gradeAttempt(attempt.id))) status = "graded";

  return Response.json({ status }, { headers: { "Cache-Control": "no-store" } });
}

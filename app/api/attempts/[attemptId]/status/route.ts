import { getAttempt } from "@/lib/attempts";
import { jsonError } from "@/lib/api";
import { gradeAttempt } from "@/lib/grading/compose";

export const maxDuration = 30;

/** Submit grades the attempt itself; this endpoint only steps in if that has not happened by now. */
const RESCUE_AFTER_MS = 20_000;

/**
 * Polled by the Proof page while an attempt is being graded. Returns only the
 * status. Grading is started by /api/submit. Only if an attempt is still
 * ungraded 20s later does this endpoint grade it (idempotently), so a Proof
 * page cannot stay stuck on "Grading…" and polling cannot fan out grader calls.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  const attempt = await getAttempt(attemptId);
  if (!attempt || attempt.kind !== "sim" || attempt.status === "active") {
    return jsonError("not_found", "This attempt does not exist.");
  }

  let status = attempt.status;
  const waitedMs = Date.now() - (attempt.submittedAt ?? attempt.startedAt).getTime();
  if (status === "submitted" && waitedMs > RESCUE_AFTER_MS && (await gradeAttempt(attempt.id))) {
    status = "graded";
  }

  return Response.json({ status }, { headers: { "Cache-Control": "no-store" } });
}

// KAN-57: the review screen's server half: the letter, and the plan worked out against her day.

import { notFound, redirect } from "next/navigation";
import { todayInZone } from "@/lib/contract/dates";
import { leftToCheck } from "@/lib/confirm-flow";
import { planLinesFor } from "@/lib/review-plan";
import { requireUser } from "@/server/auth/session";
import { countLettersToCheck, getDocument } from "@/server/documents";
import { ReviewForm } from "./review-form";

/**
 * The review screen.
 *
 * A server component, so the reading comes from the same module the endpoint
 * calls rather than from a round trip to our own API. The (app) layout has
 * already required a session, so requireUser() here is asking who it is rather
 * than whether there is anybody.
 *
 * The plan is worked out here, not in the browser, and against her zone rather
 * than the machine's. A reminder that has already gone past must not be shown
 * as one still to come, and "already" is a question about her calendar day: see
 * src/lib/contract/dates.ts on why comparing instants gets this wrong by a day.
 * The confirm handler computes the same day the same way
 * (src/server/confirm.ts), which is what keeps the card from promising a row
 * the handler will not write.
 */
export default async function DocumentReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ run?: string }>;
}) {
  const { id } = await params;
  const { run } = await searchParams;
  const user = await requireUser();
  const [document, waiting] = await Promise.all([
    getDocument(id, user.id, user.timeZone),
    countLettersToCheck(user.id),
  ]);
  // A letter belonging to somebody else is absent, not forbidden: see
  // docs/api.md on why this is a 404 and never a 403.
  if (!document) notFound();

  // KAN-59: a letter that is not waiting to be checked has nothing to check.
  // Reached by the back button after saving it, or from an old tab, so she is
  // taken Home, where what is waiting is listed.
  if (document.status !== "needs-review") redirect("/dashboard");

  const action =
    document.fields.find(
      (field) =>
        field.key === "action_required" && field.status === "confirmed",
    )?.value ?? null;

  const plan = planLinesFor(
    { dueDate: document.dueDate, dueTime: document.dueTime, action },
    todayInZone(user.timeZone),
    user.timeZone,
  );

  return (
    <ReviewForm
      document={document}
      plan={plan}
      action={action}
      left={leftToCheck(waiting)}
      run={run ?? null}
    />
  );
}

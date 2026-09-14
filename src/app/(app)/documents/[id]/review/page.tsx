// KAN-57: the review screen's server half: the letter, and the plan worked out against her day.

import { notFound } from "next/navigation";
import { todayInZone } from "@/lib/contract/dates";
import { planLinesFor } from "@/lib/review-plan";
import { requireUser } from "@/server/auth/session";
import { getDocument } from "@/server/documents";
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
 * The confirm handler will compute the same day the same way, which is what
 * keeps the card from promising a row the handler will not write.
 */
export default async function DocumentReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const document = await getDocument(id, user.id, user.timeZone);
  // A letter belonging to somebody else is absent, not forbidden: see
  // docs/api.md on why this is a 404 and never a 403.
  if (!document) notFound();

  const plan = planLinesFor(
    { dueDate: document.dueDate, dueTime: document.dueTime },
    todayInZone(user.timeZone),
    user.timeZone,
  );

  return <ReviewForm document={document} plan={plan} />;
}

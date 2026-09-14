import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Review extracted information"
        description={document.label}
      />
      <ReviewForm document={document} fields={document.fields} />
    </div>
  );
}

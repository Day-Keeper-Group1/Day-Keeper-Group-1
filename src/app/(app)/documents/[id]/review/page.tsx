import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { requireUser } from "@/server/auth/session";
import { documentDetailForUser } from "@/server/documents";
import { ReviewForm } from "./review-form";

export default async function DocumentReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const document = await documentDetailForUser(user.id, id);
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

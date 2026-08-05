import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { getDocumentById, getExtractionFields } from "@/lib/mock-data";
import { ReviewForm } from "./review-form";

export default async function DocumentReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const document = getDocumentById(id);
  if (!document) notFound();

  const fields = getExtractionFields(id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Review extracted information"
        description={`${document.issuer} · ${document.documentType}`}
      />
      <ReviewForm document={document} fields={fields} />
    </div>
  );
}

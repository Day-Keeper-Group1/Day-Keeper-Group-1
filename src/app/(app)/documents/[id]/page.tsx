import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/status-badge";
import { getDocumentById, MOCK_TASKS } from "@/lib/mock-data";

export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const document = getDocumentById(id);
  if (!document) notFound();

  const relatedTasks = MOCK_TASKS.filter((task) => task.documentId === document.id);
  const needsReview = document.status === "needs-review";

  return (
    <div className="space-y-6">
      <PageHeader
        title={document.issuer}
        description={document.documentType}
        actions={
          needsReview ? (
            <Button
              render={
                <Link href={`/documents/${document.id}/review`}>
                  Review extracted information
                </Link>
              }
            />
          ) : undefined
        }
      />

      <div className="grid gap-6 md:grid-cols-2">
        <div className="flex aspect-[3/4] items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 md:order-2">
          <div className="flex flex-col items-center gap-2 px-6 text-center">
            <FileText className="size-8 text-muted-foreground" strokeWidth={1.5} />
            <p className="text-sm text-muted-foreground">
              Document preview isn&apos;t available yet in this prototype.
            </p>
          </div>
        </div>

        <div className="space-y-6 md:order-1">
          <section className="space-y-3 rounded-lg border border-border p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-foreground">Status</h2>
              <StatusBadge status={document.status} />
            </div>
            <dl className="grid grid-cols-2 gap-y-3 text-sm">
              <dt className="text-muted-foreground">Uploaded</dt>
              <dd className="text-right text-foreground">{document.uploadedAt}</dd>
              {document.dueDate ? (
                <>
                  <dt className="text-muted-foreground">Due date</dt>
                  <dd className="text-right text-foreground">{document.dueDate}</dd>
                </>
              ) : null}
              {document.amount ? (
                <>
                  <dt className="text-muted-foreground">Amount</dt>
                  <dd className="text-right text-foreground">{document.amount}</dd>
                </>
              ) : null}
              {document.reference ? (
                <>
                  <dt className="text-muted-foreground">Reference</dt>
                  <dd className="text-right text-foreground">{document.reference}</dd>
                </>
              ) : null}
            </dl>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-medium text-foreground">Related tasks</h2>
            {relatedTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No tasks have been created from this document yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {relatedTasks.map((task) => (
                  <li key={task.id}>
                    <Link
                      href="/tasks"
                      className="flex items-center justify-between rounded-lg border border-border px-4 py-3 hover:bg-muted/60"
                    >
                      <span>
                        <span className="block text-sm font-medium text-foreground">
                          {task.title}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          Due {task.dueDate}
                        </span>
                      </span>
                      <StatusBadge status={task.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

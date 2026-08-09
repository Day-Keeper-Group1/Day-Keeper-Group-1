import Link from "next/link";
import { ArrowRight, FileText, Upload } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/status-badge";
import { MOCK_DOCUMENTS, MOCK_TASKS } from "@/lib/mock-data";

export default function DashboardPage() {
  const needsReview = MOCK_DOCUMENTS.filter(
    (doc) => doc.status === "needs-review",
  );
  const overdueTasks = MOCK_TASKS.filter((task) => task.status === "overdue");
  const upcomingTasks = MOCK_TASKS.filter((task) => task.status === "upcoming");
  const recentDocuments = [...MOCK_DOCUMENTS]
    .sort((a, b) => (a.uploadedAt < b.uploadedAt ? 1 : -1))
    .slice(0, 5);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description="Here's what needs your attention today."
      />

      <div className="grid grid-cols-3 gap-3 sm:max-w-md">
        <SummaryStat label="Needs review" value={needsReview.length} />
        <SummaryStat label="Overdue" value={overdueTasks.length} />
        <SummaryStat label="Upcoming" value={upcomingTasks.length} />
      </div>

      <Link
        href="/documents/new"
        className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-5 py-4 transition-colors hover:bg-primary/10"
      >
        <span className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Upload className="size-4" strokeWidth={1.75} />
          </span>
          <span>
            <span className="block text-sm font-medium text-foreground">
              Upload a document photo
            </span>
            <span className="block text-sm text-muted-foreground">
              Add a letter, bill, or form
            </span>
          </span>
        </span>
        <ArrowRight
          className="size-4 text-muted-foreground"
          strokeWidth={1.75}
        />
      </Link>

      <div className="grid gap-8 md:grid-cols-3">
        <div className="space-y-8 md:col-span-2">
          <DashboardSection
            title="Needs review"
            emptyLabel="No documents need review right now."
          >
            {needsReview.map((doc) => (
              <Link
                key={doc.id}
                href={`/documents/${doc.id}/review`}
                className="flex items-center justify-between rounded-lg border border-border px-4 py-3 transition-colors hover:bg-muted/60"
              >
                <span>
                  <span className="block text-sm font-medium text-foreground">
                    {doc.issuer}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {doc.documentType}
                  </span>
                </span>
                <StatusBadge status={doc.status} />
              </Link>
            ))}
          </DashboardSection>

          <DashboardSection
            title="Overdue"
            emptyLabel="Nothing overdue. Good work."
          >
            {overdueTasks.map((task) => (
              <Link
                key={task.id}
                href={
                  task.documentId ? `/documents/${task.documentId}` : "/tasks"
                }
                className="flex items-center justify-between rounded-lg border border-border px-4 py-3 transition-colors hover:bg-muted/60"
              >
                <span>
                  <span className="block text-sm font-medium text-foreground">
                    {task.title}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    Was due {task.dueDate}
                  </span>
                </span>
                <StatusBadge status={task.status} />
              </Link>
            ))}
          </DashboardSection>

          <DashboardSection
            title="Upcoming"
            emptyLabel="No upcoming tasks yet."
          >
            {upcomingTasks.map((task) => (
              <Link
                key={task.id}
                href={
                  task.documentId ? `/documents/${task.documentId}` : "/tasks"
                }
                className="flex items-center justify-between rounded-lg border border-border px-4 py-3 transition-colors hover:bg-muted/60"
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
            ))}
          </DashboardSection>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-foreground">
              Recent documents
            </h2>
            <Link
              href="/documents"
              className="text-xs font-medium text-primary hover:underline"
            >
              View all
            </Link>
          </div>
          <ul className="space-y-2">
            {recentDocuments.map((doc) => (
              <li key={doc.id}>
                <Link
                  href={`/documents/${doc.id}`}
                  className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 transition-colors hover:bg-muted/60"
                >
                  <FileText
                    className="size-4 shrink-0 text-muted-foreground"
                    strokeWidth={1.75}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {doc.issuer}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {doc.uploadedAt}
                    </span>
                  </span>
                  <StatusBadge status={doc.status} />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: number }) {
  return (
    <Card className="py-0">
      <CardContent className="px-4 py-3">
        <p className="text-2xl font-semibold tabular-nums text-foreground">
          {value}
        </p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

function DashboardSection({
  title,
  emptyLabel,
  children,
}: {
  title: string;
  emptyLabel: string;
  children: React.ReactNode;
}) {
  const hasContent = Array.isArray(children)
    ? children.length > 0
    : Boolean(children);

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium text-foreground">{title}</h2>
      {hasContent ? (
        <div className="space-y-2">{children}</div>
      ) : (
        <EmptyState icon={FileText} title={emptyLabel} />
      )}
    </section>
  );
}

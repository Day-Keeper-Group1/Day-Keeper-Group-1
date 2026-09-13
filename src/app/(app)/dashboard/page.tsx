"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, FileText, Upload } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/status-badge";
import { TaskRow } from "@/components/task-row";
import { AccessibilitySettings } from "@/components/accessibility-settings";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { addDays } from "@/lib/contract/dates";
import {
  MOCK_DOCUMENTS,
  MOCK_TASKS,
  taskStatus,
  tasksInOrder,
  TODAY,
  type MockTask,
} from "@/lib/mock-data";

export default function DashboardPage() {
  // Mock-only state, local to this page: see tasks/page.tsx for why ticking
  // here does not (yet) travel anywhere else. It still shows the thing that
  // matters, that a tick is reversible from wherever a task is drawn.
  const [tasks, setTasks] = useState<MockTask[]>(MOCK_TASKS);

  function toggleDone(id: string) {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === id ? { ...task, done: !task.done } : task,
      ),
    );
  }

  const needsReview = MOCK_DOCUMENTS.filter(
    (doc) => doc.status === "needs-review",
  );
  const overdueCount = tasks.filter(
    (task) => taskStatus(task, TODAY) === "overdue",
  ).length;
  const upcomingCount = tasks.filter(
    (task) => taskStatus(task, TODAY) === "upcoming",
  ).length;
  const openTasks = tasksInOrder(tasks.filter((task) => !task.done));
  const todayTasks = openTasks.filter((task) => task.dueDate === TODAY);
  const nextSevenDays = addDays(TODAY, 7);
  const nextSevenDayTasks = openTasks.filter(
    (task) =>
      task.dueDate !== null &&
      task.dueDate > TODAY &&
      task.dueDate <= nextSevenDays,
  );
  const recentDocuments = [...MOCK_DOCUMENTS]
    .sort((a, b) => (a.uploadedAt < b.uploadedAt ? 1 : -1))
    .slice(0, 5);

  return (
    <Tabs defaultValue="dashboard" className="space-y-6">
      <TabsList variant="line" aria-label="Dashboard views">
        <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
        <TabsTrigger value="accessibility">Accessibility</TabsTrigger>
      </TabsList>

      <TabsContent value="dashboard" className="space-y-8">
        <PageHeader
          title="Dashboard"
          description="Here's what needs your attention today."
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:max-w-md">
          <SummaryStat label="Needs review" value={needsReview.length} />
          <SummaryStat label="Overdue" value={overdueCount} />
          <SummaryStat label="Upcoming" value={upcomingCount} />
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          <TaskDateSection
            title="Today"
            tasks={todayTasks}
            emptyTitle="Nothing is due today."
            emptyDescription="You are up to date for today."
            onToggle={toggleDone}
          />

          <TaskDateSection
            title="Next seven days"
            tasks={nextSevenDayTasks}
            emptyTitle="Nothing is due in the next seven days."
            emptyDescription="New dates will appear here when they are confirmed."
            onToggle={toggleDone}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
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

          <Link
            href="/calendar"
            className="flex items-center justify-between rounded-lg border border-border px-5 py-4 transition-colors hover:bg-muted/60"
          >
            <span className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-full bg-primary-soft text-primary">
                <CalendarDays className="size-4" strokeWidth={1.75} />
              </span>
              <span>
                <span className="block text-sm font-medium text-foreground">
                  Open the calendar
                </span>
                <span className="block text-sm text-muted-foreground">
                  Everything you&apos;ve confirmed, in one place
                </span>
              </span>
            </span>
            <ArrowRight
              className="size-4 text-muted-foreground"
              strokeWidth={1.75}
            />
          </Link>
        </div>

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

            <section className="space-y-3">
              <h2 className="text-sm font-medium text-foreground">
                Your tasks
              </h2>
              {openTasks.length === 0 ? (
                <EmptyState icon={FileText} title="Nothing open. Good work." />
              ) : (
                <div className="space-y-2">
                  {openTasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      onToggle={toggleDone}
                      href={
                        task.documentId
                          ? `/documents/${task.documentId}`
                          : undefined
                      }
                    />
                  ))}
                </div>
              )}
            </section>
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
      </TabsContent>

      <TabsContent value="accessibility">
        <AccessibilitySettings />
      </TabsContent>
    </Tabs>
  );
}

function TaskDateSection({
  title,
  tasks,
  emptyTitle,
  emptyDescription,
  onToggle,
}: {
  title: string;
  tasks: MockTask[];
  emptyTitle: string;
  emptyDescription: string;
  onToggle: (id: string) => void;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium text-foreground">{title}</h2>
      {tasks.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title={emptyTitle}
          description={emptyDescription}
          className="px-4 py-8"
        />
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              onToggle={onToggle}
              href={
                task.documentId ? `/documents/${task.documentId}` : undefined
              }
            />
          ))}
        </div>
      )}
    </section>
  );
}

function SummaryStat({ label, value }: { label: string; value: number }) {
  const href =
    label === "Needs review"
      ? "/tasks?filter=needs-review"
      : label === "Overdue"
        ? "/tasks?filter=overdue"
        : "/tasks?filter=upcoming";

  return (
    <Link
      href={href}
      aria-label={`View ${label.toLowerCase()} in Tasks`}
      className="block rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <Card className="h-full py-0 transition-colors hover:bg-muted/60">
        <CardContent className="flex min-h-28 flex-col justify-center gap-1 px-4 py-4">
          <p className="text-base font-bold text-foreground sm:text-lg">
            {label}
          </p>
          <p className="text-3xl font-bold tabular-nums text-foreground">
            {value}
          </p>
        </CardContent>
      </Card>
    </Link>
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

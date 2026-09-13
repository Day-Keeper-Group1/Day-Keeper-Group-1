"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ListChecks, Search } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/status-badge";
import { TaskRow } from "@/components/task-row";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  formatTaskWhen,
  MOCK_DOCUMENTS,
  MOCK_TASKS,
  taskStatus,
  tasksInOrder,
  TODAY,
  type MockTask,
  type TaskStatus,
} from "@/lib/mock-data";

type TaskFilter = "all" | "needs-review" | TaskStatus;

const FILTERS: { label: string; value: TaskFilter }[] = [
  { label: "All", value: "all" },
  { label: "Needs review", value: "needs-review" },
  { label: "Overdue", value: "overdue" },
  { label: "Upcoming", value: "upcoming" },
  { label: "No date", value: "no-date" },
  { label: "Completed", value: "completed" },
];

const SECTIONS: { title: string; status: TaskStatus }[] = [
  { title: "Overdue", status: "overdue" },
  { title: "Upcoming", status: "upcoming" },
  { title: "No date", status: "no-date" },
  { title: "Completed", status: "completed" },
];

export default function TasksPage() {
  const searchParams = useSearchParams();
  const requestedFilter = searchParams.get("filter");
  const initialFilter: TaskFilter =
    requestedFilter === "needs-review" ||
    requestedFilter === "overdue" ||
    requestedFilter === "upcoming" ||
    requestedFilter === "no-date" ||
    requestedFilter === "completed"
      ? requestedFilter
      : "all";

  // Mock-only state, local to this page: there is no backend yet (KAN board
  // tickets for the real API haven't landed), so ticking here does not
  // travel to the dashboard or the calendar. What it does demonstrate is
  // src/lib/contract/api.ts itself: the tick is the only thing that changes, and everything
  // else on the row is worked out fresh from it.
  const [tasks, setTasks] = useState<MockTask[]>(MOCK_TASKS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<TaskFilter>(initialFilter);
  const [query, setQuery] = useState("");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [lastCompletedId, setLastCompletedId] = useState<string | null>(null);

  function toggleDone(id: string) {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === id ? { ...task, done: !task.done } : task,
      ),
    );
    const task = tasks.find((item) => item.id === id);
    if (task && !task.done) setLastCompletedId(id);
    else setLastCompletedId(null);
  }

  const normalizedQuery = query.trim().toLowerCase();
  const matchingTasks = useMemo(
    () =>
      tasks.filter(
        (task) =>
          !normalizedQuery ||
          [task.title, task.issuer].some((value) =>
            value.toLowerCase().includes(normalizedQuery),
          ),
      ),
    [tasks, normalizedQuery],
  );
  const ordered = useMemo(() => {
    const sorted = tasksInOrder(matchingTasks);
    if (sortDirection === "asc") return sorted;

    const dated = sorted.filter((task) => task.dueDate !== null).reverse();
    const withoutDate = sorted.filter((task) => task.dueDate === null);
    return [...dated, ...withoutDate];
  }, [matchingTasks, sortDirection]);

  const sections = useMemo(
    () =>
      SECTIONS.filter(
        (section) => filter === "all" || filter === section.status,
      ).map((section) => ({
        ...section,
        tasks: ordered.filter(
          (task) => taskStatus(task, TODAY) === section.status,
        ),
      })),
    [ordered, filter],
  );

  const hasAnyTask = sections.some((section) => section.tasks.length > 0);
  const needsReview = MOCK_DOCUMENTS.filter(
    (document) =>
      document.status === "needs-review" &&
      (!normalizedQuery ||
        [document.issuer, document.documentType].some((value) =>
          value.toLowerCase().includes(normalizedQuery),
        )),
  );
  const showNeedsReview = filter === "all" || filter === "needs-review";
  const hasAnyContent =
    hasAnyTask || (showNeedsReview && needsReview.length > 0);
  const selectedTask = tasks.find((task) => task.id === selectedId) ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tasks"
        description="Everything DayKeeper thinks you need to do."
      />

      <Tabs
        value={filter}
        onValueChange={(value) => setFilter(value as TaskFilter)}
      >
        <TabsList className="flex-wrap">
          {FILTERS.map((item) => (
            <TabsTrigger key={item.value} value={item.value}>
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <label className="relative block">
          <span className="sr-only">Search tasks</span>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search tasks or organisations"
            className="pl-9"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Sort by due date</span>
          <select
            value={sortDirection}
            onChange={(event) =>
              setSortDirection(event.target.value as "asc" | "desc")
            }
            className="h-10 rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <option value="asc">Soonest first</option>
            <option value="desc">Latest first</option>
          </select>
        </label>
      </div>

      {lastCompletedId ? (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-success/40 bg-success-bg px-4 py-3"
        >
          <p className="text-sm font-medium text-foreground">
            Task marked as complete.
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setTasks((prev) =>
                prev.map((task) =>
                  task.id === lastCompletedId ? { ...task, done: false } : task,
                ),
              );
              setLastCompletedId(null);
            }}
          >
            Undo
          </Button>
        </div>
      ) : null}

      {!hasAnyContent ? (
        <EmptyState icon={ListChecks} title="No tasks here" />
      ) : (
        <div className="space-y-8">
          {showNeedsReview && needsReview.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-sm font-medium text-foreground">
                Needs review
              </h2>
              <ul className="space-y-2">
                {needsReview.map((document) => (
                  <li key={document.id}>
                    <Link
                      href={`/documents/${document.id}/review`}
                      className="flex items-center justify-between rounded-lg border border-border px-4 py-3 transition-colors hover:bg-muted/60"
                    >
                      <span>
                        <span className="block text-sm font-medium text-foreground">
                          {document.issuer}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {document.documentType}
                        </span>
                      </span>
                      <StatusBadge status={document.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {sections.map((section) =>
            section.tasks.length === 0 ? null : (
              <section key={section.status} className="space-y-3">
                <h2 className="text-sm font-medium text-foreground">
                  {section.title}
                </h2>
                <ul
                  className={
                    section.status === "completed"
                      ? "space-y-2 opacity-70"
                      : "space-y-2"
                  }
                >
                  {section.tasks.map((task) => (
                    <li key={task.id}>
                      <TaskRow
                        task={task}
                        onToggle={toggleDone}
                        onOpen={() => setSelectedId(task.id)}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ),
          )}
        </div>
      )}

      <Sheet
        open={Boolean(selectedTask)}
        onOpenChange={(open) => !open && setSelectedId(null)}
      >
        <SheetContent>
          {selectedTask ? (
            <>
              <SheetHeader>
                <SheetTitle>{selectedTask.title}</SheetTitle>
                <SheetDescription>{selectedTask.issuer}</SheetDescription>
              </SheetHeader>
              <div className="space-y-4 px-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">When</span>
                  <span className="text-foreground">
                    {formatTaskWhen(selectedTask, TODAY)}
                  </span>
                </div>
                {selectedTask.documentId ? (
                  <Link
                    href={`/documents/${selectedTask.documentId}`}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    View source document
                  </Link>
                ) : null}
              </div>
              <SheetFooter>
                <Button onClick={() => toggleDone(selectedTask.id)}>
                  {selectedTask.done ? "Mark as not done" : "Mark as complete"}
                </Button>
              </SheetFooter>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ListChecks } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { TaskRow } from "@/components/task-row";
import { Button } from "@/components/ui/button";
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
  MOCK_TASKS,
  taskStatus,
  tasksInOrder,
  TODAY,
  type MockTask,
  type TaskStatus,
} from "@/lib/mock-data";

const FILTERS: { label: string; value: "all" | TaskStatus }[] = [
  { label: "All", value: "all" },
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
  // Mock-only state, local to this page: there is no backend yet (KAN board
  // tickets for the real API haven't landed), so ticking here does not
  // travel to the dashboard or the calendar. What it does demonstrate is
  // src/lib/contract/api.ts itself: the tick is the only thing that changes, and everything
  // else on the row is worked out fresh from it.
  const [tasks, setTasks] = useState<MockTask[]>(MOCK_TASKS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | TaskStatus>("all");

  function toggleDone(id: string) {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === id ? { ...task, done: !task.done } : task,
      ),
    );
  }

  const ordered = useMemo(() => tasksInOrder(tasks), [tasks]);

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
  const selectedTask = tasks.find((task) => task.id === selectedId) ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tasks"
        description="Everything DayKeeper thinks you need to do."
      />

      <Tabs
        value={filter}
        onValueChange={(value) => setFilter(value as "all" | TaskStatus)}
      >
        <TabsList className="flex-wrap">
          {FILTERS.map((item) => (
            <TabsTrigger key={item.value} value={item.value}>
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {!hasAnyTask ? (
        <EmptyState icon={ListChecks} title="No tasks here" />
      ) : (
        <div className="space-y-8">
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

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ListChecks } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge, type Status } from "@/components/status-badge";
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
import { MOCK_TASKS, type MockTask } from "@/lib/mock-data";

const FILTERS: { label: string; value: "all" | Status }[] = [
  { label: "All", value: "all" },
  { label: "Overdue", value: "overdue" },
  { label: "Upcoming", value: "upcoming" },
  { label: "Completed", value: "completed" },
];

const SECTIONS: { title: string; status: Status }[] = [
  { title: "Overdue", status: "overdue" },
  { title: "Upcoming", status: "upcoming" },
  { title: "Completed", status: "completed" },
];

export default function TasksPage() {
  const [filter, setFilter] = useState<"all" | Status>("all");
  const [selectedTask, setSelectedTask] = useState<MockTask | null>(null);

  const sections = useMemo(
    () =>
      SECTIONS.filter(
        (section) => filter === "all" || filter === section.status,
      ).map((section) => ({
        ...section,
        tasks: MOCK_TASKS.filter((task) => task.status === section.status),
      })),
    [filter],
  );

  const hasAnyTask = sections.some((section) => section.tasks.length > 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tasks"
        description="Everything DayKeeper thinks you need to do."
      />

      <Tabs
        value={filter}
        onValueChange={(value) => setFilter(value as "all" | Status)}
      >
        <TabsList>
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
                      <button
                        type="button"
                        onClick={() => setSelectedTask(task)}
                        className="flex w-full items-center justify-between rounded-lg border border-border px-4 py-3 text-left transition-colors hover:bg-muted/60"
                      >
                        <span>
                          <span className="block text-sm font-medium text-foreground">
                            {task.title}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {task.issuer} &middot; due {task.dueDate}
                          </span>
                        </span>
                        <StatusBadge status={task.status} />
                      </button>
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
        onOpenChange={(open) => !open && setSelectedTask(null)}
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
                  <span className="text-muted-foreground">Status</span>
                  <StatusBadge status={selectedTask.status} />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Due date</span>
                  <span className="text-foreground">
                    {selectedTask.dueDate}
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
                {selectedTask.status !== "completed" ? (
                  <Button onClick={() => setSelectedTask(null)}>
                    Mark as complete
                  </Button>
                ) : null}
              </SheetFooter>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

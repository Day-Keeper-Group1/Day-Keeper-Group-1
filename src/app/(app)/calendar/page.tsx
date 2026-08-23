"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { TaskRow } from "@/components/task-row";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatDueTime } from "@/lib/contract/dates";
import { cn } from "@/lib/utils";
import {
  marksForTask,
  MOCK_TASKS,
  tasksInOrder,
  TODAY,
  type CalendarMark,
  type MockTask,
} from "@/lib/mock-data";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const [TODAY_YEAR, TODAY_MONTH, TODAY_DAY] = TODAY.split("-").map(Number);

function isoOf(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Monday-first weekday index (0 = Monday) for the 1st of a month. */
function firstWeekday(year: number, month: number): number {
  const jsDay = new Date(year, month - 1, 1).getDay(); // 0 = Sunday
  return (jsDay + 6) % 7;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export default function CalendarPage() {
  // Mock-only state, local to this page: see tasks/page.tsx. Ticking a task
  // from the day sheet works the same way src/lib/contract/api.ts requires everywhere else,
  // it just does not (yet) travel back to the tasks page without a backend.
  const [tasks, setTasks] = useState<MockTask[]>(MOCK_TASKS);
  const [year, setYear] = useState(TODAY_YEAR);
  const [month, setMonth] = useState(TODAY_MONTH); // 1-12
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  function toggleDone(id: string) {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === id ? { ...task, done: !task.done } : task,
      ),
    );
  }

  function moveMonth(step: number) {
    setSelectedDay(null);
    let m = month + step;
    let y = year;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    setMonth(m);
    setYear(y);
  }

  function goToday() {
    setSelectedDay(null);
    setYear(TODAY_YEAR);
    setMonth(TODAY_MONTH);
  }

  const marksByDay = useMemo(() => {
    const map = new Map<number, CalendarMark[]>();
    for (const task of tasks) {
      for (const mark of marksForTask(task)) {
        const [y, mo, d] = mark.date.split("-").map(Number);
        if (y === year && mo === month) {
          const list = map.get(d) ?? [];
          list.push(mark);
          map.set(d, list);
        }
      }
    }
    return map;
  }, [tasks, year, month]);

  const ordered = useMemo(() => tasksInOrder(tasks), [tasks]);
  const isCurrentMonth = year === TODAY_YEAR && month === TODAY_MONTH;

  const cells: Array<{ day: number } | null> = [];
  for (let i = 0; i < firstWeekday(year, month); i++) cells.push(null);
  for (let d = 1; d <= daysInMonth(year, month); d++) cells.push({ day: d });
  while (cells.length % 7 !== 0) cells.push(null);

  const selectedMarks = selectedDay ? (marksByDay.get(selectedDay) ?? []) : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendar"
        description="Everything you've confirmed, in one place."
        actions={
          <Button
            variant="outline"
            size="sm"
            disabled={isCurrentMonth}
            onClick={goToday}
          >
            Back to today
          </Button>
        }
      />

      <Card>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Button
              variant="secondary"
              size="icon-sm"
              aria-label="Previous month"
              onClick={() => moveMonth(-1)}
            >
              <ChevronLeft className="size-4" strokeWidth={2} />
            </Button>
            <p className="text-base font-semibold text-foreground">
              {MONTH_NAMES[month - 1]} {year}
            </p>
            <Button
              variant="secondary"
              size="icon-sm"
              aria-label="Next month"
              onClick={() => moveMonth(1)}
            >
              <ChevronRight className="size-4" strokeWidth={2} />
            </Button>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {WEEKDAY_LABELS.map((label) => (
              <div
                key={label}
                className="py-1 text-center text-[11px] font-medium text-muted-foreground"
              >
                {label}
              </div>
            ))}

            {cells.map((cell, index) => {
              if (!cell) return <div key={`blank-${index}`} />;
              const marks = marksByDay.get(cell.day) ?? [];
              const hasMarks = marks.length > 0;
              const isToday = isCurrentMonth && cell.day === TODAY_DAY;
              const isSelected = selectedDay === cell.day;
              const dueMarks = marks.filter((m) => m.kind === "due").length;
              const reminderMarks = marks.filter(
                (m) => m.kind === "reminder",
              ).length;

              return (
                <button
                  key={cell.day}
                  type="button"
                  disabled={!hasMarks}
                  onClick={() => setSelectedDay(isSelected ? null : cell.day)}
                  className={cn(
                    "flex min-h-14 flex-col items-center justify-start gap-1 rounded-md py-1.5 text-sm",
                    hasMarks && "cursor-pointer",
                    isSelected
                      ? "bg-primary font-semibold text-primary-foreground"
                      : isToday
                        ? "border border-primary/40 text-foreground"
                        : "text-foreground",
                  )}
                >
                  <span>{cell.day}</span>
                  <span className="flex h-1.5 items-center gap-0.5">
                    {Array.from({ length: Math.min(dueMarks, 2) }).map(
                      (_, i) => (
                        <span
                          key={`due-${i}`}
                          className={cn(
                            "size-1.5 rounded-full",
                            isSelected ? "bg-primary-foreground" : "bg-dot-due",
                          )}
                        />
                      ),
                    )}
                    {Array.from({ length: Math.min(reminderMarks, 2) }).map(
                      (_, i) => (
                        <span
                          key={`rem-${i}`}
                          className={cn(
                            "size-1.5 rounded-full",
                            isSelected ? "bg-primary-foreground" : "bg-dot-rem",
                          )}
                        />
                      ),
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-4 pt-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-dot-due" /> Due date
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-dot-rem" /> Reminder
            </span>
          </div>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-foreground">Tasks</h2>
        {ordered.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing yet.</p>
        ) : (
          <div className="space-y-2">
            {ordered.map((task) => (
              <TaskRow key={task.id} task={task} onToggle={toggleDone} />
            ))}
          </div>
        )}
      </section>

      <Sheet
        open={selectedDay !== null}
        onOpenChange={(open) => !open && setSelectedDay(null)}
      >
        <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto">
          {selectedDay !== null ? (
            <>
              <SheetHeader>
                <SheetTitle>
                  {new Date(year, month - 1, selectedDay).toLocaleDateString(
                    "en-AU",
                    { weekday: "long", day: "numeric", month: "long" },
                  )}
                </SheetTitle>
              </SheetHeader>
              <div className="space-y-4 px-4 pb-4">
                {selectedMarks.map((mark, index) => {
                  const task = tasks.find((t) => t.id === mark.taskId);
                  if (!task) return null;

                  if (mark.kind === "due") {
                    return (
                      <div
                        key={`due-${task.id}-${index}`}
                        className="space-y-2"
                      >
                        <TaskRow task={task} onToggle={toggleDone} />
                        {task.documentId ? (
                          <Link
                            href={`/documents/${task.documentId}`}
                            className="block px-1 text-xs font-medium text-primary hover:underline"
                          >
                            View source document
                          </Link>
                        ) : null}
                      </div>
                    );
                  }

                  // A reminder mark: the same check the real dispatcher makes
                  // at fire time, drawn ahead of time. Done means it stays
                  // silent; a date behind today means it already fired; a
                  // date ahead of today means it is still planned.
                  const dayIso = isoOf(year, month, selectedDay);
                  const past = dayIso < TODAY;
                  const line = task.done
                    ? "No reminder, this is already done."
                    : past
                      ? "A reminder went out this morning, 9 am."
                      : "A reminder goes out this morning, 9 am.";

                  return (
                    <div
                      key={`rem-${task.id}-${index}`}
                      className="space-y-1 rounded-lg border border-border px-4 py-3"
                    >
                      <p className="text-xs font-medium text-warn">{line}</p>
                      <p className="text-sm font-medium text-foreground">
                        {task.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {task.dueDate ? `due ${task.dueDate}` : null}
                        {task.dueTime
                          ? ` · ${formatDueTime(task.dueTime)}`
                          : null}
                      </p>
                    </div>
                  );
                })}
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

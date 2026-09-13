"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarClock, ChevronLeft, ChevronRight, Plus } from "lucide-react";
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
import { addDays, formatDueDate, formatDueTime } from "@/lib/contract/dates";
import { cn } from "@/lib/utils";
import {
  marksForTask,
  MOCK_TASKS,
  tasksInOrder,
  taskStatus,
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
  const [view, setView] = useState<"month" | "week">("month");
  const [showAppointments, setShowAppointments] = useState(true);
  const [showOverdue, setShowOverdue] = useState(true);
  const [showReminders, setShowReminders] = useState(true);
  const [showCompleted, setShowCompleted] = useState(true);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskIssuer, setNewTaskIssuer] = useState("");
  const [newTaskDate, setNewTaskDate] = useState(TODAY);
  const [newTaskTime, setNewTaskTime] = useState("");
  const [selectedTaskIndex, setSelectedTaskIndex] = useState(0);

  function toggleDone(id: string) {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === id ? { ...task, done: !task.done } : task,
      ),
    );
  }

  function moveMonth(step: number) {
    setSelectedDay(null);
    setSelectedTaskIndex(0);
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
    setSelectedTaskIndex(0);
    setYear(TODAY_YEAR);
    setMonth(TODAY_MONTH);
  }

  function createTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = newTaskTitle.trim();
    const issuer = newTaskIssuer.trim();
    if (!title || !issuer) return;
    setTasks((prev) => [
      ...prev,
      {
        id: `task_${Date.now()}`,
        title,
        issuer,
        dueDate: newTaskDate || null,
        dueTime: newTaskTime || undefined,
        done: false,
      },
    ]);
    setNewTaskTitle("");
    setNewTaskIssuer("");
    setNewTaskDate(TODAY);
    setNewTaskTime("");
    setShowCreateTask(false);
  }

  const visibleTasks = useMemo(
    () =>
      tasks.filter((task) => {
        if (!showCompleted && task.done) return false;
        if (!showAppointments && task.dueTime) return false;
        if (!showOverdue && taskStatus(task, TODAY) === "overdue") return false;
        return true;
      }),
    [tasks, showAppointments, showCompleted, showOverdue],
  );

  const marksByDay = useMemo(() => {
    const map = new Map<number, CalendarMark[]>();
    for (const task of visibleTasks) {
      for (const mark of marksForTask(task)) {
        if (mark.kind === "reminder" && !showReminders) continue;
        const [y, mo, d] = mark.date.split("-").map(Number);
        if (y === year && mo === month) {
          const list = map.get(d) ?? [];
          list.push(mark);
          map.set(d, list);
        }
      }
    }
    return map;
  }, [visibleTasks, year, month, showReminders]);

  const ordered = useMemo(() => tasksInOrder(visibleTasks), [visibleTasks]);
  const isCurrentMonth = year === TODAY_YEAR && month === TODAY_MONTH;

  const cells: Array<{ day: number } | null> = [];
  for (let i = 0; i < firstWeekday(year, month); i++) cells.push(null);
  for (let d = 1; d <= daysInMonth(year, month); d++) cells.push({ day: d });
  while (cells.length % 7 !== 0) cells.push(null);

  const selectedMarks = selectedDay ? (marksByDay.get(selectedDay) ?? []) : [];
  const selectedDate = selectedDay ? isoOf(year, month, selectedDay) : TODAY;
  const selectedTasks = visibleTasks.filter(
    (task) => task.dueDate === selectedDate,
  );
  const selectedTask = selectedTasks[selectedTaskIndex] ?? selectedTasks[0];
  const weekStart = addDays(
    selectedDate,
    -((new Date(`${selectedDate}T00:00:00Z`).getUTCDay() + 6) % 7),
  );
  const weekDates = Array.from({ length: 7 }, (_, index) =>
    addDays(weekStart, index),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendar"
        description="Everything you've confirmed, in one place."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={isCurrentMonth}
              onClick={goToday}
            >
              Back to today
            </Button>
            <Button size="sm" onClick={() => setShowCreateTask(true)}>
              <Plus />
              Add task
            </Button>
          </div>
        }
      />

      <Card>
        <CardContent className="space-y-4 p-3 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <Button
              variant="secondary"
              size="icon-sm"
              aria-label="Previous month"
              onClick={() => moveMonth(-1)}
            >
              <ChevronLeft className="size-4" strokeWidth={2} />
            </Button>
            <div className="min-w-0 text-center">
              <p className="truncate text-base font-semibold text-foreground">
                {MONTH_NAMES[month - 1]} {year}
              </p>
              <p className="text-xs text-muted-foreground">
                Select a date to view its tasks
              </p>
            </div>
            <Button
              variant="secondary"
              size="icon-sm"
              aria-label="Next month"
              onClick={() => moveMonth(1)}
            >
              <ChevronRight className="size-4" strokeWidth={2} />
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div
              className="flex rounded-lg border border-border p-1"
              role="group"
              aria-label="Calendar view"
            >
              {(["month", "week"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={view === option}
                  onClick={() => setView(option)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium capitalize",
                    view === option
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              {[
                ["Appointments", showAppointments, setShowAppointments],
                ["Overdue", showOverdue, setShowOverdue],
                ["Reminders", showReminders, setShowReminders],
                ["Completed", showCompleted, setShowCompleted],
              ].map(([label, checked, setter]) => (
                <label
                  key={label as string}
                  className="flex items-center gap-1.5"
                >
                  <input
                    type="checkbox"
                    checked={checked as boolean}
                    onChange={(event) =>
                      (setter as (value: boolean) => void)(event.target.checked)
                    }
                    className="accent-primary"
                  />
                  {label as string}
                </label>
              ))}
            </div>
          </div>

          {view === "month" ? (
            <div className="grid grid-cols-7 gap-1 sm:gap-2">
              {WEEKDAY_LABELS.map((label) => (
                <div
                  key={label}
                  className="py-1 text-center text-[10px] font-bold uppercase tracking-wide text-muted-foreground sm:text-xs"
                >
                  {label}
                </div>
              ))}
              {cells.map((cell, index) => {
                if (!cell) {
                  return (
                    <div
                      key={`blank-${index}`}
                      aria-hidden="true"
                      className="min-h-14 rounded-md sm:min-h-20"
                    />
                  );
                }
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
                    onClick={() => {
                      setSelectedDay(isSelected ? null : cell.day);
                      setSelectedTaskIndex(0);
                    }}
                    aria-current={isToday ? "date" : undefined}
                    aria-label={`${MONTH_NAMES[month - 1]} ${cell.day}, ${year}${isToday ? ", today" : ""}${hasMarks ? `, ${marks.length} ${marks.length === 1 ? "task" : "tasks"}` : ", no tasks"}`}
                    className={cn(
                      "flex min-h-14 flex-col items-center justify-start gap-1 rounded-md border border-transparent py-1.5 text-sm transition-colors sm:min-h-20 sm:py-2",
                      hasMarks &&
                        "cursor-pointer hover:border-primary/30 hover:bg-primary-soft/50",
                      isSelected
                        ? "border-primary bg-primary font-semibold text-primary-foreground hover:bg-primary"
                        : isToday
                          ? "border-primary/40 bg-primary-soft/30 font-semibold text-foreground"
                          : hasMarks
                            ? "text-foreground"
                            : "text-muted-foreground",
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
                              isSelected
                                ? "bg-primary-foreground"
                                : "bg-dot-due",
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
                              isSelected
                                ? "bg-primary-foreground"
                                : "bg-dot-rem",
                            )}
                          />
                        ),
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-7">
              {weekDates.map((date) => {
                const dateTasks = visibleTasks.filter(
                  (task) => task.dueDate === date,
                );
                const dateParts = date.split("-").map(Number);
                const isToday = date === TODAY;
                return (
                  <button
                    key={date}
                    type="button"
                    onClick={() => {
                      setYear(dateParts[0]);
                      setMonth(dateParts[1]);
                      setSelectedDay(dateParts[2]);
                      setSelectedTaskIndex(0);
                    }}
                    className={cn(
                      "min-h-24 rounded-lg border p-3 text-left transition-colors hover:border-primary/50 hover:bg-primary-soft/30",
                      isToday && "border-primary bg-primary-soft/30",
                    )}
                    aria-label={`${formatDueDate(date, "long")}, ${dateTasks.length} ${dateTasks.length === 1 ? "task" : "tasks"}`}
                  >
                    <span className="block text-xs font-bold uppercase text-muted-foreground">
                      {formatDueDate(date, "short")}
                    </span>
                    <span className="mt-2 block text-sm font-semibold text-foreground">
                      {dateTasks.length
                        ? `${dateTasks.length} ${dateTasks.length === 1 ? "task" : "tasks"}`
                        : "No tasks"}
                    </span>
                    {dateTasks.slice(0, 2).map((task) => (
                      <span
                        key={task.id}
                        className="mt-1 block truncate text-xs text-muted-foreground"
                      >
                        {task.title}
                      </span>
                    ))}
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-3 text-xs text-muted-foreground">
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
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-medium text-foreground">All tasks</h2>
          <p className="text-xs text-muted-foreground">
            {ordered.length} {ordered.length === 1 ? "task" : "tasks"}
          </p>
        </div>
        {ordered.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            Nothing scheduled yet.
          </p>
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
                {selectedTasks.length > 1 ? (
                  <div className="flex items-center gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={selectedTaskIndex === 0}
                      onClick={() =>
                        setSelectedTaskIndex((index) => Math.max(0, index - 1))
                      }
                    >
                      Previous task
                    </Button>
                    <p
                      className="text-xs text-muted-foreground"
                      aria-live="polite"
                    >
                      Task {selectedTaskIndex + 1} of {selectedTasks.length}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={selectedTaskIndex === selectedTasks.length - 1}
                      onClick={() =>
                        setSelectedTaskIndex((index) =>
                          Math.min(selectedTasks.length - 1, index + 1),
                        )
                      }
                    >
                      Next task
                    </Button>
                  </div>
                ) : null}
              </SheetHeader>
              <div className="space-y-4 px-4 pb-4">
                {selectedTask ? (
                  <div className="rounded-lg border border-primary/30 bg-primary-soft/20 px-4 py-3">
                    <p className="text-xs font-medium text-muted-foreground">
                      Selected task
                    </p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {selectedTask.title}
                    </p>
                    {selectedTask.dueTime ? (
                      <p className="mt-1 flex items-center gap-1 text-xs font-medium text-primary">
                        <CalendarClock className="size-3" aria-hidden="true" />
                        Appointment at {formatDueTime(selectedTask.dueTime)}
                      </p>
                    ) : null}
                    <Link
                      href="/tasks"
                      className="mt-2 inline-block text-xs font-medium text-primary hover:underline"
                    >
                      View all tasks
                    </Link>
                  </div>
                ) : null}
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

      <Sheet open={showCreateTask} onOpenChange={setShowCreateTask}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>Add a task</SheetTitle>
            <p className="text-sm text-muted-foreground">
              Add a task or appointment to your local calendar.
            </p>
          </SheetHeader>
          <form onSubmit={createTask} className="space-y-4 px-4">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-foreground">Task</span>
              <input
                required
                value={newTaskTitle}
                onChange={(event) => setNewTaskTitle(event.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-foreground">
                Organisation
              </span>
              <input
                required
                value={newTaskIssuer}
                onChange={(event) => setNewTaskIssuer(event.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-foreground">
                Due date
              </span>
              <input
                type="date"
                value={newTaskDate}
                onChange={(event) => setNewTaskDate(event.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-foreground">
                Appointment time (optional)
              </span>
              <input
                type="time"
                value={newTaskTime}
                onChange={(event) => setNewTaskTime(event.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </label>
            <Button type="submit">Add task</Button>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}

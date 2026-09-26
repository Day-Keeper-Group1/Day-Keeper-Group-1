"use client";

// KAN-57: the calendar, drawn to the prototype: a month of dots, a day sheet, and the task list.

import { useMemo, useState } from "react";

import { BottomSheet } from "@/components/bottom-sheet";
import { Panel, PillButton, ScreenHeader } from "@/components/screen";
import { TaskRow } from "@/components/task-row";
import { TaskEntry, TaskSheet, useTaskDetail } from "@/components/task-sheet";
import { monthCells, tasksByDueDay, tasksForMonth } from "@/lib/calendar";
import { deriveTaskStatus, type TaskSummary } from "@/lib/contract/api";
import { formatDueDate } from "@/lib/contract/dates";
import { toggleTaskDone } from "@/lib/task-actions";
import { cn } from "@/lib/utils";

/**
 * The month names, spelled out for the title above the grid.
 *
 * src/lib/contract/dates.ts owns every date a person reads, but it writes three
 * styles and none of them is "a month and a year on its own". Rather than widen
 * that module for one heading, the heading keeps its own list here, where it is
 * the only thing using it.
 */
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

/** Monday first, the way an Australian wall calendar is printed. */
const WEEKDAY_INITIALS = ["M", "T", "W", "T", "F", "S", "S"];

const SAVE_FAILED =
  "We couldn't save that just now. Please try again in a moment.";

/**
 * One heading inside the Tasks panel. Drawn empty only when told what to say
 * about the absence, which the month heading is: a month with nothing due is
 * news, whereas "no overdue tasks" is a row about nothing.
 */
function MonthTaskGroup({
  heading,
  tasks,
  empty,
  onToggle,
  onOpen,
}: {
  heading: string;
  tasks: TaskSummary[];
  empty?: string;
  onToggle: (task: TaskSummary) => void;
  onOpen: (taskId: string) => void;
}) {
  if (tasks.length === 0 && !empty) return null;

  return (
    <section>
      <h3 className="text-caption font-bold text-ink-dim">{heading}</h3>
      {tasks.length === 0 ? (
        <p className="flex min-h-12 items-center text-row text-ink-dim">
          {empty}
        </p>
      ) : (
        <ul>
          {tasks.map((task) => (
            <li key={task.id} className="border-t border-line first:border-t-0">
              <TaskRow
                task={task}
                onToggle={onToggle}
                onOpen={() => onOpen(task.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function CalendarScreen({
  initial,
  today,
  timeZone,
  initialMonth,
}: {
  initial: TaskSummary[];
  today: string;
  timeZone: string;
  /**
   * KAN-59: the month to open at, 'YYYY-MM', when she was sent here to see
   * something land: the month of the last task she saved. Today's month
   * otherwise.
   */
  initialMonth?: string | null;
}) {
  const [todayYear, todayMonth] = today.split("-").map(Number);
  const [openYear, openMonth] = (initialMonth ?? today).split("-").map(Number);

  const [tasks, setTasks] = useState<TaskSummary[]>(initial);
  const [message, setMessage] = useState<string | null>(null);
  const [year, setYear] = useState(openYear);
  const [month, setMonth] = useState(openMonth);
  /** The task open in its own sheet, from the list, by id. */
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  /** The open day, 'YYYY-MM-DD', or null when the sheet is shut. */
  const [selected, setSelected] = useState<string | null>(null);

  const byDay = useMemo(() => tasksByDueDay(tasks), [tasks]);
  const cells = useMemo(() => monthCells(year, month), [year, month]);
  const listed = useMemo(
    () => tasksForMonth(tasks, year, month),
    [tasks, year, month],
  );
  const onTodaysMonth = year === todayYear && month === todayMonth;
  const selectedTasks = useMemo(
    () => (selected ? (byDay.get(selected) ?? []) : []),
    [selected, byDay],
  );

  function moveMonth(step: number) {
    setSelected(null);
    const shifted = month + step;
    if (shifted < 1) {
      setMonth(12);
      setYear(year - 1);
    } else if (shifted > 12) {
      setMonth(1);
      setYear(year + 1);
    } else {
      setMonth(shifted);
    }
  }

  function goToday() {
    if (onTodaysMonth) return;
    setSelected(null);
    setYear(todayYear);
    setMonth(todayMonth);
  }

  /**
   * Tick or untick, on screen first and on the server after.
   *
   * The tick is the only thing a person writes in this product, so it answers
   * at once and the request catches up. If the request fails the row goes back
   * to exactly the task we started from and says so, because a tick that looks
   * saved and is not is worse than one that visibly refused.
   */
  async function onToggle(task: TaskSummary) {
    const optimistic: TaskSummary = {
      ...task,
      status:
        task.status === "completed"
          ? deriveTaskStatus("open", task.dueDate, new Date(), timeZone)
          : "completed",
    };
    setMessage(null);
    setTasks((prev) => prev.map((t) => (t.id === task.id ? optimistic : t)));
    try {
      const saved = await toggleTaskDone(task);
      setTasks((prev) => prev.map((t) => (t.id === task.id ? saved : t)));
    } catch (cause) {
      setTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)));
      setMessage(cause instanceof Error ? cause.message : SAVE_FAILED);
    }
  }

  return (
    <div>
      <ScreenHeader
        title="Calendar"
        subtitle="Everything you've confirmed, in one place."
        action={
          <PillButton
            onClick={goToday}
            aria-disabled={onTodaysMonth}
            className={cn(onTodaysMonth && "opacity-40")}
          >
            Back to today
          </PillButton>
        }
      />

      {message ? (
        <p
          role="status"
          className="mb-3.5 rounded-[10px] bg-warn-bg px-3 py-[11px] text-caption leading-[1.45] text-warn"
        >
          {message}
        </p>
      ) : null}

      {/* The prototype's two cards: stacked on a phone, side by side once there
          is honestly room for both. Same sections in the same order either way.
          The split waits for lg rather than md because the sidebar has already
          taken 240px by 768px, and a month grid in half of what is left is
          narrower than the same grid on a phone. */}
      <div className="grid gap-3.5 lg:grid-cols-2 lg:items-start lg:gap-6">
        <Panel>
          {/* The prototype's `.cal-head`: two 36px pale green squares either
              side of a 16px bold month. Each answers taps 6px past its edge. */}
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => moveMonth(-1)}
              className="relative size-9 rounded-[8px] bg-primary-soft text-[20px] leading-none text-foreground after:absolute after:-inset-1.5"
            >
              &#8249;
            </button>
            <div className="text-row font-bold" aria-live="polite">
              {MONTH_NAMES[month - 1]} {year}
            </div>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => moveMonth(1)}
              className="relative size-9 rounded-[8px] bg-primary-soft text-[20px] leading-none text-foreground after:absolute after:-inset-1.5"
            >
              &#8250;
            </button>
          </div>

          <div className="grid grid-cols-7 gap-[3px]">
            {WEEKDAY_INITIALS.map((initial, index) => (
              <div
                key={index}
                aria-hidden="true"
                className="py-1 text-center text-dow text-ink-dim"
              >
                {initial}
              </div>
            ))}
            {cells.map((iso, index) =>
              iso === null ? (
                <div key={`pad-${index}`} aria-hidden="true" />
              ) : (
                <DayCell
                  key={iso}
                  iso={iso}
                  tasks={byDay.get(iso) ?? []}
                  selected={iso === selected}
                  onSelect={() => setSelected(iso)}
                />
              ),
            )}
          </div>
        </Panel>

        {/* The list says what the grid says: this month's tasks, with the
            overdue pinned above and the dateless below whatever month shows.
            src/lib/calendar.ts explains why it is not every task. */}
        <Panel title="Tasks">
          <div className="space-y-3">
            <MonthTaskGroup
              heading="Still to do"
              tasks={listed.overdue}
              onToggle={onToggle}
              onOpen={setOpenTaskId}
            />
            <MonthTaskGroup
              heading={MONTH_NAMES[month - 1]}
              tasks={listed.inMonth}
              empty={`Nothing due in ${MONTH_NAMES[month - 1]}`}
              onToggle={onToggle}
              onOpen={setOpenTaskId}
            />
            <MonthTaskGroup
              heading="No date"
              tasks={listed.undated}
              onToggle={onToggle}
              onOpen={setOpenTaskId}
            />
          </div>
        </Panel>
      </div>

      <BottomSheet
        open={selected !== null}
        onClose={() => setSelected(null)}
        heading={selected ? formatDueDate(selected, "long") : ""}
      >
        {selectedTasks.map((task, index) => (
          <div
            key={task.id}
            className={cn(index > 0 && "mt-3 border-t border-line pt-3")}
          >
            <DueEntry task={task} onToggle={onToggle} />
          </div>
        ))}
      </BottomSheet>

      {/* KAN-59: a task in the list opens in its own sheet, as on Home. */}
      <TaskSheet
        task={tasks.find((task) => task.id === openTaskId) ?? null}
        onClose={() => setOpenTaskId(null)}
        onToggle={onToggle}
      />
    </div>
  );
}

/**
 * One day in the grid.
 *
 * A day with nothing on it is not a button. Making every square pressable would
 * hand a screen reader thirty-one identical controls, thirty of which open an
 * empty sheet; the dots are what there is to look at, so the dots are what is
 * pressable. The label spells out how many things are on the day, because a dot
 * cannot be read aloud and colour is never the only signal (docs/theme.md).
 */
function DayCell({
  iso,
  tasks,
  selected,
  onSelect,
}: {
  iso: string;
  tasks: TaskSummary[];
  selected: boolean;
  onSelect: () => void;
}) {
  const day = Number(iso.slice(8, 10));
  const monthName = MONTH_NAMES[Number(iso.slice(5, 7)) - 1];
  // The empty day and the pressable one are the same box, so the grid keeps its
  // rhythm whether or not a day has anything on it. min-h-12: a day that opens
  // the sheet is a button like every other button in this product, and 48px is
  // the floor. Seven columns of a 375px screen cannot also be 48px wide, so the
  // width is what the month costs and the height is what the rule gets.
  // The prototype's `.cal .d`: 14px, 7px above the number, a 6px row of 5px
  // dots under it, an 8px corner, at least 34px tall.
  const shell =
    "flex min-h-[34px] flex-col items-center rounded-[8px] pt-[7px] pb-1 text-day";

  if (tasks.length === 0) {
    return (
      <div className={cn(shell, "text-foreground")}>
        <span className="leading-none">{day}</span>
        <span className="mt-0.5 h-1.5" />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`${day} ${monthName}, ${tasks.length} ${
        tasks.length === 1 ? "item" : "items"
      }`}
      className={cn(
        shell,
        "cursor-pointer",
        selected
          ? "bg-primary font-bold text-primary-foreground"
          : "text-foreground hover:bg-muted",
      )}
    >
      <span className="leading-none">{day}</span>
      <span className="mt-0.5 flex h-1.5 items-center gap-[3px]">
        {tasks.slice(0, 3).map((task) => (
          <span
            key={task.id}
            aria-hidden="true"
            className={cn(
              "size-[5px] rounded-full",
              selected ? "bg-primary-foreground" : "bg-dot-due",
            )}
          />
        ))}
      </span>
    </button>
  );
}

/**
 * The task itself, in the day sheet: the same inside as a task's own sheet
 * (src/components/task-sheet.tsx), the row with its tick, what the letter
 * said and the photographs, the way the prototype's day sheet draws a due day.
 * Opening the day a bill lands on and being shown only its title would be the
 * product forgetting why it asked for a photograph.
 */
function DueEntry({
  task,
  onToggle,
}: {
  task: TaskSummary;
  onToggle: (task: TaskSummary) => void;
}) {
  const detail = useTaskDetail(task.documentId ? task.id : null);
  return <TaskEntry task={task} detail={detail} onToggle={onToggle} />;
}

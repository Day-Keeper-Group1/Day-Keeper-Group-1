"use client";

// KAN-57: the calendar, drawn to the prototype: a month of dots, a day sheet, and the task list.

import { useEffect, useMemo, useState } from "react";

import { BottomSheet } from "@/components/bottom-sheet";
import { Panel, PillButton, ScreenHeader } from "@/components/screen";
import { TaskRow } from "@/components/task-row";
import { TaskEntry, TaskSheet, useTaskDetail } from "@/components/task-sheet";
import {
  monthCells,
  tasksByDueDay,
  tasksForMonth,
  tasksForWeek,
  weekCells,
} from "@/lib/calendar";
import { deriveTaskStatus, type TaskSummary } from "@/lib/contract/api";
import { addDays, formatDueDate } from "@/lib/contract/dates";
import {
  CALENDAR_PREFERENCES_STORAGE_KEY,
  CALENDAR_PREFERENCES_UPDATED_EVENT,
  DEFAULT_CALENDAR_PREFERENCES,
  parseCalendarPreferences,
  type CalendarView,
  type WeekStartDay,
} from "@/lib/calendar-preferences";
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

const WEEKDAY_INITIALS: Record<WeekStartDay, string[]> = {
  monday: ["M", "T", "W", "T", "F", "S", "S"],
  sunday: ["S", "M", "T", "W", "T", "F", "S"],
};

function formatWeekHeading(days: string[]): string {
  const first = days[0];
  const last = days[6];
  if (!first || !last) return "";

  const dateLabel = (iso: string) =>
    `${MONTH_NAMES[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}`;
  const firstYear = first.slice(0, 4);
  const lastYear = last.slice(0, 4);
  return firstYear === lastYear
    ? `${dateLabel(first)} - ${dateLabel(last)}, ${lastYear}`
    : `${dateLabel(first)}, ${firstYear} - ${dateLabel(last)}, ${lastYear}`;
}

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

  const [tasks, setTasks] = useState<TaskSummary[]>(initial);
  const [message, setMessage] = useState<string | null>(null);
  const [anchorDate, setAnchorDate] = useState(
    initialMonth ? `${initialMonth}-01` : today,
  );
  const [view, setView] = useState<CalendarView>(
    DEFAULT_CALENDAR_PREFERENCES.defaultView,
  );
  const [weekStartsOn, setWeekStartsOn] = useState<WeekStartDay>(
    DEFAULT_CALENDAR_PREFERENCES.weekStartsOn,
  );
  const [preferencesError, setPreferencesError] = useState<string | null>(null);
  /** The task open in its own sheet, from the list, by id. */
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  /** The open day, 'YYYY-MM-DD', or null when the sheet is shut. */
  const [selected, setSelected] = useState<string | null>(null);

  const [year, month] = anchorDate.split("-").map(Number);
  const byDay = useMemo(() => tasksByDueDay(tasks), [tasks]);
  const cells = useMemo(
    () =>
      view === "month"
        ? monthCells(year, month, weekStartsOn)
        : weekCells(anchorDate, weekStartsOn),
    [anchorDate, month, view, weekStartsOn, year],
  );
  const listed = useMemo(() => {
    if (view === "month") {
      const monthTasks = tasksForMonth(tasks, year, month);
      return {
        overdue: monthTasks.overdue,
        inPeriod: monthTasks.inMonth,
        undated: monthTasks.undated,
      };
    }
    const weekTasks = tasksForWeek(
      tasks,
      weekCells(anchorDate, weekStartsOn)[0] ?? anchorDate,
    );
    return {
      overdue: weekTasks.overdue,
      inPeriod: weekTasks.inWeek,
      undated: weekTasks.undated,
    };
  }, [anchorDate, month, tasks, view, weekStartsOn, year]);
  const isCurrentPeriod =
    view === "month"
      ? year === todayYear && month === todayMonth
      : weekCells(anchorDate, weekStartsOn).includes(today);
  const selectedTasks = useMemo(
    () => (selected ? (byDay.get(selected) ?? []) : []),
    [selected, byDay],
  );

  useEffect(() => {
    function refreshPreferences() {
      try {
        const preferences = parseCalendarPreferences(
          window.localStorage.getItem(CALENDAR_PREFERENCES_STORAGE_KEY),
        );
        setView(preferences.defaultView);
        setWeekStartsOn(preferences.weekStartsOn);
        setPreferencesError(null);
        setSelected(null);
      } catch (cause) {
        setPreferencesError(
          cause instanceof Error
            ? cause.message
            : "Calendar preferences could not be read.",
        );
      }
    }

    function onStorage(event: StorageEvent) {
      if (
        event.key === CALENDAR_PREFERENCES_STORAGE_KEY ||
        event.key === null
      ) {
        refreshPreferences();
      }
    }

    refreshPreferences();
    window.addEventListener("storage", onStorage);
    window.addEventListener(
      CALENDAR_PREFERENCES_UPDATED_EVENT,
      refreshPreferences,
    );
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(
        CALENDAR_PREFERENCES_UPDATED_EVENT,
        refreshPreferences,
      );
    };
  }, []);

  function movePeriod(step: number) {
    setSelected(null);
    if (view === "week") {
      setAnchorDate(addDays(anchorDate, step * 7));
    } else {
      const shifted = new Date(Date.UTC(year, month - 1 + step, 1));
      setAnchorDate(
        `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-01`,
      );
    }
  }

  function goToday() {
    if (isCurrentPeriod) return;
    setSelected(null);
    setAnchorDate(today);
  }

  function changeView(nextView: CalendarView) {
    setView(nextView);
    setSelected(null);
  }

  const periodTitle =
    view === "month"
      ? `${MONTH_NAMES[month - 1]} ${year}`
      : formatWeekHeading(weekCells(anchorDate, weekStartsOn));

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
            aria-disabled={isCurrentPeriod}
            className={cn(isCurrentPeriod && "opacity-40")}
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
      {preferencesError ? (
        <p role="alert" className="mb-3.5 text-base font-medium text-danger">
          {preferencesError}
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
          <div className="mb-2.5 flex items-center justify-between gap-1">
            <button
              type="button"
              aria-label={`Previous ${view}`}
              onClick={() => movePeriod(-1)}
              className="relative size-11 shrink-0 rounded-[8px] bg-primary-soft text-[20px] leading-none text-foreground after:absolute after:-inset-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              &#8249;
            </button>
            <div
              className="min-w-0 flex-1 text-center text-row font-bold"
              aria-live="polite"
            >
              {periodTitle}
            </div>
            <button
              type="button"
              aria-label={`Next ${view}`}
              onClick={() => movePeriod(1)}
              className="relative size-11 shrink-0 rounded-[8px] bg-primary-soft text-[20px] leading-none text-foreground after:absolute after:-inset-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              &#8250;
            </button>
            <div className="flex shrink-0 gap-1">
              {(["month", "week"] as const).map((calendarView) => (
                <button
                  key={calendarView}
                  type="button"
                  aria-pressed={view === calendarView}
                  onClick={() => changeView(calendarView)}
                  className={cn(
                    "min-h-11 rounded-lg px-2 text-caption font-semibold capitalize focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                    view === calendarView
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground hover:bg-primary-soft",
                  )}
                >
                  {calendarView}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-7 gap-[3px]">
            {WEEKDAY_INITIALS[weekStartsOn].map((initial, index) => (
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
            {view === "month" ? (
              <MonthTaskGroup
                heading={MONTH_NAMES[month - 1]}
                tasks={listed.inPeriod}
                empty={`Nothing due in ${MONTH_NAMES[month - 1]}`}
                onToggle={onToggle}
                onOpen={setOpenTaskId}
              />
            ) : (
              <MonthTaskGroup
                heading="This week"
                tasks={listed.inPeriod}
                empty="Nothing due this week"
                onToggle={onToggle}
                onOpen={setOpenTaskId}
              />
            )}
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

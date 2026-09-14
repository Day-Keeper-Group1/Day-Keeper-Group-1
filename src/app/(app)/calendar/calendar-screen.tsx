"use client";

// KAN-57: the calendar, drawn to the prototype: a month of dots, a day sheet, and the task list.

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Bell, BellOff } from "lucide-react";

import { FactRow } from "@/components/fact-row";
import { Panel, PillButton, ScreenHeader } from "@/components/screen";
import { TaskRow } from "@/components/task-row";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  marksByDay,
  monthCells,
  sheetLine,
  tasksForMonth,
  type CalendarMark,
} from "@/lib/calendar";
import {
  deriveTaskStatus,
  type TaskDetail,
  type TaskSummary,
} from "@/lib/contract/api";
import { formatDueDate, formatDueTime } from "@/lib/contract/dates";
import { factLines } from "@/lib/facts";
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
 * The date under a title in the day sheet.
 *
 * Always "due <date>", whatever has happened since. The prototype writes this
 * line as `'due ' + t.when` with no condition on it, and it is describing the
 * date the letter named rather than reporting on lateness; the row in the list
 * beside it is where "was due" belongs. A task with no date has no reminders
 * and never reaches this line, so the null case simply draws nothing.
 */
function dueCaption(task: TaskSummary): string | null {
  if (!task.dueDate) return null;
  const date = formatDueDate(task.dueDate, "short");
  return task.dueTime
    ? `due ${date}, ${formatDueTime(task.dueTime)}`
    : `due ${date}`;
}

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
}: {
  heading: string;
  tasks: TaskSummary[];
  empty?: string;
  onToggle: (task: TaskSummary) => void;
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
              <TaskRow task={task} onToggle={onToggle} />
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
}: {
  initial: TaskSummary[];
  today: string;
  timeZone: string;
}) {
  const [todayYear, todayMonth] = today.split("-").map(Number);

  const [tasks, setTasks] = useState<TaskSummary[]>(initial);
  const [message, setMessage] = useState<string | null>(null);
  const [year, setYear] = useState(todayYear);
  const [month, setMonth] = useState(todayMonth);
  /** The open day, 'YYYY-MM-DD', or null when the sheet is shut. */
  const [selected, setSelected] = useState<string | null>(null);
  /**
   * What each opened task's letter said, by task id.
   *
   * The list endpoint does not carry fields or a page count, so the day sheet
   * asks for them the first time a day containing that task is opened and keeps
   * the answer. A person reopening the same day gets it back without a request.
   */
  const [details, setDetails] = useState<Record<string, TaskDetail>>({});
  /** Task ids already asked for, so reopening a day asks for nothing twice. */
  const asked = useRef(new Set<string>());

  const byDay = useMemo(() => marksByDay(tasks), [tasks]);
  const cells = useMemo(() => monthCells(year, month), [year, month]);
  const listed = useMemo(
    () => tasksForMonth(tasks, year, month),
    [tasks, year, month],
  );
  const onTodaysMonth = year === todayYear && month === todayMonth;
  const selectedMarks = useMemo(
    () => (selected ? (byDay.get(selected) ?? []) : []),
    [selected, byDay],
  );

  // Which letters the open day needs, as a string, so that reopening the same
  // day does not re-run this effect on a freshly built array.
  const wanted = selectedMarks
    .filter((mark) => mark.kind === "due" && mark.task.documentId)
    .map((mark) => mark.task.id)
    .join(",");

  useEffect(() => {
    if (!wanted) return;
    let cancelled = false;

    void (async () => {
      for (const id of wanted.split(",")) {
        if (cancelled) return;
        // Asked for already, on this day or another one that shares the task.
        if (asked.current.has(id)) continue;
        asked.current.add(id);
        try {
          const response = await fetch(`/api/tasks/${id}`);
          if (!response.ok) {
            asked.current.delete(id);
            continue;
          }
          const detail = (await response.json()) as TaskDetail;
          if (cancelled) return;
          setDetails((prev) => ({ ...prev, [detail.id]: detail }));
        } catch {
          // The sheet still shows the task, its tick and its date. Saying
          // nothing about the letter is honest; an error box over a task she
          // opened to tick is not. Forgetting we asked lets the next opening
          // of the day try again.
          asked.current.delete(id);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [wanted]);

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
                  marks={byDay.get(iso) ?? []}
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
            />
            <MonthTaskGroup
              heading={MONTH_NAMES[month - 1]}
              tasks={listed.inMonth}
              empty={`Nothing due in ${MONTH_NAMES[month - 1]}`}
              onToggle={onToggle}
            />
            <MonthTaskGroup
              heading="No date"
              tasks={listed.undated}
              onToggle={onToggle}
            />
          </div>
        </Panel>
      </div>

      <Sheet
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        {/* The prototype's `.sheet`: a card-coloured panel with a 14px top
            corner, 18px of padding, 24px below, and a small dim date on top. */}
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="max-h-[76vh] gap-0 overflow-y-auto rounded-t-[14px] bg-card px-[18px] pt-[18px] pb-6"
        >
          <SheetHeader className="p-0">
            <SheetTitle className="mb-2 text-key font-semibold text-ink-dim">
              {selected ? formatDueDate(selected, "long") : ""}
            </SheetTitle>
          </SheetHeader>
          <div>
            {selectedMarks.map((mark, index) => (
              <div
                key={`${mark.kind}-${mark.reminder?.id ?? mark.task.id}`}
                className={cn(index > 0 && "mt-3 border-t border-line pt-3")}
              >
                {mark.kind === "reminder" ? (
                  <ReminderEntry mark={mark} today={today} />
                ) : (
                  <DueEntry
                    mark={mark}
                    detail={details[mark.task.id]}
                    onToggle={onToggle}
                  />
                )}
              </div>
            ))}
            <Button
              variant="quiet"
              size="block-quiet"
              className="mt-2"
              onClick={() => setSelected(null)}
            >
              Close
            </Button>
          </div>
        </SheetContent>
      </Sheet>
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
  marks,
  selected,
  onSelect,
}: {
  iso: string;
  marks: CalendarMark[];
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

  if (marks.length === 0) {
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
      aria-label={`${day} ${monthName}, ${marks.length} ${
        marks.length === 1 ? "item" : "items"
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
        {marks.slice(0, 3).map((mark, index) => (
          <span
            key={index}
            aria-hidden="true"
            className={cn(
              "size-[5px] rounded-full",
              selected
                ? "bg-primary-foreground"
                : mark.kind === "due"
                  ? "bg-dot-due"
                  : "bg-dot-rem",
            )}
          />
        ))}
      </span>
    </button>
  );
}

/**
 * A reminder morning, in the day sheet.
 *
 * There is no tick here on purpose. A reminder is not a thing to be done, it is
 * the system saying what it will do, so this entry says it and stops. The task
 * it belongs to is named underneath so the sentence is about something, and the
 * date under the name is the date the letter gave.
 */
function ReminderEntry({ mark, today }: { mark: CalendarMark; today: string }) {
  const Icon = mark.task.status === "completed" ? BellOff : Bell;
  const caption = dueCaption(mark.task);

  return (
    <div>
      {/* `.sheet .remind` over `.sheet .t`. */}
      <p className="mb-[3px] flex items-center gap-1.5 text-sub text-ink-dim">
        <Icon className="size-4 shrink-0" aria-hidden="true" strokeWidth={2} />
        {sheetLine(mark, today)}
      </p>
      <p className="text-button font-bold text-foreground">{mark.task.title}</p>
      {caption ? <p className="text-caption text-ink-dim">{caption}</p> : null}
    </div>
  );
}

/**
 * The task itself, in the day sheet.
 *
 * The same row as the list beside it, with the same working tick: operations
 * follow visibility, so wherever a task is drawn it can be ticked, however long
 * ago the day was. Underneath it, what the letter said and the photographs kept
 * with it, the way the prototype's day sheet draws a due day: opening the day a
 * bill lands on and being shown only its title is the product forgetting why it
 * asked for a photograph.
 */
function DueEntry({
  mark,
  detail,
  onToggle,
}: {
  mark: CalendarMark;
  detail?: TaskDetail;
  onToggle: (task: TaskSummary) => void;
}) {
  // What the letter says, as it may be shown: the same rows the letter and the
  // review screens draw, from src/lib/facts.ts.
  const facts = factLines(detail?.fields ?? [], detail?.identifiers ?? []);
  const pages = detail?.pageCount ?? 0;

  return (
    <div>
      {/* `.ent .row`: no rule above, 4px above and 10px below. */}
      <TaskRow task={mark.task} onToggle={onToggle} className="pt-1 pb-2.5" />

      {facts.length > 0 ? (
        <div>
          {facts.map((line) => (
            <FactRow key={line.key} line={line} />
          ))}
        </div>
      ) : null}

      {detail && pages > 0 ? (
        <div className="mt-3">
          <p className="mb-[7px] text-label text-ink-dim">
            {pages === 1
              ? "1 photo · kept with this task"
              : `${pages} photos · kept with this task`}
          </p>
          <ol className="flex flex-wrap gap-2.5">
            {Array.from({ length: pages }, (_, index) => index + 1).map(
              (page) => (
                <li key={page}>
                  {/* Lazy, because a ten page letter in a sheet she opened to
                      tick one box is ten images she never scrolled to, and
                      because storage signs each link when the image is
                      actually wanted. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/documents/${detail.documentId}/pages/${page}`}
                    alt={`Page ${page}`}
                    loading="lazy"
                    className="h-[100px] w-[74px] rounded-[8px] border border-line bg-primary-soft object-cover"
                  />
                </li>
              ),
            )}
          </ol>
        </div>
      ) : null}

      {mark.task.documentId ? (
        <Link
          href={`/documents/${mark.task.documentId}`}
          className="mt-1 inline-flex min-h-12 items-center px-0.5 text-caption font-bold text-primary underline underline-offset-4"
        >
          See the letter
        </Link>
      ) : null}
    </div>
  );
}

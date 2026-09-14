// KAN-57: the decisions Home makes before it draws anything, kept pure.

import type { HomeCounts, TaskSummary } from "@/lib/contract/api";
import { addDays } from "@/lib/contract/dates";

/**
 * What the call to action says.
 *
 * An ordered test rather than a count, exactly as the prototype's renderAll
 * does it: something read and waiting wins, otherwise something still being
 * read wins, otherwise the panel goes inert. The middle case is the waiting
 * state, and it says out loud that she does not have to stay and watch.
 *
 * `counts.failed` is deliberately not tested. A failed reading is not something
 * she can act on from here, so it stays in the "To check" list and never takes
 * the panel over from a letter that is actually waiting for her.
 *
 * The wording is the prototype's, verbatim. It lives here rather than in the
 * component so the plural forms are testable without rendering a screen.
 */
export function ctaFor(counts: HomeCounts): {
  big: string;
  small: string;
  inert: boolean;
} {
  if (counts.needsReview > 0) {
    return {
      big:
        counts.needsReview === 1
          ? "1 thing needs your OK"
          : `${counts.needsReview} things need your OK`,
      small:
        "From your photos we've prepared tasks and reminders. Check them before they go on your calendar.",
      inert: false,
    };
  }

  if (counts.processing > 0) {
    return {
      big:
        counts.processing === 1
          ? "Reading your letter…"
          : `Reading ${counts.processing} letters…`,
      small: "You can close the app. We'll tell you when it's ready.",
      inert: false,
    };
  }

  return {
    big: "Nothing to check right now",
    small: "We'll tell you when something's ready.",
    inert: true,
  };
}

/**
 * The task list, split into the headings Home shows.
 *
 * Overdue sits with today's tasks rather than in a heading of its own, and Home
 * words that heading "Needs doing" whenever an overdue task is in it, because
 * a bill from August is not "Today". An unpaid bill
 * from three weeks ago is the loudest thing this person owns, and what it needs
 * is doing today; a separate "Overdue" section would be a second place to look
 * and a second thing to feel bad about.
 *
 * `status` is the server's (src/lib/contract/api.ts derives it from the tick and
 * the day in her zone), so a ticked task that happens to be past its date is not
 * overdue and does not get pulled forward.
 *
 * Order is not touched. The server already sorts by due date ascending with the
 * dateless last, which is the same sort the prototype does, and re-sorting here
 * would be a second opinion about order living in a second file.
 */
export function groupTasks(
  tasks: TaskSummary[],
  today: string,
): { today: TaskSummary[]; week: TaskSummary[]; later: TaskSummary[] } {
  const weekEnd = addDays(today, 7);
  const todayGroup: TaskSummary[] = [];
  const week: TaskSummary[] = [];
  const later: TaskSummary[] = [];

  for (const task of tasks) {
    if (task.status === "overdue" || task.dueDate === today) {
      todayGroup.push(task);
    } else if (
      task.dueDate !== null &&
      task.dueDate > today &&
      task.dueDate <= weekEnd
    ) {
      week.push(task);
    } else {
      // Everything else: further out, dateless, and ticked rows whose day has
      // already gone by.
      later.push(task);
    }
  }

  return { today: todayGroup, week, later };
}

/** How many of the Later tasks Home shows before it points at the calendar. */
export const LATER_SHOWN = 3;

/**
 * The far end of the list, folded.
 *
 * What is due now and this week is shown whole, because that is what she has
 * to act on. Everything after that is a preview: the first few, then a count
 * and a way to the calendar, where the full list lives. The count is the point.
 * A list that simply stops looks finished.
 */
export function foldLater(later: TaskSummary[]): {
  shown: TaskSummary[];
  more: number;
} {
  return {
    shown: later.slice(0, LATER_SHOWN),
    more: Math.max(0, later.length - LATER_SHOWN),
  };
}

/** The words on the link under a folded Later. */
export function moreLabel(more: number): string {
  return more === 1
    ? "1 more in your calendar"
    : `${more} more in your calendar`;
}

/**
 * The line at the top of Home.
 *
 * The hour is passed in rather than read, so this stays pure and so the caller
 * is the one place that decides whose clock it is. Home reads it in the
 * person's own timezone, because "Good morning" is about her morning and not
 * the server's.
 */
export function greeting(hour: number, firstName: string): string {
  const part =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return `${part}, ${firstName}`;
}

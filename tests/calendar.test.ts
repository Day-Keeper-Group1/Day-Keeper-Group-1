/**
 * The calendar's arithmetic.
 *
 * The grid and the dots are the two places a calendar goes wrong quietly: a
 * month that starts on the wrong weekday still looks like a calendar, and a
 * reminder dot on the wrong day still looks like a dot. Both are asserted
 * against months chosen because they are awkward, not because they are handy.
 */

import { describe, expect, it } from "vitest";
import type { ReminderView, TaskSummary } from "@/lib/contract/api";
import { REMINDER_TIME_SPOKEN } from "@/lib/contract/reminders";
import { marksByDay, monthCells, sheetLine } from "@/lib/calendar";

function reminder(localDate: string): ReminderView {
  return {
    id: `rem_${localDate}`,
    scheduledFor: `${localDate}T23:00:00.000Z`,
    localDate,
    localTime: "09:00",
    channel: "in_app",
    status: "scheduled",
  };
}

function task(overrides: Partial<TaskSummary> = {}): TaskSummary {
  return {
    id: "task_agl",
    title: "Pay AGL electricity bill",
    documentId: "doc_agl",
    issuer: "AGL Energy",
    dueDate: "2026-08-15",
    status: "upcoming",
    reminders: [reminder("2026-08-12"), reminder("2026-08-14")],
    ...overrides,
  };
}

describe("monthCells", () => {
  const august = monthCells(2026, 8);

  it("pads August 2026 with five leading nulls, because the 1st is a Saturday", () => {
    expect(august.slice(0, 5)).toEqual([null, null, null, null, null]);
    expect(august[5]).toBe("2026-08-01");
  });

  it("gives all 31 days of August, in order", () => {
    const days = august.filter((cell): cell is string => cell !== null);
    expect(days).toHaveLength(31);
    expect(days[0]).toBe("2026-08-01");
    expect(days[30]).toBe("2026-08-31");
  });

  it("fills the last row of August, six trailing nulls for six whole weeks", () => {
    expect(august).toHaveLength(42);
    expect(august.slice(36)).toEqual([null, null, null, null, null, null]);
  });

  it("pads February 2027 at neither end: it starts on a Monday and is 28 days", () => {
    const february = monthCells(2027, 2);
    expect(february).toHaveLength(28);
    expect(february[0]).toBe("2027-02-01");
    expect(february[27]).toBe("2027-02-28");
    expect(february.every((cell) => cell !== null)).toBe(true);
  });

  it("always returns whole weeks", () => {
    for (let month = 1; month <= 12; month++) {
      expect(monthCells(2026, month).length % 7).toBe(0);
    }
  });

  it("refuses a month outside 1 to 12", () => {
    expect(() => monthCells(2026, 0)).toThrow(RangeError);
    expect(() => monthCells(2026, 13)).toThrow(RangeError);
  });
});

describe("marksByDay", () => {
  const byDay = marksByDay([task()]);

  it("marks the due day and both reminder mornings, and nothing else", () => {
    expect([...byDay.keys()].sort()).toEqual([
      "2026-08-12",
      "2026-08-14",
      "2026-08-15",
    ]);
  });

  it("files the due date as a due mark", () => {
    const marks = byDay.get("2026-08-15") ?? [];
    expect(marks).toHaveLength(1);
    expect(marks[0].kind).toBe("due");
    expect(marks[0].reminder).toBeUndefined();
    expect(marks[0].task.title).toBe("Pay AGL electricity bill");
  });

  it("files each reminder under its own localDate, carrying the reminder", () => {
    const marks = byDay.get("2026-08-12") ?? [];
    expect(marks).toHaveLength(1);
    expect(marks[0].kind).toBe("reminder");
    expect(marks[0].reminder?.localDate).toBe("2026-08-12");
  });

  it("leaves a dateless task off the calendar entirely", () => {
    const dateless = marksByDay([
      task({ id: "task_none", dueDate: null, reminders: [] }),
    ]);
    expect(dateless.size).toBe(0);
  });
});

describe("sheetLine", () => {
  const today = "2026-08-13";

  it("says a reminder is still coming when its morning has not arrived", () => {
    const mark = {
      kind: "reminder" as const,
      task: task(),
      reminder: reminder("2026-08-14"),
    };
    expect(sheetLine(mark, today)).toBe(
      `A reminder goes out this morning, ${REMINDER_TIME_SPOKEN}`,
    );
  });

  it("says a reminder has been and gone when its morning is behind today", () => {
    const mark = {
      kind: "reminder" as const,
      task: task(),
      reminder: reminder("2026-08-12"),
    };
    expect(sheetLine(mark, today)).toBe(
      `A reminder went out this morning, ${REMINDER_TIME_SPOKEN}`,
    );
  });

  it("says nothing will ring at all once the task is ticked", () => {
    const mark = {
      kind: "reminder" as const,
      task: task({ status: "completed" }),
      reminder: reminder("2026-08-14"),
    };
    expect(sheetLine(mark, today)).toBe("No reminder, this is already done");
  });

  it("reads today's own reminder as still to come, not as history", () => {
    const mark = {
      kind: "reminder" as const,
      task: task(),
      reminder: reminder(today),
    };
    expect(sheetLine(mark, today)).toBe(
      `A reminder goes out this morning, ${REMINDER_TIME_SPOKEN}`,
    );
  });
});

/**
 * The calendar's arithmetic.
 *
 * The grid and the dots are the two places a calendar goes wrong quietly: a
 * month that starts on the wrong weekday still looks like a calendar, and a
 * dot on the wrong day still looks like a dot. Both are asserted against
 * months chosen because they are awkward, not because they are handy.
 */

import { describe, expect, it } from "vitest";
import type { ReminderView, TaskSummary } from "@/lib/contract/api";
import { monthCells, tasksByDueDay, tasksForMonth } from "@/lib/calendar";

function reminder(localDate: string): ReminderView {
  return { id: `rem_${localDate}`, localDate };
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

// KAN-62: a dot means a task lands on that day. Reminder days get no dot.
describe("tasksByDueDay", () => {
  const byDay = tasksByDueDay([task()]);

  it("marks the due day and nothing else, not the reminder days", () => {
    expect([...byDay.keys()]).toEqual(["2026-08-15"]);
    expect(byDay.get("2026-08-15")?.map((t) => t.id)).toEqual(["task_agl"]);
  });

  it("keeps two tasks on one day in the order given", () => {
    const both = tasksByDueDay([task({ id: "first" }), task({ id: "second" })]);
    expect(both.get("2026-08-15")?.map((t) => t.id)).toEqual([
      "first",
      "second",
    ]);
  });

  it("leaves a dateless task off the calendar entirely", () => {
    const dateless = tasksByDueDay([
      task({ id: "task_none", dueDate: null, reminders: [] }),
    ]);
    expect(dateless.size).toBe(0);
  });
});

describe("tasksForMonth", () => {
  const all = [
    task({ id: "aug-late", dueDate: "2026-08-25", status: "overdue" }),
    task({ id: "sep-1", dueDate: "2026-09-04" }),
    task({ id: "sep-2", dueDate: "2026-09-26" }),
    task({ id: "sep-done", dueDate: "2026-09-02", status: "completed" }),
    task({ id: "oct", dueDate: "2026-10-06" }),
    task({ id: "none", dueDate: null }),
  ];

  it("lists the month on screen, in the order given", () => {
    expect(tasksForMonth(all, 2026, 9).inMonth.map((t) => t.id)).toEqual([
      "sep-1",
      "sep-2",
      "sep-done",
    ]);
  });

  it("pins the overdue and the dateless whatever month is showing", () => {
    const oct = tasksForMonth(all, 2026, 10);
    expect(oct.overdue.map((t) => t.id)).toEqual(["aug-late"]);
    expect(oct.inMonth.map((t) => t.id)).toEqual(["oct"]);
    expect(oct.undated.map((t) => t.id)).toEqual(["none"]);
  });

  it("does not list an overdue task twice when its own month is showing", () => {
    const aug = tasksForMonth(all, 2026, 8);
    expect(aug.overdue.map((t) => t.id)).toEqual(["aug-late"]);
    expect(aug.inMonth).toEqual([]);
  });
});

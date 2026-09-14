// KAN-59: checking one letter after another, and where the last one lands.
import { describe, expect, it } from "vitest";

import type { TaskSummary } from "@/lib/contract/api";
import {
  encodeRun,
  leftToCheck,
  monthParam,
  nextHref,
  parseRun,
  runAfter,
  savedNote,
} from "@/lib/confirm-flow";

const task = (over: Partial<TaskSummary> = {}): TaskSummary => ({
  id: "t1",
  title: "Pay Yarra Valley Water",
  issuer: "Yarra Valley Water",
  dueDate: "2026-09-21",
  status: "upcoming",
  reminders: [],
  ...over,
});

const START = parseRun(null);

describe("a run of checks", () => {
  it("starts knowing nothing, and carries nothing in the address", () => {
    expect(START).toEqual({ anyTask: false, month: null });
    expect(nextHref(START, "doc-2")).toBe("/documents/doc-2/review");
  });

  it("goes straight on to the next letter waiting, carrying where to land", () => {
    const run = runAfter(START, task());
    expect(nextHref(run, "doc-2")).toBe("/documents/doc-2/review?run=2026-09");
    expect(parseRun(encodeRun(run))).toEqual(run);
  });

  it("lands on the calendar at the month of the last dated task saved", () => {
    let run = runAfter(START, task({ dueDate: "2026-10-02" }));
    run = runAfter(run, task({ dueDate: null }));
    run = runAfter(run, null);
    expect(nextHref(run, null)).toBe("/calendar?month=2026-10");
  });

  it("lands on the calendar at today's month when every task saved had no date", () => {
    const run = runAfter(START, task({ dueDate: null }));
    expect(encodeRun(run)).toBe("task");
    expect(nextHref(parseRun("task"), null)).toBe("/calendar");
  });

  it("lands on Your letters when none of the letters saved made a task", () => {
    expect(nextHref(runAfter(START, null), null)).toBe("/documents");
  });

  it("ignores an address that is not a run or a month", () => {
    expect(parseRun("2026-13")).toEqual(START);
    expect(monthParam("2026-09")).toBe("2026-09");
    expect(monthParam("september")).toBeNull();
  });
});

describe("what the screen says", () => {
  it("says where a saved task went", () => {
    expect(savedNote(task(), "Pay Yarra Valley Water", "x")).toBe(
      "Saved. Pay Yarra Valley Water is on your calendar for Mon 21 Sep.",
    );
    expect(savedNote(task({ dueDate: null }), "Contact Centrelink", "x")).toBe(
      "Saved. Contact Centrelink is on your list, with no date.",
    );
  });

  it("says a letter that asked for nothing is kept", () => {
    expect(
      savedNote(null, "No action", "Wattlebank Super · Annual statement"),
    ).toBe(
      "Saved. Wattlebank Super · Annual statement is kept in your letters.",
    );
  });

  it("counts what is left, this one included", () => {
    expect(leftToCheck(3)).toBe("3 left to check");
    expect(leftToCheck(1)).toBe("Last one to check");
  });
});

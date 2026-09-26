/**
 * The reminder scheduling rule.
 *
 * The numbers asserted here are the product's promise: a bill due Saturday
 * 15 August has reminder days on the 8th, the 12th and the 14th (seven, three
 * and one day before), and an appointment gets the same three. A reminder day
 * is a day, with no hour (KAN-62). If someone changes the rule deliberately,
 * these tests are where the old promise is looked in the eye first.
 */

import { describe, expect, it } from "vitest";
import {
  REMINDER_OFFSET_DAYS,
  PLAN_LINES,
  planReminders,
} from "@/lib/contract/reminders";

describe("a deadline", () => {
  const plan = planReminders("2026-08-15");

  it("gets three reminder days: seven, three and one day before", () => {
    expect(REMINDER_OFFSET_DAYS).toEqual([7, 3, 1]);
    expect(plan.map((p) => p.offsetDays)).toEqual([7, 3, 1]);
    expect(plan.map((p) => p.localDate)).toEqual([
      "2026-08-08",
      "2026-08-12",
      "2026-08-14",
    ]);
  });

  it("is a day and nothing more: no hour, no instant", () => {
    expect(Object.keys(plan[0]).sort()).toEqual(["localDate", "offsetDays"]);
  });
});

describe("the function itself", () => {
  it("is pure: same input, same plan", () => {
    const a = planReminders("2026-08-15");
    const b = planReminders("2026-08-15");
    expect(a).toEqual(b);
  });

  it("refuses a date that is not a date", () => {
    expect(() => planReminders("15 Aug 2026")).toThrow(TypeError);
  });
});

describe("a letter photographed close to its due date", () => {
  // The failure this prevents: the review screen shows the person two
  // reminders, they agree, and the handler creates one because the first was
  // already in the past. Both callers pass the same `today`, so both get the
  // same list and the card cannot promise what Home will not show.
  it("plans only the reminders still ahead of the person", () => {
    const plan = planReminders("2026-08-15", { today: "2026-08-13" });
    expect(plan.map((p) => p.localDate)).toEqual(["2026-08-14"]);
  });

  // KAN-62: she has just looked at the letter. A mark on its row the same
  // day would be telling her what she already knows.
  it("does not plan a reminder on the day the letter is confirmed", () => {
    expect(planReminders("2026-08-15", { today: "2026-08-14" })).toEqual([]);
    expect(
      planReminders("2026-08-15", { today: "2026-08-08" }).map(
        (p) => p.localDate,
      ),
    ).toEqual(["2026-08-12", "2026-08-14"]);
  });

  it("plans nothing at all once every offset has gone by", () => {
    expect(planReminders("2026-08-15", { today: "2026-08-15" })).toEqual([]);
  });

  it("still returns the past ones when no day is given, for the seed", () => {
    expect(planReminders("2026-08-15")).toHaveLength(3);
  });
});

describe("what the plan card says", () => {
  // These strings are the prototype's, verbatim, and they are the promise the
  // person actually reads. Kept beside the rule so the two cannot drift.
  it("writes the three lines the prototype writes, with no hour", () => {
    expect(PLAN_LINES.reminder("Sat 8 Aug")).toBe("Remind you: Sat 8 Aug");
    expect(PLAN_LINES.deadline("Sat 15 Aug")).toBe(
      "On your calendar: due Sat 15 Aug",
    );
    expect(PLAN_LINES.appointment("Fri 4 Sep", "10:30 am")).toBe(
      "On your calendar: Fri 4 Sep, 10:30 am",
    );
  });
});

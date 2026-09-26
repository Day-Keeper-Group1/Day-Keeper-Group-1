/**
 * What the review screen promises.
 *
 * Every line asserted here is shown to a person before they agree to it, and
 * the confirm handler has to write exactly these rows. The reminders themselves
 * are tested in tests/reminders.test.ts; what is tested here is that the card
 * repeats them honestly, drops the ones already behind her, and closes with the
 * right sentence for the kind of letter it is.
 */

import { describe, expect, it } from "vitest";
import {
  NO_ACTION_PLAN_LINE,
  NO_DATE_PLAN_LINE,
  planLinesFor,
} from "@/lib/review-plan";

// KAN-59: saving a letter that asks for nothing makes no task, so the card
// promises no reminder, even when the letter prints a date.
describe("a letter that asks for nothing", () => {
  it("says it is kept, and promises nothing else", () => {
    expect(
      planLinesFor(
        { dueDate: "2026-08-15", action: "No action" },
        "2026-08-08",
      ),
    ).toEqual([{ icon: "page", text: NO_ACTION_PLAN_LINE }]);
  });
});

describe("a bill with more than a week to run", () => {
  const plan = planLinesFor({ dueDate: "2026-08-15" }, "2026-08-07");

  it("promises all three reminders and the day itself, with no hour", () => {
    expect(plan).toEqual([
      { icon: "bell", text: "Remind you: Sat 8 Aug" },
      { icon: "bell", text: "Remind you: Wed 12 Aug" },
      { icon: "bell", text: "Remind you: Fri 14 Aug" },
      { icon: "calendar", text: "On your calendar: due Sat 15 Aug" },
    ]);
  });
});

// KAN-62: she has just looked at the letter, so a reminder that would fall on
// the day she confirms it is not planned.
describe("a bill with exactly a week to run", () => {
  const plan = planLinesFor({ dueDate: "2026-08-15" }, "2026-08-08");

  it("drops the seven day reminder, which would be today", () => {
    expect(plan).toEqual([
      { icon: "bell", text: "Remind you: Wed 12 Aug" },
      { icon: "bell", text: "Remind you: Fri 14 Aug" },
      { icon: "calendar", text: "On your calendar: due Sat 15 Aug" },
    ]);
  });
});

describe("a bill photographed close to its due date", () => {
  // The failure this prevents: the card shows three reminders, she agrees, and
  // the handler writes one because the first was last week and the second is
  // today.
  const plan = planLinesFor({ dueDate: "2026-08-15" }, "2026-08-12");

  it("promises only the reminders still ahead of her", () => {
    expect(plan).toEqual([
      { icon: "bell", text: "Remind you: Fri 14 Aug" },
      { icon: "calendar", text: "On your calendar: due Sat 15 Aug" },
    ]);
  });
});

describe("an appointment", () => {
  const plan = planLinesFor(
    { dueDate: "2026-09-04", dueTime: "10:30" },
    "2026-09-02",
  );

  it("closes with the time, not with the word due", () => {
    expect(plan).toEqual([
      { icon: "bell", text: "Remind you: Thu 3 Sep" },
      { icon: "calendar", text: "On your calendar: Fri 4 Sep, 10:30 am" },
    ]);
  });
});

describe("a letter that named no date", () => {
  const plan = planLinesFor({}, "2026-08-10");

  it("says so once and plans nothing", () => {
    expect(plan).toEqual([{ icon: "page", text: NO_DATE_PLAN_LINE }]);
  });

  it("states the absence without asking her for the date", () => {
    expect(NO_DATE_PLAN_LINE).toBe(
      "No date on this letter. It's saved; nothing goes on your calendar.",
    );
  });
});

describe("the function itself", () => {
  it("is pure: same letter, same day, same promise", () => {
    const a = planLinesFor({ dueDate: "2026-09-01" }, "2026-08-10");
    const b = planLinesFor({ dueDate: "2026-09-01" }, "2026-08-10");
    expect(a).toEqual(b);
  });
});

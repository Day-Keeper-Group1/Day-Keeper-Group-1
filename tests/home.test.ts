// KAN-57: the pure parts of Home, tested without rendering a screen.

import { describe, expect, it } from "vitest";

import { taskByline, taskHeadline, taskWhen } from "@/components/task-row";
import type { HomeCounts, TaskSummary } from "@/lib/contract/api";
import { ctaFor, foldLater, greeting, groupTasks, moreLabel } from "@/lib/home";

/** The sketch's fictional day, so "the eighth day" is a date and not a mood. */
const TODAY = "2026-08-10";

function counts(partial: Partial<HomeCounts>): HomeCounts {
  return { needsReview: 0, processing: 0, failed: 0, ...partial };
}

function task(partial: Partial<TaskSummary> & { id: string }): TaskSummary {
  return {
    title: "Pay the electricity bill",
    issuer: "AGL Energy",
    dueDate: null,
    status: "upcoming",
    reminders: [],
    ...partial,
  };
}

describe("ctaFor", () => {
  it("puts a letter waiting for her nod above everything else", () => {
    // Ordered test, not a count: something still being read does not get to
    // take the panel over from something she can act on now.
    const cta = ctaFor(counts({ needsReview: 1, processing: 3, failed: 2 }));
    expect(cta).toEqual({
      big: "1 thing needs your OK",
      small:
        "From your photos we've prepared tasks and reminders. Check them before they go on your calendar.",
      inert: false,
    });
  });

  it("counts the things needing her OK in the plural", () => {
    expect(ctaFor(counts({ needsReview: 4 })).big).toBe(
      "4 things need your OK",
    );
  });

  it("says it is still reading, and that she may leave", () => {
    expect(ctaFor(counts({ processing: 1 }))).toEqual({
      big: "Reading your letter…",
      small: "You can close the app. We'll tell you when it's ready.",
      inert: false,
    });
    expect(ctaFor(counts({ processing: 2 })).big).toBe("Reading 2 letters…");
  });

  it("goes inert when there is nothing of hers in flight", () => {
    // A failed reading is not something she can act on from here, so it leaves
    // the panel alone and stays in the To check list.
    expect(ctaFor(counts({ failed: 2 }))).toEqual({
      big: "Nothing to check right now",
      small: "We'll tell you when something's ready.",
      inert: true,
    });
  });
});

describe("groupTasks", () => {
  it("puts today's and every overdue task under Today", () => {
    const due = task({ id: "due", dueDate: TODAY });
    const late = task({ id: "late", dueDate: "2026-08-05", status: "overdue" });

    const groups = groupTasks([due, late], TODAY);

    expect(groups.today.map((t) => t.id)).toEqual(["due", "late"]);
    expect(groups.week).toHaveLength(0);
    expect(groups.later).toHaveLength(0);
  });

  it("keeps the seventh day in the week and the eighth out of it", () => {
    const seventh = task({ id: "seventh", dueDate: "2026-08-17" });
    const eighth = task({ id: "eighth", dueDate: "2026-08-18" });
    const tomorrow = task({ id: "tomorrow", dueDate: "2026-08-11" });

    const groups = groupTasks([seventh, eighth, tomorrow], TODAY);

    expect(groups.week.map((t) => t.id)).toEqual(["seventh", "tomorrow"]);
    expect(groups.later.map((t) => t.id)).toEqual(["eighth"]);
  });

  it("sends a dateless task to Later, not to Today", () => {
    const groups = groupTasks([task({ id: "none" })], TODAY);

    expect(groups.later.map((t) => t.id)).toEqual(["none"]);
    expect(groups.today).toHaveLength(0);
  });

  it("leaves a ticked task where its date puts it", () => {
    // Completed is not overdue, whatever the date says, so a ticked row is not
    // dragged back up into Today.
    const done = task({
      id: "done",
      dueDate: "2026-08-05",
      status: "completed",
    });

    const groups = groupTasks([done], TODAY);

    expect(groups.today).toHaveLength(0);
    expect(groups.later.map((t) => t.id)).toEqual(["done"]);
  });

  it("preserves the order it was given", () => {
    const first = task({ id: "first", dueDate: "2026-08-12" });
    const second = task({ id: "second", dueDate: "2026-08-11" });

    expect(groupTasks([first, second], TODAY).week.map((t) => t.id)).toEqual([
      "first",
      "second",
    ]);
  });
});

describe("greeting", () => {
  it("turns over at noon and at six", () => {
    expect(greeting(11, "Margaret")).toBe("Good morning, Margaret");
    expect(greeting(12, "Margaret")).toBe("Good afternoon, Margaret");
    expect(greeting(17, "Margaret")).toBe("Good afternoon, Margaret");
    expect(greeting(18, "Margaret")).toBe("Good evening, Margaret");
  });
});

describe("taskWhen", () => {
  it("tells a ticked task its reminders are off, when it had any", () => {
    expect(
      taskWhen(task({ id: "a", dueDate: "2026-08-15", status: "completed" })),
    ).toBe("Done · reminders off");
  });

  it("claims nothing about reminders a dateless task never had", () => {
    expect(taskWhen(task({ id: "b", status: "completed" }))).toBe("Done");
  });

  it("says overdue in words", () => {
    expect(
      taskWhen(task({ id: "c", dueDate: "2026-08-05", status: "overdue" })),
    ).toBe("was due Wed 5 Aug");
  });

  it("prints the hour only when the letter named one", () => {
    expect(
      taskWhen(task({ id: "d", dueDate: "2026-09-04", dueTime: "10:30" })),
    ).toBe("Fri 4 Sep, 10:30 am");
    expect(taskWhen(task({ id: "e", dueDate: "2026-08-15" }))).toBe(
      "Sat 15 Aug",
    );
  });

  it("says so when there is no date at all", () => {
    expect(taskWhen(task({ id: "f" }))).toBe("No date");
  });
});

describe("taskHeadline and taskByline", () => {
  it("moves the issuer from the end of the title to the second line", () => {
    const t = task({
      id: "h",
      dueDate: "2026-09-26",
      title: "Pay the amount due (Yarra Valley Water)",
      issuer: "Yarra Valley Water",
    });
    expect(taskHeadline(t)).toBe("Pay the amount due");
    expect(taskByline(t)).toBe("Yarra Valley Water · Sat 26 Sep");
  });

  it("leaves a title that does not end in its issuer whole", () => {
    const t = task({
      id: "i",
      dueDate: "2026-09-26",
      title: "Renew rego",
      issuer: "VicRoads",
    });
    expect(taskHeadline(t)).toBe("Renew rego");
    expect(taskByline(t)).toBe("Sat 26 Sep");
  });
});

describe("foldLater", () => {
  it("shows the first three later tasks and counts the rest", () => {
    const later = Array.from({ length: 11 }, (_, i) => task({ id: `l${i}` }));
    const folded = foldLater(later);
    expect(folded.shown.map((t) => t.id)).toEqual(["l0", "l1", "l2"]);
    expect(folded.more).toBe(8);
    expect(moreLabel(folded.more)).toBe("8 more in your calendar");
  });

  it("folds nothing when there are three or fewer", () => {
    const folded = foldLater([task({ id: "a" }), task({ id: "b" })]);
    expect(folded.shown).toHaveLength(2);
    expect(folded.more).toBe(0);
    expect(moreLabel(1)).toBe("1 more in your calendar");
  });
});

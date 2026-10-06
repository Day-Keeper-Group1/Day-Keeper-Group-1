import { describe, expect, it } from "vitest";

import { parseStoredTaskReminderOverrides } from "@/lib/task-reminder-overrides";

describe("browser-local task reminder overrides", () => {
  it("returns no overrides when the browser has no saved values", () => {
    expect(parseStoredTaskReminderOverrides(null)).toEqual({});
  });

  it("keeps each task's choices separate and in the standard order", () => {
    expect(
      parseStoredTaskReminderOverrides(
        JSON.stringify({
          taskOne: [1, 7],
          taskTwo: [3],
        }),
      ),
    ).toEqual({
      taskOne: [7, 1],
      taskTwo: [3],
    });
  });

  it("preserves an empty selection as an explicit task override", () => {
    expect(
      parseStoredTaskReminderOverrides(JSON.stringify({ taskOne: [] })),
    ).toEqual({
      taskOne: [],
    });
  });

  it("rejects malformed saved data without replacing it", () => {
    expect(() => parseStoredTaskReminderOverrides("{")).toThrow(
      "Task reminder preferences could not be read.",
    );
    expect(() =>
      parseStoredTaskReminderOverrides(JSON.stringify({ taskOne: [5] })),
    ).toThrow("unexpected format");
  });
});

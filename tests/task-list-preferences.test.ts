import { describe, expect, it } from "vitest";

import type { TaskSummary } from "@/lib/contract/api";
import {
  DEFAULT_TASK_LIST_PREFERENCES,
  groupTaskList,
  parseTaskListPreferences,
  sortTasks,
} from "@/lib/task-list-preferences";

const tasks: TaskSummary[] = [
  {
    id: "task-b",
    title: "Pay the bill",
    issuer: "Zed Utilities",
    dueDate: "2026-10-12",
    status: "upcoming",
    reminders: [],
  },
  {
    id: "task-a",
    title: "Attend appointment",
    issuer: "A Medical",
    dueDate: "2026-10-10",
    status: "upcoming",
    reminders: [],
  },
  {
    id: "task-overdue",
    title: "Return form",
    issuer: "A Medical",
    dueDate: "2026-10-01",
    status: "overdue",
    reminders: [],
  },
  {
    id: "task-no-date",
    title: "Call the office",
    issuer: null,
    dueDate: null,
    status: "upcoming",
    reminders: [],
  },
  {
    id: "task-done",
    title: "Old task",
    issuer: null,
    dueDate: null,
    status: "completed",
    reminders: [],
  },
];

describe("browser-local task list preferences", () => {
  it("uses all tasks, due-date ascending, and no grouping by default", () => {
    expect(parseTaskListPreferences(null)).toEqual(
      DEFAULT_TASK_LIST_PREFERENCES,
    );
  });

  it("preserves valid saved choices and rejects invalid data", () => {
    expect(
      parseTaskListPreferences(
        JSON.stringify({
          defaultFilter: "overdue",
          sortOrder: "sender-asc",
          groupBy: "sender",
        }),
      ),
    ).toEqual({
      defaultFilter: "overdue",
      sortOrder: "sender-asc",
      groupBy: "sender",
    });
    expect(() => parseTaskListPreferences("{")).toThrow(
      "Task list preferences could not be read.",
    );
    expect(() =>
      parseTaskListPreferences(
        JSON.stringify({
          defaultFilter: "all",
          sortOrder: "invalid",
          groupBy: "none",
        }),
      ),
    ).toThrow("unexpected format");
  });

  it("sorts due dates ascending and keeps tasks without dates last", () => {
    expect(sortTasks(tasks, "due-date-asc").map((task) => task.id)).toEqual([
      "task-overdue",
      "task-a",
      "task-b",
      "task-no-date",
      "task-done",
    ]);
  });

  it("sorts due dates descending and sender names alphabetically", () => {
    expect(sortTasks(tasks, "due-date-desc").map((task) => task.id)).toEqual([
      "task-b",
      "task-a",
      "task-overdue",
      "task-no-date",
      "task-done",
    ]);
    expect(sortTasks(tasks, "sender-asc").map((task) => task.id)).toEqual([
      "task-a",
      "task-overdue",
      "task-b",
      "task-no-date",
      "task-done",
    ]);
  });

  it("filters tasks and groups them by sender or due date", () => {
    expect(
      groupTaskList(tasks, {
        ...DEFAULT_TASK_LIST_PREFERENCES,
        defaultFilter: "no-date",
      }).flatMap((group) => group.tasks.map((task) => task.id)),
    ).toEqual(["task-no-date"]);

    expect(
      groupTaskList(tasks, {
        ...DEFAULT_TASK_LIST_PREFERENCES,
        groupBy: "sender",
      }).map((group) => [group.label, group.tasks.length]),
    ).toEqual([
      ["A Medical", 2],
      ["Zed Utilities", 1],
      ["No sender", 2],
    ]);

    expect(
      groupTaskList(tasks, {
        ...DEFAULT_TASK_LIST_PREFERENCES,
        groupBy: "due-date",
      }).map((group) => group.label),
    ).toEqual([
      "Due Thu 1 Oct",
      "Due Sat 10 Oct",
      "Due Mon 12 Oct",
      "No due date",
    ]);
  });
});

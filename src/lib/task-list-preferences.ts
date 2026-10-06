import { z } from "zod";

import type { TaskSummary } from "@/lib/contract/api";
import { formatDueDate } from "@/lib/contract/dates";

export const TASK_FILTERS = [
  "all",
  "overdue",
  "upcoming",
  "no-date",
  "completed",
] as const;
export const TASK_SORT_ORDERS = [
  "due-date-asc",
  "due-date-desc",
  "sender-asc",
  "title-asc",
] as const;
export const TASK_GROUPINGS = ["none", "due-date", "sender"] as const;

export type TaskFilter = (typeof TASK_FILTERS)[number];
export type TaskSortOrder = (typeof TASK_SORT_ORDERS)[number];
export type TaskGrouping = (typeof TASK_GROUPINGS)[number];

export type TaskListPreferences = {
  defaultFilter: TaskFilter;
  sortOrder: TaskSortOrder;
  groupBy: TaskGrouping;
};

export const DEFAULT_TASK_LIST_PREFERENCES: TaskListPreferences = {
  defaultFilter: "all",
  sortOrder: "due-date-asc",
  groupBy: "none",
};

export const TASK_LIST_PREFERENCES_STORAGE_KEY =
  "daykeeper-task-list-preferences";
export const TASK_LIST_PREFERENCES_UPDATED_EVENT =
  "daykeeper-task-list-preferences-updated";

const taskListPreferencesSchema = z.object({
  defaultFilter: z.enum(TASK_FILTERS),
  sortOrder: z.enum(TASK_SORT_ORDERS),
  groupBy: z.enum(TASK_GROUPINGS),
});

export function parseTaskListPreferences(
  stored: string | null,
): TaskListPreferences {
  if (stored === null) return DEFAULT_TASK_LIST_PREFERENCES;

  let value: unknown;
  try {
    value = JSON.parse(stored);
  } catch {
    throw new Error(
      "Task list preferences could not be read. Your saved choices have not been changed.",
    );
  }

  const parsed = taskListPreferencesSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(
      "Task list preferences have an unexpected format. Your saved choices have not been changed.",
    );
  }
  return parsed.data;
}

export type TaskListGroup = {
  key: string;
  label: string;
  tasks: TaskSummary[];
};

function compareText(left: string, right: string): number {
  return left.localeCompare(right, undefined, { sensitivity: "base" });
}

export function sortTasks(
  tasks: TaskSummary[],
  sortOrder: TaskSortOrder,
): TaskSummary[] {
  return [...tasks].sort((left, right) => {
    let result = 0;
    if (sortOrder === "due-date-asc" || sortOrder === "due-date-desc") {
      const direction = sortOrder === "due-date-asc" ? 1 : -1;
      if (left.dueDate === null && right.dueDate !== null) return 1;
      if (left.dueDate !== null && right.dueDate === null) return -1;
      if (left.dueDate !== null && right.dueDate !== null) {
        result = left.dueDate.localeCompare(right.dueDate) * direction;
      }
    } else if (sortOrder === "sender-asc") {
      if (left.issuer === null && right.issuer !== null) return 1;
      if (left.issuer !== null && right.issuer === null) return -1;
      result = compareText(left.issuer ?? "", right.issuer ?? "");
    } else {
      result = compareText(left.title, right.title);
    }

    return (
      result ||
      compareText(left.title, right.title) ||
      left.id.localeCompare(right.id)
    );
  });
}

function matchesFilter(task: TaskSummary, filter: TaskFilter): boolean {
  if (filter === "all") return true;
  if (filter === "overdue") return task.status === "overdue";
  if (filter === "completed") return task.status === "completed";
  if (filter === "no-date") {
    return task.status !== "completed" && task.dueDate === null;
  }
  return task.status === "upcoming" && task.dueDate !== null;
}

export function groupTaskList(
  tasks: TaskSummary[],
  preferences: TaskListPreferences,
): TaskListGroup[] {
  const filtered = sortTasks(
    tasks.filter((task) => matchesFilter(task, preferences.defaultFilter)),
    preferences.sortOrder,
  );

  if (preferences.groupBy === "none") {
    return filtered.length > 0
      ? [{ key: "tasks", label: "Tasks", tasks: filtered }]
      : [];
  }

  const groups = new Map<string, TaskListGroup>();
  for (const task of filtered) {
    const key =
      preferences.groupBy === "due-date"
        ? (task.dueDate ?? "no-date")
        : (task.issuer ?? "no-sender");
    const label =
      preferences.groupBy === "due-date"
        ? task.dueDate
          ? `Due ${formatDueDate(task.dueDate, "short")}`
          : "No due date"
        : (task.issuer ?? "No sender");
    const group = groups.get(key);
    if (group) {
      group.tasks.push(task);
    } else {
      groups.set(key, { key, label, tasks: [task] });
    }
  }

  return [...groups.values()];
}

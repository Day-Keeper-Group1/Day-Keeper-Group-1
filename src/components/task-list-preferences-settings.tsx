"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DEFAULT_TASK_LIST_PREFERENCES,
  parseTaskListPreferences,
  TASK_LIST_PREFERENCES_STORAGE_KEY,
  TASK_LIST_PREFERENCES_UPDATED_EVENT,
  type TaskFilter,
  type TaskGrouping,
  type TaskListPreferences,
  type TaskSortOrder,
} from "@/lib/task-list-preferences";

const FILTER_OPTIONS: { value: TaskFilter; label: string }[] = [
  { value: "all", label: "All tasks" },
  { value: "overdue", label: "Overdue" },
  { value: "upcoming", label: "Upcoming" },
  { value: "no-date", label: "No date" },
  { value: "completed", label: "Completed" },
];

const SORT_OPTIONS: { value: TaskSortOrder; label: string }[] = [
  { value: "due-date-asc", label: "Due date, earliest first" },
  { value: "due-date-desc", label: "Due date, latest first" },
  { value: "sender-asc", label: "Sender name, A to Z" },
  { value: "title-asc", label: "Task name, A to Z" },
];

const GROUP_OPTIONS: { value: TaskGrouping; label: string }[] = [
  { value: "none", label: "No grouping" },
  { value: "due-date", label: "Due date" },
  { value: "sender", label: "Sender" },
];

const fieldClassName =
  "min-h-12 w-full rounded-lg border-2 border-border bg-background px-3 text-base text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60";

export function TaskListPreferencesSettings() {
  const [preferences, setPreferences] = useState<TaskListPreferences>(
    DEFAULT_TASK_LIST_PREFERENCES,
  );
  const [savedPreferences, setSavedPreferences] = useState<TaskListPreferences>(
    DEFAULT_TASK_LIST_PREFERENCES,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      try {
        const saved = parseTaskListPreferences(
          window.localStorage.getItem(TASK_LIST_PREFERENCES_STORAGE_KEY),
        );
        setPreferences(saved);
        setSavedPreferences(saved);
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Task list preferences could not be read.",
        );
      } finally {
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  function update<Key extends keyof TaskListPreferences>(
    key: Key,
    value: TaskListPreferences[Key],
  ) {
    setPreferences((current) => ({ ...current, [key]: value }));
    setNotice(null);
  }

  function save() {
    try {
      window.localStorage.setItem(
        TASK_LIST_PREFERENCES_STORAGE_KEY,
        JSON.stringify(preferences),
      );
      window.dispatchEvent(new Event(TASK_LIST_PREFERENCES_UPDATED_EVENT));
      setSavedPreferences(preferences);
      setError(null);
      setNotice("Task list preferences saved in this browser.");
    } catch {
      setError(
        "Task list preferences could not be saved in this browser. Check available storage and try again.",
      );
    }
  }

  function restoreDefaults() {
    setPreferences({ ...DEFAULT_TASK_LIST_PREFERENCES });
    setNotice("Defaults selected. Save task preferences to apply them.");
  }

  const unavailable = loading || error !== null;
  const hasUnsavedChanges =
    preferences.defaultFilter !== savedPreferences.defaultFilter ||
    preferences.sortOrder !== savedPreferences.sortOrder ||
    preferences.groupBy !== savedPreferences.groupBy;

  return (
    <div className="max-w-2xl space-y-6">
      <Button
        variant="outline"
        nativeButton={false}
        render={
          <Link href="/customization">
            <ArrowLeft className="size-5" strokeWidth={1.75} />
            Back to customization
          </Link>
        }
      />
      <PageHeader
        title="Task list"
        description="Choose how tasks are filtered, sorted, and grouped."
      />

      <p className="max-w-prose text-base text-muted-foreground">
        These choices apply to the All tasks box on Home and the full task list.
        They are saved only in this browser. Defaults are All tasks, due date
        earliest first, and no grouping. The separate Overdue and Needs review
        sections on Home stay visible. Tasks do not currently have their own
        priority, so priority grouping is not available.
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Task list preferences</CardTitle>
          <CardDescription>
            Set the view you want to see when you open your tasks.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? (
            <p role="alert" className="text-base font-medium text-danger">
              {error}
            </p>
          ) : null}
          {loading ? (
            <p role="status" className="text-base text-muted-foreground">
              Loading task list preferences...
            </p>
          ) : null}

          <div className="space-y-2">
            <label
              htmlFor="default-task-filter"
              className="text-base font-medium"
            >
              Default task view
            </label>
            <select
              id="default-task-filter"
              value={preferences.defaultFilter}
              disabled={unavailable}
              onChange={(event) => {
                const option = FILTER_OPTIONS.find(
                  (candidate) => candidate.value === event.target.value,
                );
                if (option) update("defaultFilter", option.value);
              }}
              className={fieldClassName}
            >
              {FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="default-task-sort"
              className="text-base font-medium"
            >
              Default sort order
            </label>
            <select
              id="default-task-sort"
              value={preferences.sortOrder}
              disabled={unavailable}
              onChange={(event) => {
                const option = SORT_OPTIONS.find(
                  (candidate) => candidate.value === event.target.value,
                );
                if (option) update("sortOrder", option.value);
              }}
              className={fieldClassName}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="task-grouping" className="text-base font-medium">
              Group tasks by
            </label>
            <select
              id="task-grouping"
              value={preferences.groupBy}
              disabled={unavailable}
              onChange={(event) => {
                const option = GROUP_OPTIONS.find(
                  (candidate) => candidate.value === event.target.value,
                );
                if (option) update("groupBy", option.value);
              }}
              className={fieldClassName}
            >
              {GROUP_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap gap-3 pt-1">
            <Button onClick={save} disabled={unavailable || !hasUnsavedChanges}>
              Save task preferences
            </Button>
            <Button
              variant="outline"
              onClick={restoreDefaults}
              disabled={unavailable}
            >
              Reset to defaults
            </Button>
          </div>
          {notice ? (
            <p role="status" className="text-base text-success">
              {notice}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

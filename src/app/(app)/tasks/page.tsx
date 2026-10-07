"use client";

// KAN-57: soft-deleted route, kept working against the real endpoints.

import { useEffect, useMemo, useState } from "react";
import { ListChecks, Search } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { ScreenHeader } from "@/components/screen";
import { TaskRow } from "@/components/task-row";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ApiError, TaskSummary } from "@/lib/contract/api";
import {
  DEFAULT_TASK_LIST_PREFERENCES,
  groupTaskList,
  parseTaskListPreferences,
  TASK_LIST_PREFERENCES_STORAGE_KEY,
  TASK_LIST_PREFERENCES_UPDATED_EVENT,
  type TaskFilter,
  type TaskListPreferences,
} from "@/lib/task-list-preferences";
import { toggleTaskDone } from "@/lib/task-actions";

/**
 * The flat task list.
 *
 * It has no navigation entry any more: the prototype's three destinations are
 * Home, Photograph and Calendar, and tasks are read where they belong to
 * something (Home's Your tasks, the calendar's day sheet). The route stays
 * because it is linked from older notes and still answers, so this page is
 * kept honest against the real endpoints rather than left compiling against
 * fixtures. It is deliberately plain.
 */

const FILTERS: { label: string; value: TaskFilter }[] = [
  { label: "All", value: "all" },
  { label: "Overdue", value: "overdue" },
  { label: "Upcoming", value: "upcoming" },
  { label: "No date", value: "no-date" },
  { label: "Completed", value: "completed" },
];

export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskSummary[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<TaskFilter>("all");
  const [query, setQuery] = useState("");
  const [preferences, setPreferences] = useState<TaskListPreferences>(
    DEFAULT_TASK_LIST_PREFERENCES,
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/tasks");
        const body: unknown = await response.json();
        if (!response.ok) {
          throw new Error((body as ApiError).error.message);
        }
        if (!cancelled) setTasks(body as TaskSummary[]);
      } catch (error) {
        if (!cancelled) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "We could not load your tasks just now.",
          );
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function refreshPreferences() {
      try {
        const saved = parseTaskListPreferences(
          window.localStorage.getItem(TASK_LIST_PREFERENCES_STORAGE_KEY),
        );
        setPreferences(saved);
        setFilter(saved.defaultFilter);
      } catch (error) {
        setLoadError(
          error instanceof Error
            ? error.message
            : "Task list preferences could not be read.",
        );
      }
    }

    function onStorage(event: StorageEvent) {
      if (
        event.key === TASK_LIST_PREFERENCES_STORAGE_KEY ||
        event.key === null
      ) {
        refreshPreferences();
      }
    }

    refreshPreferences();
    window.addEventListener("storage", onStorage);
    window.addEventListener(
      TASK_LIST_PREFERENCES_UPDATED_EVENT,
      refreshPreferences,
    );
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(
        TASK_LIST_PREFERENCES_UPDATED_EVENT,
        refreshPreferences,
      );
    };
  }, []);

  /**
   * The tick is the only thing that changes, and the server answers with the
   * whole row, so the answer replaces the row rather than the page patching a
   * copy and hoping the two agree.
   */
  async function onToggle(task: TaskSummary) {
    try {
      const updated = await toggleTaskDone(task);
      setTasks((previous) =>
        (previous ?? []).map((item) =>
          item.id === updated.id ? updated : item,
        ),
      );
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "We could not save that just now.",
      );
    }
  }

  const needle = query.trim().toLowerCase();
  const sections = useMemo(() => {
    const matching = (tasks ?? []).filter(
      (task) =>
        !needle ||
        [task.title, task.issuer ?? ""].some((value) =>
          value.toLowerCase().includes(needle),
        ),
    );

    return groupTaskList(matching, {
      ...preferences,
      defaultFilter: filter,
    });
  }, [tasks, needle, filter, preferences]);

  const hasAnyTask = sections.length > 0;

  return (
    <div className="space-y-6">
      <ScreenHeader
        title="Your tasks"
        subtitle="Everything from your letters, in one list."
      />

      {loadError ? (
        <p role="status" className="text-base font-semibold text-danger">
          {loadError}
        </p>
      ) : null}

      <Tabs
        value={filter}
        onValueChange={(value) => {
          const selected = FILTERS.find((item) => item.value === value);
          if (selected) setFilter(selected.value);
        }}
      >
        <TabsList className="flex-wrap">
          {FILTERS.map((item) => (
            <TabsTrigger key={item.value} value={item.value}>
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <label className="relative block">
        <span className="sr-only">Search tasks</span>
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search tasks or organisations"
          className="h-12 pl-10 text-base"
        />
      </label>

      {tasks === null ? (
        <p className="text-base text-muted-foreground">Loading your tasks…</p>
      ) : !hasAnyTask ? (
        <EmptyState icon={ListChecks} title="No tasks here" />
      ) : (
        <div className="space-y-8">
          {sections.map((section) => (
            <section key={section.key} className="space-y-2">
              {preferences.groupBy !== "none" ||
              filter === "all" ||
              section.label !== "Tasks" ? (
                <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                  {section.label}
                </h2>
              ) : null}
              <ul className="space-y-2">
                {section.tasks.map((task) => (
                  <li key={task.id}>
                    <TaskRow task={task} onToggle={onToggle} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

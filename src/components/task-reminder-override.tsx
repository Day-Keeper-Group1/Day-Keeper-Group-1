"use client";

import { useEffect, useState } from "react";

import { REMINDER_OFFSET_DAYS } from "@/lib/contract/reminders";
import type { TaskSummary } from "@/lib/contract/api";
import {
  matchingSenderRuleForIssuer,
  orderedReminderOffsets,
  parseStoredSenderRules,
  SENDER_RULES_STORAGE_KEY,
  SENDER_RULES_UPDATED_EVENT,
  toggleReminderOffset,
  type ReminderOffset,
} from "@/lib/sender-rules";
import {
  parseStoredTaskReminderOverrides,
  TASK_REMINDER_OVERRIDES_STORAGE_KEY,
  TASK_REMINDER_OVERRIDES_UPDATED_EVENT,
} from "@/lib/task-reminder-overrides";

type OverrideState =
  | { status: "loading" }
  | { status: "unavailable"; message: string }
  | {
      status: "ready";
      defaultOffsets: ReminderOffset[];
      selectedOffsets: ReminderOffset[];
      overridden: boolean;
      sender: string | null;
    };

const storageErrorMessage =
  "Task reminder preferences could not be saved in this browser. Check available storage and try again.";

export function TaskReminderOverride({ task }: { task: TaskSummary }) {
  const [state, setState] = useState<OverrideState>({ status: "loading" });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function refresh() {
      try {
        const overrides = parseStoredTaskReminderOverrides(
          window.localStorage.getItem(TASK_REMINDER_OVERRIDES_STORAGE_KEY),
        );
        const rules = parseStoredSenderRules(
          window.localStorage.getItem(SENDER_RULES_STORAGE_KEY),
        );
        const senderRule = matchingSenderRuleForIssuer(task.issuer, rules);
        const defaultOffsets = orderedReminderOffsets(
          senderRule?.reminderOffsets ?? [...REMINDER_OFFSET_DAYS],
        );
        const overridden = Object.hasOwn(overrides, task.id);
        setState({
          status: "ready",
          defaultOffsets,
          selectedOffsets: overridden ? overrides[task.id] : defaultOffsets,
          overridden,
          sender: senderRule?.issuer ?? null,
        });
        setError(null);
      } catch (cause) {
        setState({
          status: "unavailable",
          message:
            cause instanceof Error
              ? cause.message
              : "Task reminder preferences could not be read.",
        });
      }
    }

    function onStorage(event: StorageEvent) {
      if (
        event.key === TASK_REMINDER_OVERRIDES_STORAGE_KEY ||
        event.key === SENDER_RULES_STORAGE_KEY ||
        event.key === null
      ) {
        refresh();
      }
    }

    refresh();
    window.addEventListener("storage", onStorage);
    window.addEventListener(TASK_REMINDER_OVERRIDES_UPDATED_EVENT, refresh);
    window.addEventListener(SENDER_RULES_UPDATED_EVENT, refresh);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(
        TASK_REMINDER_OVERRIDES_UPDATED_EVENT,
        refresh,
      );
      window.removeEventListener(SENDER_RULES_UPDATED_EVENT, refresh);
    };
  }, [task.id, task.issuer]);

  function saveOffsets(offsets: ReminderOffset[]) {
    if (state.status !== "ready") return;
    try {
      const overrides = parseStoredTaskReminderOverrides(
        window.localStorage.getItem(TASK_REMINDER_OVERRIDES_STORAGE_KEY),
      );
      const nextOffsets = orderedReminderOffsets(offsets);
      const nextOverrides = { ...overrides, [task.id]: nextOffsets };
      window.localStorage.setItem(
        TASK_REMINDER_OVERRIDES_STORAGE_KEY,
        JSON.stringify(nextOverrides),
      );
      window.dispatchEvent(new Event(TASK_REMINDER_OVERRIDES_UPDATED_EVENT));
      setState({ ...state, selectedOffsets: nextOffsets, overridden: true });
      setError(null);
    } catch {
      setError(storageErrorMessage);
    }
  }

  function resetToDefault() {
    if (state.status !== "ready") return;
    try {
      const overrides = parseStoredTaskReminderOverrides(
        window.localStorage.getItem(TASK_REMINDER_OVERRIDES_STORAGE_KEY),
      );
      const nextOverrides = { ...overrides };
      delete nextOverrides[task.id];
      if (Object.keys(nextOverrides).length === 0) {
        window.localStorage.removeItem(TASK_REMINDER_OVERRIDES_STORAGE_KEY);
      } else {
        window.localStorage.setItem(
          TASK_REMINDER_OVERRIDES_STORAGE_KEY,
          JSON.stringify(nextOverrides),
        );
      }
      window.dispatchEvent(new Event(TASK_REMINDER_OVERRIDES_UPDATED_EVENT));
      setState({
        ...state,
        selectedOffsets: state.defaultOffsets,
        overridden: false,
      });
      setError(null);
    } catch {
      setError(storageErrorMessage);
    }
  }

  if (!task.dueDate || task.status === "completed") return null;

  return (
    <section className="mt-3 rounded-[10px] border-2 border-line p-4">
      <h3 className="text-base font-semibold text-foreground">
        Reminder days for this task
      </h3>
      <p className="mt-1 text-caption text-muted-foreground">
        Choose which days before the due date to keep a reminder for this task.
        This does not change the sender&apos;s default.
      </p>

      {state.status === "loading" ? (
        <p role="status" className="mt-2 text-caption text-muted-foreground">
          Loading reminder preferences...
        </p>
      ) : null}

      {state.status === "unavailable" ? (
        <p role="alert" className="mt-2 text-caption text-danger">
          {state.message}
        </p>
      ) : null}

      {state.status === "ready" ? (
        <>
          <p className="mt-2 text-caption text-muted-foreground">
            {state.overridden
              ? "Using this task's own reminder preferences."
              : state.sender
                ? `Using ${state.sender}'s sender rule as the default.`
                : "Using DayKeeper's standard reminder schedule."}
          </p>
          <fieldset className="mt-2" aria-label="Reminder days before due date">
            <div className="flex flex-wrap gap-x-6">
              {REMINDER_OFFSET_DAYS.map((offset) => (
                <label
                  key={offset}
                  className="flex min-h-12 items-center gap-3 text-base"
                >
                  <input
                    type="checkbox"
                    checked={state.selectedOffsets.includes(offset)}
                    onChange={(event) =>
                      saveOffsets(
                        toggleReminderOffset(
                          state.selectedOffsets,
                          offset,
                          event.target.checked,
                        ),
                      )
                    }
                    className="size-5 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  />
                  {offset} {offset === 1 ? "day" : "days"} before
                </label>
              ))}
            </div>
          </fieldset>
          {state.overridden ? (
            <button
              type="button"
              onClick={resetToDefault}
              className="mt-1 inline-flex min-h-12 items-center font-semibold text-primary underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              Use sender&apos;s default
            </button>
          ) : null}
        </>
      ) : null}

      <p className="mt-2 text-caption text-muted-foreground">
        This preference is stored only for this task in this browser. It does
        not reschedule reminders already created by DayKeeper or change another
        task&apos;s settings.
      </p>
      {error ? (
        <p role="alert" className="mt-2 text-caption text-danger">
          {error}
        </p>
      ) : null}
    </section>
  );
}

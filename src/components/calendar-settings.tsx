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
  CALENDAR_PREFERENCES_STORAGE_KEY,
  CALENDAR_PREFERENCES_UPDATED_EVENT,
  DEFAULT_CALENDAR_PREFERENCES,
  parseCalendarPreferences,
  type CalendarPreferences,
} from "@/lib/calendar-preferences";

const fieldClassName =
  "min-h-12 w-full rounded-lg border-2 border-border bg-background px-3 text-base text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60";

export function CalendarSettings() {
  const [preferences, setPreferences] = useState<CalendarPreferences>(
    DEFAULT_CALENDAR_PREFERENCES,
  );
  const [savedPreferences, setSavedPreferences] = useState<CalendarPreferences>(
    DEFAULT_CALENDAR_PREFERENCES,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      try {
        const saved = parseCalendarPreferences(
          window.localStorage.getItem(CALENDAR_PREFERENCES_STORAGE_KEY),
        );
        setPreferences(saved);
        setSavedPreferences(saved);
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Calendar preferences could not be read.",
        );
      } finally {
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  function save() {
    try {
      window.localStorage.setItem(
        CALENDAR_PREFERENCES_STORAGE_KEY,
        JSON.stringify(preferences),
      );
      window.dispatchEvent(new Event(CALENDAR_PREFERENCES_UPDATED_EVENT));
      setSavedPreferences(preferences);
      setError(null);
      setNotice("Calendar settings saved in this browser.");
    } catch {
      setError(
        "Calendar settings could not be saved in this browser. Check available storage and try again.",
      );
    }
  }

  function restoreDefaults() {
    setPreferences({ ...DEFAULT_CALENDAR_PREFERENCES });
    setNotice("Defaults selected. Save calendar settings to apply them.");
    setError(null);
  }

  const unavailable = loading || error !== null;
  const hasUnsavedChanges =
    preferences.defaultView !== savedPreferences.defaultView ||
    preferences.weekStartsOn !== savedPreferences.weekStartsOn;

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
        title="Manage Calendar Settings"
        description="Choose the calendar view and the first day of your week."
      />

      <p className="max-w-prose text-base text-muted-foreground">
        These settings are saved only in this browser and apply when you open
        Calendar. Defaults are Month view and Monday-first. Choosing Week shows
        the seven days around the selected week; the task list keeps overdue and
        undated tasks easy to find.
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Calendar defaults</CardTitle>
          <CardDescription>
            Choose what you see when you open Calendar.
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
              Loading calendar settings...
            </p>
          ) : null}

          <div className="space-y-2">
            <label
              htmlFor="calendar-default-view"
              className="text-base font-medium"
            >
              Default calendar view
            </label>
            <select
              id="calendar-default-view"
              value={preferences.defaultView}
              disabled={unavailable}
              onChange={(event) => {
                const defaultView = event.target.value;
                if (defaultView === "month" || defaultView === "week") {
                  setPreferences((current) => ({
                    ...current,
                    defaultView,
                  }));
                  setNotice(null);
                }
              }}
              className={fieldClassName}
            >
              <option value="month">Month</option>
              <option value="week">Week</option>
            </select>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="calendar-week-start"
              className="text-base font-medium"
            >
              First day of the week
            </label>
            <select
              id="calendar-week-start"
              value={preferences.weekStartsOn}
              disabled={unavailable}
              onChange={(event) => {
                const weekStartsOn = event.target.value;
                if (weekStartsOn === "monday" || weekStartsOn === "sunday") {
                  setPreferences((current) => ({
                    ...current,
                    weekStartsOn,
                  }));
                  setNotice(null);
                }
              }}
              className={fieldClassName}
            >
              <option value="monday">Monday</option>
              <option value="sunday">Sunday</option>
            </select>
          </div>

          {notice ? (
            <p role="status" className="text-base text-primary">
              {notice}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-3 pt-2">
            <Button onClick={save} disabled={unavailable || !hasUnsavedChanges}>
              Save calendar settings
            </Button>
            <Button
              variant="outline"
              onClick={restoreDefaults}
              disabled={unavailable}
            >
              Reset to defaults
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DEFAULT_REMINDER_PREFERENCES,
  PREFERRED_DAYS,
  PREFERRED_DAY_LABELS,
  parseReminderPreferences,
  REMINDER_PREFERENCES_STORAGE_KEY,
  REMINDER_PREFERENCES_UPDATED_EVENT,
  type PreferredDay,
  type ReminderPreferences,
} from "@/lib/reminder-preferences";

function storageErrorMessage(): string {
  return "We couldn't save reminder preferences in this browser. Check available storage and try again.";
}

export function ReminderPreferencesSettings() {
  const [preferences, setPreferences] = useState<ReminderPreferences>(
    DEFAULT_REMINDER_PREFERENCES,
  );
  const [savedPreferences, setSavedPreferences] = useState<ReminderPreferences>(
    DEFAULT_REMINDER_PREFERENCES,
  );
  const [loading, setLoading] = useState(true);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      try {
        const saved = parseReminderPreferences(
          window.localStorage.getItem(REMINDER_PREFERENCES_STORAGE_KEY),
        );
        setPreferences(saved);
        setSavedPreferences(saved);
      } catch (error) {
        setStorageError(
          error instanceof Error ? error.message : storageErrorMessage(),
        );
      } finally {
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  function updatePreference<Key extends keyof ReminderPreferences>(
    key: Key,
    value: ReminderPreferences[Key],
  ) {
    setPreferences((current) => ({ ...current, [key]: value }));
    setFormError(null);
    setNotice(null);
  }

  function togglePreferredDay(day: PreferredDay, checked: boolean) {
    const selected = new Set(preferences.preferredDays);
    if (checked) selected.add(day);
    else selected.delete(day);
    updatePreference(
      "preferredDays",
      PREFERRED_DAYS.filter((candidate) => selected.has(candidate)),
    );
  }

  function savePreferences(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setNotice(null);

    if (preferences.preferredDays.length === 0) {
      setFormError("Choose at least one preferred day.");
      return;
    }
    if (
      preferences.quietHoursEnabled &&
      preferences.quietHoursStart === preferences.quietHoursEnd
    ) {
      setFormError("Quiet hours must have different start and end times.");
      return;
    }

    try {
      window.localStorage.setItem(
        REMINDER_PREFERENCES_STORAGE_KEY,
        JSON.stringify(preferences),
      );
      window.dispatchEvent(new Event(REMINDER_PREFERENCES_UPDATED_EVENT));
      setSavedPreferences(preferences);
      setStorageError(null);
      setNotice("Reminder preferences saved in this browser.");
    } catch {
      setStorageError(storageErrorMessage());
    }
  }

  function resetToDefaults() {
    setPreferences({ ...DEFAULT_REMINDER_PREFERENCES });
    setFormError(null);
    setNotice("Defaults selected. Save reminder preferences to apply them.");
  }

  const hasUnsavedChanges =
    preferences.deliveryTime !== savedPreferences.deliveryTime ||
    preferences.quietHoursEnabled !== savedPreferences.quietHoursEnabled ||
    preferences.quietHoursStart !== savedPreferences.quietHoursStart ||
    preferences.quietHoursEnd !== savedPreferences.quietHoursEnd ||
    preferences.preferredDays.length !==
      savedPreferences.preferredDays.length ||
    preferences.preferredDays.some(
      (day, index) => day !== savedPreferences.preferredDays[index],
    );
  const isAtDefaults =
    preferences.deliveryTime === DEFAULT_REMINDER_PREFERENCES.deliveryTime &&
    preferences.quietHoursEnabled ===
      DEFAULT_REMINDER_PREFERENCES.quietHoursEnabled &&
    preferences.quietHoursStart ===
      DEFAULT_REMINDER_PREFERENCES.quietHoursStart &&
    preferences.quietHoursEnd === DEFAULT_REMINDER_PREFERENCES.quietHoursEnd &&
    preferences.preferredDays.length ===
      DEFAULT_REMINDER_PREFERENCES.preferredDays.length &&
    preferences.preferredDays.every(
      (day, index) => day === DEFAULT_REMINDER_PREFERENCES.preferredDays[index],
    );
  const unavailable = loading || storageError !== null;

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
        title="Reminders"
        description="Choose when and on which days you prefer reminders."
      />

      <p className="max-w-prose text-base text-muted-foreground">
        These preferences are saved only in this browser. Defaults are 9:00 am,
        quiet hours off, and every day selected. They describe when reminders
        would be preferred. This release does not apply them to task schedules
        or send notifications.
      </p>

      {storageError ? (
        <p role="alert" className="text-base font-medium text-danger">
          {storageError}
        </p>
      ) : null}
      {formError ? (
        <p role="alert" className="text-base font-medium text-danger">
          {formError}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="text-base font-medium text-success">
          {notice}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Reminder preferences</CardTitle>
          <CardDescription>
            You can change these choices at any time.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={savePreferences} className="space-y-6">
            <div className="max-w-xs space-y-2">
              <Label htmlFor="reminder-delivery-time">
                Preferred delivery time
              </Label>
              <Input
                id="reminder-delivery-time"
                type="time"
                value={preferences.deliveryTime}
                onChange={(event) =>
                  updatePreference("deliveryTime", event.target.value)
                }
                disabled={unavailable}
                required
                className="h-12 text-base"
              />
              <p className="text-sm text-muted-foreground">
                The preferred time for a reminder, using this device’s local
                time. It does not change a task’s due time.
              </p>
            </div>

            <fieldset className="space-y-3" disabled={unavailable}>
              <legend className="text-base font-semibold text-foreground">
                Quiet hours
              </legend>
              <label className="flex min-h-12 items-center gap-3 text-base">
                <input
                  type="checkbox"
                  checked={preferences.quietHoursEnabled}
                  onChange={(event) =>
                    updatePreference("quietHoursEnabled", event.target.checked)
                  }
                  className="size-5 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                />
                Avoid sending reminders during these hours
              </label>
              {preferences.quietHoursEnabled ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="quiet-hours-start">Quiet hours start</Label>
                    <Input
                      id="quiet-hours-start"
                      type="time"
                      value={preferences.quietHoursStart}
                      onChange={(event) =>
                        updatePreference("quietHoursStart", event.target.value)
                      }
                      required
                      className="h-12 text-base"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="quiet-hours-end">Quiet hours end</Label>
                    <Input
                      id="quiet-hours-end"
                      type="time"
                      value={preferences.quietHoursEnd}
                      onChange={(event) =>
                        updatePreference("quietHoursEnd", event.target.value)
                      }
                      required
                      className="h-12 text-base"
                    />
                  </div>
                  <p className="text-sm text-muted-foreground sm:col-span-2">
                    Quiet hours can continue overnight, for example from 9:00 pm
                    until 7:00 am.
                  </p>
                </div>
              ) : null}
            </fieldset>

            <fieldset className="space-y-3" disabled={unavailable}>
              <legend className="text-base font-semibold text-foreground">
                Preferred days
              </legend>
              <p className="text-sm text-muted-foreground">
                Choose the days you would prefer to receive reminders. Keep at
                least one day selected.
              </p>
              <div className="grid gap-x-6 sm:grid-cols-2">
                {PREFERRED_DAYS.map((day) => (
                  <label
                    key={day}
                    className="flex min-h-12 items-center gap-3 text-base"
                  >
                    <input
                      type="checkbox"
                      checked={preferences.preferredDays.includes(day)}
                      onChange={(event) =>
                        togglePreferredDay(day, event.target.checked)
                      }
                      className="size-5 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    />
                    {PREFERRED_DAY_LABELS[day]}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="flex flex-wrap gap-3">
              <Button
                type="submit"
                disabled={unavailable || !hasUnsavedChanges}
              >
                Save reminder preferences
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={resetToDefaults}
                disabled={unavailable || isAtDefaults}
              >
                Reset to defaults
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

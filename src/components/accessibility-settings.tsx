"use client";

import { useEffect, useState } from "react";
import type { KeyboardEvent } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  ACCESSIBILITY_PREFERENCES_STORAGE_KEY,
  ACCESSIBILITY_PREFERENCES_UPDATED_EVENT,
  DEFAULT_ACCESSIBILITY_PREFERENCES,
  parseAccessibilityPreferences,
  type AccessibilityPreferences,
} from "@/lib/accessibility-preferences";
import { cn } from "@/lib/utils";

export function AccessibilitySettings() {
  const [initial] = useState(readPreferences);
  const [preferences, setPreferences] = useState<AccessibilityPreferences>(
    initial.preferences,
  );
  const [storageError, setStorageError] = useState<string | null>(
    initial.error,
  );
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    applyPreferences(preferences);
  }, [preferences]);

  useEffect(() => {
    function refreshPreferences() {
      const saved = readPreferences();
      setPreferences(saved.preferences);
      setStorageError(saved.error);
    }

    function onStorage(event: StorageEvent) {
      if (
        event.key === ACCESSIBILITY_PREFERENCES_STORAGE_KEY ||
        event.key === null
      ) {
        refreshPreferences();
      }
    }

    window.addEventListener("storage", onStorage);
    window.addEventListener(
      ACCESSIBILITY_PREFERENCES_UPDATED_EVENT,
      refreshPreferences,
    );
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(
        ACCESSIBILITY_PREFERENCES_UPDATED_EVENT,
        refreshPreferences,
      );
    };
  }, []);

  function updatePreferences(patch: Partial<AccessibilityPreferences>) {
    const next = { ...preferences, ...patch };
    setPreferences(next);
    setNotice(null);
    try {
      window.localStorage.setItem(
        ACCESSIBILITY_PREFERENCES_STORAGE_KEY,
        JSON.stringify(next),
      );
      window.dispatchEvent(new Event(ACCESSIBILITY_PREFERENCES_UPDATED_EVENT));
      setStorageError(null);
    } catch {
      setStorageError(
        "These accessibility choices apply for now, but could not be saved in this browser.",
      );
    }
  }

  function resetToDefaults() {
    updatePreferences(DEFAULT_ACCESSIBILITY_PREFERENCES);
    setNotice("Accessibility settings reset to defaults.");
  }

  function handleRadioKeyDown<Value extends string>(
    event: KeyboardEvent<HTMLButtonElement>,
    values: readonly Value[],
    selected: Value,
    onSelect: (value: Value) => void,
  ) {
    const direction =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;
    if (direction === 0) return;
    event.preventDefault();
    const currentIndex = values.indexOf(selected);
    const nextIndex =
      (currentIndex + direction + values.length) % values.length;
    const nextValue = values[nextIndex];
    if (nextValue === undefined) return;
    onSelect(nextValue);
    event.currentTarget.parentElement
      ?.querySelectorAll<HTMLButtonElement>('[role="radio"]')
      .item(nextIndex)
      ?.focus();
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">
          Make DayKeeper easier to use
        </h2>
        <p className="mt-1 text-base text-muted-foreground">
          These choices apply across the app on this device. You can change them
          whenever you need. Defaults are standard text, the DayKeeper palette,
          extra contrast off, and reduced motion off.
        </p>
      </div>

      {storageError ? (
        <p role="alert" className="text-base font-medium text-danger">
          {storageError}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="text-base font-medium text-success">
          {notice}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Text size</CardTitle>
          <CardDescription>
            Choose a size that feels comfortable to read.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            aria-label="Text size"
            className="grid gap-2 sm:grid-cols-3"
            role="radiogroup"
          >
            {(
              [
                ["default", "Standard", "The usual text size"],
                ["large", "Large", "A little bigger"],
                ["largest", "Largest", "The biggest text"],
              ] as const
            ).map(([value, label, description]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={preferences.fontScale === value}
                tabIndex={preferences.fontScale === value ? 0 : -1}
                onClick={() => updatePreferences({ fontScale: value })}
                onKeyDown={(event) =>
                  handleRadioKeyDown(
                    event,
                    ["default", "large", "largest"],
                    preferences.fontScale,
                    (fontScale) => updatePreferences({ fontScale }),
                  )
                }
                className={cn(
                  "min-h-14 rounded-lg border px-4 py-3 text-left transition-colors",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  preferences.fontScale === value
                    ? "border-primary bg-primary-soft text-foreground"
                    : "border-border hover:bg-muted",
                )}
              >
                <span className="block font-medium">{label}</span>
                <span className="mt-0.5 block text-sm text-muted-foreground">
                  {description}
                </span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Colour vision</CardTitle>
          <CardDescription>
            Choose a palette designed to keep important differences visible.
            Text labels and icons still identify every status.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            aria-label="Colour vision palette"
            className="grid gap-2 sm:grid-cols-2"
            role="radiogroup"
          >
            {(
              [
                ["none", "DayKeeper palette", "Use the standard palette"],
                ["protanopia", "Protanopia", "Red-weak colour vision"],
                ["deuteranopia", "Deuteranopia", "Green-weak colour vision"],
                ["tritanopia", "Tritanopia", "Blue-weak colour vision"],
                ["monochromacy", "Monochromacy", "Very limited colour vision"],
              ] as const
            ).map(([value, label, description]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={preferences.colourVision === value}
                tabIndex={preferences.colourVision === value ? 0 : -1}
                onClick={() => updatePreferences({ colourVision: value })}
                onKeyDown={(event) =>
                  handleRadioKeyDown(
                    event,
                    [
                      "none",
                      "protanopia",
                      "deuteranopia",
                      "tritanopia",
                      "monochromacy",
                    ],
                    preferences.colourVision,
                    (colourVision) => updatePreferences({ colourVision }),
                  )
                }
                className={cn(
                  "min-h-14 rounded-lg border px-4 py-3 text-left transition-colors",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  preferences.colourVision === value
                    ? "border-primary bg-primary-soft text-foreground"
                    : "border-border hover:bg-muted",
                )}
              >
                <span className="block font-medium">{label}</span>
                <span className="mt-0.5 block text-sm text-muted-foreground">
                  {description}
                </span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Contrast</CardTitle>
          <CardDescription>
            Make borders and supporting text stand out more clearly.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PreferenceSwitch
            id="high-contrast"
            label="Extra contrast"
            description="Strengthens the contrast of borders and supporting text."
            checked={preferences.highContrast}
            onCheckedChange={(checked) =>
              updatePreferences({ highContrast: checked })
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Motion</CardTitle>
          <CardDescription>
            Reduce movement when transitions feel distracting.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PreferenceSwitch
            id="reduce-motion"
            label="Reduce motion"
            description="Turns off non-essential transitions and animations."
            checked={preferences.reduceMotion}
            onCheckedChange={(checked) =>
              updatePreferences({ reduceMotion: checked })
            }
          />
        </CardContent>
      </Card>
      <Button variant="outline" onClick={resetToDefaults}>
        Reset to defaults
      </Button>
    </div>
  );
}

function PreferenceSwitch({
  id,
  label,
  description,
  checked,
  onCheckedChange,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-6">
      <div className="space-y-1">
        <Label htmlFor={id} className="text-base font-medium">
          {label}
        </Label>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function applyPreferences(preferences: AccessibilityPreferences) {
  const root = document.documentElement;
  root.dataset.fontScale = preferences.fontScale;
  root.dataset.colourVision = preferences.colourVision;
  root.dataset.highContrast = String(preferences.highContrast);
  root.dataset.reduceMotion = String(preferences.reduceMotion);
}

function readPreferences(): {
  preferences: AccessibilityPreferences;
  error: string | null;
} {
  if (typeof window === "undefined") {
    return {
      preferences: DEFAULT_ACCESSIBILITY_PREFERENCES,
      error: null,
    };
  }
  try {
    return {
      preferences: parseAccessibilityPreferences(
        window.localStorage.getItem(ACCESSIBILITY_PREFERENCES_STORAGE_KEY),
      ),
      error: null,
    };
  } catch {
    return {
      preferences: DEFAULT_ACCESSIBILITY_PREFERENCES,
      error:
        "Saved accessibility settings could not be read. DayKeeper is using its defaults for now.",
    };
  }
}

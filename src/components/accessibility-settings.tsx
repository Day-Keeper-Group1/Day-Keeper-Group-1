"use client";

import { useEffect, useState } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type FontScale = "default" | "large" | "largest";
type ColourVisionMode =
  "none" | "protanopia" | "deuteranopia" | "tritanopia" | "monochromacy";

const STORAGE_KEY = "daykeeper-accessibility";

type AccessibilityPreferences = {
  fontScale: FontScale;
  colourVision: ColourVisionMode;
  highContrast: boolean;
  reduceMotion: boolean;
};

const DEFAULT_PREFERENCES: AccessibilityPreferences = {
  fontScale: "default",
  colourVision: "none",
  highContrast: false,
  reduceMotion: false,
};

export function AccessibilitySettings() {
  const [preferences, setPreferences] =
    useState<AccessibilityPreferences>(readPreferences);

  useEffect(() => {
    applyPreferences(preferences);
  }, [preferences]);

  function updatePreferences(patch: Partial<AccessibilityPreferences>) {
    const next = { ...preferences, ...patch };
    setPreferences(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">
          Make DayKeeper easier to use
        </h2>
        <p className="mt-1 text-base text-muted-foreground">
          These choices apply across the app on this device. You can change them
          whenever you need.
        </p>
      </div>

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
                onClick={() => updatePreferences({ fontScale: value })}
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
                onClick={() => updatePreferences({ colourVision: value })}
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

function readPreferences(): AccessibilityPreferences {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES;

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) return DEFAULT_PREFERENCES;

  try {
    const parsed = JSON.parse(stored) as Partial<AccessibilityPreferences> & {
      colourSafe?: boolean;
    };
    const legacyColourSafe =
      "colourSafe" in parsed && parsed.colourSafe === true
        ? "deuteranopia"
        : DEFAULT_PREFERENCES.colourVision;
    return {
      ...DEFAULT_PREFERENCES,
      ...parsed,
      colourVision: parsed.colourVision ?? legacyColourSafe,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

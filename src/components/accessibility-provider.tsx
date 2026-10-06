"use client";

import { useEffect, useState } from "react";

import {
  ACCESSIBILITY_PREFERENCES_STORAGE_KEY,
  ACCESSIBILITY_PREFERENCES_UPDATED_EVENT,
  DEFAULT_ACCESSIBILITY_PREFERENCES,
  parseAccessibilityPreferences,
  type AccessibilityPreferences,
} from "@/lib/accessibility-preferences";

export function AccessibilityProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function applySavedPreferences() {
      try {
        const preferences = parseAccessibilityPreferences(
          window.localStorage.getItem(ACCESSIBILITY_PREFERENCES_STORAGE_KEY),
        );
        apply(preferences);
        setError(null);
      } catch (cause) {
        apply(DEFAULT_ACCESSIBILITY_PREFERENCES);
        setError(
          cause instanceof Error
            ? cause.message
            : "Accessibility settings could not be read in this browser.",
        );
      }
    }

    function onStorage(event: StorageEvent) {
      if (
        event.key === ACCESSIBILITY_PREFERENCES_STORAGE_KEY ||
        event.key === null
      ) {
        applySavedPreferences();
      }
    }

    applySavedPreferences();
    window.addEventListener("storage", onStorage);
    window.addEventListener(
      ACCESSIBILITY_PREFERENCES_UPDATED_EVENT,
      applySavedPreferences,
    );
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(
        ACCESSIBILITY_PREFERENCES_UPDATED_EVENT,
        applySavedPreferences,
      );
    };
  }, []);

  return (
    <>
      {error ? (
        <p
          role="alert"
          className="border-b border-danger px-4 py-3 text-danger"
        >
          {error} Open Accessibility settings to review them.
        </p>
      ) : null}
      {children}
    </>
  );
}

function apply(preferences: AccessibilityPreferences) {
  const root = document.documentElement;
  root.dataset.fontScale = preferences.fontScale;
  root.dataset.colourVision = preferences.colourVision;
  root.dataset.highContrast = String(preferences.highContrast);
  root.dataset.reduceMotion = String(preferences.reduceMotion);
}

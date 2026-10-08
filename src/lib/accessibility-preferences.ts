import { z } from "zod";

export type FontScale = "default" | "large" | "largest";
export type ColourVisionMode =
  "none" | "protanopia" | "deuteranopia" | "tritanopia" | "monochromacy";

export type AccessibilityPreferences = {
  fontScale: FontScale;
  colourVision: ColourVisionMode;
  highContrast: boolean;
  reduceMotion: boolean;
};

export const ACCESSIBILITY_PREFERENCES_STORAGE_KEY = "daykeeper-accessibility";
export const ACCESSIBILITY_PREFERENCES_UPDATED_EVENT =
  "daykeeper-accessibility-preferences-updated";

export const DEFAULT_ACCESSIBILITY_PREFERENCES: AccessibilityPreferences = {
  fontScale: "default",
  colourVision: "none",
  highContrast: false,
  reduceMotion: false,
};

const preferencesSchema = z
  .object({
    fontScale: z.enum(["default", "large", "largest"]).optional(),
    colourVision: z
      .enum([
        "none",
        "protanopia",
        "deuteranopia",
        "tritanopia",
        "monochromacy",
      ])
      .optional(),
    highContrast: z.boolean().optional(),
    reduceMotion: z.boolean().optional(),
    colourSafe: z.boolean().optional(),
  })
  .passthrough();

export function parseAccessibilityPreferences(
  stored: string | null,
): AccessibilityPreferences {
  if (stored === null) return { ...DEFAULT_ACCESSIBILITY_PREFERENCES };

  let value: unknown;
  try {
    value = JSON.parse(stored);
  } catch {
    throw new Error(
      "Saved accessibility settings could not be read. They have not been changed.",
    );
  }

  const parsed = preferencesSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(
      "Saved accessibility settings have an unexpected format. They have not been changed.",
    );
  }

  return {
    fontScale:
      parsed.data.fontScale ?? DEFAULT_ACCESSIBILITY_PREFERENCES.fontScale,
    colourVision:
      parsed.data.colourVision ??
      (parsed.data.colourSafe === true
        ? "deuteranopia"
        : DEFAULT_ACCESSIBILITY_PREFERENCES.colourVision),
    highContrast:
      parsed.data.highContrast ??
      DEFAULT_ACCESSIBILITY_PREFERENCES.highContrast,
    reduceMotion:
      parsed.data.reduceMotion ??
      DEFAULT_ACCESSIBILITY_PREFERENCES.reduceMotion,
  };
}

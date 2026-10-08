import { describe, expect, it } from "vitest";

import {
  DEFAULT_ACCESSIBILITY_PREFERENCES,
  parseAccessibilityPreferences,
} from "@/lib/accessibility-preferences";

describe("browser-local accessibility preferences", () => {
  it("uses accessible defaults when no choices are saved", () => {
    expect(parseAccessibilityPreferences(null)).toEqual(
      DEFAULT_ACCESSIBILITY_PREFERENCES,
    );
  });

  it("preserves valid choices and the previous colour-safe setting", () => {
    expect(
      parseAccessibilityPreferences(
        JSON.stringify({
          fontScale: "large",
          colourVision: "tritanopia",
          highContrast: true,
          reduceMotion: true,
        }),
      ),
    ).toEqual({
      fontScale: "large",
      colourVision: "tritanopia",
      highContrast: true,
      reduceMotion: true,
    });
    expect(
      parseAccessibilityPreferences(JSON.stringify({ colourSafe: true }))
        .colourVision,
    ).toBe("deuteranopia");
  });

  it("rejects malformed and unsupported settings", () => {
    expect(() => parseAccessibilityPreferences("{")).toThrow(
      "Saved accessibility settings could not be read.",
    );
    expect(() =>
      parseAccessibilityPreferences(JSON.stringify({ fontScale: "huge" })),
    ).toThrow("unexpected format");
  });
});

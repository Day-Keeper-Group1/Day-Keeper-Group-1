import { describe, expect, it } from "vitest";

import {
  DEFAULT_DASHBOARD_SECTIONS,
  parseDashboardSections,
} from "@/lib/dashboard-sections";

describe("browser-local dashboard sections", () => {
  it("uses all sections in their default order when no choices are saved", () => {
    expect(parseDashboardSections(null)).toEqual(DEFAULT_DASHBOARD_SECTIONS);
  });

  it("adds All tasks to an older saved dashboard layout", () => {
    expect(
      parseDashboardSections(
        JSON.stringify(["upcoming", "today", "recentDocuments"]),
      ),
    ).toEqual([
      "upcoming",
      "today",
      "recentDocuments",
      "allTasks",
      "overdue",
      "needsReview",
    ]);
  });

  it("preserves current saved order but restores urgent sections", () => {
    expect(
      parseDashboardSections(
        JSON.stringify({
          version: 2,
          sections: ["upcoming", "today", "recentDocuments"],
        }),
      ),
    ).toEqual([
      "upcoming",
      "today",
      "recentDocuments",
      "overdue",
      "needsReview",
    ]);
  });

  it("restores All tasks and urgent sections when an old layout hid everything", () => {
    expect(parseDashboardSections("[]")).toEqual([
      "allTasks",
      "overdue",
      "needsReview",
    ]);
    expect(
      parseDashboardSections(JSON.stringify({ version: 2, sections: [] })),
    ).toEqual(["overdue", "needsReview"]);
  });

  it("rejects malformed, unknown, and duplicated sections", () => {
    expect(() => parseDashboardSections("{")).toThrow(
      "Dashboard sections could not be read.",
    );
    expect(() => parseDashboardSections('["unknown"]')).toThrow(
      "unexpected format",
    );
    expect(() => parseDashboardSections('["today","today"]')).toThrow(
      "unexpected format",
    );
    expect(() =>
      parseDashboardSections(
        JSON.stringify({ version: 2, sections: ["allTasks", "allTasks"] }),
      ),
    ).toThrow("unexpected format");
  });
});

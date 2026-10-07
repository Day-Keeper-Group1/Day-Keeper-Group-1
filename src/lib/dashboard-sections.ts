import { z } from "zod";

export const DASHBOARD_SECTIONS = [
  "today",
  "overdue",
  "upcoming",
  "needsReview",
  "recentDocuments",
  "allTasks",
] as const;

export type DashboardSection = (typeof DASHBOARD_SECTIONS)[number];

export const REQUIRED_DASHBOARD_SECTIONS: DashboardSection[] = [
  "overdue",
  "needsReview",
];

export const DASHBOARD_SECTION_LABELS: Record<DashboardSection, string> = {
  today: "Today",
  overdue: "Overdue",
  upcoming: "Upcoming",
  needsReview: "Needs review",
  recentDocuments: "Recent documents",
  allTasks: "All tasks",
};

export const DEFAULT_DASHBOARD_SECTIONS: DashboardSection[] = [
  ...DASHBOARD_SECTIONS,
];

export const DASHBOARD_SECTIONS_STORAGE_KEY = "daykeeper-dashboard-sections";
export const DASHBOARD_SECTIONS_UPDATED_EVENT =
  "daykeeper-dashboard-sections-updated";

const dashboardSectionsSchema = z.array(z.enum(DASHBOARD_SECTIONS));
const savedDashboardSectionsSchema = z
  .object({
    version: z.literal(2),
    sections: dashboardSectionsSchema,
  })
  .strict();

export function parseDashboardSections(
  stored: string | null,
): DashboardSection[] {
  if (stored === null) return [...DEFAULT_DASHBOARD_SECTIONS];

  let value: unknown;
  try {
    value = JSON.parse(stored);
  } catch {
    throw new Error(
      "Dashboard sections could not be read. Your saved choices have not been changed.",
    );
  }

  let sections: DashboardSection[] | null;
  if (Array.isArray(value)) {
    const parsed = dashboardSectionsSchema.safeParse(value);
    sections = parsed.success
      ? parsed.data.includes("allTasks")
        ? parsed.data
        : [...parsed.data, "allTasks"]
      : null;
  } else {
    const parsed = savedDashboardSectionsSchema.safeParse(value);
    sections = parsed.success ? parsed.data.sections : null;
  }

  if (sections === null || new Set(sections).size !== sections.length) {
    throw new Error(
      "Dashboard sections have an unexpected format. Your saved choices have not been changed.",
    );
  }

  for (const required of REQUIRED_DASHBOARD_SECTIONS) {
    if (!sections.includes(required)) sections.push(required);
  }

  return sections;
}

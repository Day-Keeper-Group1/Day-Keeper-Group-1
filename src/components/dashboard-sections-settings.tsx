"use client";

import Link from "next/link";
import { ArrowLeft, ArrowDown, ArrowUp } from "lucide-react";
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
  DASHBOARD_SECTION_LABELS,
  DASHBOARD_SECTIONS,
  DASHBOARD_SECTIONS_STORAGE_KEY,
  DASHBOARD_SECTIONS_UPDATED_EVENT,
  DEFAULT_DASHBOARD_SECTIONS,
  parseDashboardSections,
  REQUIRED_DASHBOARD_SECTIONS,
  type DashboardSection,
} from "@/lib/dashboard-sections";

export function DashboardSectionsSettings() {
  const [sections, setSections] = useState<DashboardSection[]>(
    DEFAULT_DASHBOARD_SECTIONS,
  );
  const [savedSections, setSavedSections] = useState<DashboardSection[]>(
    DEFAULT_DASHBOARD_SECTIONS,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      try {
        const saved = parseDashboardSections(
          window.localStorage.getItem(DASHBOARD_SECTIONS_STORAGE_KEY),
        );
        setSections(saved);
        setSavedSections(saved);
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Dashboard sections could not be read.",
        );
      } finally {
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  function toggleSection(section: DashboardSection, checked: boolean) {
    if (!checked && REQUIRED_DASHBOARD_SECTIONS.includes(section)) return;
    setSections((current) => {
      if (checked) {
        return current.includes(section) ? current : [...current, section];
      }
      return current.filter((candidate) => candidate !== section);
    });
    setNotice(null);
  }

  function moveSection(section: DashboardSection, direction: -1 | 1) {
    setSections((current) => {
      const index = current.indexOf(section);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
    setNotice(null);
  }

  function saveSections() {
    try {
      window.localStorage.setItem(
        DASHBOARD_SECTIONS_STORAGE_KEY,
        JSON.stringify({ version: 2, sections }),
      );
      window.dispatchEvent(new Event(DASHBOARD_SECTIONS_UPDATED_EVENT));
      setSavedSections(sections);
      setError(null);
      setNotice("Dashboard sections saved in this browser.");
    } catch {
      setError(
        "Dashboard sections could not be saved in this browser. Check available storage and try again.",
      );
    }
  }

  function resetSections() {
    setSections([...DEFAULT_DASHBOARD_SECTIONS]);
    setSavedSections([]);
    setNotice("Defaults selected. Save dashboard layout to apply them.");
    setError(null);
  }

  const unavailable = loading || error !== null;
  const hasUnsavedChanges =
    sections.length !== savedSections.length ||
    sections.some((section, index) => section !== savedSections[index]);

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
        title="Dashboard sections"
        description="Choose what appears on your dashboard and put it in the order you prefer."
      />

      <p className="max-w-prose text-base text-muted-foreground">
        These choices are saved only in this browser and change which sections
        appear on Home. Overdue and Needs review always stay visible so overdue
        tasks and letters awaiting review remain easy to find. The default is to
        show all sections. Reset to defaults restores that full list; save the
        layout to apply it.
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your dashboard</CardTitle>
          <CardDescription>
            Turn sections on or off, or move them to change their order.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <p role="alert" className="mb-3 text-base font-medium text-danger">
              {error}
            </p>
          ) : null}
          {loading ? (
            <p role="status" className="mb-3 text-base text-muted-foreground">
              Loading dashboard sections...
            </p>
          ) : null}

          <ol className="space-y-2">
            {sections.map((section, index) => (
              <li
                key={section}
                className="flex min-h-14 items-center gap-3 rounded-lg border-2 border-border px-3 py-2"
              >
                <label className="flex min-h-12 min-w-0 flex-1 items-center gap-3 text-base font-medium">
                  <input
                    type="checkbox"
                    checked
                    aria-describedby={
                      REQUIRED_DASHBOARD_SECTIONS.includes(section)
                        ? `required-section-${section}`
                        : undefined
                    }
                    disabled={
                      unavailable ||
                      REQUIRED_DASHBOARD_SECTIONS.includes(section)
                    }
                    onChange={(event) =>
                      toggleSection(section, event.target.checked)
                    }
                    className="size-5 shrink-0 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  />
                  <span>{DASHBOARD_SECTION_LABELS[section]}</span>
                </label>
                {REQUIRED_DASHBOARD_SECTIONS.includes(section) ? (
                  <span
                    id={`required-section-${section}`}
                    className="max-w-40 text-right text-caption text-muted-foreground"
                  >
                    Always shown for urgent items
                  </span>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label={`Move ${DASHBOARD_SECTION_LABELS[section]} up`}
                  disabled={unavailable || index === 0}
                  onClick={() => moveSection(section, -1)}
                >
                  <ArrowUp className="size-5" strokeWidth={1.75} />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label={`Move ${DASHBOARD_SECTION_LABELS[section]} down`}
                  disabled={unavailable || index === sections.length - 1}
                  onClick={() => moveSection(section, 1)}
                >
                  <ArrowDown className="size-5" strokeWidth={1.75} />
                </Button>
              </li>
            ))}
            {DASHBOARD_SECTIONS.filter(
              (section) => !sections.includes(section),
            ).map((section) => (
              <li
                key={section}
                className="flex min-h-14 items-center gap-3 rounded-lg border-2 border-border px-3 py-2"
              >
                <label className="flex min-h-12 min-w-0 flex-1 items-center gap-3 text-base font-medium">
                  <input
                    type="checkbox"
                    checked={false}
                    disabled={unavailable}
                    onChange={(event) =>
                      toggleSection(section, event.target.checked)
                    }
                    className="size-5 shrink-0 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  />
                  <span>{DASHBOARD_SECTION_LABELS[section]}</span>
                </label>
                <span className="px-2 text-caption text-muted-foreground">
                  Hidden
                </span>
              </li>
            ))}
          </ol>

          <div className="mt-4 flex flex-wrap gap-3">
            <Button
              onClick={saveSections}
              disabled={unavailable || !hasUnsavedChanges}
            >
              Save dashboard layout
            </Button>
            <Button
              variant="outline"
              onClick={resetSections}
              disabled={unavailable}
            >
              Reset to defaults
            </Button>
          </div>
          {notice ? (
            <p role="status" className="mt-3 text-base text-success">
              {notice}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

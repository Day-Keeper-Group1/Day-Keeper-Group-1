"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  matchingSenderRuleForIssuer,
  parseStoredSenderRules,
  SENDER_RULES_STORAGE_KEY,
  SENDER_RULES_UPDATED_EVENT,
  type SenderRule,
} from "@/lib/sender-rules";

type PreferencesState =
  | { status: "loading"; issuer: string }
  | { status: "none"; issuer: string }
  | { status: "unavailable"; issuer: string }
  | { status: "matched"; issuer: string; rule: SenderRule };

export function SenderRulePreferences({
  issuer,
  showNoMatch = false,
}: {
  issuer: string | null;
  showNoMatch?: boolean;
}) {
  const [state, setState] = useState<PreferencesState | null>(null);

  useEffect(() => {
    if (!issuer) return;
    const currentIssuer = issuer;

    function refresh() {
      try {
        const rules = parseStoredSenderRules(
          window.localStorage.getItem(SENDER_RULES_STORAGE_KEY),
        );
        const rule = matchingSenderRuleForIssuer(currentIssuer, rules);
        setState(
          rule
            ? { status: "matched", issuer: currentIssuer, rule }
            : { status: "none", issuer: currentIssuer },
        );
      } catch {
        setState({ status: "unavailable", issuer: currentIssuer });
      }
    }

    function onStorage(event: StorageEvent) {
      if (event.key === SENDER_RULES_STORAGE_KEY || event.key === null) {
        refresh();
      }
    }

    refresh();
    window.addEventListener("storage", onStorage);
    window.addEventListener(SENDER_RULES_UPDATED_EVENT, refresh);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(SENDER_RULES_UPDATED_EVENT, refresh);
    };
  }, [issuer]);

  if (!showNoMatch && !issuer) return null;
  if (!issuer) {
    return (
      <aside className="rounded-[10px] border-2 border-line p-4">
        <h3 className="text-base font-semibold text-foreground">Sender rule</h3>
        <p className="mt-2 text-caption text-muted-foreground">
          No sender was identified for this task, so a sender rule cannot be
          matched.
        </p>
      </aside>
    );
  }
  if (!state || state.issuer !== issuer || state.status === "loading") {
    if (!showNoMatch) return null;
    return (
      <aside className="rounded-[10px] border-2 border-line p-4">
        <h3 className="text-base font-semibold text-foreground">Sender rule</h3>
        <p role="status" className="mt-2 text-caption text-muted-foreground">
          Checking saved sender rules for {issuer}...
        </p>
      </aside>
    );
  }

  if (state.status === "none") {
    if (!showNoMatch) return null;
    return (
      <aside className="rounded-[10px] border-2 border-line p-4">
        <h3 className="text-base font-semibold text-foreground">Sender rule</h3>
        <p className="mt-2 text-caption text-muted-foreground">
          No sender rule is saved for {issuer} in this browser.
        </p>
        <Link
          href="/customization/sender-rules"
          className="mt-2 inline-flex min-h-12 items-center font-semibold text-primary underline underline-offset-2"
        >
          View sender rules
        </Link>
      </aside>
    );
  }

  if (state.status === "unavailable") {
    if (!showNoMatch) {
      return (
        <p
          role="status"
          className="mt-3 border-t border-line pt-3 text-caption"
        >
          Saved sender preferences could not be checked in this browser.
        </p>
      );
    }
    return (
      <aside
        role="status"
        className="rounded-[10px] border-2 border-line p-4 text-caption"
      >
        Saved sender preferences could not be checked in this browser.
      </aside>
    );
  }

  const { rule } = state;
  const reminderTiming =
    rule.reminderOffsets?.map(
      (offset) => `${offset} ${offset === 1 ? "day" : "days"} before`,
    ) ?? [];
  const priority = rule.priority[0].toUpperCase() + rule.priority.slice(1);

  return (
    <aside
      className={
        showNoMatch
          ? "rounded-[10px] border-2 border-line p-4"
          : "mt-3 border-t border-line pt-3"
      }
    >
      <h3 className="text-base font-semibold text-foreground">
        Saved preferences for {rule.issuer}
      </h3>
      <ul className="mt-1 space-y-1 text-caption text-muted-foreground">
        <li>Default priority: {priority}</li>
        {rule.action ? <li>Default action type: {rule.action}</li> : null}
        {reminderTiming.length > 0 ? (
          <li>Reminder timing: {reminderTiming.join(", ")}</li>
        ) : null}
      </ul>
      <p className="mt-2 text-caption text-muted-foreground">
        These browser-saved preferences do not change this task.
      </p>
      <Link
        href={`/customization/sender-rules?editRule=${encodeURIComponent(rule.id)}`}
        className="mt-2 inline-flex min-h-12 items-center font-semibold text-primary underline underline-offset-2"
      >
        Change sender rule
      </Link>
    </aside>
  );
}

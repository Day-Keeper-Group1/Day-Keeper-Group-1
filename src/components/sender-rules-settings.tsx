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
import { ACTION_WORDS, type ActionWord } from "@/lib/contract/fields";
import { REMINDER_OFFSET_DAYS } from "@/lib/contract/reminders";
import {
  isActionWord,
  isTaskPriority,
  normalizeIssuer,
  orderedReminderOffsets,
  parseStoredSenderRules,
  SENDER_RULES_STORAGE_KEY,
  SENDER_RULES_UPDATED_EVENT,
  TASK_PRIORITIES,
  toggleReminderOffset,
  type ReminderOffset,
  type SenderRule,
  type TaskPriority,
} from "@/lib/sender-rules";

function priorityLabel(priority: TaskPriority): string {
  return priority[0].toUpperCase() + priority.slice(1);
}

function reminderTimingLabel(offsets?: ReminderOffset[]): string {
  if (offsets === undefined) {
    return "Standard (7 days, 3 days, and 1 day before due date)";
  }
  const days = offsets
    .map((offset) => `${offset} ${offset === 1 ? "day" : "days"}`)
    .join(", ");
  return `${days} before due date`;
}

function storageErrorMessage(): string {
  return "We couldn't save sender rules in this browser. Check available storage and try again.";
}

export function SenderRulesSettings({
  initialEditRuleId,
}: {
  initialEditRuleId?: string;
}) {
  const [rules, setRules] = useState<SenderRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [issuer, setIssuer] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("normal");
  const [action, setAction] = useState<ActionWord | "">("");
  const [reminderOffsets, setReminderOffsets] = useState<ReminderOffset[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editIssuer, setEditIssuer] = useState("");
  const [editPriority, setEditPriority] = useState<TaskPriority>("normal");
  const [editAction, setEditAction] = useState<ActionWord | "">("");
  const [editReminderOffsets, setEditReminderOffsets] = useState<
    ReminderOffset[]
  >([]);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(
    null,
  );
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      try {
        const savedRules = parseStoredSenderRules(
          window.localStorage.getItem(SENDER_RULES_STORAGE_KEY),
        );
        setRules(savedRules);
        const ruleToEdit = savedRules.find(
          (rule) => rule.id === initialEditRuleId,
        );
        if (ruleToEdit) {
          setEditingId(ruleToEdit.id);
          setEditIssuer(ruleToEdit.issuer);
          setEditPriority(ruleToEdit.priority);
          setEditAction(ruleToEdit.action ?? "");
          setEditReminderOffsets(ruleToEdit.reminderOffsets ?? []);
        }
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
  }, [initialEditRuleId]);

  function persistRules(nextRules: SenderRule[]): boolean {
    try {
      window.localStorage.setItem(
        SENDER_RULES_STORAGE_KEY,
        JSON.stringify(nextRules),
      );
      window.dispatchEvent(new Event(SENDER_RULES_UPDATED_EVENT));
      setRules(nextRules);
      setStorageError(null);
      return true;
    } catch {
      setStorageError(storageErrorMessage());
      return false;
    }
  }

  function saveNewRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setNotice(null);
    const cleanedIssuer = issuer.normalize("NFKC").trim().replace(/\s+/gu, " ");
    const normalizedIssuer = normalizeIssuer(cleanedIssuer);
    if (!cleanedIssuer || cleanedIssuer.length > 200) {
      setFormError("Enter an organization name of 1 to 200 characters.");
      return;
    }

    const existing = rules.find(
      (rule) => normalizeIssuer(rule.issuer) === normalizedIssuer,
    );
    const nextRule: SenderRule = {
      id: existing?.id ?? crypto.randomUUID(),
      issuer: cleanedIssuer,
      priority,
      ...(action ? { action } : {}),
      ...(reminderOffsets.length > 0
        ? { reminderOffsets: orderedReminderOffsets(reminderOffsets) }
        : {}),
    };
    const nextRules = [
      ...rules.filter((rule) => rule.id !== existing?.id),
      nextRule,
    ].sort((left, right) => left.issuer.localeCompare(right.issuer));

    if (!persistRules(nextRules)) return;
    setIssuer("");
    setPriority("normal");
    setAction("");
    setReminderOffsets([]);
    setNotice(
      existing
        ? "The existing sender rule was updated in this browser."
        : "Sender rule saved in this browser.",
    );
  }

  function startEditing(rule: SenderRule) {
    setEditingId(rule.id);
    setEditIssuer(rule.issuer);
    setEditPriority(rule.priority);
    setEditAction(rule.action ?? "");
    setEditReminderOffsets(rule.reminderOffsets ?? []);
    setFormError(null);
    setNotice(null);
    setConfirmingDeleteId(null);
  }

  function saveEdit(event: FormEvent<HTMLFormElement>, rule: SenderRule) {
    event.preventDefault();
    setFormError(null);
    setNotice(null);
    const cleanedIssuer = editIssuer
      .normalize("NFKC")
      .trim()
      .replace(/\s+/gu, " ");
    const normalizedIssuer = normalizeIssuer(cleanedIssuer);
    if (!cleanedIssuer || cleanedIssuer.length > 200) {
      setFormError("Enter an organization name of 1 to 200 characters.");
      return;
    }
    if (
      rules.some(
        (candidate) =>
          candidate.id !== rule.id &&
          normalizeIssuer(candidate.issuer) === normalizedIssuer,
      )
    ) {
      setFormError(
        "A sender rule already exists for this organization. Edit that rule instead.",
      );
      return;
    }

    const nextRules = rules
      .map((candidate) => {
        if (candidate.id !== rule.id) return candidate;
        return {
          id: candidate.id,
          issuer: cleanedIssuer,
          priority: editPriority,
          ...(editAction ? { action: editAction } : {}),
          ...(editReminderOffsets.length > 0
            ? {
                reminderOffsets: orderedReminderOffsets(editReminderOffsets),
              }
            : {}),
        };
      })
      .sort((left, right) => left.issuer.localeCompare(right.issuer));

    if (!persistRules(nextRules)) return;
    setEditingId(null);
    setNotice("Sender rule updated in this browser.");
  }

  function removeRule(rule: SenderRule) {
    const nextRules = rules.filter((candidate) => candidate.id !== rule.id);
    if (!persistRules(nextRules)) return;
    setConfirmingDeleteId(null);
    if (editingId === rule.id) setEditingId(null);
    setNotice(`Sender rule for ${rule.issuer} removed from this browser.`);
  }

  function resetRules() {
    if (!persistRules([])) return;
    setConfirmingReset(false);
    setConfirmingDeleteId(null);
    setEditingId(null);
    setNotice(
      "All sender rules removed. Tasks continue to use DayKeeper's usual handling.",
    );
  }

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
        title="Sender rules"
        description="Set default task preferences for an organization."
      />

      <p className="max-w-prose text-base text-muted-foreground">
        Sender rules are saved only in this browser. With no rules, DayKeeper
        uses its standard defaults: normal priority, no action type, and
        reminders 7, 3, and 1 day before a due date. Rules are reference
        preferences only in this release; they do not change existing or future
        tasks.
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
          <CardTitle className="text-base">Create a sender rule</CardTitle>
          <CardDescription>
            Use the organization name printed on the letter. Matching ignores
            letter case and repeated spaces.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveNewRule} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sender-rule-issuer">Organization name</Label>
              <Input
                id="sender-rule-issuer"
                value={issuer}
                onChange={(event) => setIssuer(event.target.value)}
                maxLength={200}
                required
                disabled={unavailable}
                placeholder="For example, AGL Energy"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sender-rule-priority">Default priority</Label>
              <select
                id="sender-rule-priority"
                value={priority}
                onChange={(event) => {
                  if (!isTaskPriority(event.target.value)) {
                    setFormError("Choose a valid default priority.");
                    return;
                  }
                  setPriority(event.target.value);
                }}
                disabled={unavailable}
                className="min-h-12 w-full rounded-lg border-2 border-border bg-background px-3 text-base text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60"
              >
                {TASK_PRIORITIES.map((option) => (
                  <option key={option} value={option}>
                    {priorityLabel(option)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sender-rule-action">
                Default action type (optional)
              </Label>
              <select
                id="sender-rule-action"
                value={action}
                onChange={(event) => {
                  if (event.target.value === "") {
                    setAction("");
                    return;
                  }
                  if (!isActionWord(event.target.value)) {
                    setFormError("Choose a valid default action type.");
                    return;
                  }
                  setAction(event.target.value);
                }}
                disabled={unavailable}
                className="min-h-12 w-full rounded-lg border-2 border-border bg-background px-3 text-base text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60"
              >
                <option value="">No default action</option>
                {ACTION_WORDS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <fieldset
              className="space-y-2 sm:col-span-2"
              disabled={unavailable}
            >
              <legend className="text-base font-medium">
                Default reminder timing (optional)
              </legend>
              <p className="text-base text-muted-foreground">
                Choose reminder days before the due date. Leave all unchecked to
                keep the standard schedule: 7 days, 3 days, and 1 day before the
                due date.
              </p>
              <div className="flex flex-wrap gap-x-6">
                {REMINDER_OFFSET_DAYS.map((offset) => (
                  <label
                    key={offset}
                    className="flex min-h-12 items-center gap-3 text-base"
                  >
                    <input
                      type="checkbox"
                      checked={reminderOffsets.includes(offset)}
                      onChange={(event) =>
                        setReminderOffsets((current) =>
                          toggleReminderOffset(
                            current,
                            offset,
                            event.target.checked,
                          ),
                        )
                      }
                      className="size-5 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    />
                    {offset} {offset === 1 ? "day" : "days"} before
                  </label>
                ))}
              </div>
            </fieldset>
            <Button
              type="submit"
              className="sm:col-span-2"
              disabled={unavailable}
            >
              Save sender rule
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your sender rules</CardTitle>
          <CardDescription>
            Create one rule per organization. Adding an existing organization
            updates its rule.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p
              role="status"
              className="min-h-12 text-base text-muted-foreground"
            >
              Loading sender rules...
            </p>
          ) : storageError ? (
            <p className="min-h-12 text-base text-muted-foreground">
              Saved rules are unavailable.
            </p>
          ) : rules.length === 0 ? (
            <p className="min-h-12 text-base text-muted-foreground">
              No sender rules yet. Create a rule above to add it to this
              browser.
            </p>
          ) : (
            <ul>
              {rules.map((rule) => (
                <li
                  key={rule.id}
                  className="border-t border-border py-4 first:border-t-0"
                >
                  {editingId === rule.id ? (
                    <form
                      onSubmit={(event) => saveEdit(event, rule)}
                      className="grid gap-4 sm:grid-cols-2"
                    >
                      <div className="space-y-2">
                        <Label htmlFor={`edit-issuer-${rule.id}`}>
                          Organization name
                        </Label>
                        <Input
                          id={`edit-issuer-${rule.id}`}
                          value={editIssuer}
                          onChange={(event) =>
                            setEditIssuer(event.target.value)
                          }
                          maxLength={200}
                          required
                          disabled={unavailable}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`edit-priority-${rule.id}`}>
                          Default priority
                        </Label>
                        <select
                          id={`edit-priority-${rule.id}`}
                          value={editPriority}
                          onChange={(event) => {
                            if (!isTaskPriority(event.target.value)) {
                              setFormError("Choose a valid default priority.");
                              return;
                            }
                            setEditPriority(event.target.value);
                          }}
                          disabled={unavailable}
                          className="min-h-12 w-full rounded-lg border-2 border-border bg-background px-3 text-base text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60"
                        >
                          {TASK_PRIORITIES.map((option) => (
                            <option key={option} value={option}>
                              {priorityLabel(option)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`edit-action-${rule.id}`}>
                          Default action type (optional)
                        </Label>
                        <select
                          id={`edit-action-${rule.id}`}
                          value={editAction}
                          onChange={(event) => {
                            if (event.target.value === "") {
                              setEditAction("");
                              return;
                            }
                            if (!isActionWord(event.target.value)) {
                              setFormError(
                                "Choose a valid default action type.",
                              );
                              return;
                            }
                            setEditAction(event.target.value);
                          }}
                          disabled={unavailable}
                          className="min-h-12 w-full rounded-lg border-2 border-border bg-background px-3 text-base text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60"
                        >
                          <option value="">No default action</option>
                          {ACTION_WORDS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>
                      <fieldset
                        className="space-y-2 sm:col-span-2"
                        disabled={unavailable}
                      >
                        <legend className="text-base font-medium">
                          Default reminder timing (optional)
                        </legend>
                        <p className="text-base text-muted-foreground">
                          Choose reminder days before the due date. Leave all
                          unchecked to keep the standard schedule: 7 days, 3
                          days, and 1 day before the due date.
                        </p>
                        <div className="flex flex-wrap gap-x-6">
                          {REMINDER_OFFSET_DAYS.map((offset) => (
                            <label
                              key={offset}
                              className="flex min-h-12 items-center gap-3 text-base"
                            >
                              <input
                                type="checkbox"
                                checked={editReminderOffsets.includes(offset)}
                                onChange={(event) =>
                                  setEditReminderOffsets((current) =>
                                    toggleReminderOffset(
                                      current,
                                      offset,
                                      event.target.checked,
                                    ),
                                  )
                                }
                                className="size-5 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                              />
                              {offset} {offset === 1 ? "day" : "days"} before
                            </label>
                          ))}
                        </div>
                      </fieldset>
                      <div className="flex flex-wrap gap-3 sm:col-span-2">
                        <Button type="submit" disabled={unavailable}>
                          Save changes
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={unavailable}
                          onClick={() => setEditingId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </form>
                  ) : confirmingDeleteId === rule.id ? (
                    <div className="space-y-3">
                      <p className="text-base text-foreground">
                        Remove the rule for {rule.issuer} from this browser?
                      </p>
                      <div className="flex flex-wrap gap-3">
                        <Button
                          type="button"
                          variant="destructive"
                          disabled={unavailable}
                          onClick={() => removeRule(rule)}
                        >
                          Remove sender rule
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={unavailable}
                          onClick={() => setConfirmingDeleteId(null)}
                        >
                          Keep rule
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-foreground">
                          {rule.issuer}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Default priority: {priorityLabel(rule.priority)}
                        </p>
                        <p className="text-base text-muted-foreground">
                          Default action: {rule.action ?? "Not set"}
                        </p>
                        <p className="text-base text-muted-foreground">
                          Reminder timing:{" "}
                          {reminderTimingLabel(rule.reminderOffsets)}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          disabled={unavailable}
                          onClick={() => startEditing(rule)}
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          disabled={unavailable}
                          onClick={() => setConfirmingDeleteId(rule.id)}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          {rules.length > 0 ? (
            <div className="mt-4 border-t border-border pt-4">
              {confirmingReset ? (
                <div
                  role="group"
                  aria-label="Confirm resetting sender rules"
                  className="space-y-3"
                >
                  <p className="text-base text-foreground">
                    Remove all {rules.length} sender rules from this browser?
                    This cannot be undone.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={unavailable}
                      onClick={resetRules}
                    >
                      Remove all sender rules
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={unavailable}
                      onClick={() => setConfirmingReset(false)}
                    >
                      Keep rules
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  disabled={unavailable}
                  onClick={() => setConfirmingReset(true)}
                >
                  Reset sender rules to defaults
                </Button>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

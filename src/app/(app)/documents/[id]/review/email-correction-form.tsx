"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { DocumentDetail } from "@/lib/contract/api";
import { Info, Pencil } from "lucide-react";
import type { EmailMessage } from "@/lib/contract/email";
import { EmailBody } from "../../../email/email-body";
import {
  CONTRACT_FIELD_KEYS,
  type ContractFieldKey,
  FIELD_LABELS,
} from "@/lib/contract/fields";
import { Panel, ScreenHeader } from "@/components/screen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
export function EmailCorrectionForm({
  document,
  originalEmail,
}: {
  document: DocumentDetail;
  originalEmail?: EmailMessage;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      document.fields.map((field) => [field.key, field.value ?? ""]),
    ),
  );
  const [editing, setEditing] = useState<ContractFieldKey[]>(
    document.correction!.fieldKeys,
  );
  const [showReferenceHelp, setShowReferenceHelp] = useState(false);
  const reference = values.reference ?? "";
  const identifier = document.identifiers.find(
    (item) =>
      item.value?.replace(/\s/g, "") === reference.replace(/\s/g, "") &&
      reference !== "",
  );
  const referenceHelp = identifier
    ? `This reference is the ${identifier.label.toLowerCase()} on your document. Quote it when contacting the sender or paying.`
    : "The number that identifies your account or this matter. Quote it when contacting the sender or paying. For a Yarra Valley Water bill, this is the account number.";
  const documentTypes = [
    "utility bill",
    "government letter",
    "fine notice",
    "medical letter",
    "appointment letter",
    "insurance renewal",
    "bank statement",
    "council rates notice",
    "tax notice",
    "other document",
  ];
  if (values.document_type && !documentTypes.includes(values.document_type))
    documentTypes.unshift(values.document_type);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const correction = document.correction!;
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/documents/${document.id}/correct`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runId: correction.runId,
          fields: editing.map((key) => ({
            key,
            value: values[key] ?? "",
          })),
        }),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(
          body.error?.message ??
            "Could not save corrections. Please try again.",
        );
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not save corrections.",
      );
      setSaving(false);
    }
  }
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <ScreenHeader
        title="Correct the highlighted details"
        subtitle={document.label}
      />
      <Panel title="Document details">
        <p className="mb-5 text-row">
          Correct the highlighted details. You can also edit any other detail
          before reviewing your task and reminders.
        </p>
        <form onSubmit={submit} className="space-y-5">
          {CONTRACT_FIELD_KEYS.map((key) => {
            const needsCorrection = correction.fieldKeys.includes(key);
            const isEditing = editing.includes(key);
            return (
              <div
                key={key}
                className={`rounded-lg border border-border p-4 ${needsCorrection ? "bg-warn-bg" : "bg-card"}`}
              >
                <div className="flex items-center gap-2">
                  <label
                    htmlFor={isEditing ? `correct-${key}` : undefined}
                    className="font-bold"
                  >
                    {FIELD_LABELS[key]}
                    {needsCorrection ? " — correction needed" : ""}
                  </label>
                  {key === "reference" && (
                    <span
                      className="group relative"
                      onMouseEnter={() => setShowReferenceHelp(true)}
                      onMouseLeave={() => setShowReferenceHelp(false)}
                    >
                      <button
                        type="button"
                        aria-label="About the reference number"
                        aria-describedby={
                          showReferenceHelp ? "reference-help" : undefined
                        }
                        aria-expanded={showReferenceHelp}
                        onFocus={() => setShowReferenceHelp(true)}
                        onBlur={() => setShowReferenceHelp(false)}
                        onClick={() => setShowReferenceHelp(true)}
                        onKeyDown={(event) => {
                          if (event.key === "Escape")
                            setShowReferenceHelp(false);
                        }}
                        className="flex min-h-11 min-w-11 items-center justify-center rounded-md text-primary"
                      >
                        <Info size={18} aria-hidden="true" />
                      </button>
                      {showReferenceHelp && (
                        <span
                          role="tooltip"
                          id="reference-help"
                          className="absolute left-1/2 top-full z-10 w-64 -translate-x-1/2 rounded-md border border-border bg-card p-3 text-sub font-normal text-foreground shadow-sm"
                        >
                          {referenceHelp}
                        </span>
                      )}
                    </span>
                  )}
                  <button
                    type="button"
                    aria-label={`Edit ${FIELD_LABELS[key]}`}
                    aria-expanded={isEditing}
                    disabled={saving}
                    className="ml-auto flex min-h-11 min-w-11 items-center justify-center rounded-md text-primary"
                    onClick={() => {
                      setEditing((current) =>
                        current.includes(key) ? current : [...current, key],
                      );
                      requestAnimationFrame(() => documentElementFocus(key));
                    }}
                  >
                    <Pencil size={18} aria-hidden="true" />
                  </button>
                </div>
                {isEditing ? (
                  key === "document_type" ? (
                    <select
                      id={`correct-${key}`}
                      required
                      disabled={saving}
                      value={values[key] ?? ""}
                      onChange={(event) =>
                        setValues((current) => ({
                          ...current,
                          [key]: event.target.value,
                        }))
                      }
                      className="mt-3 min-h-12 w-full rounded-md border border-border bg-card px-3 text-row"
                    >
                      <option value="" disabled>
                        Select a document type
                      </option>
                      {documentTypes.map((type) => (
                        <option key={type} value={type}>
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <>
                      <Input
                        id={`correct-${key}`}
                        type={
                          key === "due_date" && values[key] !== "Not applicable"
                            ? "date"
                            : "text"
                        }
                        required
                        maxLength={2000}
                        value={values[key] ?? ""}
                        disabled={saving}
                        onChange={(event) =>
                          setValues((current) => ({
                            ...current,
                            [key]: event.target.value,
                          }))
                        }
                        aria-describedby={`help-${key}`}
                        className="mt-3 min-h-12"
                      />
                      <p
                        id={`help-${key}`}
                        className="mt-2 text-sub text-ink-dim"
                      >
                        {key === "due_date"
                          ? "Include the day, month and year."
                          : key === "amount"
                            ? "For example, $10.72, or No payment required."
                            : "Use the wording or number on your document."}
                      </p>
                      {key === "due_date" && (
                        <button
                          type="button"
                          disabled={saving}
                          className="mt-2 min-h-11 text-sub text-primary underline"
                          onClick={() =>
                            setValues((current) => ({
                              ...current,
                              due_date:
                                current.due_date === "Not applicable"
                                  ? ""
                                  : "Not applicable",
                            }))
                          }
                        >
                          {values.due_date === "Not applicable"
                            ? "Enter a due date"
                            : "No due date applies"}
                        </button>
                      )}
                    </>
                  )
                ) : (
                  <p className="break-words text-row">{values[key]}</p>
                )}
              </div>
            );
          })}
          {error && (
            <p role="alert" className="text-warn">
              {error}
            </p>
          )}
          <Button type="submit" disabled={saving}>
            {saving ? "Saving corrections..." : "Continue to review"}
          </Button>
        </form>
      </Panel>
      {document.sourceEmail && (
        <Panel title="Original email">
          {originalEmail ? (
            <EmailBody message={originalEmail} />
          ) : (
            <>
              <p role="status" className="mb-3 text-sub text-ink-dim">
                Formatted email is unavailable. Showing the saved email text.
              </p>
              <p className="whitespace-pre-wrap break-words text-row leading-relaxed">
                {document.sourceEmail.textBody}
              </p>
            </>
          )}
        </Panel>
      )}
    </div>
  );
}

function documentElementFocus(key: ContractFieldKey) {
  window.document.getElementById(`correct-${key}`)?.focus();
}

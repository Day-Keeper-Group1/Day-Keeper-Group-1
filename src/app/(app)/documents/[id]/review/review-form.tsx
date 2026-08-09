"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/status-badge";
import type { ExtractedField, MockDocument } from "@/lib/mock-data";

const SUPPORTIVE_HINT: Record<ExtractedField["status"], string | null> = {
  confirmed: null,
  uncertain: "Please check this value before confirming.",
  unreadable: "We couldn't read this from the photo. Please fill it in.",
};

function PreviewPlaceholder() {
  return (
    <div className="flex aspect-[3/4] items-center justify-center rounded-lg border border-dashed border-border bg-muted/30">
      <div className="flex flex-col items-center gap-2 px-6 text-center">
        <FileText className="size-8 text-muted-foreground" strokeWidth={1.5} />
        <p className="text-sm text-muted-foreground">
          Document preview isn&apos;t available yet in this prototype.
        </p>
      </div>
    </div>
  );
}

export function ReviewForm({
  document,
  fields: initialFields,
}: {
  document: MockDocument;
  fields: ExtractedField[];
}) {
  const router = useRouter();
  const [fields, setFields] = useState(initialFields);

  function updateValue(key: string, value: string) {
    setFields((prev) =>
      prev.map((field) =>
        field.key === key ? { ...field, value, status: "confirmed" } : field,
      ),
    );
  }

  function handleConfirm() {
    router.push(`/documents/${document.id}`);
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <div className="hidden md:block">
          <PreviewPlaceholder />
        </div>

        <details className="rounded-lg border border-border md:hidden">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-foreground">
            View original document
          </summary>
          <div className="px-4 pb-4">
            <PreviewPlaceholder />
          </div>
        </details>

        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            handleConfirm();
          }}
        >
          {fields.map((field) => {
            const hint = SUPPORTIVE_HINT[field.status];
            return (
              <div key={field.key} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor={field.key}>{field.label}</Label>
                  <StatusBadge status={field.status} />
                </div>
                <Input
                  id={field.key}
                  value={field.value}
                  placeholder={
                    field.status === "unreadable"
                      ? "Enter the value"
                      : undefined
                  }
                  onChange={(event) =>
                    updateValue(field.key, event.target.value)
                  }
                  className={
                    field.status !== "confirmed"
                      ? "border-amber-300 focus-visible:ring-amber-300/50 aria-[invalid=true]:border-red-300"
                      : undefined
                  }
                  aria-invalid={field.status === "unreadable"}
                />
                {field.rawText ? (
                  <p className="text-xs text-muted-foreground">
                    Found on document: &ldquo;{field.rawText}&rdquo;
                  </p>
                ) : null}
                {hint ? (
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                    {hint}
                  </p>
                ) : null}
              </div>
            );
          })}

          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <Button type="submit" className="sm:flex-1">
              Confirm and create task
            </Button>
            <Button
              variant="outline"
              render={<Link href={`/documents/${document.id}`}>Cancel</Link>}
            />
          </div>
        </form>
      </div>
    </div>
  );
}

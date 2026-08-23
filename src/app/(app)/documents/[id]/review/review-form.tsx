"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ExtractedField, MockDocument } from "@/lib/mock-data";

/**
 * The review screen shows, it never asks.
 *
 * There are no inputs here on purpose. A value the model was not sure of never
 * reaches this screen (it arrives as an absent value), so there is nothing to
 * interrogate the person about, and nothing here is editable. The person's
 * whole job on this screen is recognition: does this match the letter? Yes is
 * a tap, and that is the only control. See src/lib/contract/api.ts.
 */

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
  fields,
}: {
  document: MockDocument;
  fields: ExtractedField[];
}) {
  const router = useRouter();

  // Rows without a confident value are not drawn: an empty row invites an
  // answer nobody is being asked for. The card-level message below speaks for
  // whatever is missing.
  const readable = fields.filter(
    (field) => field.status === "confirmed" && field.value,
  );
  const dateMissing = !readable.some((field) => field.key === "due_date");

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

        <div className="space-y-5">
          <dl className="space-y-4">
            {readable.map((field) => (
              <div key={field.key} className="space-y-0.5">
                <dt className="text-sm text-muted-foreground">{field.label}</dt>
                <dd className="text-base font-medium text-foreground">
                  {field.value}
                </dd>
              </div>
            ))}
          </dl>

          {dateMissing ? (
            <p className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
              This letter doesn&apos;t give a clear date. It will be saved, and
              nothing goes on your calendar. If the date is on the letter,
              photographing it again may pick it up.
            </p>
          ) : null}

          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <Button onClick={handleConfirm} className="sm:flex-1">
              Looks right, save it
            </Button>
            <Button
              variant="outline"
              render={<Link href="/documents/new">Take the photos again</Link>}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

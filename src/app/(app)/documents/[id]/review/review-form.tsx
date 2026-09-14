"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type {
  DocumentDetail,
  DocumentPageView,
  ExtractedFieldView,
} from "@/lib/contract/api";

/**
 * The review screen shows, it never asks.
 *
 * There are no inputs here on purpose. A value the model was not sure of never
 * reaches this screen (it arrives as an absent value), so there is nothing to
 * interrogate the person about, and nothing here is editable. The person's
 * whole job on this screen is recognition: does this match the letter? Yes is
 * a tap, and that is the only control. See src/lib/contract/api.ts.
 */

/**
 * The letter itself, page by page.
 *
 * Each photograph is loaded through `/api/documents/:id/pages/:n`, which checks
 * who is asking and then redirects to a link storage has signed, so the browser
 * follows the redirect and the signed link never sits in a payload long enough
 * to go stale.
 *
 * The photographs are lazy for two reasons that arrive together. This screen
 * draws them twice, once for each breakpoint, and only one of the two is ever
 * on screen, so eager images would pull every page of the letter down twice
 * over somebody's mobile data. And a letter may run to ten pages, of which the
 * person sees the first before scrolling. Deferring also means the signed link
 * is minted when the image is actually wanted, so it cannot expire while she is
 * still working her way down the page.
 */
function Photographs({ pages }: { pages: DocumentPageView[] }) {
  if (pages.length === 0) {
    return (
      <div className="flex aspect-[3/4] items-center justify-center rounded-lg border border-dashed border-border bg-muted/30">
        <p className="px-6 text-center text-sm text-muted-foreground">
          The photographs of this letter are not available.
        </p>
      </div>
    );
  }

  return (
    <ol className="space-y-3">
      {pages.map((page) =>
        page.url ? (
          <li key={page.id}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={page.url}
              alt={`Page ${page.pageNumber}`}
              loading="lazy"
              className="w-full max-w-full rounded-lg border border-border"
            />
          </li>
        ) : null,
      )}
    </ol>
  );
}

export function ReviewForm({
  document,
  fields,
}: {
  document: DocumentDetail;
  fields: ExtractedFieldView[];
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
    // Confirming is its own ticket, so for now this only takes the person back
    // to the letter. Nothing here writes.
    router.push(`/documents/${document.id}`);
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <div className="hidden md:block">
          <Photographs pages={document.pages} />
        </div>

        <details className="rounded-lg border border-border md:hidden">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-foreground">
            View original document
          </summary>
          <div className="px-4 pb-4">
            <Photographs pages={document.pages} />
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

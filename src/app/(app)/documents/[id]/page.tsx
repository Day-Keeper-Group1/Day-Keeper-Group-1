// KAN-57: one letter, rebuilt as the prototype's facts and photographs.

import Link from "next/link";
import { notFound } from "next/navigation";
import { FactRow } from "@/components/fact-row";
import { Panel, ScreenHeader } from "@/components/screen";
import { Button } from "@/components/ui/button";
import type { DocumentDetail, DocumentStatus } from "@/lib/contract/api";
import { NOT_APPLICABLE, NO_PAYMENT_REQUIRED } from "@/lib/contract/fields";
import { requireUser } from "@/server/auth/session";
import { getDocument } from "@/server/documents";

/**
 * Where this letter is up to, in a sentence rather than a badge.
 *
 * A badge asks a person to learn a vocabulary of five words and their colours.
 * The sentence says the same thing and also says what it means for her, which
 * is the only part she wanted. Colour is never the only signal here, and here
 * it is not a signal at all.
 */
function statusSentence(document: DocumentDetail): string {
  const sentences: Record<DocumentStatus, string> = {
    processing:
      "Still being read. You can close the app; we'll tell you when it's ready.",
    "needs-review": "Read, and waiting for your OK.",
    confirmed: "Saved. Its task is on your list.",
    // The one sentence src/lib/contract/api.ts words for every surface. It
    // leads by saying the fault was ours, because it was.
    failed: document.failure?.message ?? "Something went wrong on our side.",
    archived: "Kept.",
  };
  return sentences[document.status];
}

/**
 * One letter, opened from Your letters.
 *
 * A server component, so the reading is fetched by calling the same module the
 * endpoint calls rather than by going back out through HTTP to our own API.
 * The (app) layout has already required a session, so requireUser() here is
 * asking who it is rather than whether there is anybody.
 */
export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const document = await getDocument(id, user.id, user.timeZone);
  // A letter belonging to somebody else is absent, not forbidden: see
  // docs/api.md on why this is a 404 and never a 403.
  if (!document) notFound();

  /*
   * What the letter says, as it may be shown.
   *
   * A value the reader was not confident of never reaches a screen, so an
   * unreadable row is not drawn (src/lib/contract/api.ts). The other two are
   * confident facts that have nothing to tell her: an appointment letter that
   * prints no reference number reports NOT_APPLICABLE, and a form with nothing
   * to pay reports NO_PAYMENT_REQUIRED. Hiding those rows is not dropping the
   * data, and the spellings come from the contract so the comparison cannot
   * quietly stop matching (src/lib/contract/fields.ts).
   */
  const facts = document.fields.filter(
    (field) =>
      field.status === "confirmed" &&
      field.value &&
      field.value !== NO_PAYMENT_REQUIRED &&
      field.value !== NOT_APPLICABLE,
  );

  const photos = document.pages.filter((page) => page.url);
  const photoCount = photos.length;

  return (
    <div>
      <ScreenHeader
        title={document.label}
        subtitle={statusSentence(document)}
      />

      {/* The same sections at every width: what it says, then the letter
          itself. On a wide screen they sit side by side instead of stacking.
          The split waits for lg rather than md because the sidebar has already
          taken 240px by then, and two columns of a 768px window are narrower
          than the phone they were meant to improve on. */}
      <div className="grid gap-3.5 lg:grid-cols-2 lg:items-start lg:gap-6">
        <div className="flex flex-col gap-3.5">
          {document.status === "needs-review" ? (
            <Button
              size="block"
              nativeButton={false}
              render={
                <Link href={`/documents/${document.id}/review`}>Check it</Link>
              }
            />
          ) : null}

          {facts.length > 0 ? (
            <Panel title="What it says">
              {/* Wrapped so that the first row is a first child and loses its
                  rule: the card's own heading sits above this. */}
              <div>
                {facts.map((field) => (
                  <FactRow key={field.key} field={field} />
                ))}
              </div>
            </Panel>
          ) : null}
        </div>

        <Panel>
          {/* The prototype's `.cap2`. */}
          <p className="mb-[7px] text-label text-ink-dim">
            {photoCount === 1
              ? "1 photo · kept with this letter"
              : `${photoCount} photos · kept with this letter`}
          </p>
          {photoCount === 0 ? (
            <p className="text-row text-foreground">
              The photographs of this letter are not available.
            </p>
          ) : (
            <ol className="space-y-3">
              {photos.map((page) => (
                <li key={page.id}>
                  {/* A letter may run to ten pages, of which she sees the first
                      before scrolling, so the rest are fetched when they are
                      wanted. That also means storage signs each link at the
                      moment the image is asked for, rather than signing ten at
                      once and racing her scroll. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={page.url}
                    alt={`Page ${page.pageNumber}`}
                    loading="lazy"
                    className="w-full max-w-full rounded-lg border border-line"
                  />
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>
    </div>
  );
}

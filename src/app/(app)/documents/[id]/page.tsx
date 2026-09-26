// KAN-57: one letter, rebuilt as the prototype's facts and photographs.

import Link from "next/link";
import { notFound } from "next/navigation";
import { FactRow } from "@/components/fact-row";
import { LetterPages } from "@/components/letter-pages";
import { Panel, ScreenHeader } from "@/components/screen";
import { Button } from "@/components/ui/button";
import type { DocumentDetail, DocumentStatus } from "@/lib/contract/api";
import { factLines } from "@/lib/facts";
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
      "Still being read. You can close the app; it will be here when you come back.",
    "needs-review": "Read, and waiting for your OK.",
    confirmed: "Saved, and kept in your letters.",
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

  // What the letter says, as it may be shown, every number under its printed
  // label. The rule is shared with the review and the day sheet: src/lib/facts.ts.
  const facts = factLines(document.fields, document.identifiers);

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
                {facts.map((line) => (
                  <FactRow key={line.key} line={line} />
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
            <LetterPages
              documentId={document.id}
              count={document.pages.length}
              pages={photos.map((page) => ({
                id: page.id,
                pageNumber: page.pageNumber,
                url: page.url as string,
              }))}
            />
          )}
        </Panel>
      </div>
    </div>
  );
}

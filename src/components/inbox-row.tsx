"use client";

// KAN-57: one letter in the queue, drawn the same on Home and on the camera
// screen, as the prototype's itemRow is.

import Link from "next/link";

import { FAILURE_MESSAGE, type DocumentSummary } from "@/lib/contract/api";
import { cn } from "@/lib/utils";

/**
 * One letter in To check.
 *
 * A letter still being read cannot say who it is from, because nothing has
 * looked at it yet, so it says what it honestly knows: how many photographs it
 * holds. The name arrives with the reading, and the row is the same row
 * throughout, in the same place.
 *
 * "ready to check" is set in bark brown rather than a warning colour. It is not
 * an alarm: a letter has been read and is waiting for her nod, which is a pencil
 * note in the margin rather than a parking ticket (docs/theme.md).
 */
export function InboxRow({ doc }: { doc: DocumentSummary }) {
  const reading = doc.status === "processing";
  const ready = doc.status === "needs-review";

  const label = reading
    ? `${doc.pageCount} ${doc.pageCount === 1 ? "photo" : "photos"}`
    : doc.label;

  const caption = reading
    ? "reading…"
    : ready
      ? `ready to check${doc.pageCount > 1 ? ` · ${doc.pageCount} pages` : ""}`
      : (doc.failure?.message ?? FAILURE_MESSAGE);

  const body = (
    <>
      {/* The photograph itself, so the row is recognisably her letter before
          anything has been read off it. Lazy, because a long inbox is a long
          column of images she has not scrolled to yet, and because the signed
          link is then minted when the image is actually wanted. */}
      <span
        className={cn(
          "h-11 w-[34px] shrink-0 overflow-hidden rounded-md border border-line bg-primary-soft",
          reading && "animate-pulse",
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/documents/${doc.id}/pages/1`}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover"
          onError={(event) => {
            // A letter whose photograph is not in the bucket (the seed's, or
            // one whose object was lost) keeps the plain box behind it, the
            // prototype's blank thumbnail, rather than a broken-image glyph.
            event.currentTarget.style.visibility = "hidden";
          }}
        />
      </span>

      {/* The name and the way in are one wrapping line. "check →" may not
          shrink and the thumbnail may not either, so in a narrow card the name
          was the only thing left to squeeze and its glyphs ran over the word
          beside it. Given a basis it takes its own line instead. */}
      <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3">
        <span className="min-w-0 flex-[1_1_10rem]">
          <span
            className={cn(
              "block text-lg",
              reading ? "text-ink-dim" : "text-foreground",
            )}
          >
            {label}
          </span>
          <span
            className={cn(
              "block text-base",
              reading && "animate-pulse text-ink-dim",
              ready && "font-semibold text-warn",
              !reading && !ready && "text-danger",
            )}
          >
            {caption}
          </span>
        </span>

        {ready ? (
          <span className="ml-auto shrink-0 text-base font-bold text-primary">
            check <span aria-hidden="true">→</span>
          </span>
        ) : null}
      </span>
    </>
  );

  // The whole row is the link, because a small "check" word is not a target for
  // the hands this is built for.
  return ready ? (
    <Link
      href={`/documents/${doc.id}/review`}
      className="flex min-h-12 items-center gap-3 py-2"
    >
      {body}
    </Link>
  ) : (
    <div className="flex min-h-12 items-center gap-3 py-2">{body}</div>
  );
}

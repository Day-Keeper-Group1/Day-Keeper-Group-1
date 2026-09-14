"use client";

// KAN-59: the photographs of a letter, small in a row, and one at a time across the whole screen.

import { useCallback, useEffect, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";

/**
 * The address of one photograph. It checks who is asking and then redirects to
 * a link storage signed (docs/api.md, "A page image"), so it is safe to put in
 * an img tag and never goes stale in a cache.
 */
function pageUrl(documentId: string, page: number): string {
  return `/api/documents/${documentId}/pages/${page}`;
}

/**
 * The photographs kept with a letter, drawn wherever a letter or a task is
 * opened: the review, a task's sheet, a letter's sheet and the calendar's day
 * sheet. "We keep your photographs" is only a promise if she can see them.
 *
 * The prototype's `.strip`: a small dim caption, then 74 by 100 pages 10px
 * apart. Tapping one opens it across the whole screen.
 *
 * `whose` is the word the caption ends with, because a photograph opened from
 * a task is "kept with this task" and the same photograph opened from Your
 * letters is "kept with this letter".
 */
export function PhotoStrip({
  documentId,
  count,
  whose,
  className,
}: {
  documentId: string;
  count: number;
  whose: "letter" | "task";
  className?: string;
}) {
  /** The page being looked at, from 1, or null when the viewer is shut. */
  const [viewing, setViewing] = useState<number | null>(null);

  if (count < 1) return null;

  const pages = Array.from({ length: count }, (_, index) => index + 1);

  return (
    <div className={className}>
      <p className="mb-[7px] text-label text-ink-dim">
        {count === 1 ? "1 photo" : `${count} photos`} · kept with this {whose}
      </p>
      <ol className="flex flex-wrap gap-2.5">
        {pages.map((page) => (
          <li key={page}>
            <button
              type="button"
              onClick={() => setViewing(page)}
              aria-label={`Photo ${page} of ${count}`}
              className="block h-[100px] w-[74px] overflow-hidden rounded-[8px] border border-line bg-card"
            >
              {/* Lazy, because a ten page letter in a sheet she opened to tick
                  one box is ten images she never scrolled to, and storage then
                  signs each link when the image is actually wanted. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={pageUrl(documentId, page)}
                alt=""
                loading="lazy"
                className="size-full object-cover"
                onError={(event) => {
                  // No photograph behind this page: the plain card the
                  // prototype draws, not a broken-image glyph.
                  event.currentTarget.style.visibility = "hidden";
                }}
              />
            </button>
          </li>
        ))}
      </ol>

      <PhotoViewer
        documentId={documentId}
        count={count}
        page={viewing}
        onPage={setViewing}
      />
    </div>
  );
}

/**
 * One photograph at a time, as wide as the screen.
 *
 * The prototype's `.viewer`: a dark screen, "Photo 1 of 2" and Close along the
 * top, the page as wide as the phone, and a line under it saying how to turn
 * and how to read closer. The left and right thirds of the page turn it, which
 * is a bigger target than any arrow, and they are simply absent on the first
 * and the last page so a tap there does nothing rather than something
 * surprising. Pinching is the browser's own, which is why nothing here zooms.
 *
 * A dialog of its own, so it can open over a sheet that is itself a dialog:
 * Close and Escape shut the photograph and leave the sheet where it was.
 */
function PhotoViewer({
  documentId,
  count,
  page,
  onPage,
}: {
  documentId: string;
  count: number;
  page: number | null;
  onPage: (page: number | null) => void;
}) {
  const turn = useCallback(
    (step: number) => {
      if (page === null) return;
      const next = page + step;
      if (next >= 1 && next <= count) onPage(next);
    },
    [page, count, onPage],
  );

  // The arrow keys turn the page too, for anyone looking on a keyboard.
  useEffect(() => {
    if (page === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") turn(-1);
      if (event.key === "ArrowRight") turn(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [page, turn]);

  return (
    <Dialog.Root
      open={page !== null}
      onOpenChange={(open) => {
        if (!open) onPage(null);
      }}
    >
      <Dialog.Portal>
        <Dialog.Popup className="fixed inset-0 z-[60] flex flex-col bg-[rgba(12,12,16,0.94)] text-primary-foreground outline-none">
          {/* `.vbar`: the caption at 14.5px and a 48px outlined Close. */}
          <div className="flex shrink-0 items-center justify-between py-2.5 pr-2.5 pl-[18px]">
            <Dialog.Title className="text-sub font-semibold">
              Photo {page ?? 1} of {count}
            </Dialog.Title>
            <Dialog.Close className="min-h-12 min-w-12 rounded-full border-2 border-primary-foreground px-4 text-sub font-bold">
              Close
            </Dialog.Close>
          </div>

          <div className="relative flex min-h-0 flex-1 items-center justify-center">
            {page !== null ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={page}
                src={pageUrl(documentId, page)}
                alt={`Photo ${page} of ${count}`}
                className="size-full object-contain"
              />
            ) : null}
            {page !== null && page > 1 ? (
              <button
                type="button"
                onClick={() => turn(-1)}
                aria-label="Previous photo"
                className="absolute inset-y-0 left-0 w-1/3"
              />
            ) : null}
            {page !== null && page < count ? (
              <button
                type="button"
                onClick={() => turn(1)}
                aria-label="Next photo"
                className="absolute inset-y-0 right-0 w-1/3"
              />
            ) : null}
          </div>

          {/* `.vhint`: 12.5px, faded, under the page. */}
          <p className="shrink-0 px-[18px] pt-2.5 pb-3.5 text-center text-label opacity-70">
            {count > 1
              ? "Tap the sides to turn the page. Pinch to read closer."
              : "Pinch to read closer."}
          </p>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

"use client";

// KAN-59: the photographs of a letter, small in a row, and one at a time across the whole screen.

import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";

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
 * One photograph at a time, as large as the screen, and as close as she wants.
 *
 * The prototype's `.viewer`: a dark screen, "Photo 1 of 2" and Close along the
 * top, the page in the middle and a line under it saying what she can do.
 *
 * Reading closer is ours, not the browser's. Pinching the browser zooms the
 * whole screen, Close included, and a computer has no pinch at all, so the
 * page is zoomed inside its own frame by react-zoom-pan-pinch: pinch or the
 * wheel to zoom at that spot, drag to move, double-tap or double-click to go in
 * and back out, and three buttons for anyone who would rather press something.
 *
 * Pages turn with the round buttons at either side or the arrow keys. The
 * buttons go away while the page is zoomed, so a drag near the edge moves the
 * page instead of turning it, and a new page always opens whole.
 *
 * A dialog of its own, so it can open over a sheet that is itself a dialog:
 * Close and Escape shut the photograph and leave the sheet where it was.
 */
export function PhotoViewer({
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
  /** Whether the page is bigger than it opened at. */
  const [zoomed, setZoomed] = useState(false);

  // The frame's size, so the page can be drawn exactly as big as fits. An
  // image stretched over the whole frame would zoom its dark margins too, and
  // a drag could then carry the page out of sight.
  const [frame, setFrame] = useState<{ width: number; height: number } | null>(
    null,
  );
  // A callback ref, because the dialog mounts its content after this
  // component has rendered: the frame is measured when it actually appears.
  const observer = useRef<ResizeObserver | null>(null);
  const frameRef = useCallback((element: HTMLDivElement | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!element) return;
    observer.current = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setFrame({ width, height });
    });
    observer.current.observe(element);
  }, []);

  const turn = useCallback(
    (step: number) => {
      if (page === null) return;
      const next = page + step;
      if (next >= 1 && next <= count) {
        setZoomed(false);
        onPage(next);
      }
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

  const roundButton =
    "flex size-12 items-center justify-center rounded-full border-2 border-primary-foreground bg-[rgba(12,12,16,0.6)] text-xl font-bold leading-none disabled:opacity-40";

  return (
    <Dialog.Root
      open={page !== null}
      onOpenChange={(open) => {
        if (!open) {
          setZoomed(false);
          onPage(null);
        }
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

          <div
            ref={frameRef}
            className="relative min-h-0 flex-1 overflow-hidden"
          >
            {page !== null && frame ? (
              <TransformWrapper
                // A fresh frame per page, so every page opens whole.
                key={page}
                minScale={1}
                maxScale={8}
                centerOnInit
                // The library multiplies this by the wheel's travel: one notch of a
                // mouse (100) adds 0.3 to the scale.
                wheel={{ step: 0.003 }}
                doubleClick={{ mode: "toggle", step: 1.2 }}
                onTransform={(_, state) => setZoomed(state.scale > 1.01)}
              >
                {({ zoomIn, zoomOut, resetTransform }) => (
                  <>
                    <TransformComponent
                      wrapperStyle={{ width: "100%", height: "100%" }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={pageUrl(documentId, page)}
                        alt={`Photo ${page} of ${count}`}
                        draggable={false}
                        style={{
                          maxWidth: frame.width,
                          maxHeight: frame.height,
                        }}
                        className="block select-none"
                      />
                    </TransformComponent>

                    {!zoomed && page > 1 ? (
                      <button
                        type="button"
                        onClick={() => turn(-1)}
                        aria-label="Previous photo"
                        className={`${roundButton} absolute top-1/2 left-3 -translate-y-1/2`}
                      >
                        ‹
                      </button>
                    ) : null}
                    {!zoomed && page < count ? (
                      <button
                        type="button"
                        onClick={() => turn(1)}
                        aria-label="Next photo"
                        className={`${roundButton} absolute top-1/2 right-3 -translate-y-1/2`}
                      >
                        ›
                      </button>
                    ) : null}

                    <div className="absolute right-3 bottom-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => zoomOut(0.5)}
                        disabled={!zoomed}
                        aria-label="Zoom out"
                        className={roundButton}
                      >
                        −
                      </button>
                      <button
                        type="button"
                        onClick={() => resetTransform()}
                        disabled={!zoomed}
                        className={`${roundButton} w-auto px-4 text-sub`}
                      >
                        Fit
                      </button>
                      <button
                        type="button"
                        onClick={() => zoomIn(0.5)}
                        aria-label="Zoom in"
                        className={roundButton}
                      >
                        +
                      </button>
                    </div>
                  </>
                )}
              </TransformWrapper>
            ) : null}
          </div>

          {/* `.vhint`: 12.5px, faded, under the page. */}
          <p className="shrink-0 px-[18px] pt-2.5 pb-3.5 text-center text-label opacity-70">
            <span className="md:hidden">
              Pinch or double-tap to read closer. Drag to move.
            </span>
            <span className="hidden md:inline">
              Scroll or double-click to read closer. Drag to move.
            </span>
          </p>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

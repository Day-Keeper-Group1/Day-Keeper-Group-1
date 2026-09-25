"use client";

import { useState } from "react";

import { PhotoViewer } from "@/components/photo-strip";

/**
 * The photographs down the side of one letter, each opening the same viewer
 * the small strip opens, so a page can be read closer from here as well.
 */
export function LetterPages({
  documentId,
  count,
  pages,
}: {
  documentId: string;
  /** How many pages the letter has, for "Photo 2 of 3". */
  count: number;
  pages: { id: string; pageNumber: number; url: string }[];
}) {
  const [viewing, setViewing] = useState<number | null>(null);

  return (
    <>
      <ol className="space-y-3">
        {pages.map((page) => (
          <li key={page.id}>
            <button
              type="button"
              onClick={() => setViewing(page.pageNumber)}
              aria-label={`Open page ${page.pageNumber} to read closer`}
              className="block w-full cursor-zoom-in"
            >
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
    </>
  );
}

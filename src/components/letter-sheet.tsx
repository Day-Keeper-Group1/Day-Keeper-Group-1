"use client";

// KAN-59: a letter opened from Your letters: what the reading found, and the photographs it was read from.

import { useEffect, useState } from "react";

import { BottomSheet } from "@/components/bottom-sheet";
import { FactRow } from "@/components/fact-row";
import { PhotoStrip } from "@/components/photo-strip";
import type { DocumentDetail, DocumentSummary } from "@/lib/contract/api";
import { factLines } from "@/lib/facts";

/**
 * A letter, in the same sheet a task and a day open in. Null closes it.
 *
 * The list row already knows what the letter is called, so the sheet opens at
 * once with that on top, and the rows and photographs arrive with the one
 * request for the letter in full.
 */
export function LetterSheet({
  letter,
  onClose,
}: {
  letter: DocumentSummary | null;
  onClose: () => void;
}) {
  const [arrived, setArrived] = useState<DocumentDetail | null>(null);
  const id = letter?.id ?? null;

  useEffect(() => {
    if (!id) return;
    let live = true;
    void (async () => {
      try {
        const response = await fetch(`/api/documents/${id}`);
        if (!response.ok) return;
        const fetched = (await response.json()) as DocumentDetail;
        if (live) setArrived(fetched);
      } catch {
        // The sheet keeps its heading; the next opening asks again.
      }
    })();
    return () => {
      live = false;
    };
  }, [id]);

  // Only the answer for the letter that is open: another letter's rows never
  // show while this one's are on their way.
  const detail = arrived && arrived.id === id ? arrived : null;
  const facts = detail ? factLines(detail.fields, detail.identifiers) : [];

  return (
    <BottomSheet
      open={letter !== null}
      onClose={onClose}
      heading={letter?.label ?? ""}
    >
      {facts.length > 0 ? (
        <div>
          {facts.map((line) => (
            <FactRow key={line.key} line={line} />
          ))}
        </div>
      ) : null}
      {detail ? (
        <PhotoStrip
          documentId={detail.id}
          count={detail.pages.length}
          whose="letter"
          className="mt-3"
        />
      ) : null}
    </BottomSheet>
  );
}

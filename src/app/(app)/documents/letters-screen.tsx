"use client";

// KAN-57: Your letters, drawn as the prototype's month folders.
// KAN-59: the letters she has saved, each opening in the sheet.

import { useState } from "react";
import Link from "next/link";
import { Folder } from "lucide-react";
import { LetterSheet } from "@/components/letter-sheet";
import { PillButton, ScreenHeader } from "@/components/screen";
import type { DocumentSummary } from "@/lib/contract/api";
import { groupLetters, letterStatusLine } from "@/lib/letters";

/**
 * One letter, drawn as the prototype's `.item`: the photograph it starts with,
 * what the reading named it, when it is due, and a way in.
 *
 * The whole row is the button rather than the name alone. The people this is
 * for do not aim well at a word, and there is only one thing a row can do.
 */
function LetterRow({
  doc,
  onOpen,
}: {
  doc: DocumentSummary;
  onOpen: (doc: DocumentSummary) => void;
}) {
  const status = letterStatusLine(doc);

  return (
    <li className="border-t border-line first:border-t-0">
      {/* The prototype's `.item`: 11px apart, 11px above and below. */}
      <button
        type="button"
        onClick={() => onOpen(doc)}
        className="flex min-h-12 w-full items-center gap-[11px] px-0.5 py-[11px] text-left"
      >
        {/* The first page, at thumbnail size. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/documents/${doc.id}/pages/1`}
          alt=""
          loading="lazy"
          width={34}
          height={44}
          className="h-11 w-[34px] shrink-0 rounded-[5px] border border-line bg-primary-soft object-cover"
          onError={(event) => {
            // No photograph in the bucket for this row: show the blank box the
            // prototype draws, not the browser's broken-image glyph.
            event.currentTarget.style.color = "transparent";
          }}
        />

        {/* The name at 15px with its due date under it at 12.5px, and
            "open →" beside them at 13px, never shrinking. */}
        <span className="min-w-0 flex-1">
          <span className="block text-item text-foreground">{doc.label}</span>
          {status ? (
            // The prototype's `.item.ready .st`: bark brown, semibold.
            <span className="mt-0.5 block text-label font-semibold text-warn">
              {status}
            </span>
          ) : null}
        </span>

        <span className="shrink-0 text-key font-bold text-primary">
          open <span aria-hidden="true">→</span>
        </span>
      </button>
    </li>
  );
}

/**
 * Your letters.
 *
 * The door the product's promise is kept behind: photographing a letter says
 * the photographs are kept and she can always see them, and this is where she
 * sees them. Months as folders, each letter named by what the reading found,
 * and each one opening in the same sheet a task opens in.
 *
 * No search box and no status tabs. Everything she has saved is on this page,
 * filed, and a person who cannot find a letter among her own months is not
 * helped by being asked to spell its sender.
 *
 * Nothing here changes while she looks: every letter on it is already saved,
 * so there is nothing to poll for.
 */
export function LettersScreen({ letters }: { letters: DocumentSummary[] }) {
  const [open, setOpen] = useState<DocumentSummary | null>(null);
  const folders = groupLetters(letters);

  return (
    // The same one column at every width, given more room rather than more
    // columns: a list of letters that grows to 1280px is a spreadsheet.
    <div className="max-w-3xl">
      <ScreenHeader
        title="Your letters"
        subtitle="Every letter you've photographed, kept and named for you."
        action={
          <PillButton
            nativeButton={false}
            render={<Link href="/dashboard">← Home</Link>}
          />
        }
      />

      {folders.length === 0 ? (
        <p className="flex min-h-12 items-center px-0.5 text-row text-ink-dim">
          Nothing yet
        </p>
      ) : (
        folders.map((folder) => (
          <section key={folder.heading}>
            {/* The prototype's `.folder-h`: 13.5px, bold, spaced, uppercase. */}
            <h2 className="mx-0.5 mt-[18px] mb-1 flex items-center gap-1.5 text-caption font-bold tracking-[0.06em] text-ink-dim uppercase">
              <Folder className="size-4" strokeWidth={2} aria-hidden="true" />
              {folder.heading}
            </h2>
            <ul>
              {folder.letters.map((doc) => (
                <LetterRow key={doc.id} doc={doc} onOpen={setOpen} />
              ))}
            </ul>
          </section>
        ))
      )}

      <LetterSheet letter={open} onClose={() => setOpen(null)} />
    </div>
  );
}

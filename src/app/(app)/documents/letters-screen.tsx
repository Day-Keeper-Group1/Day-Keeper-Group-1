"use client";

// KAN-57: Your letters, drawn as the prototype's month folders.

import { useEffect, useState } from "react";
import Link from "next/link";
import { Folder } from "lucide-react";
import { PillButton, ScreenHeader } from "@/components/screen";
import type { DocumentSummary } from "@/lib/contract/api";
import { groupLetters, letterStatusLine } from "@/lib/letters";
import { cn } from "@/lib/utils";

/**
 * How often the list asks again while a letter is still being read.
 *
 * A reading takes about ten seconds (AGENTS.md), so five seconds is short
 * enough that a row stops saying "reading" while the person is still looking at
 * it. The polling stops the moment no row is processing, so an idle letters
 * area makes no requests at all.
 */
const POLL_INTERVAL_MS = 5000;

/**
 * One letter, drawn as the prototype's queue row: the photograph it starts
 * with, what the reading named it, where it is up to, and a way in.
 *
 * The whole row is the link rather than the name alone. The people this is for
 * do not aim well at a word, and there is only one thing a row can do.
 */
function LetterRow({ doc }: { doc: DocumentSummary }) {
  const reading = doc.status === "processing";
  const ready = doc.status === "needs-review";
  const failed = doc.status === "failed";
  const status = letterStatusLine(doc);

  return (
    <li className="border-t border-line first:border-t-0">
      <Link
        href={`/documents/${doc.id}`}
        className="flex min-h-14 items-center gap-3 rounded-lg px-1 py-3 hover:bg-card"
      >
        {/* The first page, at thumbnail size. A letter has its photographs from
            the moment it exists, so even a row that says "reading" can show
            what it is holding. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/documents/${doc.id}/pages/1`}
          alt=""
          loading="lazy"
          width={34}
          height={44}
          className={cn(
            "h-11 w-[34px] shrink-0 rounded-sm border border-line bg-primary-soft object-cover",
            reading && "animate-pulse",
          )}
          onError={(event) => {
            // No photograph in the bucket for this row: show the blank box the
            // prototype draws, not the browser's broken-image glyph.
            event.currentTarget.style.color = "transparent";
          }}
        />

        {/* The name and the way in are one wrapping line rather than two
            columns that cannot both give: "open →" may not shrink, so in a
            narrow window the name was the only thing left to squeeze. */}
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3">
          <span className="min-w-0 flex-[1_1_10rem]">
            <span className={cn("block", reading && "text-muted-foreground")}>
              {doc.label}
            </span>
            {status ? (
              <span
                className={cn(
                  "mt-0.5 block text-sm",
                  // "ready to check" is not an alarm. It means a letter has
                  // been read and is waiting for her nod, so it gets bark
                  // brown: a pencil note in the margin, not a parking ticket.
                  // A reading that turned the upload away is what --danger is
                  // reserved for (docs/theme.md), and Home says it in that
                  // same red, so one sentence cannot be two colours on two
                  // screens.
                  ready && "font-semibold text-warn",
                  failed && "text-danger",
                  !ready && !failed && "text-muted-foreground",
                  reading && "animate-pulse",
                )}
              >
                {status}
              </span>
            ) : null}
          </span>

          <span className="ml-auto shrink-0 font-semibold text-primary">
            open →
          </span>
        </span>
      </Link>
    </li>
  );
}

/**
 * Your letters.
 *
 * The door the product's promise is kept behind: photographing a letter says
 * the photographs are kept and she can always see them, and this is where she
 * sees them. Months as folders, each letter named by what the reading found.
 *
 * No search box and no status tabs. Everything she has is on this page, filed,
 * and a person who cannot find a letter among her own months is not helped by
 * being asked to spell its sender.
 *
 * The first list arrives already rendered from the server, so this component
 * does nothing at all unless something is still being read. That is also what
 * removed the old double request: an effect that both loaded and polled had to
 * be keyed on "is anything processing", which is necessarily false before the
 * first answer lands and true straight after it, so the effect tore itself down
 * and fetched a second time on exactly the case the poll was written for.
 */
export function LettersScreen({ initial }: { initial: DocumentSummary[] }) {
  const [letters, setLetters] = useState<DocumentSummary[]>(initial);

  const anyProcessing = letters.some(
    (letter) => letter.status === "processing",
  );

  useEffect(() => {
    if (!anyProcessing) return;

    let live = true;
    const timer = window.setInterval(() => {
      void (async () => {
        try {
          const response = await fetch("/api/documents", {
            cache: "no-store",
          });
          if (!response.ok) return;
          const next = (await response.json()) as DocumentSummary[];
          if (live) setLetters(next);
        } catch {
          // A dropped poll is not worth telling anyone about. The next one is
          // five seconds away and what is on screen is still true.
        }
      })();
    }, POLL_INTERVAL_MS);

    return () => {
      live = false;
      window.clearInterval(timer);
    };
  }, [anyProcessing]);

  const folders = groupLetters(letters);

  return (
    // The same one column at every width, given more room rather than more
    // columns: a list of letters that grows to 1280px is a spreadsheet.
    <div className="max-w-3xl space-y-2">
      <ScreenHeader
        title="Your letters"
        subtitle="Every letter you've photographed, kept and named for you."
        action={<PillButton render={<Link href="/dashboard">← Home</Link>} />}
      />

      {folders.length === 0 ? (
        <p className="flex min-h-14 items-center px-1 text-muted-foreground">
          Nothing yet
        </p>
      ) : (
        folders.map((folder) => (
          <section key={folder.heading}>
            <h2 className="mt-4 mb-1 flex items-center gap-2 px-1 text-sm font-bold tracking-wide text-muted-foreground uppercase">
              <Folder className="size-4" strokeWidth={2} aria-hidden="true" />
              {folder.heading}
            </h2>
            <ul>
              {folder.letters.map((doc) => (
                <LetterRow key={doc.id} doc={doc} />
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

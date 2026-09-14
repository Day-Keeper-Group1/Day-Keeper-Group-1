"use client";

// KAN-57: Check what we found, rebuilt as the prototype's two cards and one green button.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, CalendarDays, FileText, type LucideIcon } from "lucide-react";
import { FactRow } from "@/components/fact-row";
import { Panel, ScreenHeader } from "@/components/screen";
import { Button } from "@/components/ui/button";
import type { DocumentDetail } from "@/lib/contract/api";
import { factLines } from "@/lib/facts";
import type { PlanLine } from "@/lib/review-plan";
import { cn } from "@/lib/utils";

/**
 * The review screen shows, it never asks.
 *
 * There are no inputs here on purpose. A value the model was not sure of never
 * reaches this screen (it arrives as an absent value), so there is nothing to
 * interrogate the person about, and nothing here is editable. The person's
 * whole job on this screen is recognition: does this match the letter? Yes is
 * a tap, and that is the only control. See src/lib/contract/api.ts.
 */

/** The plan card's three kinds of line, as lucide draws them. */
const PLAN_ICONS: Record<PlanLine["icon"], LucideIcon> = {
  bell: Bell,
  calendar: CalendarDays,
  page: FileText,
};

/**
 * The sentence that closes the plan card.
 *
 * It is the whole reason the screen exists: everything above it is a proposal,
 * and nothing above it has happened. Said in bark brown on sandy yellow, which
 * is the product's "please look" and never its "you did something wrong".
 */
const PLAN_HOLD =
  "Nothing happens until you say so, and never from a date you haven't checked.";

/**
 * The width at which the fold below stops being a fold and becomes a column.
 *
 * 64rem, the same lg the grid below splits at, because the sidebar has taken
 * 240px by 768px and a photograph in half of what is left is smaller than the
 * phone's.
 */
const WIDE = "(min-width: 64rem)";

export function ReviewForm({
  document,
  plan,
}: {
  document: DocumentDetail;
  plan: PlanLine[];
}) {
  const router = useRouter();

  /*
   * The photographs are one list of images, mounted once.
   *
   * On a phone they live behind a fold, because the letter is in her hand and
   * the screen is small; on a wide screen there is room to show them beside the
   * facts and no reason to hide them. Drawing the fold and the column as two
   * blocks that take turns by media query would pull every page of the letter
   * down twice, so instead the same details element is opened by the media
   * query and loses its summary when it has nothing left to do.
   */
  const [wide, setWide] = useState(false);
  const [photosOpen, setPhotosOpen] = useState(false);

  useEffect(() => {
    const query = window.matchMedia(WIDE);
    const sync = () => {
      setWide(query.matches);
      if (query.matches) setPhotosOpen(true);
    };
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  /*
   * What the letter says, as it may be shown: no row for a date that could not
   * be read, since the plan card carries that news in one sentence instead, and
   * every number the letter printed under its own label. The rule is shared
   * with the letter and the day sheet, in src/lib/facts.ts.
   */
  const facts = factLines(document.fields, document.identifiers);

  const photos = document.pages.filter((page) => page.url);

  const subtitle =
    document.issuer && document.documentType
      ? `${document.issuer} · ${document.documentType}`
      : document.label;

  function handleConfirm() {
    // Confirming is its own ticket, so for now this only takes the person back
    // to the letter. Nothing here writes.
    router.push(`/documents/${document.id}`);
  }

  return (
    <div>
      <ScreenHeader title="Check what we found" subtitle={subtitle} />

      {/* The same sections at every width: what it says, what we will do, the
          two answers, and the letter itself. On a wide screen the letter moves
          to a column beside them rather than below. */}
      <div className="grid gap-3.5 lg:grid-cols-2 lg:items-start lg:gap-6">
        <div className="flex flex-col gap-3.5">
          {facts.length > 0 ? (
            <Panel title="What it says">
              {/* Wrapped so the first row is a first child and loses its rule:
                  the card's own heading sits above this. */}
              <div>
                {facts.map((line) => (
                  <FactRow key={line.key} line={line} />
                ))}
              </div>
            </Panel>
          ) : null}

          <Panel title="What DayKeeper will do">
            <div>
              {plan.map((line) => {
                const Icon = PLAN_ICONS[line.icon];
                return (
                  // The prototype's `.plan-row`: 15.5px, 11px apart.
                  <div
                    key={line.text}
                    className="flex items-center gap-[11px] border-t border-line px-0.5 py-[11px] text-plan first:border-t-0"
                  >
                    <Icon
                      className="size-[17px] shrink-0 text-primary"
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                    <span>{line.text}</span>
                  </div>
                );
              })}
            </div>
            <p className="mt-2.5 rounded-[10px] bg-warn-bg px-3 py-[11px] text-caption leading-[1.45] text-warn">
              {PLAN_HOLD}
            </p>
          </Panel>

          <div>
            <Button size="block" className="mt-1" onClick={handleConfirm}>
              Looks right, save it
            </Button>
            <Button
              variant="quiet"
              size="block-quiet"
              nativeButton={false}
              render={<Link href="/dashboard">Not now</Link>}
            />
          </div>
        </div>

        <details
          open={photosOpen}
          onToggle={(event) => setPhotosOpen(event.currentTarget.open)}
          className="rounded-[10px] border-2 border-line bg-card p-4 shadow-[var(--shadow-card)]"
        >
          <summary
            className={cn(
              "flex min-h-12 cursor-pointer items-center text-row font-semibold",
              wide && "hidden",
            )}
          >
            See the photographs
          </summary>

          {photos.length === 0 ? (
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
        </details>
      </div>
    </div>
  );
}

"use client";

// KAN-57: Check what we found, rebuilt as the prototype's two cards and one green button.
// KAN-59: the button saves, and moves on to the next letter waiting.

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, CalendarDays, FileText, type LucideIcon } from "lucide-react";
import { FactRow } from "@/components/fact-row";
import { useActivity } from "@/components/layout/activity";
import { PhotoStrip } from "@/components/photo-strip";
import { Panel } from "@/components/screen";
import { Button } from "@/components/ui/button";
import type {
  ApiError,
  ConfirmDocumentResponse,
  DocumentDetail,
  HomePayload,
} from "@/lib/contract/api";
import { nextHref, parseRun, runAfter, savedNote } from "@/lib/confirm-flow";
import { factLines } from "@/lib/facts";
import type { PlanLine } from "@/lib/review-plan";

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

const SAVE_FAILED =
  "We couldn't save that just now. Please try again in a moment.";

export function ReviewForm({
  document,
  plan,
  action,
  left,
  run,
}: {
  document: DocumentDetail;
  plan: PlanLine[];
  /** What the card says to do, word for word, for the note after saving. */
  action: string | null;
  /** "3 left to check", counted from the letters when the page was drawn. */
  left: string;
  /** Where this run of checks lands, as the address carried it. */
  run: string | null;
}) {
  const router = useRouter();
  const { flash } = useActivity();
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  /*
   * What the letter says, as it may be shown: no row for a date that could not
   * be read, since the plan card carries that news in one sentence instead, and
   * every number the letter printed under its own label. The rule is shared
   * with the letter and the day sheet, in src/lib/facts.ts.
   */
  const facts = factLines(document.fields, document.identifiers);

  /**
   * Save, say so, and go on.
   *
   * The next letter is asked for after the save rather than known in advance,
   * because a reading can land while she is looking at this one, and the one
   * that just landed belongs at the end of the queue she is working through.
   * If that question fails the letter is still saved, so she lands as if it
   * had been the last one rather than being told something went wrong.
   */
  async function handleConfirm() {
    if (saving) return;
    setSaving(true);
    setProblem(null);

    let saved: ConfirmDocumentResponse;
    try {
      const response = await fetch(`/api/documents/${document.id}/confirm`, {
        method: "POST",
      });
      if (!response.ok) {
        const body = (await response
          .json()
          .catch(() => null)) as ApiError | null;
        setProblem(body?.error?.message ?? SAVE_FAILED);
        setSaving(false);
        return;
      }
      saved = (await response.json()) as ConfirmDocumentResponse;
    } catch {
      setProblem(SAVE_FAILED);
      setSaving(false);
      return;
    }

    let next: string | null = null;
    try {
      const response = await fetch("/api/home", { cache: "no-store" });
      if (response.ok) {
        const home = (await response.json()) as HomePayload;
        next =
          home.inbox.find(
            (doc) => doc.status === "needs-review" && doc.id !== document.id,
          )?.id ?? null;
      }
    } catch {
      // Landing is the safe answer; see above.
    }

    // The note is said before the screen changes and outlives it: it belongs
    // to the app, not to this page (src/components/layout/activity.tsx).
    flash(savedNote(saved.task, action, document.label));
    router.push(nextHref(runAfter(parseRun(run), saved.task), next));
  }

  return (
    <div>
      {/* The prototype's review heading: the title, and under it who the letter
          is from beside how many are left to check, this one included. */}
      <div className="mb-[18px]">
        <h1 className="text-title font-bold tracking-[-0.2px] text-foreground">
          Check what we found
        </h1>
        <div className="mt-[3px] flex items-baseline justify-between gap-3">
          <p className="min-w-0 text-sub text-ink-dim">{document.label}</p>
          <span className="shrink-0 text-key font-bold text-ink-dim">
            {left}
          </span>
        </div>
      </div>

      {/* The same sections at every width: what it says with the photographs
          under it, then what we will do and the two answers. On a wide screen
          the second half moves beside the first rather than below. */}
      <div className="grid gap-3.5 lg:grid-cols-2 lg:items-start lg:gap-6">
        {/* The photographs sit under the facts, because checking is comparing:
            what we read against what the letter says. */}
        <Panel title="What it says">
          {/* Wrapped so the first row is a first child and loses its rule:
              the card's own heading sits above this. */}
          {facts.length > 0 ? (
            <div>
              {facts.map((line) => (
                <FactRow key={line.key} line={line} />
              ))}
            </div>
          ) : null}
          <PhotoStrip
            documentId={document.id}
            count={document.pages.length}
            whose="letter"
            className={facts.length > 0 ? "mt-3" : undefined}
          />
        </Panel>

        <div className="flex flex-col gap-3.5">
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
            {problem ? (
              <p
                role="status"
                className="mb-2 rounded-[10px] bg-warn-bg px-3 py-[11px] text-caption leading-[1.45] text-warn"
              >
                {problem}
              </p>
            ) : null}
            <Button
              size="block"
              className="mt-1"
              disabled={saving}
              onClick={() => void handleConfirm()}
            >
              {saving ? "Saving…" : "Looks right, save it"}
            </Button>
            <Button
              variant="quiet"
              size="block-quiet"
              nativeButton={false}
              render={<Link href="/dashboard">Not now</Link>}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

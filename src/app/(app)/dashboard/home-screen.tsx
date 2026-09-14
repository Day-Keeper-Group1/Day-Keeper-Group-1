"use client";

// KAN-57: Home, the prototype's HOME screen, on real data.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FolderOpen } from "lucide-react";

import { Panel, ScreenHeader } from "@/components/screen";
import { TaskRow } from "@/components/task-row";
import {
  FAILURE_MESSAGE,
  deriveTaskStatus,
  type DocumentSummary,
  type HomePayload,
  type SessionUser,
  type TaskSummary,
} from "@/lib/contract/api";
import { ctaFor, greeting, groupTasks } from "@/lib/home";
import { toggleTaskDone } from "@/lib/task-actions";
import { cn } from "@/lib/utils";

/**
 * How often to ask again while something of hers is still being read.
 *
 * Five seconds, and only while `counts.processing` is above zero: a reading
 * takes tens of seconds, so this is frequent enough that the row changes while
 * she is still looking at it, and it stops the moment there is nothing left to
 * wait for. docs/api.md, "Everything the home screen needs".
 */
const HOME_POLL_MS = 5000;

/**
 * The hour on her clock, not the server's.
 *
 * "Good morning" is a claim about where she is, so it is computed in her own
 * zone. Computing it from the zone rather than from the machine also keeps the
 * server's first render and the browser's hydration saying the same words.
 */
function hourInZone(timeZone: string, now: Date = new Date()): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      hourCycle: "h23",
    }).format(now),
  );
}

export function HomeScreen({
  initial,
  user,
  today,
}: {
  initial: HomePayload;
  user: SessionUser;
  today: string;
}) {
  const router = useRouter();
  const [payload, setPayload] = useState<HomePayload>(initial);
  const [tickError, setTickError] = useState<string | null>(null);

  const { counts, inbox, tasks } = payload;
  const processing = counts.processing;

  useEffect(() => {
    if (processing === 0) return;

    let live = true;
    const timer = window.setInterval(() => {
      void (async () => {
        try {
          const response = await fetch("/api/home", { cache: "no-store" });
          if (!response.ok) return;
          const next = (await response.json()) as HomePayload;
          // The whole payload at once, because the counts and the lists were
          // gathered in one query and are only true together.
          if (live) setPayload(next);
        } catch {
          // A dropped poll is not worth telling anyone about. The next one is
          // five seconds away and what is on screen is still true.
        }
      })();
    }, HOME_POLL_MS);

    return () => {
      live = false;
      window.clearInterval(timer);
    };
  }, [processing]);

  /**
   * The tick, shown first and sent second.
   *
   * She gets the tick immediately because that is what a tick is for, and the
   * server's answer replaces the guess when it lands. If the call fails, only
   * that one row goes back to what it was, so a poll that arrived in the
   * meantime is not thrown away with it.
   */
  async function handleToggle(task: TaskSummary) {
    const optimistic: TaskSummary = {
      ...task,
      status:
        task.status === "completed"
          ? deriveTaskStatus("open", task.dueDate, new Date(), user.timeZone)
          : "completed",
    };

    setTickError(null);
    setPayload((prev) => ({
      ...prev,
      tasks: prev.tasks.map((row) => (row.id === task.id ? optimistic : row)),
    }));

    try {
      const saved = await toggleTaskDone(task);
      setPayload((prev) => ({
        ...prev,
        tasks: prev.tasks.map((row) => (row.id === saved.id ? saved : row)),
      }));
    } catch (error) {
      setPayload((prev) => ({
        ...prev,
        tasks: prev.tasks.map((row) => (row.id === task.id ? task : row)),
      }));
      setTickError(
        error instanceof Error
          ? error.message
          : "Something went wrong at our end. Please try again in a moment.",
      );
    }
  }

  const cta = ctaFor(counts);
  /*
   * Green is reserved for the one state that is asking her for something.
   *
   * The prototype puts `.review-cta.dim` on everything that is not ready, so
   * both the waiting state and the empty state are quiet cards. `cta.inert`
   * only marks the empty one, which is about whether the panel has anything
   * behind it, not about what colour it is; asking the count directly keeps
   * "is she being asked for something" as one question with one answer.
   */
  const ctaAsksForSomething = counts.needsReview > 0;
  const firstToCheck = inbox.find((doc) => doc.status === "needs-review");
  const ctaHref = firstToCheck
    ? `/documents/${firstToCheck.id}/review`
    : "/documents/new";
  const groups = groupTasks(tasks, today);
  const firstName = user.displayName.trim().split(/\s+/)[0] || user.displayName;

  return (
    <div className="space-y-4">
      <ScreenHeader
        title={greeting(hourInZone(user.timeZone), firstName)}
        subtitle="Here's what needs you today."
      />

      {/* One column on a phone, the same sections side by side once there is
          honestly room for two. Nothing appears at one width and not the other.
          The split waits for lg: at md the sidebar has already taken 240px, so
          two columns of a 768px window are narrower than the phone they were
          meant to improve on, and the rows inside them wrapped to six lines. */}
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start lg:gap-6">
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => router.push(ctaHref)}
            className={cn(
              "flex min-h-16 w-full flex-col justify-center gap-1 rounded-xl border-2 p-4 text-left transition-colors",
              ctaAsksForSomething
                ? "border-transparent bg-primary text-primary-foreground shadow-sm hover:bg-button-hover"
                : "border-line bg-card text-ink-dim",
            )}
          >
            <span className="text-lg font-bold">{cta.big}</span>
            <span className="text-base">{cta.small}</span>
          </button>

          {inbox.length > 0 ? (
            <Panel title="To check">
              <ul>
                {inbox.map((doc) => (
                  // The rule between rows sits on the item rather than inside
                  // the row, so that "no rule above the first one" is a fact
                  // about the list and not something each row has to know.
                  <li
                    key={doc.id}
                    className="border-t border-line first:border-t-0"
                  >
                    <InboxRow doc={doc} />
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}
        </div>

        <Panel title="Your tasks">
          {tickError ? (
            <p role="status" className="mb-3 text-base text-danger">
              {tickError}
            </p>
          ) : null}

          {tasks.length === 0 ? (
            <div className="flex min-h-12 items-center text-lg text-ink-dim">
              Nothing yet
            </div>
          ) : (
            <div className="space-y-4">
              <TaskGroup
                heading="Today"
                tasks={groups.today}
                onToggle={handleToggle}
              />
              <TaskGroup
                heading="Next seven days"
                tasks={groups.week}
                onToggle={handleToggle}
              />
              <TaskGroup
                heading="Later"
                tasks={groups.later}
                onToggle={handleToggle}
              />
            </div>
          )}
        </Panel>
      </div>

      {/* The quiet door. She can ignore it for a year and lose nothing. */}
      <Link
        href="/documents"
        className="flex min-h-12 items-center gap-2 border-t border-line px-1 text-base text-ink-dim hover:text-foreground"
      >
        <FolderOpen className="size-5 shrink-0" strokeWidth={1.75} />
        All your letters <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}

/**
 * One of the three headings inside Your tasks.
 *
 * Gerry's Today and Next seven days survived the rebuild as sections of the one
 * list rather than as separate cards, so there is still one place a task lives.
 * An empty heading is not drawn: a section saying "nothing due" is a row about
 * an absence, and this screen has enough to say about things that exist.
 */
function TaskGroup({
  heading,
  tasks,
  onToggle,
}: {
  heading: string;
  tasks: TaskSummary[];
  onToggle: (task: TaskSummary) => void;
}) {
  if (tasks.length === 0) return null;

  return (
    <section>
      <h3 className="mb-1 text-base font-semibold text-ink-dim">{heading}</h3>
      <div>
        {tasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            onToggle={onToggle}
            href={task.documentId ? `/documents/${task.documentId}` : undefined}
          />
        ))}
      </div>
    </section>
  );
}

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
function InboxRow({ doc }: { doc: DocumentSummary }) {
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

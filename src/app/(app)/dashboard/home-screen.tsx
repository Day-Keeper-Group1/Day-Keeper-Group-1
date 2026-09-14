"use client";

// KAN-57: Home, the prototype's HOME screen, on real data.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FolderOpen } from "lucide-react";

import { Panel, ScreenHeader } from "@/components/screen";
import { InboxRow } from "@/components/inbox-row";
import { TaskRow } from "@/components/task-row";
import {
  deriveTaskStatus,
  type HomePayload,
  type SessionUser,
  type TaskSummary,
} from "@/lib/contract/api";
import { ctaFor, foldLater, greeting, groupTasks, moreLabel } from "@/lib/home";
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
  const later = foldLater(groups.later);
  const firstName = user.displayName.trim().split(/\s+/)[0] || user.displayName;

  return (
    <div>
      <ScreenHeader
        title={greeting(hourInZone(user.timeZone), firstName)}
        subtitle="Here's what needs you today."
      />

      {/* One column on a phone, the same sections side by side once there is
          honestly room for two. Nothing appears at one width and not the other.
          The split waits for lg: at md the sidebar has already taken 240px, so
          two columns of a 768px window are narrower than the phone they were
          meant to improve on, and the rows inside them wrapped to six lines. */}
      <div className="grid gap-3.5 lg:grid-cols-2 lg:items-start lg:gap-6">
        <div className="flex flex-col gap-3.5">
          {/* The prototype's `.review-cta`: 18px of padding, an 18px bold line
              and a 13.5px one under it, green when it asks for something and
              an inert card when it does not. */}
          <button
            type="button"
            onClick={() => router.push(ctaHref)}
            className={cn(
              "flex w-full flex-col rounded-[10px] border-2 p-[18px] text-left transition-colors",
              ctaAsksForSomething
                ? "border-transparent bg-primary text-primary-foreground shadow-[var(--shadow-card)] hover:bg-button-hover"
                : "border-line bg-card text-ink-dim",
            )}
          >
            <span className="mb-[3px] text-cta font-bold">{cta.big}</span>
            <span
              className={cn(
                "text-caption",
                ctaAsksForSomething ? "opacity-[0.92]" : "text-ink-dim",
              )}
            >
              {cta.small}
            </span>
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
            <p role="status" className="mb-3 text-caption text-danger">
              {tickError}
            </p>
          ) : null}

          {tasks.length === 0 ? (
            <div className="flex min-h-12 items-center text-row text-ink-dim">
              Nothing yet
            </div>
          ) : (
            <div className="space-y-3">
              <TaskGroup
                heading={
                  groups.today.some((task) => task.status === "overdue")
                    ? "Needs doing"
                    : "Today"
                }
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
                tasks={later.shown}
                more={later.more}
                onToggle={handleToggle}
              />
            </div>
          )}
        </Panel>
      </div>

      {/* The quiet door. She can ignore it for a year and lose nothing. The
          prototype's `.all-letters`: 18px above, a line, 15.5px dim words. */}
      <Link
        href="/documents"
        className="mx-0.5 mt-[18px] mb-1.5 flex min-h-12 items-center gap-2 border-t border-line px-1 py-3 text-plan text-ink-dim hover:text-foreground"
      >
        <FolderOpen className="size-[18px] shrink-0" strokeWidth={1.75} />
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
  more = 0,
  onToggle,
}: {
  heading: string;
  tasks: TaskSummary[];
  /** Tasks in this group that are not drawn here, counted on a calendar link. */
  more?: number;
  onToggle: (task: TaskSummary) => void;
}) {
  if (tasks.length === 0) return null;

  return (
    <section>
      <h3 className="text-caption font-bold text-ink-dim">{heading}</h3>
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
      {more > 0 ? (
        <Link
          href="/calendar"
          className="flex min-h-12 items-center gap-1.5 border-t border-line pl-10 text-caption font-bold text-primary hover:underline"
        >
          {moreLabel(more)} <span aria-hidden="true">→</span>
        </Link>
      ) : null}
    </section>
  );
}

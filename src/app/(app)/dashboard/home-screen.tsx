"use client";

// KAN-57: Home, the prototype's HOME screen, on real data.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, FolderOpen } from "lucide-react";

import { Panel, ScreenHeader } from "@/components/screen";
import { InboxRow } from "@/components/inbox-row";
import { useActivity } from "@/components/layout/activity";
import { TaskRow } from "@/components/task-row";
import { TaskSheet } from "@/components/task-sheet";
import {
  deriveTaskStatus,
  type DocumentSummary,
  type HomePayload,
  type SessionUser,
  type TaskSummary,
} from "@/lib/contract/api";
import {
  ctaFor,
  foldLater,
  greeting,
  moreLabel,
  reminderToday,
} from "@/lib/home";
import {
  DASHBOARD_SECTIONS_STORAGE_KEY,
  DASHBOARD_SECTIONS_UPDATED_EVENT,
  DEFAULT_DASHBOARD_SECTIONS,
  parseDashboardSections,
  type DashboardSection,
} from "@/lib/dashboard-sections";
import {
  DEFAULT_TASK_LIST_PREFERENCES,
  groupTaskList,
  parseTaskListPreferences,
  TASK_LIST_PREFERENCES_STORAGE_KEY,
  TASK_LIST_PREFERENCES_UPDATED_EVENT,
  type TaskListPreferences,
} from "@/lib/task-list-preferences";
import { toggleTaskDone } from "@/lib/task-actions";
import { cn } from "@/lib/utils";

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
  recentDocuments,
  user,
  today,
}: {
  initial: HomePayload;
  recentDocuments: DocumentSummary[];
  user: SessionUser;
  today: string;
}) {
  const router = useRouter();
  const [payload, setPayload] = useState<HomePayload>(initial);
  const [tickError, setTickError] = useState<string | null>(null);
  const [dashboardSections, setDashboardSections] = useState<
    DashboardSection[]
  >(DEFAULT_DASHBOARD_SECTIONS);
  const [sectionsError, setSectionsError] = useState<string | null>(null);
  const [taskListPreferences, setTaskListPreferences] =
    useState<TaskListPreferences>(DEFAULT_TASK_LIST_PREFERENCES);
  const [taskListPreferencesError, setTaskListPreferencesError] = useState<
    string | null
  >(null);
  /** The task open in the sheet, by id, so the sheet's tick follows the list. */
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  useEffect(() => {
    function refreshSections() {
      try {
        setDashboardSections(
          parseDashboardSections(
            window.localStorage.getItem(DASHBOARD_SECTIONS_STORAGE_KEY),
          ),
        );
        setSectionsError(null);
      } catch (error) {
        setSectionsError(
          error instanceof Error
            ? error.message
            : "Dashboard sections could not be read.",
        );
      }
    }

    function onStorage(event: StorageEvent) {
      if (event.key === DASHBOARD_SECTIONS_STORAGE_KEY || event.key === null) {
        refreshSections();
      }
    }

    refreshSections();
    window.addEventListener("storage", onStorage);
    window.addEventListener(DASHBOARD_SECTIONS_UPDATED_EVENT, refreshSections);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(
        DASHBOARD_SECTIONS_UPDATED_EVENT,
        refreshSections,
      );
    };
  }, []);

  useEffect(() => {
    function refreshTaskListPreferences() {
      try {
        setTaskListPreferences(
          parseTaskListPreferences(
            window.localStorage.getItem(TASK_LIST_PREFERENCES_STORAGE_KEY),
          ),
        );
        setTaskListPreferencesError(null);
      } catch (error) {
        setTaskListPreferencesError(
          error instanceof Error
            ? error.message
            : "Task list preferences could not be read.",
        );
      }
    }

    function onStorage(event: StorageEvent) {
      if (
        event.key === TASK_LIST_PREFERENCES_STORAGE_KEY ||
        event.key === null
      ) {
        refreshTaskListPreferences();
      }
    }

    refreshTaskListPreferences();
    window.addEventListener("storage", onStorage);
    window.addEventListener(
      TASK_LIST_PREFERENCES_UPDATED_EVENT,
      refreshTaskListPreferences,
    );
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(
        TASK_LIST_PREFERENCES_UPDATED_EVENT,
        refreshTaskListPreferences,
      );
    };
  }, []);

  // KAN-59: the app asks /api/home once for every screen, and again every five
  // seconds while anything is being read (src/components/layout/activity.tsx).
  // Each answer replaces the whole payload, because the counts and the lists
  // were gathered in one query and are only true together.
  const { home } = useActivity();
  const [taken, setTaken] = useState(home);
  if (home !== taken) {
    setTaken(home);
    if (home) setPayload(home);
  }

  const { counts, inbox, tasks } = payload;
  const openTask = tasks.find((task) => task.id === openTaskId) ?? null;

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
  const todayTasks = tasks.filter(
    (task) => task.status === "upcoming" && task.dueDate === today,
  );
  const overdueTasks = tasks.filter((task) => task.status === "overdue");
  const upcomingTasks = tasks.filter(
    (task) => task.status === "upcoming" && task.dueDate !== today,
  );
  const needsReviewDocuments = inbox.filter(
    (document) => document.status === "needs-review",
  );
  const allTaskGroups = groupTaskList(tasks, taskListPreferences);
  const sectionContent: Record<DashboardSection, React.ReactNode> = {
    today: (
      <DashboardTaskSection
        key="today"
        title="Today"
        emptyMessage="No tasks due today."
        tasks={todayTasks}
        today={today}
        onToggle={handleToggle}
        onOpen={setOpenTaskId}
      />
    ),
    overdue: (
      <DashboardTaskSection
        key="overdue"
        title="Overdue"
        emptyMessage="No overdue tasks."
        tasks={overdueTasks}
        today={today}
        onToggle={handleToggle}
        onOpen={setOpenTaskId}
      />
    ),
    upcoming: (
      <DashboardTaskSection
        key="upcoming"
        title="Upcoming"
        emptyMessage="No upcoming tasks."
        tasks={upcomingTasks}
        today={today}
        onToggle={handleToggle}
        onOpen={setOpenTaskId}
        fold
      />
    ),
    needsReview: (
      <DashboardPanel key="needsReview" title="Needs review">
        {needsReviewDocuments.length > 0 ? (
          <ul>
            {needsReviewDocuments.map((document) => (
              <li
                key={document.id}
                className="border-t border-line first:border-t-0"
              >
                <InboxRow doc={document} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="min-h-12 text-row text-ink-dim">
            No letters are waiting for your check.
          </p>
        )}
      </DashboardPanel>
    ),
    recentDocuments: (
      <DashboardPanel key="recentDocuments" title="Recent documents">
        {recentDocuments.length > 0 ? (
          <ul>
            {recentDocuments.map((document) => (
              <li
                key={document.id}
                className="border-t border-line first:border-t-0"
              >
                <Link
                  href={`/documents/${document.id}`}
                  className="flex min-h-12 items-center px-0.5 py-[11px] text-base font-medium text-foreground hover:underline"
                >
                  {document.label}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="min-h-12 text-row text-ink-dim">No recent documents.</p>
        )}
      </DashboardPanel>
    ),
    allTasks: (
      <DashboardPanel
        key="allTasks"
        title="All tasks"
        titleAction={
          <Link
            href="/tasks"
            aria-label="View all tasks"
            className="inline-flex min-h-11 items-center gap-1 rounded-sm px-2 text-caption font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            View all
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        }
      >
        {taskListPreferences.defaultFilter !== "all" ? (
          <p className="mb-1 text-caption text-muted-foreground">
            Showing {taskListPreferences.defaultFilter.replace("-", " ")} tasks
          </p>
        ) : null}
        {allTaskGroups.length > 0 ? (
          <div className="space-y-2">
            {allTaskGroups.map((group) => (
              <section key={group.key}>
                {taskListPreferences.groupBy !== "none" ? (
                  <h3 className="py-1 text-caption font-semibold text-ink-dim">
                    {group.label}
                  </h3>
                ) : null}
                <ul>
                  {group.tasks.map((task) => (
                    <li
                      key={task.id}
                      className="border-t border-line first:border-t-0"
                    >
                      <TaskRow
                        task={task}
                        onToggle={handleToggle}
                        onOpen={() => setOpenTaskId(task.id)}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        ) : (
          <p className="min-h-12 text-row text-ink-dim">
            No tasks match this view.
          </p>
        )}
        {taskListPreferencesError ? (
          <p role="alert" className="mt-2 text-caption text-danger">
            {taskListPreferencesError}
          </p>
        ) : null}
      </DashboardPanel>
    ),
  };
  const firstName = user.displayName.trim().split(/\s+/)[0] || user.displayName;

  return (
    <div>
      <ScreenHeader
        title={greeting(hourInZone(user.timeZone), firstName)}
        subtitle="Here's what needs you today."
      />

      <div className="space-y-3.5">
        {/* The prototype's `.review-cta`: green only when it asks for something. */}
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

        {sectionsError ? (
          <p role="alert" className="text-caption text-danger">
            {sectionsError}
          </p>
        ) : null}
        {tickError ? (
          <p role="status" className="text-caption text-danger">
            {tickError}
          </p>
        ) : null}
        {dashboardSections.length > 0 ? (
          <div className="grid gap-3.5 lg:grid-cols-2 lg:items-start lg:gap-6">
            {dashboardSections.map((section) => sectionContent[section])}
          </div>
        ) : (
          <p className="text-row text-ink-dim">
            No dashboard sections are selected. Change this in Customization.
          </p>
        )}
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

      {/* KAN-59: a task opens where it is, in the sheet, as in the prototype. */}
      <TaskSheet
        task={openTask}
        onClose={() => setOpenTaskId(null)}
        onToggle={handleToggle}
      />
    </div>
  );
}

function DashboardTaskSection({
  title,
  emptyMessage,
  tasks,
  today,
  onToggle,
  onOpen,
  fold = false,
}: {
  title: string;
  emptyMessage: string;
  tasks: TaskSummary[];
  /** 'YYYY-MM-DD' in her zone, for the reminder marks. */
  today: string;
  onToggle: (task: TaskSummary) => void;
  onOpen: (taskId: string) => void;
  /** A preview rather than a list to act on: the first few, then a count. */
  fold?: boolean;
}) {
  const { shown, more } = fold ? foldLater(tasks) : { shown: tasks, more: 0 };
  return (
    <DashboardPanel title={title}>
      {tasks.length > 0 ? (
        <>
          <ul>
            {shown.map((task) => (
              <li
                key={task.id}
                className="border-t border-line first:border-t-0"
              >
                <TaskRow
                  task={task}
                  reminder={reminderToday(task, today)}
                  onToggle={onToggle}
                  onOpen={() => onOpen(task.id)}
                />
              </li>
            ))}
          </ul>
          {more > 0 ? (
            <Link
              href="/calendar"
              className="flex min-h-12 items-center gap-1.5 border-t border-line pl-10 text-caption font-bold text-primary hover:underline"
            >
              {moreLabel(more)} <span aria-hidden="true">&rarr;</span>
            </Link>
          ) : null}
        </>
      ) : (
        <p className="min-h-12 text-row text-ink-dim">{emptyMessage}</p>
      )}
    </DashboardPanel>
  );
}

function DashboardPanel({
  title,
  titleAction,
  children,
}: {
  title: string;
  titleAction?: React.ReactNode;
  children: React.ReactNode;
}) {
  /* A panel is as tall as what is in it. A fixed height cut rows in half and
     put a scrollbar inside every card. A list too long for the page is folded
     at the source (foldLater in src/lib/home.ts): the first few, then a count
     she can follow, rather than content hidden behind a bar she has to find. */
  return (
    <Panel
      title={
        titleAction ? (
          <span className="flex items-center justify-between gap-2">
            <span>{title}</span>
            {titleAction}
          </span>
        ) : (
          title
        )
      }
      className="flex flex-col"
    >
      {children}
    </Panel>
  );
}

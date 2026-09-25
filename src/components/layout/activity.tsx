"use client";

// KAN-59: what is going on with her letters, known once for the whole app: the
// poll, the number on Home, the message when a reading lands, and the note
// after a save.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import { CircleCheck } from "lucide-react";

import type { HomePayload } from "@/lib/contract/api";
import { cn } from "@/lib/utils";

/**
 * How often to ask again while a letter of hers is still being read.
 *
 * Five seconds, and only while `counts.processing` is above zero: a reading
 * takes tens of seconds, so this is often enough that a row changes while she
 * is still looking at it, and it stops the moment there is nothing left to
 * wait for. docs/api.md, "Everything the home screen needs".
 */
const POLL_MS = 5000;

/** The prototype's timings: the message waits a moment, then stays a while. */
const READY_DELAY_MS = 1500;
const READY_SHOWN_MS = 4200;
/** How long the note after a save stays before it goes by itself. */
const NOTE_SHOWN_MS = 3200;

type Activity = {
  /** The latest /api/home, or null before the first answer. */
  home: HomePayload | null;
  /** Ask /api/home again now, for a screen that just changed something. */
  refresh: () => Promise<void>;
  /** Say what was just saved, in a note that goes by itself. */
  flash: (text: string) => void;
};

const ActivityContext = createContext<Activity>({
  home: null,
  refresh: async () => {},
  flash: () => {},
});

export function useActivity(): Activity {
  return useContext(ActivityContext);
}

/** One answer from /api/home, or null when there was none to be had. */
async function fetchHome(): Promise<HomePayload | null> {
  try {
    const response = await fetch("/api/home", { cache: "no-store" });
    if (!response.ok) return null;
    return (await response.json()) as HomePayload;
  } catch {
    // A dropped poll is not worth telling anyone about. The next one is
    // seconds away and what is on screen is still true.
    return null;
  }
}

/**
 * One poll for the whole app.
 *
 * Home, the camera screen and the bottom bar all want the same answer to "what
 * is being read, and what is waiting to be checked". Three polls would be
 * three chances to disagree on one screen, so the answer is asked for here,
 * once, and every screen reads it. It is asked for on arrival, again on every
 * change of screen (so the number on Home is right the moment she has saved
 * something), and every five seconds while anything is being read.
 *
 * It lives in the app's layout, which stays mounted while she moves between
 * screens. That is what lets a note said on the review screen still be on
 * screen when the calendar she lands on has drawn.
 */
export function ActivityProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [home, setHome] = useState<HomePayload | null>(null);
  const [ready, setReady] = useState<{ count: number; shown: boolean }>({
    count: 0,
    shown: false,
  });
  const [note, setNote] = useState<{ text: string; shown: boolean }>({
    text: "",
    shown: false,
  });

  /** The letters being read at the last answer, so a landing can be noticed. */
  const reading = useRef<Set<string> | null>(null);
  const readyTimers = useRef<number[]>([]);
  const noteTimer = useRef<number | null>(null);

  /** Take in one answer: the payload, and whether a reading landed. */
  const take = useCallback((payload: HomePayload) => {
    // A reading landed: a letter that was being read at the last look is now
    // waiting to be checked. The message is the prototype's, and it is what
    // makes the waiting a state rather than a loading screen: she can look
    // away while a letter is read, and this is what brings her back.
    const before = reading.current;
    const landed =
      before !== null &&
      payload.inbox.some(
        (doc) => doc.status === "needs-review" && before.has(doc.id),
      );
    reading.current = new Set(
      payload.inbox
        .filter((doc) => doc.status === "processing")
        .map((doc) => doc.id),
    );
    setHome(payload);

    if (landed) {
      readyTimers.current.forEach((timer) => window.clearTimeout(timer));
      readyTimers.current = [
        window.setTimeout(
          () => setReady({ count: payload.counts.needsReview, shown: true }),
          READY_DELAY_MS,
        ),
        window.setTimeout(
          () => setReady((prev) => ({ ...prev, shown: false })),
          READY_DELAY_MS + READY_SHOWN_MS,
        ),
      ];
    }
  }, []);

  const refresh = useCallback(async () => {
    const payload = await fetchHome();
    if (payload) take(payload);
  }, [take]);

  // On arrival and on every change of screen.
  useEffect(() => {
    let live = true;
    void fetchHome().then((payload) => {
      if (live && payload) take(payload);
    });
    return () => {
      live = false;
    };
  }, [pathname, take]);

  // Every five seconds while anything is being read, and not otherwise.
  const processing = home?.counts.processing ?? 0;
  useEffect(() => {
    if (processing === 0) return;
    const timer = window.setInterval(() => void refresh(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [processing, refresh]);

  useEffect(
    () => () => {
      readyTimers.current.forEach((timer) => window.clearTimeout(timer));
      if (noteTimer.current !== null) window.clearTimeout(noteTimer.current);
    },
    [],
  );

  const flash = useCallback((text: string) => {
    setNote({ text, shown: true });
    if (noteTimer.current !== null) window.clearTimeout(noteTimer.current);
    noteTimer.current = window.setTimeout(
      () => setNote((prev) => ({ ...prev, shown: false })),
      NOTE_SHOWN_MS,
    );
  }, []);

  return (
    <ActivityContext.Provider value={{ home, refresh, flash }}>
      {children}

      {/* The message when a reading lands. The prototype's `.toast`: the
          darkest ink, pale words, dropped in at the top of the screen, a small
          spaced label over a bold line and a quiet one. Nothing to press: it
          says a letter is ready and that nothing happens until she looks. */}
      <div
        role="status"
        aria-live="polite"
        className={cn(
          "pointer-events-none fixed inset-x-[14px] top-[14px] z-[45] rounded-[10px] bg-focus px-3.5 py-3 text-caption text-primary-foreground shadow-[0_8px_24px_rgba(0,0,0,0.3)] transition-all duration-300 md:left-auto md:w-96",
          ready.shown
            ? "visible translate-y-0 opacity-100"
            : "invisible -translate-y-3.5 opacity-0",
        )}
      >
        <span className="mb-[5px] block text-dow tracking-[0.6px] uppercase opacity-60">
          DayKeeper
        </span>
        <b className="mb-0.5 block text-sub">
          {ready.count > 1
            ? `${ready.count} letters are ready to check`
            : "Your letter is ready to check"}
        </b>
        <span>Nothing happens until you look at it.</span>
      </div>

      {/* The note after a save. The prototype's `.flash`: success green on its
          pale ground, a tick, sitting just above the bottom bar, and gone by
          itself after three seconds. It says what was kept and where, and it
          never asks for anything, so nothing about it is pressable. */}
      <div
        role="status"
        aria-live="polite"
        className={cn(
          "pointer-events-none fixed inset-x-[14px] bottom-24 z-[45] flex items-start gap-2 rounded-[10px] border-2 border-success bg-success-bg px-3 py-[11px] text-caption leading-[1.45] font-semibold text-success shadow-[0_8px_24px_rgba(28,26,21,0.18)] transition-all duration-300 md:bottom-6 md:left-auto md:w-[26rem]",
          note.shown
            ? "visible translate-y-0 opacity-100"
            : "invisible translate-y-3 opacity-0",
        )}
      >
        <CircleCheck
          className="mt-px size-[18px] shrink-0"
          strokeWidth={2}
          aria-hidden="true"
        />
        <span>{note.text}</span>
      </div>
    </ActivityContext.Provider>
  );
}

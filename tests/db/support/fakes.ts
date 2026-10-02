// KAN-92: stand-ins for the four things a database test must not really reach.

/**
 * The fakes.
 *
 * A database test runs the real functions and the real route handlers against
 * a real PostgreSQL. Four things around them are replaced, because they are
 * not the database and would make a test slow, paid for, or impossible: the
 * bucket, the model, the browser's cookies, and the host's promise to run work
 * after a response has gone.
 *
 * Each is a factory for `vi.mock`, declared at the top of the test file that
 * needs it. `vi.mock` is lifted above the file's imports, so the factory
 * fetches this module itself:
 *
 *   vi.mock("@/server/storage", async (importActual) =>
 *     (await import("./support/fakes")).memoryStorage(importActual),
 *   );
 *   vi.mock("@/server/extraction", async () =>
 *     (await import("./support/fakes")).scriptedReader(),
 *   );
 *   vi.mock("next/headers", async () =>
 *     (await import("./support/fakes")).cookieJar(),
 *   );
 *   vi.mock("next/server", async () =>
 *     (await import("./support/fakes")).afterQueue(),
 *   );
 *
 * The test then drives them through the other exports here: what is in the
 * bucket, what the reader will answer next, whose browser is asking, and when
 * the work left for afterwards runs. `resetFakes()` in a `beforeEach` gives
 * every test an empty bucket and an empty script.
 *
 * One more thing is moved rather than replaced, and needs no `vi.mock`: the
 * app's clock. `withTheAppClockIn2001()`, at the end of this file, is how a
 * test tells a moment the database stamped from one the app did.
 *
 * No tests in here.
 */

import { vi } from "vitest";

import type { ExtractionResult } from "@/lib/contract/extraction";
// Only the type, which costs nothing: the module itself is the one replaced.
import type { Reading } from "@/server/extraction";
// The real one, from the file that defines it: src/server/uploads/reading.ts
// asks `instanceof ExtractionFailure`, and a copy would never be an instance.
import { ExtractionFailure } from "@/server/extraction/provider";

/* The bucket ---------------------------------------------------------------- */

const bucket = new Map<string, { bytes: Buffer; contentType: string }>();

/** Every key in the bucket, sorted. */
export function storedKeys(): string[] {
  return [...bucket.keys()].sort();
}

/** What the real bucket answers for a key it does not hold. */
function noSuchKey(): Error {
  return Object.assign(new Error("The specified key does not exist."), {
    name: "NoSuchKey",
    $metadata: { httpStatusCode: 404 },
  });
}

/**
 * `@/server/storage` over a Map.
 *
 * The five functions that would reach the bucket are `vi.fn`s, so a test can
 * make one of them fail once (`vi.mocked(putObject).mockRejectedValueOnce`).
 * `uploadObjectKey` and the constants are the real ones. A signed link is an
 * absolute address, as the real one is, because the page route hands it to
 * `Response.redirect`, which refuses anything else.
 */
export async function memoryStorage(importActual: () => Promise<unknown>) {
  const actual = (await importActual()) as typeof import("@/server/storage");

  return {
    ...actual,
    putObject: vi.fn(
      async (key: string, body: Uint8Array, contentType: string) => {
        bucket.set(key, { bytes: Buffer.from(body), contentType });
      },
    ),
    // The whole object, or its first `length` bytes with the size of the whole,
    // which is what a ranged read of the real bucket answers.
    getObject: vi.fn(async (key: string, length?: number) => {
      const stored = bucket.get(key);
      if (!stored) throw noSuchKey();
      if (length !== undefined && stored.bytes.byteLength === 0) {
        throw Object.assign(
          new Error("The requested range is not satisfiable"),
          { name: "InvalidRange", $metadata: { httpStatusCode: 416 } },
        );
      }
      return {
        bytes:
          length === undefined
            ? stored.bytes
            : stored.bytes.subarray(0, length),
        contentType: stored.contentType,
        byteSize: stored.bytes.byteLength,
      };
    }),
    deleteObjects: vi.fn(async (keys: readonly string[]) => {
      for (const key of keys) bucket.delete(key);
    }),
    signedUploadUrl: vi.fn(
      async (key: string) => `https://storage.test/upload/${key}`,
    ),
    signedObjectUrl: vi.fn(
      async (key: string) => `https://storage.test/read/${key}`,
    ),
  };
}

/* The reader ---------------------------------------------------------------- */

/** What one call of the reader will come to: a reading, or the error it rejects with. */
type Scripted = ExtractionResult | Reading | Error;

const script: Scripted[] = [];

/**
 * Say what the next calls of `readLetter` answer, in the order they are made.
 *
 * A round calls the reader twice, at once, and then the judge when the two
 * differ, so one round takes two or three answers: first reader, second
 * reader, judge. A bare result is wrapped in the record of a call that cost
 * nothing; hand over `{ call, result }` to say what it cost. An Error is what
 * the call rejects with: `new ExtractionFailure(...)` for a reader that
 * failed, anything else for a bug.
 */
export function readerAnswers(...answers: Scripted[]): void {
  script.push(...answers);
}

/** How many scripted answers no call has asked for yet. */
export function answersLeft(): number {
  return script.length;
}

/** `@/server/extraction`, answering from the script instead of a model. */
export function scriptedReader() {
  return {
    ExtractionFailure,
    extractionProvider: () => ({ name: "scripted", model: "scripted-1" }),
    readLetter: vi.fn(
      async (
        _input: unknown,
        cell?: { model: string; effort: string },
      ): Promise<Reading> => {
        const next = script.shift();
        if (next === undefined) {
          throw new Error(
            "The scripted reader was asked for a reading no test queued. Call readerAnswers() first.",
          );
        }
        if (next instanceof Error) throw next;
        if ("call" in next) return next;

        // Stamped by the code that made the call, as the real readLetter does.
        const model = cell?.model ?? "scripted-1";
        return {
          call: {
            provider: "scripted",
            model,
            effort: cell?.effort ?? null,
            seconds: 0,
            usage: null,
          },
          result: { ...next, provider: "scripted", model },
        };
      },
    ),
  };
}

/* The browser's cookies ----------------------------------------------------- */

type Cookie = { value: string; options?: Record<string, unknown> };

/** One change a response made to the cookies of the browser it answered. */
export type CookieChange =
  | { set: string; value: string; options?: Record<string, unknown> }
  | { deleted: string };

const jars = new Map<string, Map<string, Cookie>>();
const changes: CookieChange[] = [];
let asking = "nobody";

function jar(): Map<string, Cookie> {
  let current = jars.get(asking);
  if (!current) {
    current = new Map();
    jars.set(asking, current);
  }
  return current;
}

/**
 * Whose browser the next requests come from. Each name has a cookie jar of its
 * own, empty the first time it is used, so switching names switches person.
 */
export function browserOf(name: string): void {
  asking = name;
}

/** What the browser now asking holds under a cookie name. */
export function cookieValue(name: string): string | undefined {
  return jar().get(name)?.value;
}

/** Put a cookie in the browser now asking, as if it had kept one from earlier. */
export function keepCookie(name: string, value: string): void {
  jar().set(name, { value });
}

/** Every change made to cookies since this was last called. */
export function takeCookieChanges(): CookieChange[] {
  return changes.splice(0, changes.length);
}

/** `next/headers`: `cookies()` over the jar of whoever is asking. */
export function cookieJar() {
  return {
    cookies: async () => ({
      get: (name: string) => {
        const cookie = jar().get(name);
        return cookie ? { name, value: cookie.value } : undefined;
      },
      set: (name: string, value: string, options?: Record<string, unknown>) => {
        jar().set(name, { value, options });
        changes.push({ set: name, value, options });
      },
      delete: (name: string) => {
        jar().delete(name);
        changes.push({ deleted: name });
      },
    }),
  };
}

/* Work left for after the response ------------------------------------------ */

const pending: Array<() => unknown> = [];

/**
 * `next/server`, of which the route handlers import only `after`. The real one
 * runs its callback once the response has gone; this one keeps it until the
 * test says so, which is what lets a test look at the letter in between.
 */
export function afterQueue() {
  return {
    after: (work: () => unknown) => {
      pending.push(work);
    },
  };
}

/** Run everything the answered requests left to be done, one after another. */
export async function runAfter(): Promise<void> {
  while (pending.length > 0) {
    await pending.shift()!();
  }
}

/* All four ------------------------------------------------------------------ */

/** An empty bucket, an empty script, no cookies, nothing left to run. */
export function resetFakes(): void {
  bucket.clear();
  script.length = 0;
  jars.clear();
  changes.length = 0;
  asking = "nobody";
  pending.length = 0;
}

/* The app's clock ----------------------------------------------------------- */

/**
 * Run one thing while the app's clock says the first moment of 2001, and put
 * the clock back when it has finished.
 *
 * The moments the app writes down are meant to be the database's: `now()` in
 * the statement, never `new Date()` bound to it, because every copy of the
 * deployed app has a clock of its own. On one machine the two clocks agree,
 * so a test cannot see which one stamped a row. With the app's clock a
 * quarter of a century behind it can: what the database stamped is still of
 * just now, and what the app stamped is in 2001. The database's clock is not
 * touched, and cannot be.
 *
 * Only `Date` is replaced, and it stands still. Timers run as they do, so the
 * pool still gives up waiting when it should. Build the fixtures first and
 * hand this the one call the test is about.
 */
export async function withTheAppClockIn2001<T>(
  run: () => Promise<T>,
): Promise<T> {
  vi.setSystemTime(new Date("2001-01-01T00:00:00.000Z"));
  try {
    return await run();
  } finally {
    vi.useRealTimers();
  }
}

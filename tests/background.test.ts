// KAN-98: where a letter's reading runs, locally and on Netlify.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const afterMock = vi.hoisted(() => vi.fn());
const readToTheEndMock = vi.hoisted(() => vi.fn());
const continueReadingsMock = vi.hoisted(() => vi.fn());

// `after` is replaced outright: the real one needs a Next.js request scope.
vi.mock("next/server", () => ({ after: afterMock }));
vi.mock("@/server/uploads", () => ({
  readToTheEnd: readToTheEndMock,
  continueReadings: continueReadingsMock,
}));

import { carryOnReadings, readInBackground } from "@/server/background";
import { READ_LETTER_PATH } from "@/server/background/ask";
import readLetterInTheBackground from "@/server/background/worker";

const ORIGIN = "https://pr-41--daykeeper-group1.netlify.app";
const request = () =>
  new Request(`${ORIGIN}/api/documents`, { method: "POST" });

/** Whatever was handed to `after`, so a test can run it on purpose. */
let scheduled: Array<() => unknown> = [];
let fetchMock: ReturnType<typeof vi.fn>;
let logged: string[] = [];

beforeEach(() => {
  scheduled = [];
  logged = [];
  afterMock.mockReset();
  afterMock.mockImplementation((callback: () => unknown) => {
    scheduled.push(callback);
  });
  readToTheEndMock.mockReset();
  readToTheEndMock.mockResolvedValue("done");
  continueReadingsMock.mockReset();
  fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation((line: unknown) => {
    logged.push(String(line));
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("locally, where nothing stops a request", () => {
  it("reads round one from what the route holds, then the rest, after the answer", async () => {
    const firstRound = vi.fn().mockResolvedValue(undefined);

    readInBackground(request(), "letter-1", "user-1", firstRound);

    // Scheduled, not run: the person is answered first.
    expect(firstRound).not.toHaveBeenCalled();
    expect(scheduled).toHaveLength(1);
    await scheduled[0]();

    expect(firstRound).toHaveBeenCalledOnce();
    expect(readToTheEndMock).toHaveBeenCalledWith("letter-1", "user-1");
    expect(firstRound.mock.invocationCallOrder[0]).toBeLessThan(
      readToTheEndMock.mock.invocationCallOrder[0],
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("carries readings on in the process that answered the poll", async () => {
    carryOnReadings(request(), "user-1");
    await scheduled[0]();

    expect(continueReadingsMock).toHaveBeenCalledWith("user-1");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("on Netlify, where a request lives thirty seconds", () => {
  beforeEach(() => {
    vi.stubEnv("SITE_ID", "a-site");
  });

  it("asks the background reader of the same deploy, after the answer, and reads nothing itself", async () => {
    const firstRound = vi.fn();

    readInBackground(request(), "letter-1", "user-1", firstRound);
    expect(fetchMock).not.toHaveBeenCalled();
    await scheduled[0]();

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${ORIGIN}${READ_LETTER_PATH}`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      documentId: "letter-1",
      userId: "user-1",
    });
    expect(firstRound).not.toHaveBeenCalled();
    expect(readToTheEndMock).not.toHaveBeenCalled();
    expect(logged).toEqual([]);
  });

  it("has the poll hand every queued letter to a background reader", async () => {
    carryOnReadings(request(), "user-1");
    await scheduled[0]();

    const [userId, carryOn] = continueReadingsMock.mock.calls[0];
    expect(userId).toBe("user-1");
    await carryOn("letter-2");
    expect(fetchMock.mock.calls[0][0]).toBe(`${ORIGIN}${READ_LETTER_PATH}`);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      documentId: "letter-2",
      userId: "user-1",
    });
  });

  it("logs, and leaves the letter for the next poll, when the reader cannot be asked", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }));
    readInBackground(request(), "letter-1", "user-1");
    await scheduled[0]();

    fetchMock.mockRejectedValueOnce(new Error("fetch failed"));
    readInBackground(request(), "letter-2", "user-1");
    await expect(scheduled[1]()).resolves.toBeUndefined();

    expect(logged).toEqual([
      "[background] the background reader answered 404 for document letter-1; the Home poll will ask again",
      "[background] could not reach the background reader for document letter-2; the Home poll will ask again",
    ]);
  });
});

describe("the background reader", () => {
  const ask = (body: unknown) =>
    new Request(`${ORIGIN}${READ_LETTER_PATH}`, {
      method: "POST",
      body: JSON.stringify(body),
    });

  it("reads the letter to the end, timed from when it started", async () => {
    const before = Date.now();
    await readLetterInTheBackground(
      ask({ documentId: "letter-1", userId: "user-1" }),
    );

    expect(readToTheEndMock).toHaveBeenCalledOnce();
    const [documentId, userId, options] = readToTheEndMock.mock.calls[0];
    expect([documentId, userId]).toEqual(["letter-1", "user-1"]);
    expect(options.startedAt).toBeGreaterThanOrEqual(before);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("hands what is left to a fresh reader when it is too old to start another round", async () => {
    readToTheEndMock.mockResolvedValueOnce("out-of-time");

    await readLetterInTheBackground(
      ask({ documentId: "letter-1", userId: "user-1" }),
    );

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toBe(`${ORIGIN}${READ_LETTER_PATH}`);
  });

  it("reads nothing when it is not told which letter and whose", async () => {
    await readLetterInTheBackground(ask({ documentId: "letter-1" }));
    await readLetterInTheBackground(
      new Request(`${ORIGIN}${READ_LETTER_PATH}`, {
        method: "POST",
        body: "not json",
      }),
    );

    expect(readToTheEndMock).not.toHaveBeenCalled();
    expect(logged).toEqual([
      "[background] asked to read without a letter and its owner",
      "[background] asked to read without a letter and its owner",
    ]);
  });

  it("never throws, because Netlify would start it again", async () => {
    readToTheEndMock.mockRejectedValueOnce(new Error("connection terminated"));

    await expect(
      readLetterInTheBackground(
        ask({ documentId: "letter-1", userId: "user-1" }),
      ),
    ).resolves.toBeUndefined();
    expect(logged).toEqual(["[background] the background reader stopped"]);
  });
});

// KAN-92: every endpoint, answered by the real handlers over a real database, held against a recording.

/**
 * How the API answers, written down before the database layer changed.
 *
 * One person signs up, sends five letters, checks them, saves them and ticks a
 * task; a second person tries to reach the first one's things; the first signs
 * out. Every request goes through the real route handler, the real service and
 * a real PostgreSQL. Only the bucket, the model, the cookies and `after()` are
 * stand-ins (./support/fakes.ts). Each answer is recorded as its status and its
 * body, and the whole recording is compared with the one committed beside this
 * file.
 *
 * The recording was taken while every statement was still hand-written SQL.
 * KAN-92 moved those statements to Drizzle without changing what any endpoint
 * answers, and this is the test that holds the code to it: **a change under
 * tests/db/__snapshots__/ is a change in behaviour.** Do not update the
 * snapshot to make this pass; find what changed. When an answer is changed on
 * purpose, update the snapshot in the same commit as the change, and say so in
 * the commit message:
 *
 *   npm run test:db -- tests/db/http-characterisation.test.ts -u
 *
 * A body is recorded as the text of its JSON rather than as an object, because
 * a snapshot of an object sorts its keys and the order the keys were sent in is
 * part of what must not change. What differs from run to run is replaced first:
 * each id by `<id-N>` in the order ids first appear, each instant by
 * `<instant>`, the moment in a "Photographed ..." label by `<when>`, and the
 * session token by nothing at all, leaving the cookie's flags. A signed link
 * keeps its path with the ids in it numbered like any other, so the recording
 * says whose photograph, of which letter and which page, the link is for. The
 * letters are due in 2099, so no reminder is ever in the past and no task is
 * ever overdue.
 *
 * The story is told out of order on purpose. Rows come back from a table in
 * the order they went in until something says otherwise, so a story told in
 * the order the screens show things would be answered correctly by a statement
 * that had lost its ORDER BY. Wherever the story can choose, it writes things
 * in another order than the one they are shown in: the fields and the numbers
 * of the first letter (see BILL), the fourth letter read after the fifth, and
 * the tasks made with the later date first and the one with no date in the
 * middle. Three orders it cannot choose, because the app itself writes those
 * rows in the order they are shown in: a letter's pages, its numbers as the
 * reader listed them, and a task's reminders. A statement that stopped
 * ordering those would still pass here, and has to be caught by a test that
 * writes its rows directly.
 *
 * The five letters arrive both ways a letter can: four as the capture screen
 * sends them (ask for upload links, put the photographs in the bucket, say
 * they have landed), one as a multipart form, which is how curl and Swagger
 * send one.
 *
 * It is one test because it is one story: the tables are emptied before every
 * test, and each step needs what the steps before it left behind.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/storage", async (importActual) =>
  (await import("./support/fakes")).memoryStorage(importActual),
);
vi.mock("@/server/extraction", async () =>
  (await import("./support/fakes")).scriptedReader(),
);
vi.mock("next/headers", async () =>
  (await import("./support/fakes")).cookieJar(),
);
vi.mock("next/server", async () =>
  (await import("./support/fakes")).afterQueue(),
);

import { POST as login } from "@/app/api/auth/login/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import { GET as me } from "@/app/api/auth/me/route";
import { POST as register } from "@/app/api/auth/register/route";
import { POST as confirm } from "@/app/api/documents/[id]/confirm/route";
import { GET as onePage } from "@/app/api/documents/[id]/pages/[page]/route";
import { GET as oneLetter } from "@/app/api/documents/[id]/route";
import {
  GET as listLetters,
  POST as sendLetter,
} from "@/app/api/documents/route";
import { POST as askToUpload } from "@/app/api/documents/uploads/route";
import { GET as home } from "@/app/api/home/route";
import {
  DELETE as reopen,
  POST as complete,
} from "@/app/api/tasks/[id]/complete/route";
import { GET as oneTask } from "@/app/api/tasks/[id]/route";
import { GET as listTasks } from "@/app/api/tasks/route";
import { SESSION_COOKIE_NAME } from "@/server/auth/session";
import { ExtractionFailure } from "@/server/extraction";
import { putObject, uploadObjectKey } from "@/server/storage";

import {
  answersLeft,
  browserOf,
  cookieValue,
  keepCookie,
  readerAnswers,
  resetFakes,
  runAfter,
  takeCookieChanges,
} from "./support/fakes";
import { aReading } from "./support/world";

/* What is recorded ---------------------------------------------------------- */

type Step = {
  step: string;
  status: number;
  /** The JSON text of the answer, normalised. Empty for an answer with no body. */
  body: string;
  /** Where a redirect points. */
  location?: string;
  /** Every change the answer made to the browser's cookies, in the order it made them: flags, never a value. */
  cookies?: string[];
};

const steps: Step[] = [];

/** `<id-N>` for each id, numbered in the order they first appear in an answer. */
const seen = new Map<string, string>();

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const PHOTOGRAPHED = /^Photographed .+ at .+?(, \d+ pages?)$/;

function normaliseText(text: string): string {
  if (INSTANT.test(text)) return "<instant>";
  return text
    .replace(PHOTOGRAPHED, "Photographed <when>$1")
    .replace(UUID, (id) => {
      const key = id.toLowerCase();
      if (!seen.has(key)) seen.set(key, `<id-${seen.size + 1}>`);
      return seen.get(key)!;
    });
}

/** In place, so every object keeps its keys in the order the route sent them. */
function normalise(value: unknown): unknown {
  if (typeof value === "string") return normaliseText(value);
  if (value instanceof Date) return "<instant>";
  if (Array.isArray(value)) {
    value.forEach((item, index) => (value[index] = normalise(item)));
  } else if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of Object.keys(record)) record[key] = normalise(record[key]);
  }
  return value;
}

/**
 * Write one answer down, and hand its body back as it really was, ids and all,
 * for the steps that follow.
 */
async function record<T = unknown>(
  step: string,
  answer: Promise<Response>,
): Promise<T> {
  const response = await answer;
  const text = await response.text();
  const location = response.headers.get("location");
  const cookies = takeCookieChanges().map((change) =>
    "set" in change
      ? JSON.stringify(normalise({ set: change.set, ...change.options }))
      : JSON.stringify(change),
  );

  steps.push({
    step,
    status: response.status,
    body: text === "" ? "" : JSON.stringify(normalise(JSON.parse(text))),
    ...(location !== null && { location: normaliseText(location) }),
    ...(cookies.length > 0 && { cookies }),
  });

  return (text === "" ? null : JSON.parse(text)) as T;
}

/* How a request is made ----------------------------------------------------- */

const ORIGIN = "http://daykeeper.test";

function get(path: string): Request {
  return new Request(`${ORIGIN}${path}`);
}

/** A request carrying JSON, or nothing: confirming and ticking send no body. */
function send(method: "POST" | "DELETE", path: string, body?: unknown) {
  const headers: Record<string, string> = {
    "user-agent": "characterisation test",
  };
  if (body !== undefined) headers["content-type"] = "application/json";
  return new Request(`${ORIGIN}${path}`, {
    method,
    headers,
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });
}

/** The second argument Next hands a handler under a path with brackets in it. */
function at<P extends Record<string, string>>(params: P) {
  return { params: Promise.resolve(params) };
}

/* What the letters are ------------------------------------------------------ */

/**
 * Enough of a PNG to be taken for one: the eight bytes every PNG opens with,
 * which is all the server looks at before the reader does.
 */
const PHOTOGRAPH = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from("a photograph of a letter"),
]);

/**
 * A bill: something to pay, by a day and a time, with numbers printed on it.
 *
 * The reader answers none of it in an order a screen shows it in, so that
 * every order in the recording is one a statement or a mapper made:
 *
 *   - the fields are in neither the contract's order (the letter screen), nor
 *     the task screen's, nor the alphabet's;
 *   - the two fields the contract has never heard of (six is a floor) come
 *     with the one that sorts first, `bpay_biller_code`, answered second;
 *   - the numbers are not in the order of their labels, nor of their values,
 *     the one the reader hedged is first, and the one the reference names is
 *     last, where the screens show it first.
 */
const BILL = aReading(
  {
    reference: "4417 2290 113",
    due_time: "10:30",
    amount: "$347.60",
    document_type: "Utility bill",
    action_required: "Pay Example Energy",
    issuer: "Example Energy",
    supply_period: "1 Dec 2098 to 28 Feb 2099",
    due_date: "2099-03-15",
    bpay_biller_code: "23796",
  },
  [
    { label: "Meter number", value: "MTR 88 201", status: "uncertain" },
    { label: "Invoice number", value: "INV-2099-0215" },
    { label: "Customer number", value: "CN 5512 08" },
    { label: "Account number", value: "4417 2290 113" },
  ],
);

/** A notice that asks for nothing. */
const NOTICE = aReading({
  document_type: "Information notice",
  issuer: "Calderfield Council",
  action_required: "No action",
  due_date: "Not applicable",
  amount: "No payment required",
  reference: "Not applicable",
});

/** What the fourth letter is finally read as: no date, and a reference the reader hedged. */
const REFERRAL = aReading(
  {
    document_type: "Government letter",
    issuer: "My Aged Care",
    action_required: "Contact a Support at Home provider",
    due_date: "Not applicable",
    amount: "No payment required",
    reference: { value: "AC 7731 0092", status: "uncertain" },
  },
  [
    { label: "Aged care ID", value: "AC 7731 0092", status: "uncertain" },
    { label: "Letter reference", value: "L-2099-0412" },
  ],
);

/** The same letter read three ways, so its first round decides nothing. */
const referralAsking = (action: string) =>
  aReading({
    document_type: "Government letter",
    issuer: "My Aged Care",
    action_required: action,
    due_date: "Not applicable",
    amount: "No payment required",
    reference: "Not applicable",
  });

/**
 * A form to send back, by a day earlier than the bill's. It is saved after the
 * bill and after the letter with no date, so the task list has to put its
 * task first: by its date, against the order the three tasks were made in.
 */
const FORM = aReading({
  document_type: "Concession form",
  issuer: "Harbour Water",
  action_required: "Return form to Harbour Water",
  due_date: "2099-02-03",
  amount: "No payment required",
  reference: "Not applicable",
});

const NOBODYS = "00000000-0000-4000-8000-000000000000";
const MALFORMED = "not-a-uuid";

type Account = { id: string };
type Letter = { id: string };
type Slots = { documentId: string };
type Confirmed = { task: { id: string } | null };

describe("the API, as it answered before the database layer moved", () => {
  /** What reached console.error, so that only what is expected can. */
  let logged: string[];

  beforeEach(() => {
    resetFakes();
    steps.length = 0;
    seen.clear();
    logged = [];
    vi.spyOn(console, "error").mockImplementation((first: unknown) => {
      // Ids taken out, not numbered: a log line is not part of the recording.
      logged.push(String(first).replace(UUID, "<id>"));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Send one letter the way the capture screen does, and hand back its id. The
   * photograph is put in the bucket by this test, where a browser would have
   * used the signed link, which points at a host that does not exist.
   */
  async function sendAsTheCaptureScreenDoes(
    name: string,
    owner: Account,
  ): Promise<string> {
    const pages = [
      { contentType: "image/png", byteSize: PHOTOGRAPH.byteLength },
    ];
    const slots = await record<Slots>(
      `${name}: ask to upload`,
      askToUpload(send("POST", "/api/documents/uploads", { pages })),
    );
    await putObject(
      uploadObjectKey({
        userId: owner.id,
        documentId: slots.documentId,
        pageNumber: 1,
        contentType: "image/png",
      }),
      PHOTOGRAPH,
      "image/png",
    );
    const letter = await record<Letter>(
      `${name}: say the photograph has landed`,
      sendLetter(
        send("POST", "/api/documents", {
          documentId: slots.documentId,
          pages: [{ contentType: "image/png" }],
        }),
      ),
    );
    return letter.id;
  }

  it("answers every step the way the recording says", async () => {
    /* Nobody is signed in. */
    browserOf("Margaret");
    await record("nobody signed in: who am I", me(get("/api/auth/me")));
    await record("nobody signed in: home", home(get("/api/home")));
    await record(
      "nobody signed in: letters",
      listLetters(get("/api/documents")),
    );
    await record("nobody signed in: tasks", listTasks(get("/api/tasks")));

    /* An account. */
    await record(
      "register with nothing usable",
      register(
        send("POST", "/api/auth/register", {
          email: "not an address",
          password: "short",
          displayName: "  ",
        }),
      ),
    );
    const margaret = await record<Account>(
      "register",
      register(
        send("POST", "/api/auth/register", {
          email: " Margaret.W@Example.COM ",
          password: "a long simple phrase",
          displayName: "Margaret Whitfield",
        }),
      ),
    );
    await record(
      "register the same address in another case",
      register(
        send("POST", "/api/auth/register", {
          email: "margaret.w@example.com",
          password: "another long phrase",
          displayName: "Somebody Else",
        }),
      ),
    );
    await record(
      "sign in with the wrong password",
      login(
        send("POST", "/api/auth/login", {
          email: "margaret.w@example.com",
          password: "not her password",
        }),
      ),
    );
    await record(
      "sign in with an address nobody registered",
      login(
        send("POST", "/api/auth/login", {
          email: "nobody@example.com",
          password: "a long simple phrase",
        }),
      ),
    );
    await record(
      "sign in with mixed case and spaces",
      login(
        send("POST", "/api/auth/login", {
          email: "  MARGARET.W@example.com ",
          password: "a long simple phrase",
        }),
      ),
    );
    await record("who am I", me(get("/api/auth/me")));

    /* Letter one: sent, sent again by a second tap, looked at, and then read. */
    const bill = await sendAsTheCaptureScreenDoes("letter one", margaret);
    await record(
      "letter one: say the photograph has landed, a second time",
      sendLetter(
        send("POST", "/api/documents", {
          documentId: bill,
          pages: [{ contentType: "image/png" }],
        }),
      ),
    );
    await record(
      "letter one, in full, while it is being read",
      oneLetter(get(`/api/documents/${bill}`), at({ id: bill })),
    );
    readerAnswers(BILL, BILL);
    await runAfter();

    /* Letter two: two pages, sent as a form, and it asks for nothing. */
    const form = new FormData();
    form.append(
      "pages",
      new File([PHOTOGRAPH], "1.png", { type: "image/png" }),
    );
    form.append(
      "pages",
      new File([PHOTOGRAPH], "2.png", { type: "image/png" }),
    );
    const notice = (
      await record<Letter>(
        "letter two: send two photographs as a form",
        sendLetter(
          new Request(`${ORIGIN}/api/documents`, {
            method: "POST",
            body: form,
          }),
        ),
      )
    ).id;
    readerAnswers(NOTICE, NOTICE);
    await runAfter();

    /* Letter three: the reader fails, in a way trying again would not mend. */
    const unread = await sendAsTheCaptureScreenDoes("letter three", margaret);
    readerAnswers(
      new ExtractionFailure("the reader has no key", { retryable: false }),
      new ExtractionFailure("the reader has no key", { retryable: false }),
    );
    await runAfter();

    /* Letter four: two readings differ and the third matches neither. */
    const referral = await sendAsTheCaptureScreenDoes("letter four", margaret);
    readerAnswers(
      referralAsking("Contact a Support at Home provider"),
      referralAsking("Attend an assessment"),
      referralAsking("Return form to My Aged Care"),
    );
    await runAfter();

    /* Letter five: sent after letter four, and read before it. */
    const returned = await sendAsTheCaptureScreenDoes("letter five", margaret);
    readerAnswers(FORM, FORM);
    await runAfter();

    /* The poll that shows it still being read is the one that reads it again. */
    await record(
      "home, while letter four waits for its second round",
      home(get("/api/home")),
    );
    readerAnswers(REFERRAL, REFERRAL);
    await runAfter();

    /* What she sees. */
    const letters = [
      ["letter one", bill],
      ["letter two", notice],
      ["letter three", unread],
      ["letter four", referral],
      ["letter five", returned],
    ];
    const showingPage = (id: string, page: string) =>
      onePage(get(`/api/documents/${id}/pages/${page}`), at({ id, page }));

    await record("home", home(get("/api/home")));
    await record("letters", listLetters(get("/api/documents")));
    for (const [name, id] of letters) {
      await record(
        `${name}, in full`,
        oneLetter(get(`/api/documents/${id}`), at({ id })),
      );
    }
    await record("letter one, page 1", showingPage(bill, "1"));
    await record("letter one, page 99", showingPage(bill, "99"));
    await record("letter two, page 2", showingPage(notice, "2"));
    await record("a page of a letter nobody has", showingPage(NOBODYS, "1"));
    await record(
      "a page of a letter id that is not an id",
      showingPage(MALFORMED, "1"),
    );
    await record(
      "a letter nobody has",
      oneLetter(get(`/api/documents/${NOBODYS}`), at({ id: NOBODYS })),
    );
    await record(
      "a letter id that is not an id",
      oneLetter(get(`/api/documents/${MALFORMED}`), at({ id: MALFORMED })),
    );

    /*
     * Looks right, save it. The bill first, the letter with no date next and
     * the form, which is due before the bill, last: the task list has to show
     * the form, then the bill, then the letter with no date.
     */
    const confirming = (id: string) =>
      confirm(send("POST", `/api/documents/${id}/confirm`), at({ id }));
    const saved = await record<Confirmed>(
      "confirm letter one",
      confirming(bill),
    );
    await record("confirm letter two", confirming(notice));
    const contact = await record<Confirmed>(
      "confirm letter four",
      confirming(referral),
    );
    await record("confirm letter five", confirming(returned));
    await record("confirm letter one again", confirming(bill));
    await record("confirm letter three, which failed", confirming(unread));
    await record("confirm a letter nobody has", confirming(NOBODYS));
    await record(
      "confirm a letter id that is not an id",
      confirming(MALFORMED),
    );

    /* What she sees now that they are saved. */
    await record("home, after confirming", home(get("/api/home")));
    await record(
      "letters, after confirming",
      listLetters(get("/api/documents")),
    );
    for (const [name, id] of letters) {
      await record(
        `${name}, in full, after confirming`,
        oneLetter(get(`/api/documents/${id}`), at({ id })),
      );
    }

    /* Tasks. */
    const task = saved.task!.id;
    const ticking = (id: string) =>
      complete(send("POST", `/api/tasks/${id}/complete`), at({ id }));
    const unticking = (id: string) =>
      reopen(send("DELETE", `/api/tasks/${id}/complete`), at({ id }));
    const showing = (id: string) =>
      oneTask(get(`/api/tasks/${id}`), at({ id }));

    await record("tasks", listTasks(get("/api/tasks")));
    await record("the task of letter one, in full", showing(task));
    await record("the task of letter four, in full", showing(contact.task!.id));
    await record("tick the task", ticking(task));
    await record("tick it again", ticking(task));
    await record("home, with a task just ticked", home(get("/api/home")));
    await record("untick the task", unticking(task));
    await record("untick it again", unticking(task));
    await record("a task nobody has", showing(NOBODYS));
    await record("tick a task nobody has", ticking(NOBODYS));
    await record("untick a task nobody has", unticking(NOBODYS));
    // KAN-93: 404, as a letter answers. These three answered 500 until then.
    await record("a task id that is not an id", showing(MALFORMED));
    await record("tick a task id that is not an id", ticking(MALFORMED));
    await record("untick a task id that is not an id", unticking(MALFORMED));

    /* Somebody else, holding Margaret's ids. */
    browserOf("Dorothy");
    await record(
      "a second person registers",
      register(
        send("POST", "/api/auth/register", {
          email: "dorothy@example.com",
          password: "a different long phrase",
          displayName: "Dorothy Ng",
        }),
      ),
    );
    await record("the second person: home", home(get("/api/home")));
    await record(
      "the second person: letters",
      listLetters(get("/api/documents")),
    );
    await record("the second person: tasks", listTasks(get("/api/tasks")));
    await record(
      "the second person reads the first one's letter",
      oneLetter(get(`/api/documents/${bill}`), at({ id: bill })),
    );
    await record(
      "the second person opens its photograph",
      showingPage(bill, "1"),
    );
    await record(
      "the second person says its photograph has landed",
      sendLetter(
        send("POST", "/api/documents", {
          documentId: bill,
          pages: [{ contentType: "image/png" }],
        }),
      ),
    );
    await record("the second person confirms it", confirming(bill));
    await record("the second person reads the first one's task", showing(task));
    await record("the second person ticks it", ticking(task));
    await record("the second person unticks it", unticking(task));

    /* Signing out. */
    browserOf("Margaret");
    const token = cookieValue(SESSION_COOKIE_NAME)!;
    await record("sign out", logout(send("POST", "/api/auth/logout")));
    await record("who am I, signed out", me(get("/api/auth/me")));
    keepCookie(SESSION_COOKIE_NAME, token);
    await record(
      "who am I, from a browser that kept the cookie",
      me(get("/api/auth/me")),
    );
    await record("sign out again", logout(send("POST", "/api/auth/logout")));

    expect(steps).toMatchSnapshot();

    // Every scripted reading was asked for: no round was skipped or repeated.
    expect(answersLeft()).toBe(0);
    // And nothing was logged that the story does not explain: the two reader
    // calls of letter three.
    expect(logged).toEqual([
      "[uploads] reading document <id> failed: reader 1, attempt 1 of 3",
      "[uploads] reading document <id> failed: reader 2, attempt 1 of 3",
    ]);
  });
});

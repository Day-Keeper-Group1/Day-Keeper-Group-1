// KAN-56: what a letter is called, what a list row carries, and what the home screen counts.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/db", () => ({ query: vi.fn(), queryOne: vi.fn() }));

import { query, queryOne } from "@/server/db";
import {
  documentLabel,
  getDocument,
  getHome,
  getPageStoragePath,
  listDocuments,
} from "@/server/documents";
import { FAILURE_MESSAGE } from "@/lib/contract/api";
import { CONTRACT_FIELD_KEYS } from "@/lib/contract/fields";

const queryMock = vi.mocked(query);
const queryOneMock = vi.mocked(queryOne);

const USER_ID = "11111111-1111-1111-1111-111111111111";
const DOCUMENT_ID = "3a9f1e77-4c02-4f1a-9b3e-5d2c8a11f004";
const MELBOURNE = "Australia/Melbourne";

/** 9:12 on a Monday morning in Melbourne, which is the Sunday night in UTC. */
const UPLOADED_AT = "2026-08-09T23:12:44.000Z";

beforeEach(() => {
  queryMock.mockReset();
  queryOneMock.mockReset();
});

describe("what a letter is called", () => {
  it("names a letter after the reading once there is one", () => {
    expect(
      documentLabel({
        issuer: "AGL Energy",
        documentType: "Electricity bill",
        uploadedAt: UPLOADED_AT,
        pageCount: 2,
        timeZone: MELBOURNE,
      }),
    ).toBe("AGL Energy · Electricity bill");
  });

  it("falls back to the upload itself until both halves are known", () => {
    const provisional = "Photographed Mon 10 Aug at 9:12 am, 2 pages";

    expect(
      documentLabel({
        issuer: null,
        documentType: null,
        uploadedAt: UPLOADED_AT,
        pageCount: 2,
        timeZone: MELBOURNE,
      }),
    ).toBe(provisional);

    // Half a name is not a name. A reading that produced an issuer and no
    // document type would otherwise be called "AGL Energy undefined".
    expect(
      documentLabel({
        issuer: "AGL Energy",
        documentType: null,
        uploadedAt: UPLOADED_AT,
        pageCount: 2,
        timeZone: MELBOURNE,
      }),
    ).toBe(provisional);
  });

  it("counts one page in the singular", () => {
    expect(
      documentLabel({
        issuer: null,
        documentType: null,
        uploadedAt: UPLOADED_AT,
        pageCount: 1,
        timeZone: MELBOURNE,
      }),
    ).toBe("Photographed Mon 10 Aug at 9:12 am, 1 page");
  });

  it("tells the day in the person's zone and not the server's", () => {
    // The same instant, read from two places. Getting this wrong is the day off
    // by one that src/lib/contract/dates.ts exists to prevent, and here it
    // would put a letter on the wrong evening in the letters area.
    expect(
      documentLabel({
        issuer: null,
        documentType: null,
        uploadedAt: UPLOADED_AT,
        pageCount: 2,
        timeZone: "UTC",
      }),
    ).toBe("Photographed Sun 9 Aug at 11:12 pm, 2 pages");

    // Just after midnight in Melbourne, which is still the previous afternoon
    // in UTC, so the hour has to wrap onto the next day as well as the clock.
    expect(
      documentLabel({
        issuer: null,
        documentType: null,
        uploadedAt: "2026-08-10T14:05:00.000Z",
        pageCount: 1,
        timeZone: MELBOURNE,
      }),
    ).toBe("Photographed Tue 11 Aug at 12:05 am, 1 page");
  });
});

describe("the letters list", () => {
  it("is scoped to its owner, newest upload first, and holds every status", async () => {
    queryMock.mockResolvedValue([]);

    await listDocuments(USER_ID, MELBOURNE);

    const [sql, params] = queryMock.mock.calls[0];
    expect(sql).toContain("WHERE d.user_id = $1");
    expect(sql).toContain("ORDER BY d.uploaded_at DESC");
    expect(sql).not.toContain("d.status IN");
    expect(params).toEqual([USER_ID]);
  });

  it("omits the optional keys rather than sending them as null", async () => {
    queryMock.mockResolvedValue([
      {
        id: DOCUMENT_ID,
        issuer: null,
        document_type: null,
        status: "processing",
        due_date: null,
        due_time: null,
        amount_text: null,
        reference: null,
        uploaded_at: new Date(UPLOADED_AT),
        page_count: 2,
      },
    ]);

    const [row] = await listDocuments(USER_ID, MELBOURNE);

    expect(row).toEqual({
      id: DOCUMENT_ID,
      issuer: null,
      documentType: null,
      label: "Photographed Mon 10 Aug at 9:12 am, 2 pages",
      status: "processing",
      uploadedAt: UPLOADED_AT,
      pageCount: 2,
    });
    expect("dueDate" in row).toBe(false);
    expect("failure" in row).toBe(false);
  });

  it("carries the sentence for a person exactly when the reading failed", async () => {
    queryMock.mockResolvedValue([
      {
        id: DOCUMENT_ID,
        issuer: null,
        document_type: null,
        status: "failed",
        due_date: null,
        due_time: null,
        amount_text: null,
        reference: null,
        uploaded_at: new Date(UPLOADED_AT),
        page_count: 1,
      },
    ]);

    const [row] = await listDocuments(USER_ID, MELBOURNE);

    // The developer's reason lives on the run and never leaves the server.
    expect(row.failure).toEqual({ message: FAILURE_MESSAGE });
  });
});

describe("one letter, in full", () => {
  function readingRows() {
    return [
      { field_key: "amount", extracted_value: "$347.60", status: "confirmed" },
      {
        field_key: "due_date",
        extracted_value: "2026-08-15",
        status: "confirmed",
      },
      { field_key: "due_time", extracted_value: "10:30", status: "confirmed" },
      {
        field_key: "issuer",
        extracted_value: "AGL Energy",
        status: "confirmed",
      },
      // A hedge and a blank are told apart in storage and alike on screen.
      {
        field_key: "reference",
        extracted_value: "8841 2290",
        status: "uncertain",
      },
    ];
  }

  function documentRow() {
    return {
      id: DOCUMENT_ID,
      issuer: "AGL Energy",
      document_type: "Electricity bill",
      status: "needs-review",
      due_date: "2026-08-15",
      due_time: "10:30",
      amount_text: "$347.60",
      reference: null,
      uploaded_at: new Date(UPLOADED_AT),
      page_count: 1,
    };
  }

  // Every one of these queries is the ownership check. A mocked driver answers
  // whatever it was told to answer, so the only thing that can catch a WHERE
  // clause losing its user id is reading the SQL that was sent: the 404 rather
  // than 403 rule in docs/api.md rests on a stranger's letter being absent, not
  // on it being refused.
  it("asks for a letter, its reading and its pages under one owner", async () => {
    queryOneMock.mockResolvedValue(documentRow());
    queryMock
      .mockResolvedValueOnce(readingRows())
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await getDocument(DOCUMENT_ID, USER_ID, MELBOURNE);

    const [sql, params] = queryOneMock.mock.calls[0];
    expect(sql).toContain("d.user_id = $2");
    expect(params).toEqual([DOCUMENT_ID, USER_ID]);

    for (const [fieldsOrPagesSql, fieldsOrPagesParams] of queryMock.mock
      .calls) {
      expect(fieldsOrPagesSql).toContain("d.user_id = $2");
      expect(fieldsOrPagesParams).toEqual([DOCUMENT_ID, USER_ID]);
    }
  });

  it("finds a photograph only underneath the person who owns the letter", async () => {
    queryOneMock.mockResolvedValue({ storage_path: "uploads/u/d/1.jpg" });

    expect(await getPageStoragePath(DOCUMENT_ID, 1, USER_ID)).toBe(
      "uploads/u/d/1.jpg",
    );

    const [sql, params] = queryOneMock.mock.calls[0];
    expect(sql).toContain("d.user_id = $3");
    expect(params).toEqual([DOCUMENT_ID, 1, USER_ID]);

    // A page of somebody else's letter is a page that is not there, which is
    // the same answer a page number nobody photographed gets.
    queryOneMock.mockResolvedValue(null);
    expect(await getPageStoragePath(DOCUMENT_ID, 9, USER_ID)).toBeNull();
  });

  it("always shows all six, in the contract's order, with a hedge collapsed", async () => {
    queryOneMock.mockResolvedValue(documentRow());
    queryMock
      .mockResolvedValueOnce(readingRows())
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: "page-one", page_number: 1 }]);

    const detail = await getDocument(DOCUMENT_ID, USER_ID, MELBOURNE);

    expect(detail?.fields.map((field) => field.key)).toEqual([
      ...CONTRACT_FIELD_KEYS,
      "due_time",
    ]);

    // Two of the six were never stored at all. They say so rather than going
    // missing, because silence and "I could not read this" are different
    // answers (src/lib/contract/fields.ts).
    const byKey = new Map(detail?.fields.map((f) => [f.key, f]));
    expect(byKey.get("document_type")).toEqual({
      key: "document_type",
      label: "Document type",
      value: null,
      status: "unreadable",
    });
    expect(byKey.get("action_required")?.status).toBe("unreadable");

    // An uncertain value never reaches the browser, and it loses its value on
    // the way out rather than arriving flagged.
    expect(byKey.get("reference")).toEqual({
      key: "reference",
      label: "Reference",
      value: null,
      status: "unreadable",
    });

    // A confident date is display text by the time it leaves the server.
    expect(byKey.get("due_date")?.value).toBe("15 Aug 2026");
  });

  it("lists the numbers the letter printed, the one to quote first, hedges dropped", async () => {
    queryOneMock.mockResolvedValue(documentRow());
    queryMock
      .mockResolvedValueOnce([
        ...readingRows().filter((row) => row.field_key !== "reference"),
        {
          field_key: "reference",
          extracted_value: "8124  6630",
          status: "confirmed",
        },
      ])
      .mockResolvedValueOnce([
        { label: "Licence number", value: "0550 2615", status: "confirmed" },
        { label: "Card number", value: "P4471", status: "uncertain" },
        { label: "Customer number", value: "8124 6630", status: "confirmed" },
      ])
      .mockResolvedValueOnce([]);

    const detail = await getDocument(DOCUMENT_ID, USER_ID, MELBOURNE);

    expect(detail?.identifiers).toEqual([
      { label: "Customer number", value: "8124 6630", isReference: true },
      { label: "Licence number", value: "0550 2615", isReference: false },
    ]);
  });

  it("offers each photograph as a path and never as a signed link", async () => {
    queryOneMock.mockResolvedValue(documentRow());
    queryMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: "page-one", page_number: 1 }]);

    const detail = await getDocument(DOCUMENT_ID, USER_ID, MELBOURNE);

    expect(detail?.pages).toEqual([
      {
        id: "page-one",
        pageNumber: 1,
        url: `/api/documents/${DOCUMENT_ID}/pages/1`,
      },
    ]);
  });

  it("has no reading to show while the letter is still being read", async () => {
    queryOneMock.mockResolvedValue({ ...documentRow(), status: "processing" });
    queryMock
      .mockResolvedValueOnce(readingRows())
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const detail = await getDocument(DOCUMENT_ID, USER_ID, MELBOURNE);

    expect(detail?.fields).toEqual([]);
  });

  it("treats an id these tables could not hold as a letter nobody has", async () => {
    // The address bar is reachable by anyone, so a mistyped id has to answer
    // the same absence a stranger's letter does. Reaching the database with it
    // would raise on the uuid cast and become a 500 where docs/api.md says 404.
    expect(await getDocument("not-a-letter", USER_ID, MELBOURNE)).toBeNull();
    expect(await getPageStoragePath("not-a-letter", 1, USER_ID)).toBeNull();
    expect(queryOneMock).not.toHaveBeenCalled();
    expect(queryMock).not.toHaveBeenCalled();
  });
});

describe("the home screen", () => {
  const NOW = new Date("2026-08-15T00:30:00.000Z");

  function inboxRow(id: string, status: string) {
    return {
      id,
      issuer: null,
      document_type: null,
      status,
      due_date: null,
      due_time: null,
      amount_text: null,
      reference: null,
      uploaded_at: new Date(UPLOADED_AT),
      page_count: 1,
    };
  }

  function taskRow(id: string, dueDate: string, state: string) {
    return {
      id,
      title: `Pay something (${id})`,
      document_id: DOCUMENT_ID,
      issuer: "AGL Energy",
      due_date: dueDate,
      due_time: null,
      state,
      reminder_id: null,
      scheduled_for: null,
      reminder_local_date: null,
      reminder_local_time: null,
      reminder_channel: null,
      reminder_status: null,
    };
  }

  it("counts the very rows the inbox is drawn from", async () => {
    // The three queries run together, in the order getHome lists them: the
    // inbox, then listTasks' own query, then the recent ticks.
    queryMock
      .mockResolvedValueOnce([
        inboxRow("doc-needs-review", "needs-review"),
        inboxRow("doc-processing", "processing"),
        inboxRow("doc-failed", "failed"),
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const home = await getHome(USER_ID, MELBOURNE, NOW);

    expect(home.counts).toEqual({
      needsReview: 1,
      processing: 1,
      failed: 1,
    });
    expect(home.inbox.map((row) => row.id)).toEqual([
      "doc-needs-review",
      "doc-processing",
      "doc-failed",
    ]);
    expect(home.inbox[2].failure).toEqual({ message: FAILURE_MESSAGE });

    const [sql] = queryMock.mock.calls[0];
    expect(sql).toContain(
      "d.status IN ('processing', 'needs-review', 'failed')",
    );
  });

  it("keeps every open task and ages out only the older ticks", async () => {
    queryMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        // Three weeks overdue and still open, which is the loudest thing this
        // person owns, so it stays whatever its date.
        taskRow("task-overdue", "2026-07-25", "open"),
        taskRow("task-ticked-recently", "2026-08-12", "completed"),
        taskRow("task-ticked-in-march", "2026-03-02", "completed"),
      ])
      .mockResolvedValueOnce([{ id: "task-ticked-recently" }]);

    const home = await getHome(USER_ID, MELBOURNE, NOW);

    expect(home.tasks.map((task) => task.id)).toEqual([
      "task-overdue",
      "task-ticked-recently",
    ]);
    expect(home.tasks[0].status).toBe("overdue");

    const [sql, params] = queryMock.mock.calls[2];
    expect(sql).toContain("t.state = 'completed'");
    expect(params).toEqual([USER_ID, NOW.toISOString(), 7]);
  });
});

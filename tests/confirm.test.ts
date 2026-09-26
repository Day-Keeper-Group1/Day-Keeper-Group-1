// KAN-59: what confirming a letter writes, and what it refuses.
import { beforeEach, describe, expect, it, vi } from "vitest";

const getTaskSummaryMock = vi.hoisted(() => vi.fn());

vi.mock("@/server/db", () => ({
  pool: vi.fn(),
  query: vi.fn(),
  queryOne: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/server/tasks", () => ({ getTaskSummary: getTaskSummaryMock }));

import type { PoolClient } from "pg";

import { transaction } from "@/server/db";
import { ConfirmRefused, confirmDocument } from "@/server/confirm";

const transactionMock = vi.mocked(transaction);

const USER_ID = "11111111-1111-1111-1111-111111111111";
const DOCUMENT_ID = "3a9f1e77-4c02-4f1a-9b3e-5d2c8a11f004";
const MELBOURNE = "Australia/Melbourne";
/** Midday on Tuesday 15 September 2026 in Melbourne. */
const NOW = new Date("2026-09-15T02:00:00Z");

type Letter = {
  status: string;
  issuer: string | null;
  document_type: string | null;
  due_date: string | null;
  due_time: string | null;
};

const WAITING: Letter = {
  status: "needs-review",
  issuer: "Yarra Valley Water",
  document_type: "Water bill",
  due_date: "2026-09-21",
  due_time: null,
};

/**
 * A database holding one letter and the action its reading found, answering
 * each statement confirmDocument() sends in the order it sends them.
 */
function database(letter: Letter | null, action: string | null) {
  const client = {
    query: vi.fn(async (sql: string) => {
      if (sql.includes("FROM documents d")) {
        return { rows: letter ? [letter] : [] };
      }
      if (sql.includes("field_key = 'action_required'")) {
        return { rows: action === null ? [] : [{ extracted_value: action }] };
      }
      if (sql.includes("INSERT INTO tasks")) {
        return { rows: [{ id: "task-new" }] };
      }
      return { rows: [] };
    }),
  };
  transactionMock.mockImplementation((run) =>
    run(client as unknown as PoolClient),
  );
  return client;
}

function statements(client: ReturnType<typeof database>) {
  return client.query.mock.calls as unknown as [string, unknown[]][];
}

describe("confirming a letter", () => {
  beforeEach(() => {
    transactionMock.mockReset();
    getTaskSummaryMock.mockReset();
    getTaskSummaryMock.mockResolvedValue({ id: "task-new" });
  });

  it("makes a task named from the action, with the reminders still ahead", async () => {
    const client = database(WAITING, "Pay Yarra Valley Water");

    const result = await confirmDocument(DOCUMENT_ID, USER_ID, MELBOURNE, NOW);

    expect(result).toEqual({
      documentId: DOCUMENT_ID,
      task: { id: "task-new" },
    });

    const calls = statements(client);
    const task = calls.find(([sql]) => sql.includes("INSERT INTO tasks"));
    // The action already names who, so nothing is added in brackets.
    expect(task?.[1]).toEqual([
      USER_ID,
      DOCUMENT_ID,
      "Pay Yarra Valley Water",
      "Yarra Valley Water",
      "2026-09-21",
      null,
    ]);

    // Due the 21st, confirmed the 15th: 7 days before is already gone, so
    // the 18th and the 20th are planned, as days.
    const reminders = calls.filter(([sql]) =>
      sql.includes("INSERT INTO reminders"),
    );
    expect(reminders.map(([, params]) => params)).toEqual([
      ["task-new", "2026-09-18"],
      ["task-new", "2026-09-20"],
    ]);

    const letter = calls.find(([sql]) => sql.includes("UPDATE documents"));
    expect(letter?.[0]).toContain("'confirmed'");
    expect(letter?.[0]).toContain("confirmed_at = now()");

    const audit = calls.find(([sql]) => sql.includes("INSERT INTO audit_logs"));
    expect(audit?.[0]).toContain("'document.confirm'");
    // Metadata only, never a value from the letter.
    expect(JSON.parse(audit?.[1][2] as string)).toEqual({
      taskId: "task-new",
      reminders: 2,
    });

    expect(getTaskSummaryMock).toHaveBeenCalledWith(
      "task-new",
      USER_ID,
      MELBOURNE,
      NOW,
    );
  });

  it("keeps a letter that asks for nothing, and makes no task", async () => {
    const client = database(
      {
        ...WAITING,
        issuer: "Wattlebank Super",
        document_type: "Annual statement",
        due_date: null,
      },
      "No action",
    );

    const result = await confirmDocument(DOCUMENT_ID, USER_ID, MELBOURNE, NOW);

    expect(result).toEqual({ documentId: DOCUMENT_ID, task: null });
    const calls = statements(client);
    expect(calls.some(([sql]) => sql.includes("INSERT INTO tasks"))).toBe(
      false,
    );
    expect(
      calls.find(([sql]) => sql.includes("UPDATE documents"))?.[0],
    ).toContain("'confirmed'");
    expect(getTaskSummaryMock).not.toHaveBeenCalled();
  });

  it("makes a task with no reminders for a letter that names no date", async () => {
    const client = database(
      { ...WAITING, due_date: null },
      "Contact Centrelink",
    );

    await confirmDocument(DOCUMENT_ID, USER_ID, MELBOURNE, NOW);

    const calls = statements(client);
    const task = calls.find(([sql]) => sql.includes("INSERT INTO tasks"));
    expect(task?.[1][2]).toBe("Contact Centrelink (Yarra Valley Water)");
    expect(calls.some(([sql]) => sql.includes("INSERT INTO reminders"))).toBe(
      false,
    );
  });

  it("locks the letter it reads, so two taps cannot make two tasks", async () => {
    const client = database(WAITING, "Pay Yarra Valley Water");

    await confirmDocument(DOCUMENT_ID, USER_ID, MELBOURNE, NOW);

    const [sql, params] = statements(client)[0];
    expect(sql).toContain("FOR UPDATE");
    expect(sql).toContain("d.user_id = $2");
    expect(params).toEqual([DOCUMENT_ID, USER_ID]);
  });

  it("answers null for a letter that is not hers, and for an id that is not one", async () => {
    database(null, null);

    await expect(
      confirmDocument(DOCUMENT_ID, USER_ID, MELBOURNE, NOW),
    ).resolves.toBeNull();
    await expect(
      confirmDocument("not-an-id", USER_ID, MELBOURNE, NOW),
    ).resolves.toBeNull();
  });

  it.each([
    ["confirmed", "This letter is already saved."],
    ["processing", "This letter is still being read."],
    ["failed", "This letter could not be read, so there is nothing to save."],
  ])(
    "refuses a letter that is %s, and writes nothing",
    async (status, message) => {
      const client = database({ ...WAITING, status }, "Pay Yarra Valley Water");

      const refusal = await confirmDocument(
        DOCUMENT_ID,
        USER_ID,
        MELBOURNE,
        NOW,
      ).catch((error: unknown) => error);

      expect(refusal).toBeInstanceOf(ConfirmRefused);
      expect((refusal as Error).message).toBe(message);
      expect(statements(client)).toHaveLength(1);
    },
  );
});

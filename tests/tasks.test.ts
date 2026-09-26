import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/db", () => ({ query: vi.fn(), queryOne: vi.fn() }));

import { query, queryOne } from "@/server/db";
import { completeTask, getTask, listTasks, reopenTask } from "@/server/tasks";

const queryMock = vi.mocked(query);
const queryOneMock = vi.mocked(queryOne);
const NOW = new Date("2026-08-15T00:30:00.000Z");
const USER_ID = "11111111-1111-1111-1111-111111111111";

describe("task list", () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it("scopes the query to its owner and excludes dismissed tasks", async () => {
    queryMock.mockResolvedValue([]);

    await listTasks(USER_ID, "Australia/Melbourne", NOW);

    const [sql, params] = queryMock.mock.calls[0];
    expect(sql).toContain("WHERE t.user_id = $1");
    expect(sql).toContain("t.state <> 'dismissed'");
    expect(sql).toContain("t.due_date ASC NULLS LAST");
    expect(sql).not.toMatch(/\bLIMIT\b/);
    expect(params).toEqual([USER_ID]);
  });

  it("returns ordered task summaries with all reminder states", async () => {
    queryMock.mockResolvedValue([
      {
        id: "task-overdue",
        title: "Return the form (Services Australia)",
        document_id: "document-one",
        issuer: "Services Australia",
        due_date: "2026-08-14",
        due_time: null,
        state: "open",
        reminder_id: "reminder-sent",
        reminder_local_date: "2026-08-08",
      },
      {
        id: "task-overdue",
        title: "Return the form (Services Australia)",
        document_id: "document-one",
        issuer: "Services Australia",
        due_date: "2026-08-14",
        due_time: null,
        state: "open",
        reminder_id: "reminder-skipped",
        reminder_local_date: "2026-08-14",
      },
      {
        id: "task-appointment",
        title: "Attend the appointment (Clinic)",
        document_id: "document-two",
        issuer: "Clinic",
        due_date: "2026-08-20",
        due_time: "10:30",
        state: "completed",
        reminder_id: "reminder-failed",
        reminder_local_date: "2026-08-20",
      },
      {
        id: "task-no-date",
        title: "Call the issuer",
        document_id: null,
        issuer: null,
        due_date: null,
        due_time: null,
        state: "open",
        reminder_id: null,
        reminder_local_date: null,
      },
    ]);

    const result = await listTasks(USER_ID, "Australia/Melbourne", NOW);

    expect(result).toEqual([
      {
        id: "task-overdue",
        title: "Return the form (Services Australia)",
        documentId: "document-one",
        issuer: "Services Australia",
        dueDate: "2026-08-14",
        status: "overdue",
        reminders: [
          {
            id: "reminder-sent",
            localDate: "2026-08-08",
          },
          {
            id: "reminder-skipped",
            localDate: "2026-08-14",
          },
        ],
      },
      {
        id: "task-appointment",
        title: "Attend the appointment (Clinic)",
        documentId: "document-two",
        issuer: "Clinic",
        dueDate: "2026-08-20",
        dueTime: "10:30",
        status: "completed",
        reminders: [
          {
            id: "reminder-failed",
            localDate: "2026-08-20",
          },
        ],
      },
      {
        id: "task-no-date",
        title: "Call the issuer",
        issuer: null,
        dueDate: null,
        status: "upcoming",
        reminders: [],
      },
    ]);
  });

  it("uses the person's timezone when deciding whether a task is overdue", async () => {
    queryMock.mockResolvedValue([
      {
        id: "task",
        title: "Pay bill",
        document_id: null,
        issuer: null,
        due_date: "2026-08-14",
        due_time: null,
        state: "open",
        reminder_id: null,
        reminder_local_date: null,
      },
    ]);

    const melbourne = await listTasks(
      USER_ID,
      "Australia/Melbourne",
      new Date("2026-08-14T14:30:00.000Z"),
    );
    const losAngeles = await listTasks(
      USER_ID,
      "America/Los_Angeles",
      new Date("2026-08-14T14:30:00.000Z"),
    );

    expect(melbourne[0].status).toBe("overdue");
    expect(losAngeles[0].status).toBe("upcoming");
  });
});

describe("complete task", () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it("updates only the owned task and does not write reminders", async () => {
    queryMock.mockResolvedValue([
      {
        id: "task-one",
        title: "Pay bill",
        document_id: "document-one",
        issuer: "Issuer",
        due_date: "2026-08-20",
        due_time: null,
        state: "completed",
        reminder_id: "reminder-one",
        reminder_local_date: "2026-08-20",
      },
    ]);

    const result = await completeTask(
      "task-one",
      USER_ID,
      "Australia/Melbourne",
      NOW,
    );

    const [sql, params] = queryMock.mock.calls[0];
    expect(sql).toContain("UPDATE tasks");
    expect(sql).toContain("state = 'completed'");
    expect(sql).toContain("completed_at = COALESCE(completed_at, now())");
    expect(sql).toContain("WHERE id = $1");
    expect(sql).toContain("AND user_id = $2");
    expect(sql).toContain("AND state <> 'dismissed'");
    expect(sql).not.toMatch(/UPDATE reminders/);
    expect(params).toEqual(["task-one", USER_ID]);
    expect(result).toEqual({
      id: "task-one",
      title: "Pay bill",
      documentId: "document-one",
      issuer: "Issuer",
      dueDate: "2026-08-20",
      status: "completed",
      reminders: [
        {
          id: "reminder-one",
          localDate: "2026-08-20",
        },
      ],
    });
  });

  it("returns null when the task is missing or belongs to another user", async () => {
    queryMock.mockResolvedValue([]);

    await expect(
      completeTask("unknown-task", USER_ID, "Australia/Melbourne", NOW),
    ).resolves.toBeNull();
  });
});

describe("one task", () => {
  beforeEach(() => {
    queryMock.mockReset();
    queryOneMock.mockReset();
  });

  it("returns the owned task with its fields and page count", async () => {
    queryMock
      .mockResolvedValueOnce([
        {
          id: "task-one",
          title: "Pay bill",
          document_id: "document-one",
          issuer: "Issuer",
          due_date: "2026-08-20",
          due_time: null,
          state: "open",
          reminder_id: null,
          reminder_local_date: null,
        },
      ])
      .mockResolvedValueOnce([
        {
          field_key: "document_type",
          extracted_value: "Utility bill",
          status: "confirmed",
        },
        {
          field_key: "due_date",
          extracted_value: "2026-08-20",
          status: "confirmed",
        },
        {
          field_key: "reference",
          extracted_value: "hidden guess",
          status: "uncertain",
        },
      ])
      .mockResolvedValueOnce([
        { label: "Account number", value: "4417 9902", status: "confirmed" },
        { label: "Invoice number", value: "hidden", status: "uncertain" },
      ]);
    queryOneMock.mockResolvedValue({ page_count: 2 });

    const result = await getTask(
      "task-one",
      USER_ID,
      "Australia/Melbourne",
      NOW,
    );

    expect(queryMock.mock.calls[0][1]).toEqual(["task-one", USER_ID]);
    expect(queryMock.mock.calls[0][0]).toContain("AND t.user_id = $2");
    expect(queryMock.mock.calls[0][0]).toContain(
      "AND t.document_id IS NOT NULL",
    );
    expect(queryOneMock).toHaveBeenCalledWith(
      expect.stringContaining("AND d.user_id = $2"),
      ["document-one", USER_ID],
    );
    expect(result).toEqual({
      id: "task-one",
      title: "Pay bill",
      documentId: "document-one",
      issuer: "Issuer",
      dueDate: "2026-08-20",
      status: "upcoming",
      reminders: [],
      fields: [
        {
          key: "document_type",
          label: "Document type",
          value: "Utility bill",
          status: "confirmed",
        },
        {
          key: "due_date",
          label: "Due date",
          value: "20 Aug 2026",
          status: "confirmed",
        },
        {
          key: "reference",
          label: "Reference",
          value: null,
          status: "unreadable",
        },
      ],
      identifiers: [
        { label: "Account number", value: "4417 9902", isReference: false },
      ],
      pageCount: 2,
    });
  });

  it("returns null without reading document details when the task is unavailable", async () => {
    queryMock.mockResolvedValue([]);

    await expect(
      getTask("missing", USER_ID, "Australia/Melbourne", NOW),
    ).resolves.toBeNull();
    expect(queryOneMock).not.toHaveBeenCalled();
    expect(queryMock).toHaveBeenCalledOnce();
  });
});

describe("reopen task", () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it("reopens only the owned task and leaves reminders unchanged", async () => {
    queryMock.mockResolvedValue([
      {
        id: "task-one",
        title: "Pay bill",
        document_id: "document-one",
        issuer: "Issuer",
        due_date: "2026-08-14",
        due_time: null,
        state: "open",
        reminder_id: "reminder-one",
        reminder_local_date: "2026-08-14",
      },
    ]);

    const result = await reopenTask(
      "task-one",
      USER_ID,
      "Australia/Melbourne",
      NOW,
    );

    const [sql, params] = queryMock.mock.calls[0];
    expect(sql).toContain("UPDATE tasks");
    expect(sql).toContain("state = 'open'");
    expect(sql).toContain("completed_at = NULL");
    expect(sql).toContain("WHERE id = $1");
    expect(sql).toContain("AND user_id = $2");
    expect(sql).not.toMatch(/UPDATE reminders/);
    expect(params).toEqual(["task-one", USER_ID]);
    expect(result?.status).toBe("overdue");
    // Unticking takes nothing back: the reminder days were never removed.
    expect(result?.reminders[0].localDate).toBe("2026-08-14");
  });

  it("returns null when the task is unavailable", async () => {
    queryMock.mockResolvedValue([]);

    await expect(
      reopenTask("unknown-task", USER_ID, "Australia/Melbourne", NOW),
    ).resolves.toBeNull();
  });
});

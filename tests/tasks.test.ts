import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/db", () => ({ query: vi.fn() }));

import { query } from "@/server/db";
import { listTasks } from "@/server/tasks";

const queryMock = vi.mocked(query);
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
    expect(params).toEqual([USER_ID, "Australia/Melbourne"]);
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
        scheduled_for: new Date("2026-08-07T23:00:00.000Z"),
        reminder_local_date: "2026-08-08",
        reminder_local_time: "09:00",
        reminder_channel: "in_app",
        reminder_status: "sent",
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
        scheduled_for: new Date("2026-08-13T23:00:00.000Z"),
        reminder_local_date: "2026-08-14",
        reminder_local_time: "09:00",
        reminder_channel: "email",
        reminder_status: "skipped",
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
        scheduled_for: new Date("2026-08-19T23:00:00.000Z"),
        reminder_local_date: "2026-08-20",
        reminder_local_time: "09:00",
        reminder_channel: "in_app",
        reminder_status: "failed",
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
        scheduled_for: null,
        reminder_local_date: null,
        reminder_local_time: null,
        reminder_channel: null,
        reminder_status: null,
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
            scheduledFor: "2026-08-07T23:00:00.000Z",
            localDate: "2026-08-08",
            localTime: "09:00",
            channel: "in_app",
            status: "sent",
          },
          {
            id: "reminder-skipped",
            scheduledFor: "2026-08-13T23:00:00.000Z",
            localDate: "2026-08-14",
            localTime: "09:00",
            channel: "email",
            status: "skipped",
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
            scheduledFor: "2026-08-19T23:00:00.000Z",
            localDate: "2026-08-20",
            localTime: "09:00",
            channel: "in_app",
            status: "failed",
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
        scheduled_for: null,
        reminder_local_date: null,
        reminder_local_time: null,
        reminder_channel: null,
        reminder_status: null,
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

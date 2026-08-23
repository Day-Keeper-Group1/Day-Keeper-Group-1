import type { Status } from "@/components/status-badge";
import { formatDueDate, formatDueTime } from "@/lib/contract/dates";
import { planReminders } from "@/lib/contract/reminders";

export type MockDocument = {
  id: string;
  issuer: string;
  documentType: string;
  status: Extract<
    Status,
    "processing" | "needs-review" | "confirmed" | "failed" | "archived"
  >;
  dueDate?: string;
  amount?: string;
  reference?: string;
  uploadedAt: string;
};

export const MOCK_DOCUMENTS: MockDocument[] = [
  // Its extraction below has a hedged date and an unreadable reference, so
  // the summary carries neither: a value the model was not sure of never
  // reaches a summary (src/lib/contract/api.ts).
  {
    id: "doc_1",
    issuer: "Yarra Valley Water",
    documentType: "Utility bill",
    status: "needs-review",
    amount: "$142.30",
    uploadedAt: "2026-08-04",
  },
  {
    id: "doc_2",
    issuer: "Centrelink",
    documentType: "Government letter",
    status: "confirmed",
    dueDate: "2026-08-05",
    reference: "CRN-2201884",
    uploadedAt: "2026-08-03",
  },
  {
    id: "doc_3",
    issuer: "Metro Trains Melbourne",
    documentType: "Fine notice",
    status: "processing",
    uploadedAt: "2026-08-06",
  },
  {
    id: "doc_4",
    issuer: "Bupa",
    documentType: "Medical letter",
    status: "failed",
    uploadedAt: "2026-08-02",
  },
  {
    id: "doc_5",
    issuer: "Telstra",
    documentType: "Utility bill",
    status: "archived",
    dueDate: "2026-07-18",
    amount: "$79.00",
    uploadedAt: "2026-07-10",
  },
];

export function getDocumentById(id: string) {
  return MOCK_DOCUMENTS.find((doc) => doc.id === id);
}

/**
 * A field as a screen sees it: two states only. Storage knows a third
 * (`uncertain`), but the server collapses it to `unreadable` on the way out:
 * a value the model was not sure of does not exist as far as any screen is
 * concerned, and nobody is asked about it. See src/lib/contract/api.ts.
 */
export type ExtractedField = {
  key: string;
  label: string;
  value: string;
  status: Extract<Status, "confirmed" | "unreadable">;
};

const MOCK_EXTRACTIONS: Record<string, ExtractedField[]> = {
  doc_1: [
    {
      key: "document_type",
      label: "Document type",
      value: "Utility bill",
      status: "confirmed",
    },
    {
      key: "issuer",
      label: "Issuer",
      value: "Yarra Valley Water",
      status: "confirmed",
    },
    {
      key: "action_required",
      label: "Action required",
      value: "Pay bill",
      status: "confirmed",
    },
    // Storage holds this one as `uncertain` with the model's guess; what the
    // browser receives is the collapsed form: no value. The screen's message
    // line, not this row, is what tells the person the date is missing.
    {
      key: "due_date",
      label: "Due date",
      value: "",
      status: "unreadable",
    },
    {
      key: "amount",
      label: "Amount",
      value: "$142.30",
      status: "confirmed",
    },
    {
      key: "reference",
      label: "Reference number",
      value: "",
      status: "unreadable",
    },
  ],
};

export function getExtractionFields(documentId: string): ExtractedField[] {
  if (MOCK_EXTRACTIONS[documentId]) return MOCK_EXTRACTIONS[documentId];

  const document = getDocumentById(documentId);
  if (!document) return [];

  const fields: ExtractedField[] = [
    {
      key: "document_type",
      label: "Document type",
      value: document.documentType,
      status: "confirmed",
    },
    {
      key: "issuer",
      label: "Issuer",
      value: document.issuer,
      status: "confirmed",
    },
  ];
  if (document.dueDate) {
    fields.push({
      key: "due_date",
      label: "Due date",
      value: document.dueDate,
      status: "confirmed",
    });
  }
  if (document.amount) {
    fields.push({
      key: "amount",
      label: "Amount",
      value: document.amount,
      status: "confirmed",
    });
  }
  if (document.reference) {
    fields.push({
      key: "reference",
      label: "Reference number",
      value: document.reference,
      status: "confirmed",
    });
  }
  return fields;
}

/**
 * Tasks, and the one fact that describes them (src/lib/contract/api.ts).
 *
 * `done` is the only thing a task stores about itself. Everything else this
 * file exports for a task — whether it reads as overdue, upcoming or
 * completed, what its row says on the right — is worked out from `done`,
 * `dueDate` and a reference date, exactly the way the real product derives it
 * at draw time rather than writing "overdue" anywhere. See
 * src/lib/contract/api.ts.
 *
 * `dueDate: null` is the dateless task src/lib/contract/api.ts describes: a letter with a
 * clear action and no clear date still becomes a task, sits on the list
 * saying "No date", never reminds, never touches the calendar, and stays
 * until ticked.
 */
export type MockTask = {
  id: string;
  title: string;
  documentId?: string;
  issuer: string;
  dueDate: string | null;
  /** Only present for an appointment (something you attend AT a time). */
  dueTime?: string;
  done: boolean;
};

/**
 * The mock's fictional "today". Every derived status (overdue, upcoming, the
 * calendar's month on first render) is computed against this fixed date so
 * the screenshots this frontend produces do not quietly change meaning
 * tomorrow. Chosen to match the product prototype's own fictional today, so
 * the two stay easy to compare side by side.
 */
export const TODAY = "2026-08-10";

export const MOCK_TASKS: MockTask[] = [
  // Overdue: due before TODAY, not done. Linked to doc_2, the one confirmed
  // government letter in MOCK_DOCUMENTS.
  {
    id: "task_centrelink",
    title: "Respond to Centrelink review",
    documentId: "doc_2",
    issuer: "Centrelink",
    dueDate: "2026-08-05",
    done: false,
  },
  // Completed: ticked off, so it reads "Done" however far in the past its
  // date is. Linked to doc_5, the one archived document.
  {
    id: "task_telstra",
    title: "Pay Telstra bill",
    documentId: "doc_5",
    issuer: "Telstra",
    dueDate: "2026-07-18",
    done: true,
  },
  // Upcoming deadline: due after TODAY. Three reminders (7, 3, 1 days
  // before) via planReminders(); the 7-day one lands before TODAY, so the
  // calendar and day sheet show it as already sent rather than planned.
  {
    id: "task_agl",
    title: "Pay AGL electricity bill",
    issuer: "AGL Energy",
    dueDate: "2026-08-15",
    done: false,
  },
  // Upcoming appointment: has a dueTime, so it gets one reminder the day
  // before rather than the three-reminder deadline schedule. See
  // src/lib/contract/reminders.ts.
  {
    id: "task_patel",
    title: "Appointment with Dr Patel",
    issuer: "Dr A. Patel, GP clinic",
    dueDate: "2026-08-14",
    dueTime: "10:30",
    done: false,
  },
  // Dateless: the letter had a clear action and no clear date. It never
  // reminds and never touches the calendar; the list itself is the reminder.
  {
    id: "task_community",
    title: "Return community centre form",
    issuer: "Carlton Community Centre",
    dueDate: null,
    done: false,
  },
];

export type TaskStatus = Extract<
  Status,
  "overdue" | "upcoming" | "completed" | "no-date"
>;

/** The tick, a due date and "today": the only inputs a task's status needs. */
export function taskStatus(task: MockTask, today: string = TODAY): TaskStatus {
  if (task.done) return "completed";
  if (!task.dueDate) return "no-date";
  return task.dueDate < today ? "overdue" : "upcoming";
}

/**
 * The text a task row shows on its right-hand side, read off the prototype:
 * "was due" (not a colour) for overdue, "Done · reminders off" only for a
 * task that had a date to begin with, plain "Done" otherwise, "No date" for
 * the dateless case, and the due date (with a time, for an appointment)
 * otherwise.
 */
export function formatTaskWhen(task: MockTask, today: string = TODAY): string {
  const status = taskStatus(task, today);
  if (status === "no-date") return "No date";
  if (status === "completed")
    return task.dueDate ? "Done · reminders off" : "Done";
  if (!task.dueDate) return "No date";
  const short = formatDueDate(task.dueDate, "short");
  const stamped = task.dueTime
    ? `${short}, ${formatDueTime(task.dueTime)}`
    : short;
  return status === "overdue" ? `was due ${stamped}` : stamped;
}

/** Due date ascending, dateless last: the one sort that pins overdue rows to
 * the top for free, because an overdue date sorts before every upcoming
 * one. */
export function tasksInOrder(tasks: MockTask[]): MockTask[] {
  return [...tasks].sort((a, b) => {
    const aKey = a.dueDate ?? "9999-12-31";
    const bKey = b.dueDate ?? "9999-12-31";
    if (aKey === bKey) return a.title.localeCompare(b.title);
    return aKey < bKey ? -1 : 1;
  });
}

export type CalendarMark = {
  date: string; // 'YYYY-MM-DD'
  kind: "due" | "reminder";
  taskId: string;
};

/**
 * Every mark a task puts on the calendar: one due-date dot, plus one
 * reminder dot per planned reminder. Reuses `planReminders()` from the real
 * contract rather than re-deriving the 7/3/1 (or appointment's single
 * day-before) rule a second time here; omitting `today` deliberately returns
 * every offset, past ones included, so the calendar can still show a
 * reminder that has already gone out.
 */
export function marksForTask(task: MockTask): CalendarMark[] {
  if (!task.dueDate) return [];
  const marks: CalendarMark[] = [
    { date: task.dueDate, kind: "due", taskId: task.id },
  ];
  for (const reminder of planReminders(task.dueDate, {
    hasTime: Boolean(task.dueTime),
  })) {
    marks.push({ date: reminder.localDate, kind: "reminder", taskId: task.id });
  }
  return marks;
}

/**
 * What the browser sees.
 *
 * These types are deliberately close in shape to the ones the interface was
 * already written against (src/lib/mock-data.ts), down to `rawText` being
 * camelCase and `status` using hyphens. Where the two disagree, it is because
 * the fixture invented facts the system cannot know: mock-data gives a
 * still-processing document an issuer, and no real document has one until it
 * has been read. The types here tell the truth about the database; the fixture
 * is a sketch.
 *
 * The translation from the provider's snake_case contract into this shape
 * happens in exactly one place, src/server/extraction, so there is only ever one
 * file to look at when a name does not line up.
 *
 * Wire formats, stated once: every date is 'YYYY-MM-DD' (a calendar day, never
 * a timestamp, never a zone), every time of day is 'HH:mm' (24-hour), and every
 * instant is ISO 8601 with a zone. See ./dates.ts for the helpers that keep it
 * that way.
 */

import type { FieldStatus } from "./extraction";
import type { ContractFieldKey } from "./fields";
import { APP_TIME_ZONE, todayInZone } from "./dates";

/** Where a document is in its life. Mirrors the document_status enum. */
export type DocumentStatus =
  "processing" | "needs-review" | "confirmed" | "failed" | "archived";

/**
 * A task's state as the interface wants it.
 *
 * `upcoming` and `overdue` are computed from the due date at read time, not
 * stored: a task becomes overdue because time passed, and nothing in the system
 * wakes up at midnight to write that down. `completed` is stored.
 */
export type TaskStatus = "upcoming" | "overdue" | "completed";

/**
 * Why a reading failed, in the three kinds the whole system distinguishes.
 * The server-side ExtractionFailure class carries the same union; this is the
 * one definition the browser may import.
 */
export type ExtractionFailureKind =
  "transient" | "unreadable_image" | "unsupported_document";

/**
 * What the person is told for each kind of failure.
 *
 * Resolved here, like FIELD_LABELS, so every surface says it identically. The
 * `failure_detail` column is developer text and never leaves the server; this
 * table is what `failure.message` is built from.
 */
export const FAILURE_MESSAGES: Record<ExtractionFailureKind, string> = {
  // A failure reaches a person only after the automatic attempts are spent, so
  // this cannot say "we're trying again": at the one moment it is displayable,
  // that sentence is already false and it sits beside a button asking the
  // person to do the thing it claims is happening by itself.
  transient: "Something went wrong on our side. Please try again.",
  unreadable_image: "The photo was too blurry to read. Please take it again.",
  unsupported_document: "DayKeeper can't read this kind of document yet.",
};

/**
 * A failure as a list row needs it.
 *
 * This lives on the summary, not only the detail, because the home screen's
 * queue draws the retake affordance directly on the failed row. If it lived
 * only on DocumentDetail, drawing the home screen would cost one extra request
 * per failed document, which is exactly what GET /api/home exists to avoid.
 */
export type DocumentFailureView = {
  kind: ExtractionFailureKind;
  /** Written for the person, not for a developer. From FAILURE_MESSAGES. */
  message: string;
  /** Whether offering "take the photo again" makes sense for this failure. */
  canRetake: boolean;
};

/**
 * One document in a list.
 *
 * `issuer` and `documentType` are null until a reading has succeeded: a
 * document that is still processing, or that failed, has not told anyone who
 * it is from. The interface labels those rows from `uploadedAt` and
 * `pageCount` instead. They are filled in as soon as extraction succeeds and
 * overwritten with the person's corrections at confirm.
 */
export type DocumentSummary = {
  id: string;
  issuer: string | null;
  documentType: string | null;
  /**
   * What to call this row, always present, resolved on the server.
   *
   * `${issuer} · ${documentType}` once the six fields have been read, and the
   * provisional label the division gave it before then. A letter therefore has
   * a name from the moment it exists, which it can, because the pass that
   * divided the pile had already read the letterhead.
   *
   * Resolved in one place for the same reason FIELD_LABELS and
   * FAILURE_MESSAGES are: two screens draw this row and they must not word it
   * differently. See docs/api.md on GET /api/documents.
   */
  label: string;
  status: DocumentStatus;
  /** 'YYYY-MM-DD'. Absent until a reading produced one. */
  dueDate?: string;
  /** 'HH:mm', 24-hour. Only appointments have one. */
  dueTime?: string;
  amount?: string;
  reference?: string;
  uploadedAt: string;
  pageCount: number;
  /** Present exactly when status is 'failed'. */
  failure?: DocumentFailureView;
};

/**
 * One reminder, readable at last.
 *
 * `localDate` is the calendar day the server bucketed the reminder into, in
 * the user's zone. The calendar draws its dots from this string so the client
 * never has to turn an instant back into a day (and get it wrong by one).
 */
export type ReminderView = {
  id: string;
  /** The instant it is scheduled for, ISO 8601 with zone. */
  scheduledFor: string;
  /** The day it lands on for calendar purposes, 'YYYY-MM-DD'. */
  localDate: string;
  /**
   * The wall clock it lands at in the user's zone, 'HH:mm'. Computed beside
   * `localDate` for the same reason: the day sheet says "a reminder goes out
   * this morning, 9 am", and the only other way to that string is turning
   * `scheduledFor` back into a local time in the browser, which is the
   * conversion `localDate` exists to keep out of the client. It is always
   * 09:00 today; it is data rather than copy so that the day the hour becomes
   * a setting, the sentence does not quietly start lying.
   */
  localTime: string;
  channel: "in_app" | "email";
  /**
   * 'skipped' is written by the dispatcher when the clock rang and the task
   * was already done. Ticking a task changes no reminder row; see ADR 007.
   */
  status: "scheduled" | "sent" | "skipped" | "failed";
};

export type TaskSummary = {
  id: string;
  title: string;
  documentId?: string;
  issuer: string | null;
  /** 'YYYY-MM-DD', or null when the letter named no date. */
  dueDate: string | null;
  /** 'HH:mm'. Present only for appointments. */
  dueTime?: string;
  status: TaskStatus;
  /**
   * Every reminder for this task, whatever its status: still scheduled, sent,
   * skipped because the task was already done when the clock rang, or failed.
   * The calendar draws its dots from these rows' `localDate`s, and the day
   * sheet words each one from its status.
   */
  reminders: ReminderView[];
};

/**
 * A task opened from the calendar's day sheet: the summary plus the extracted
 * fields of the letter it came from, and enough to show the photograph.
 * Served by GET /api/tasks/:id.
 */
export type TaskDetail = TaskSummary & {
  /**
   * The task's letter. Required here, though `tasks.document_id` is nullable:
   * confirming a document is the only thing that creates a task this semester,
   * so every task has one. The column is nullable for the day someone adds a
   * task by hand, and that day this type gains a second shape.
   */
  documentId: string;
  fields: ExtractedFieldView[];
  /** Pages in the current attempt only, not every page ever photographed. */
  pageCount: number;
};

/**
 * One row on the review screen.
 *
 * `label` is presentation, resolved from the field key on the server so that
 * every surface spells "Reference" the same way.
 *
 * `value` and `rawText` are null for exactly one case: a field the reader could
 * not read at all. The extraction contract enforces that pairing in the other
 * direction too (status `unreadable` requires a null value), so these two types
 * agree rather than needing a translation that invents `""`. An empty string
 * would mean "the model read an empty string", which is a different fact from
 * "the model could not read this", and the review screen draws a different row
 * for each. The screen renders an empty input for a null.
 */
export type ExtractedFieldView = {
  key: ContractFieldKey | string;
  label: string;
  value: string | null;
  rawText: string | null;
  status: FieldStatus;
};

export type DocumentDetail = DocumentSummary & {
  /**
   * Empty while status is 'processing' and for a document that has never been
   * read successfully. Otherwise the most recent successful reading, with a
   * person's corrections taking precedence.
   */
  fields: ExtractedFieldView[];
  pages: DocumentPageView[];
};

export type DocumentPageView = {
  id: string;
  pageNumber: number;
  /**
   * Where to load the image from: `/api/documents/{id}/pages/{n}`, which checks
   * who is asking and then redirects to a link storage has signed. It is this
   * path rather than the signed link itself so that a payload sitting in a
   * cache cannot go stale.
   */
  url?: string;
};

/**
 * Upload limits, shared with the capture screen so it can stop the person at
 * page ten rather than rejecting ten deliberate photographs at the end.
 *
 * Ten is not a claim about how many pages a reading can divide correctly. It is
 * a bound on how much there is to untangle when it divides them wrongly.
 */
export const MAX_PAGES = 10;
export const MAX_PAGE_BYTES = 10 * 1024 * 1024;

/** Where a batch of photographs is in its life. Mirrors the batch_status enum. */
export type BatchStatus = "uploaded" | "grouping" | "grouped" | "failed";

/**
 * What an upload becomes.
 *
 * A batch, not a document, because nothing about photographing a pile of post
 * says where one letter ends. `documents` fills in as the reading works out how
 * many there are: empty while `status` is `uploaded` or `grouping`, and then
 * however many letters were in the pile.
 *
 * The interface draws one row for the batch while it is being divided, and that
 * row becomes several. See docs/architecture/adr-005-ingestion-and-grouping.md.
 */
export type BatchSummary = {
  id: string;
  status: BatchStatus;
  /** How many photographs arrived. Known immediately, unlike the letter count. */
  pageCount: number;
  uploadedAt: string;
  documents: DocumentSummary[];
  /** Present exactly when status is 'failed': the pages are still here. */
  failure?: DocumentFailureView;
};

/**
 * What the review screen sends back when a person accepts a document.
 *
 * `fields` carries ONLY what the person changed. Sending unchanged fields back
 * records corrections that never happened and quietly destroys the accuracy
 * numbers; see docs/api.md on confirm.
 *
 * `acknowledged` carries the keys of every field that was flagged (uncertain
 * or unreadable), that the person saw, and that they accepted without editing.
 * Without it, "checked and left alone" is indistinguishable from "never looked
 * at", and the review screen's promise ("never from a date you haven't
 * checked") could not be kept honestly.
 */
export type ConfirmDocumentRequest = {
  fields: Array<{ key: string; value: string }>;
  acknowledged: string[];
};

/** What the home screen needs, in one request. */
export type HomeCounts = {
  needsReview: number;
  processing: number;
  failed: number;
};

/**
 * GET /api/home. One request rather than three so the counts and the lists
 * cannot disagree with each other on screen.
 *
 * `inbox` is every document not yet dealt with: status 'processing',
 * 'needs-review' or 'failed', in one merged list, newest upload first. The
 * prototype renders these interleaved in a single card, so the server sends
 * them as the one list they are, not as three lists the client must weave.
 */
export type HomePayload = {
  counts: HomeCounts;
  /**
   * Batches posted and not yet turned into letters. One row each, saying how
   * many photographs are in it, replaced by its letters when the dividing
   * finishes. Usually empty, and never for long.
   */
  dividing: BatchSummary[];
  inbox: DocumentSummary[];
  tasks: TaskSummary[];
};

/**
 * The single error shape every endpoint uses.
 *
 * `message` is safe to show a person: plain, blame-free, and never containing a
 * stack trace, a SQL fragment, or the contents of someone's letter.
 */
export type ApiError = {
  error: {
    code:
      | "unauthenticated"
      | "forbidden"
      | "not_found"
      | "invalid_request"
      | "conflict"
      | "server_error";
    message: string;
    /** Field-level problems, keyed by field name, for form errors. */
    fields?: Record<string, string>;
  };
};

export type SessionUser = {
  id: string;
  email: string;
  displayName: string;
  role: "user" | "platform_operator" | "org_admin" | "org_worker";
  /** IANA zone name, defaulted server-side. "9 am" means 9 am here. */
  timeZone: string;
};

/**
 * Derive the status the interface shows for a task.
 *
 * Kept here, beside the type it produces, so the front end and the back end
 * cannot disagree about when something is overdue.
 *
 * The comparison happens on calendar days in the user's zone, as strings.
 * Comparing instants against a UTC end-of-day looks equivalent and is not: it
 * keeps a Melbourne task "upcoming" until ten the next morning.
 */
export function deriveTaskStatus(
  state: "open" | "completed" | "dismissed",
  dueDate: string | null,
  now: Date = new Date(),
  timeZone: string = APP_TIME_ZONE,
): TaskStatus {
  if (state === "completed") return "completed";
  if (!dueDate) return "upcoming";
  // Something due today is not overdue until today, in the user's zone, is over.
  return dueDate < todayInZone(timeZone, now) ? "overdue" : "upcoming";
}

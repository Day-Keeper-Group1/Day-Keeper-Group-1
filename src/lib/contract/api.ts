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

import type { FieldStatus } from './extraction';
import type { ContractFieldKey } from './fields';
import { APP_TIME_ZONE, todayInZone } from './dates';

/** Where a document is in its life. Mirrors the document_status enum. */
export type DocumentStatus =
  | 'processing'
  | 'needs-review'
  | 'confirmed'
  | 'failed'
  | 'archived';

/**
 * A task's state as the interface wants it.
 *
 * `upcoming` and `overdue` are computed from the due date at read time, not
 * stored: a task becomes overdue because time passed, and nothing in the system
 * wakes up at midnight to write that down. `completed` is stored.
 */
export type TaskStatus = 'upcoming' | 'overdue' | 'completed';

/**
 * Why a reading failed, in the three kinds the whole system distinguishes.
 * The server-side ExtractionFailure class carries the same union; this is the
 * one definition the browser may import.
 */
export type ExtractionFailureKind =
  | 'transient'
  | 'unreadable_image'
  | 'unsupported_document';

/**
 * What the person is told for each kind of failure.
 *
 * Resolved here, like FIELD_LABELS, so every surface says it identically. The
 * `failure_detail` column is developer text and never leaves the server; this
 * table is what `failure.message` is built from.
 */
export const FAILURE_MESSAGES: Record<ExtractionFailureKind, string> = {
  transient: "Something went wrong on our side. We're trying again.",
  unreadable_image: 'The photo was too blurry to read. Please take it again.',
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
  channel: 'in_app' | 'email';
  status: 'scheduled' | 'sent' | 'cancelled' | 'failed';
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
   * Every reminder for this task, including cancelled ones with their status
   * saying so. The calendar's grey dots are these rows' `localDate`s; whether
   * a cancelled reminder keeps its dot is the client's call, and returning the
   * status keeps both answers possible.
   */
  reminders: ReminderView[];
};

/**
 * A task opened from the calendar's day sheet: the summary plus the extracted
 * fields of the letter it came from, and enough to show the photograph.
 * Served by GET /api/tasks/:id.
 */
export type TaskDetail = TaskSummary & {
  /** The task's letter. Required here: a day-sheet entry always has one. */
  documentId: string;
  fields: ExtractedFieldView[];
  pageCount: number;
};

/**
 * One row on the review screen.
 *
 * `label` is presentation, resolved from the field key on the server so that
 * every surface spells "Reference" the same way.
 */
export type ExtractedFieldView = {
  key: ContractFieldKey | string;
  label: string;
  value: string;
  rawText: string;
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
  /** Time-limited URL for the image. Absent until storage is wired up. */
  url?: string;
};

/**
 * Upload limits, shared with the capture screen so it can stop the person at
 * page ten rather than rejecting ten deliberate photographs at the end.
 */
export const MAX_PAGES = 10;
export const MAX_PAGE_BYTES = 10 * 1024 * 1024;

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
      | 'unauthenticated'
      | 'forbidden'
      | 'not_found'
      | 'invalid_request'
      | 'conflict'
      | 'server_error';
    message: string;
    /** Field-level problems, keyed by field name, for form errors. */
    fields?: Record<string, string>;
  };
};

export type SessionUser = {
  id: string;
  email: string;
  displayName: string;
  role: 'user' | 'platform_operator' | 'org_admin' | 'org_worker';
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
  state: 'open' | 'completed' | 'dismissed',
  dueDate: string | null,
  now: Date = new Date(),
  timeZone: string = APP_TIME_ZONE,
): TaskStatus {
  if (state === 'completed') return 'completed';
  if (!dueDate) return 'upcoming';
  // Something due today is not overdue until today, in the user's zone, is over.
  return dueDate < todayInZone(timeZone, now) ? 'overdue' : 'upcoming';
}

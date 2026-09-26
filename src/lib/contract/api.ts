/**
 * What the browser sees.
 *
 * The reader speaks snake_case (./extraction.ts), because that is what a model
 * is asked to produce. These types are camelCase, because the interface was
 * written first and in TypeScript. The translation between the two happens in
 * exactly one place, src/server/extraction, so there is one file to open when a
 * name does not line up.
 *
 * Statuses keep the database's spellings, hyphens and all, so that a value read
 * out of Postgres is the value a component compares against. See db/schema.sql.
 *
 * Wire formats: a date is 'YYYY-MM-DD', a time of day is 'HH:mm' on a 24-hour
 * clock, an instant is ISO 8601 with a zone. The rule and its helpers live in
 * ./dates.ts.
 */

import type { ContractFieldKey } from "./fields";
import { APP_TIME_ZONE, todayInZone } from "./dates";

/** Where a document is in its life. Mirrors document_status in db/schema.sql. */
export type DocumentStatus =
  "processing" | "needs-review" | "confirmed" | "failed" | "archived";

/**
 * A task's state as the interface shows it.
 *
 * `completed` is stored, because it is the tick and the tick is the only thing a
 * person writes. `upcoming` and `overdue` are worked out from the due date and
 * the clock while the list is being drawn. Nothing writes "overdue" anywhere, so
 * nothing has to wake at midnight to write it and nothing can forget to unwrite
 * it.
 *
 * Overdue is told in words, not colour: the date column reads "was due Wed 5
 * Aug", set bolder. Red already means a failed reading in this product, and
 * colour is never the only signal (docs/theme.md). There is no badge and no
 * separate list either. Sorting by due date ascending puts every overdue task
 * above every upcoming one, so the pinning is the sort.
 *
 * deriveTaskStatus() at the foot of this file is the one place it is computed.
 */
export type TaskStatus = "upcoming" | "overdue" | "completed";

/**
 * What a person is told when a reading failed.
 *
 * One sentence, because there is one kind of failure left to tell anyone about.
 * The system does not decide that a photograph is too blurry, does not decide
 * that a page is not a letter, and never asks for a retake: docs/scope.md says
 * why none of that is in this release. The only failure a person can meet is
 * ours, so the sentence leads by saying so. This product's reader tends to
 * assume every error is her fault, and here it genuinely is not.
 *
 * Resolved here rather than in a component so every surface says it identically.
 * The `failure_detail` column is developer text and never leaves the server.
 */
export const FAILURE_MESSAGE =
  "It wasn't your photo. Something went wrong on our side. Please try again.";

/**
 * A failed reading, as a list row needs it.
 *
 * This lives on the summary rather than only on the detail because the home
 * screen draws the failed row itself. If it lived only on DocumentDetail,
 * drawing the home screen would cost one extra request per failed document,
 * which is exactly what GET /api/home exists to avoid.
 */
export type DocumentFailureView = {
  /** Written for the person, not for a developer. FAILURE_MESSAGE. */
  message: string;
};

/**
 * One document in a list.
 *
 * `issuer` and `documentType` are null until a reading has succeeded: a letter
 * still being read, or one that failed, has not told anyone who it is from. They
 * are filled in from confident values only, so a hedged value stays absent here
 * as it does everywhere else (see the note on confirming, below). Nobody edits
 * them.
 */
export type DocumentSummary = {
  id: string;
  issuer: string | null;
  documentType: string | null;
  /**
   * What to call this row, always present, resolved on the server.
   *
   * `${issuer} · ${documentType}` once the six fields have been read, and before
   * then a provisional label from the upload itself: when it arrived and how
   * many photographs it holds. A letter therefore has a name from the moment it
   * exists, so a list of letters being read is not a column of identical rows
   * saying "reading...".
   *
   * Resolved in one place for the same reason FIELD_LABELS is (./fields.ts): two
   * screens draw this row and they must not word it differently. See docs/api.md
   * on GET /api/documents.
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
 * One reminder: a day on which Home marks the task's row (./reminders.ts).
 *
 * `localDate` is the day in the person's zone, written by the server, so the
 * client compares it with today as a string and never turns an instant back
 * into a day.
 */
export type ReminderView = {
  id: string;
  /** The day Home marks the task, 'YYYY-MM-DD'. */
  localDate: string;
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
   * Every day planned for this task as a reminder, past ones included. Home
   * marks the row when one of them is today and the task is still open; see
   * reminderToday() in src/lib/home.ts. The calendar does not draw them.
   */
  reminders: ReminderView[];
};

/**
 * A task opened from the calendar's day sheet: the summary, the extracted fields
 * of the letter it came from, and enough to show the photographs. Served by
 * GET /api/tasks/:id.
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
  identifiers: IdentifierView[];
  /** How many photographs the letter has. */
  pageCount: number;
};

/**
 * KAN-58: one number the letter prints, as a screen shows it.
 *
 * Confident ones only, in the order the reading gave, with the one the letter
 * says to quote first. `isReference` marks that one: it is the value the
 * `reference` field carries, so a screen can say "The one to quote" under it
 * when there is more than one to choose from. A letter read before this list
 * existed has none, and a screen falls back to its Reference row.
 */
export type IdentifierView = {
  label: string;
  value: string;
  isReference: boolean;
};

/**
 * One row on the review screen.
 *
 * `label` is presentation, resolved from the field key on the server so that
 * every surface spells "Reference" the same way. See ./fields.ts.
 *
 * The browser never sees `uncertain`. What happens to a field that is not
 * confirmed is ruled in one place, ./extraction.ts, beside the statuses.
 *
 * `value` is null exactly when status is `unreadable`. An empty string would
 * mean "the model read an empty string", which is a different fact.
 */
export type ExtractedFieldView = {
  key: ContractFieldKey | string;
  label: string;
  value: string | null;
  status: "confirmed" | "unreadable";
};

export type DocumentDetail = DocumentSummary & {
  /**
   * Empty while status is 'processing' and for a document that has never been
   * read successfully. Otherwise the most recent successful reading, exactly as
   * it came back. There is nothing to overlay on it, because nobody edits a
   * reading.
   */
  fields: ExtractedFieldView[];
  /** Empty exactly when `fields` is, and for a reading that listed none. */
  identifiers: IdentifierView[];
  pages: DocumentPageView[];
};

export type DocumentPageView = {
  id: string;
  pageNumber: number;
  /**
   * Where to load the image from: `/api/documents/{id}/pages/{n}`, which checks
   * who is asking and then redirects to a link storage has signed. It is this
   * path rather than the signed link itself so that a payload sitting in a cache
   * cannot go stale.
   */
  url?: string;
};

/**
 * The limits an upload is held to, exported so the capture screen can hold the
 * person to the same ones.
 *
 * An upload is one letter. A letter may run to several pages, and every
 * photograph in one upload belongs to that one letter (docs/scope.md).
 *
 * Ten is not a claim about letters. It is the point past which an upload has
 * stopped being one letter in practice, and it bounds how much image goes into
 * a single model call. It is exported rather than checked only on the server so
 * the capture screen can stop the person at page ten, instead of accepting ten
 * deliberate photographs and rejecting the lot at the end.
 *
 * Size and type are the only other things checked before the reading, and they
 * are the only two things code can check without holding an opinion: is this an
 * image we can decode, and is it under the limit. Whether a photograph is sharp
 * enough, and whether a page is a letter at all, are judgements this release
 * does not make.
 */
export const MAX_PAGES = 10;
export const MAX_PAGE_BYTES = 10 * 1024 * 1024;

/**
 * What she is told when a letter has more pages than MAX_PAGES. The server
 * says it of photographs and the capture screen says it of a PDF too long to
 * add, and it is one sentence so the two cannot drift apart. (KAN-85)
 */
export const TOO_MANY_PAGES_MESSAGE = `Please send one letter at a time, up to ${MAX_PAGES} photos.`;

/*
 * There is deliberately no ConfirmDocumentRequest, and deliberately no endpoint
 * anywhere that corrects a reading.
 *
 * Confirming sends an empty body. The person looked, the person nodded, that is
 * the entire message. Nothing is edited, because nothing on the screen is
 * editable. Nothing is attested, because a value the model was unsure of never
 * reached the screen, so there is nothing on it to interrogate anyone about.
 *
 * The screen this replaced was an exam. A field the model was not sure of came
 * back flagged, drew an amber box, asked "This was hard to read. Is it right?",
 * offered a text input, and refused to confirm until the person had either
 * edited the value or acknowledged it.
 *
 * It interrogated the wrong party. When the model is unsure, the honest answers
 * available to this product's reader are "go and find the paper letter again"
 * or "guess". The product exists so that the paper can leave her life, and the
 * exam quietly reinstated the paper as the reference she was expected to
 * consult. She is also the person least equipped to adjudicate a model's
 * hesitation, which is the reason the product exists at all. And recognition is
 * easy where entry is hard: reading a card and nodding is a different kind of
 * work from typing a date into a box on a phone. The exam demanded the hard
 * kind, at the worst moment, about the values least likely to be right.
 *
 * So the screen shows and it never asks. Rows the model read confidently are
 * displayed, read-only. A row with no value is not drawn at all, because an
 * empty box invites an answer nobody is asking for. A date or an amount the
 * model was not sure of never reaches this screen as an empty row: the reading
 * fails instead (./extraction.ts).
 *
 * What this buys is one invariant, and it is worth more than the exam was: a
 * date reaches the calendar from exactly two places, a confident read that a
 * person has seen, or nowhere. That is a missing path rather than a checkpoint,
 * so no procedure has to guard it and no later change can forget to. It is also
 * the test for any proposal that sounds reasonable here, an edit box "just for
 * the date", a "confirm you checked this" toggle, a transcription snippet shown
 * "just as a hint": after it ships, are the calendar's sources still exactly
 * two?
 *
 * What it costs, named honestly. Corrections were going to be the in-product
 * accuracy signal, the value a person typed against the value the model read;
 * with editing gone that signal is gone, and accuracy now rests entirely on the
 * synthetic evaluation line, where ground truth is known by construction. And
 * this release has no correction path at all: joining a later upload to a letter
 * already in the system is not in it (docs/scope.md), so photographing a letter
 * again makes a second letter rather than mending the first.
 *
 * A letter with a clear action and no clear date still becomes a task. It sits
 * in the list saying "No date", never reminds, never touches the calendar, and
 * stays until it is ticked. The list itself is the reminder.
 */

/**
 * KAN-59: what POST /api/documents/:id/confirm answers.
 *
 * `task` is null when the letter asks for nothing (`action_required` is
 * NO_ACTION in ./fields.ts): the letter is kept in Your letters and no task is
 * made, because a task titled "No action" is noise on a list whose whole job is
 * saying what to do. Otherwise it is the task the letter became, with every
 * reminder planned for it, so the screens she lands on can draw it without
 * asking again.
 */
export type ConfirmDocumentResponse = {
  documentId: string;
  task: TaskSummary | null;
};

/** What the home screen needs, in one request. */
export type HomeCounts = {
  needsReview: number;
  processing: number;
  failed: number;
};

/**
 * GET /api/home. One request rather than three, so the counts and the lists
 * cannot disagree with each other on screen.
 *
 * `inbox` is every document not yet dealt with: status 'processing',
 * 'needs-review' or 'failed', in one merged list, first photographed first. The
 * prototype renders these interleaved in a single card, so the server sends them
 * as the one list they are rather than as three the client has to weave.
 *
 * KAN-59: oldest on top because that is the order the pile was photographed
 * in, and checking starts from the top: the letter she photographed first is
 * the first she is asked to look at, and one photographed while she is
 * checking joins the end of the queue rather than jumping ahead of it.
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

/**
 * The signed-in person.
 *
 * `role` mirrors user_role in db/schema.sql. The operator roles stay in the
 * schema and this release builds no surface for them; docs/scope.md says why
 * that absence is deliberate rather than an oversight.
 */
export type SessionUser = {
  id: string;
  email: string;
  displayName: string;
  role: "user" | "platform_operator" | "org_admin" | "org_worker";
  /** IANA zone name, defaulted server-side. Her "today" is today here. */
  timeZone: string;
};

/**
 * Derive the status the interface shows for a task.
 *
 * Kept here, beside the type it produces, so the front end and the back end
 * cannot disagree about when something is overdue.
 *
 * The comparison happens on calendar days in the person's zone, as strings.
 * Comparing instants against a UTC end of day looks equivalent and is not: it
 * keeps a Melbourne task "upcoming" until ten the next morning. See ./dates.ts.
 */
/**
 * The title a confirmed letter's task gets.
 *
 * `action_required` starts with an action word and usually names who already
 * ("Pay Telstra", "Return form to Services Australia"), so the issuer is added
 * in brackets only when the action does not already contain it: "Attend GP
 * appointment (Dr A. Patel, GP clinic)". Either half can be missing and
 * `tasks.title` is NOT NULL, so it falls back to the action alone, then
 * "Letter from issuer", then the document type, then "Letter". Nobody meets a
 * task called "()".
 *
 * The seed and the confirm handler both call this; a second copy of the rule
 * is how two screens end up naming one task differently. The list row splits
 * the bracket back off (taskHeadline in src/components/task-row.tsx).
 */
export function taskTitle(parts: {
  action: string | null;
  issuer: string | null;
  documentType: string | null;
}): string {
  const action = parts.action?.trim() || null;
  const issuer = parts.issuer?.trim() || null;
  if (action && issuer) {
    return action.toLowerCase().includes(issuer.toLowerCase())
      ? action
      : `${action} (${issuer})`;
  }
  if (action) return action;
  if (issuer) return `Letter from ${issuer}`;
  return parts.documentType?.trim() || "Letter";
}

export function deriveTaskStatus(
  state: "open" | "completed" | "dismissed",
  dueDate: string | null,
  now: Date = new Date(),
  timeZone: string = APP_TIME_ZONE,
): TaskStatus {
  if (state === "completed") return "completed";
  if (!dueDate) return "upcoming";
  // Something due today is not overdue until today, in the person's zone, is over.
  return dueDate < todayInZone(timeZone, now) ? "overdue" : "upcoming";
}

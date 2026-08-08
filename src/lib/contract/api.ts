/**
 * What the browser sees.
 *
 * These types are deliberately identical in shape to the ones the interface was
 * already written against (src/lib/mock-data.ts), down to `rawText` being
 * camelCase and `status` using hyphens. The user interface is three thousand
 * lines old and correct; the backend arrived second and adapts to it, not the
 * other way around.
 *
 * The translation from the provider's snake_case contract into this shape
 * happens in exactly one place, src/server/extraction, so there is only ever one
 * file to look at when a name does not line up.
 */

import type { FieldStatus } from './extraction';
import type { ContractFieldKey } from './fields';

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

export type DocumentSummary = {
  id: string;
  issuer: string;
  documentType: string;
  status: DocumentStatus;
  dueDate?: string;
  amount?: string;
  reference?: string;
  uploadedAt: string;
  pageCount: number;
};

export type TaskSummary = {
  id: string;
  title: string;
  documentId?: string;
  issuer: string;
  dueDate: string;
  status: TaskStatus;
};

/**
 * One row on the review screen.
 *
 * `label` is presentation, resolved from the field key on the server so that
 * every surface spells "Reference number" the same way.
 */
export type ExtractedFieldView = {
  key: ContractFieldKey | string;
  label: string;
  value: string;
  rawText: string;
  status: FieldStatus;
};

export type DocumentDetail = DocumentSummary & {
  fields: ExtractedFieldView[];
  pages: DocumentPageView[];
  /** Why the last extraction failed, when status is 'failed'. */
  failure?: {
    kind: 'transient' | 'unreadable_image' | 'unsupported_document';
    /** Written for the person, not for a developer. */
    message: string;
    /** Whether offering "retake the photo" makes sense for this failure. */
    canRetake: boolean;
  };
};

export type DocumentPageView = {
  id: string;
  pageNumber: number;
  /** Time-limited URL for the image. Absent until storage is wired up. */
  url?: string;
};

/** What the review screen sends back when a person accepts a document. */
export type ConfirmDocumentRequest = {
  fields: Array<{ key: string; value: string }>;
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
};

/**
 * Derive the status the interface shows for a task.
 *
 * Kept here, beside the type it produces, so the front end and the back end
 * cannot disagree about when something is overdue.
 */
export function deriveTaskStatus(
  state: 'open' | 'completed' | 'dismissed',
  dueDate: string | null,
  now: Date = new Date(),
): TaskStatus {
  if (state === 'completed') return 'completed';
  if (!dueDate) return 'upcoming';
  // Compare whole days: something due today is not overdue until today is over.
  const due = new Date(`${dueDate}T23:59:59.999Z`);
  return due.getTime() < now.getTime() ? 'overdue' : 'upcoming';
}

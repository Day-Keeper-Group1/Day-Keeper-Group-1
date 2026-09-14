// KAN-56: reading letters back out of the database, for the letters area and for the home screen.

/**
 * Document reads shared by the letter endpoints and the home screen.
 *
 * A letter's row is written twice and never by a person: once when the
 * photographs are stored, and once when the reading comes back
 * (src/server/uploads.ts). Everything here is the other direction, and it is
 * only presentation: what to call a letter before anyone knows who sent it,
 * which of its fields a screen may show, and where its photographs are.
 *
 * Every query is scoped by user id. Knowing a letter's id must never be enough
 * to read it, which is also why a letter belonging to somebody else comes back
 * as null here and as a 404 there: a 403 would confirm that a letter with that
 * id exists.
 */

import "server-only";

import {
  FAILURE_MESSAGE,
  type DocumentDetail,
  type DocumentPageView,
  type DocumentStatus,
  type DocumentSummary,
  type ExtractedFieldView,
  type HomeCounts,
  type HomePayload,
} from "@/lib/contract/api";
import { formatDueDate, formatDueTime } from "@/lib/contract/dates";
import {
  CONTRACT_FIELD_KEYS,
  KNOWN_FIELD_KEYS,
  OPTIONAL_FIELD_KEYS,
} from "@/lib/contract/fields";
import { query, queryOne } from "@/server/db";
import {
  identifierViews,
  mapField,
  type ExtractedFieldRow,
  type ExtractedIdentifierRow,
} from "@/server/field-views";
import { listTasks } from "@/server/tasks";

/**
 * One document row, as every query below selects it. `uploaded_at` is an
 * instant and arrives as a Date; `due_date` arrives as 'YYYY-MM-DD' because
 * src/server/db.ts stops the driver turning a date column into a shifted Date.
 */
type DocumentRow = {
  id: string;
  issuer: string | null;
  document_type: string | null;
  status: DocumentStatus;
  due_date: string | null;
  due_time: string | null;
  amount_text: string | null;
  reference: string | null;
  uploaded_at: Date;
  page_count: number;
};

/**
 * The shape of an id these tables will accept.
 *
 * `documents.id` is a uuid column, so an address carrying anything else reaches
 * Postgres as "invalid input syntax for type uuid", which is an error rather
 * than an answer: the endpoint would say 500 where docs/api.md says 404, and a
 * mistyped /documents/... would render the error page instead of the not found
 * page. A letter nobody owns is absent however the address was arrived at, so
 * the shape is checked before the query rather than discovered after it.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * How long a ticked off task stays on the home screen. Long enough that a row
 * does not vanish from under the finger that just ticked it, short enough that
 * a card headed "Coming up" does not become twenty struck through rows from
 * last March.
 */
const COMPLETED_TASK_WINDOW_DAYS = 7;

/**
 * The calendar day and the wall clock an upload happened at, in the person's
 * zone.
 *
 * Formatting rather than arithmetic: Intl is asked what clock this instant
 * shows over there, which is the same thing todayInZone() does in
 * src/lib/contract/dates.ts. It happens here rather than in SQL because
 * src/server/uploads.ts forms the same label for a letter it has just
 * inserted, and a second way of reaching these two strings is a second way for
 * them to disagree.
 */
function uploadLocalParts(
  uploadedAt: string,
  timeZone: string,
): { day: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(uploadedAt));
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    day: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
  };
}

/**
 * What to call a letter, resolved on the server so that no two screens word it
 * differently.
 *
 * Once a reading has succeeded a letter is called what it is: who it is from
 * and what kind of thing it is. Before then it is called after the only facts
 * that exist, which are when it was photographed and how many photographs it
 * holds. That is what keeps a list of letters still being read from being a
 * column of identical rows saying "reading...", and it is why this is a label
 * rather than a placeholder: the provisional name is true when it is written,
 * and it was still true after the real one replaced it.
 */
export function documentLabel(input: {
  issuer: string | null;
  documentType: string | null;
  uploadedAt: string;
  pageCount: number;
  timeZone: string;
}): string {
  if (input.issuer && input.documentType) {
    return `${input.issuer} · ${input.documentType}`;
  }

  const { day, time } = uploadLocalParts(input.uploadedAt, input.timeZone);
  const pages = `${input.pageCount} page${input.pageCount === 1 ? "" : "s"}`;
  return `Photographed ${formatDueDate(day, "short")} at ${formatDueTime(time)}, ${pages}`;
}

/**
 * One row as a list needs it.
 *
 * The optional keys are omitted rather than sent as null, because the contract
 * declares them optional and a row carrying `dueDate: null` makes every caller
 * test two things. `failure` is present exactly when the status is 'failed',
 * and its sentence is worded once in src/lib/contract/api.ts so that every
 * surface says it identically.
 */
function mapDocument(row: DocumentRow, timeZone: string): DocumentSummary {
  const uploadedAt = row.uploaded_at.toISOString();

  return {
    id: row.id,
    issuer: row.issuer,
    documentType: row.document_type,
    label: documentLabel({
      issuer: row.issuer,
      documentType: row.document_type,
      uploadedAt,
      pageCount: row.page_count,
      timeZone,
    }),
    status: row.status,
    ...(row.due_date && { dueDate: row.due_date }),
    ...(row.due_time && { dueTime: row.due_time }),
    ...(row.amount_text && { amount: row.amount_text }),
    ...(row.reference && { reference: row.reference }),
    uploadedAt,
    pageCount: row.page_count,
    ...(row.status === "failed" && { failure: { message: FAILURE_MESSAGE } }),
  };
}

/**
 * The reading, as the review screen shows it.
 *
 * All six contract fields are always here, in the order
 * src/lib/contract/fields.ts gives, whatever a screen chooses to draw: a field
 * the reader could not read says so rather than going missing, and a row that
 * is absent from storage would be a third answer nothing downstream could tell
 * from the other two. Optional and unrecognised keys follow, because six is a
 * floor and a reader that returned more is not punished for being richer.
 */
function fieldViews(rows: ExtractedFieldRow[]): ExtractedFieldView[] {
  if (rows.length === 0) return [];

  const byKey = new Map(rows.map((row) => [row.field_key, row]));
  const contract = CONTRACT_FIELD_KEYS.map((key) =>
    mapField(
      byKey.get(key) ?? {
        field_key: key,
        extracted_value: null,
        status: "unreadable",
      },
    ),
  );
  const optional = OPTIONAL_FIELD_KEYS.flatMap((key) => {
    const row = byKey.get(key);
    return row ? [mapField(row)] : [];
  });
  const extra = rows
    .filter(
      (row) => !(KNOWN_FIELD_KEYS as readonly string[]).includes(row.field_key),
    )
    .map((row) => mapField(row));

  return [...contract, ...optional, ...extra];
}

/**
 * Every letter this person has, newest upload first.
 *
 * Every status, including letters that failed and letters that never became a
 * task because the reading found nothing to do. This list is the door to the
 * photographs, so nothing is filtered out of it. docs/api.md, "List letters".
 */
export async function listDocuments(
  userId: string,
  timeZone: string,
): Promise<DocumentSummary[]> {
  const rows = await query<DocumentRow>(
    `SELECT d.id,
            d.issuer,
            d.document_type,
            d.status,
            d.due_date,
            CASE WHEN d.due_time IS NULL
                 THEN NULL
                 ELSE to_char(d.due_time, 'HH24:MI')
            END AS due_time,
            d.amount_text,
            d.reference,
            d.uploaded_at,
            (SELECT count(*)::integer
               FROM document_pages p
              WHERE p.document_id = d.id) AS page_count
       FROM documents d
      WHERE d.user_id = $1
      ORDER BY d.uploaded_at DESC, d.id DESC`,
    [userId],
  );

  return rows.map((row) => mapDocument(row, timeZone));
}

/**
 * One owned letter, with its reading and its photographs.
 *
 * Null when there is no such letter and null when it belongs to somebody else,
 * so that the handler cannot tell the two apart either.
 * docs/api.md, "One letter, in full".
 */
export async function getDocument(
  documentId: string,
  userId: string,
  timeZone: string,
): Promise<DocumentDetail | null> {
  if (!UUID.test(documentId)) return null;

  const row = await queryOne<DocumentRow>(
    `SELECT d.id,
            d.issuer,
            d.document_type,
            d.status,
            d.due_date,
            CASE WHEN d.due_time IS NULL
                 THEN NULL
                 ELSE to_char(d.due_time, 'HH24:MI')
            END AS due_time,
            d.amount_text,
            d.reference,
            d.uploaded_at,
            (SELECT count(*)::integer
               FROM document_pages p
              WHERE p.document_id = d.id) AS page_count
       FROM documents d
      WHERE d.id = $1
        AND d.user_id = $2`,
    [documentId, userId],
  );
  if (!row) return null;

  const [fields, identifiers, pages] = await Promise.all([
    query<ExtractedFieldRow>(
      `SELECT f.field_key, f.extracted_value, f.status
         FROM documents d
         JOIN extraction_runs e ON e.document_id = d.id
         JOIN extracted_fields f ON f.extraction_run_id = e.id
        WHERE d.id = $1
          AND d.user_id = $2
          AND e.status = 'succeeded'
        ORDER BY f.field_key`,
      [documentId, userId],
    ),
    query<ExtractedIdentifierRow>(
      `SELECT i.label, i.value, i.status
         FROM documents d
         JOIN extraction_runs e ON e.document_id = d.id
         JOIN extracted_identifiers i ON i.extraction_run_id = e.id
        WHERE d.id = $1
          AND d.user_id = $2
          AND e.status = 'succeeded'
        ORDER BY i.position`,
      [documentId, userId],
    ),
    query<{ id: string; page_number: number }>(
      `SELECT p.id, p.page_number
         FROM document_pages p
         JOIN documents d ON d.id = p.document_id
        WHERE p.document_id = $1
          AND d.user_id = $2
        ORDER BY p.page_number ASC`,
      [documentId, userId],
    ),
  ]);

  const views = row.status === "processing" ? [] : fieldViews(fields);

  return {
    ...mapDocument(row, timeZone),
    // Empty while the letter is still being read, and empty for a letter no
    // reading ever succeeded for. The second case falls out of the query, which
    // finds nothing; the first is stated here as a rule rather than left to be
    // inferred from a run that has not finished yet.
    fields: views,
    identifiers: views.length === 0 ? [] : identifierViews(identifiers, views),
    pages: pages.map((page): DocumentPageView => ({
      id: page.id,
      pageNumber: page.page_number,
      // The path rather than a link storage has signed, so that a payload
      // sitting in a cache cannot go stale. Who is asking is checked when the
      // path is followed.
      url: `/api/documents/${documentId}/pages/${page.page_number}`,
    })),
  };
}

/**
 * Where one photograph of one owned letter is kept.
 *
 * Null for a page that does not exist and null for a letter belonging to
 * somebody else. This is the ownership check that stands between a person and
 * everyone else's post: the link storage signs afterwards expires, but it never
 * asks who is holding it. docs/api.md, "A page image".
 */
export async function getPageStoragePath(
  documentId: string,
  pageNumber: number,
  userId: string,
): Promise<string | null> {
  if (!UUID.test(documentId)) return null;

  const row = await queryOne<{ storage_path: string }>(
    `SELECT p.storage_path
       FROM document_pages p
       JOIN documents d ON d.id = p.document_id
      WHERE p.document_id = $1
        AND p.page_number = $2
        AND d.user_id = $3`,
    [documentId, pageNumber, userId],
  );

  return row?.storage_path ?? null;
}

/**
 * Everything the home screen draws, in one request.
 *
 * One request rather than three, so the counts and the lists cannot disagree
 * with each other on screen: the counts are counted from the very rows the
 * inbox is drawn from rather than asked for separately.
 *
 * It is also the poll. While anything of this person's is still being read the
 * interface asks again every five seconds and stops when `counts.processing`
 * reaches zero. docs/api.md, "Everything the home screen needs".
 */
export async function getHome(
  userId: string,
  timeZone: string,
  now: Date = new Date(),
): Promise<HomePayload> {
  const [inboxRows, allTasks, recentlyCompleted] = await Promise.all([
    // Every letter not yet dealt with, in one merged list, newest upload first
    // and uncapped. The prototype draws these interleaved in a single card, so
    // they travel as the one list they are rather than as three the client has
    // to weave.
    query<DocumentRow>(
      `SELECT d.id,
              d.issuer,
              d.document_type,
              d.status,
              d.due_date,
              CASE WHEN d.due_time IS NULL
                   THEN NULL
                   ELSE to_char(d.due_time, 'HH24:MI')
              END AS due_time,
              d.amount_text,
              d.reference,
              d.uploaded_at,
              (SELECT count(*)::integer
                 FROM document_pages p
                WHERE p.document_id = d.id) AS page_count
         FROM documents d
        WHERE d.user_id = $1
          AND d.status IN ('processing', 'needs-review', 'failed')
        ORDER BY d.uploaded_at DESC, d.id DESC`,
      [userId],
    ),
    listTasks(userId, timeZone, now),
    // Which ticks are recent enough to still be shown. The window is asked for
    // here rather than read off a task summary, because a summary carries the
    // tick and not the moment of it.
    query<{ id: string }>(
      `SELECT t.id
         FROM tasks t
        WHERE t.user_id = $1
          AND t.state = 'completed'
          AND t.completed_at >= $2::timestamptz - ($3::integer * interval '1 day')`,
      [userId, now.toISOString(), COMPLETED_TASK_WINDOW_DAYS],
    ),
  ]);

  const inbox = inboxRows.map((row) => mapDocument(row, timeZone));
  const counts: HomeCounts = {
    needsReview: inbox.filter((row) => row.status === "needs-review").length,
    processing: inbox.filter((row) => row.status === "processing").length,
    failed: inbox.filter((row) => row.status === "failed").length,
  };

  // Every open task whatever its date, because an unpaid bill from three weeks
  // ago is the loudest thing this person owns and the ascending sort already
  // puts it first. Completed rows are the only ones that age out. Nothing is
  // cut here: a cap dropped the furthest tasks without a word. Home folds the
  // far end instead and says how many it folded (src/lib/home.ts).
  const recent = new Set(recentlyCompleted.map((row) => row.id));
  const tasks = allTasks.filter(
    (task) => task.status !== "completed" || recent.has(task.id),
  );

  return { counts, inbox, tasks };
}

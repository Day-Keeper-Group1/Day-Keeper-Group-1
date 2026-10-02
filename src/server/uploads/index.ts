// KAN-56: photographs of a letter arriving, and the reading that follows them.
/**
 * Uploading a letter, and reading it.
 *
 * Four steps in a fixed order, and the order is the point. The photographs are
 * judged, then stored in the bucket, then recorded as rows, and only then does
 * a model look at them. The person is answered the moment the rows are written
 * (docs/api.md, "Upload a letter"), because a reading takes about ten seconds
 * and the interface polls rather than making anyone watch a spinner.
 *
 * Every transition is written down as it happens, so that a letter interrupted
 * at any point leaves a database that describes what became of it: what each
 * status of a round says is written beside runStatus in
 * src/server/db/schema/enums.ts. A letter stuck on 'processing' forever is the
 * same fact told as a lie, which is the reason that file has a 'failed' status
 * at all.
 *
 * The two audiences are kept apart on purpose. `failure_detail` is written for
 * whoever reads the table later and never leaves the server; the sentence a
 * person meets is FAILURE_MESSAGE, worded once in src/lib/contract/api.ts so
 * that every surface says it identically.
 *
 * KAN-92: the steps are in the three files beside this one. This file only
 * hands their names on, so everything outside the folder keeps importing from
 * "@/server/uploads".
 *
 *   - ./intake.ts: a letter arriving. Steps one to three: the photographs are
 *     judged, stored, and recorded as rows.
 *   - ./reading.ts: a letter being read. Step four: one round per call, and
 *     how each round ends.
 *   - ./reading-columns.ts: which values of a reading reach the letter's own
 *     columns. Pure.
 *
 * Server-only. This module holds letter bytes and storage keys, neither of
 * which has any business in a browser bundle.
 */

import "server-only";

export {
  UploadRejected,
  checkStoredUpload,
  createDocument,
  createStoredDocument,
  planUpload,
  validateUpload,
  type StoredPage,
  type UploadedPage,
} from "./intake";
export {
  MAX_READING_ATTEMPTS,
  ROUND_DEADLINE_SECONDS,
  continueReadings,
  readDocument,
  readStoredDocument,
} from "./reading";
export { columnsFromReading } from "./reading-columns";

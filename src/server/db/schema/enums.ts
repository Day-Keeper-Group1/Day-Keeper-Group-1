// KAN-92: the five enum types of the database, and what each value means.

/**
 * Enumerated vocabularies
 *
 * These values are the ones the interface already speaks, so a status travels
 * from a table to the screen without being translated on the way: hence
 * 'needs-review' rather than 'needs_review'. Field keys stay snake_case,
 * because that is what the extraction contract calls them.
 *
 * The lists themselves are the arrays in src/lib/contract/enums.ts, which the
 * browser-facing types and the validators are derived from too. Add a value
 * there and it is legal everywhere at once; invent one anywhere else and
 * Postgres rejects it.
 *
 * Script-safe, for the reason ./index.ts gives.
 */

import { sql, type SQL } from "drizzle-orm";
import { pgEnum } from "drizzle-orm/pg-core";
import {
  DOCUMENT_STATUSES,
  FIELD_STATUSES,
  RUN_STATUSES,
  TASK_STATES,
  USER_ROLES,
} from "@/lib/contract/enums";

/**
 * Who someone is. Two kinds of account sign in this release, a person and a
 * platform operator. There is no operator dashboard in it (docs/scope.md); the
 * role stays because who someone is outlives what has been built for them, and
 * an account created without one would have to be given one retrospectively by
 * guesswork. The organisation roles are named because the project description
 * anticipates institutional customers, so the vocabulary is settled once here
 * rather than invented twice later.
 */
export const userRole = pgEnum("user_role", USER_ROLES);

/**
 * Where a letter is in its life.
 *   processing    the photographs are stored, the reading has not come back
 *   needs-review  the reading came back, the person has not confirmed it yet
 *   confirmed     the person looked at what was read and accepted it
 *   failed        no reading could be produced at all
 *   archived      the person put it away; it stays readable
 *
 * 'failed' is here because a model call can fail for ordinary technical
 * reasons, and a row has to be able to say so: a letter left on 'processing'
 * forever is the same fact told as a lie. Nothing in this release offers a way
 * back out of it, which is a scope decision rather than an oversight; see
 * docs/scope.md.
 */
export const documentStatus = pgEnum("document_status", DOCUMENT_STATUSES);

/**
 * How much the reading trusts one field. What each value means, and why a value
 * the model was unsure of is stored and never shown, is in
 * src/lib/contract/extraction.ts.
 */
export const fieldStatus = pgEnum("field_status", FIELD_STATUSES);

/**
 * Where one round of a reading got to. A round is one extraction_runs row
 * (./readings.ts).
 *   queued      written down, and none of its calls has started
 *   processing  a request took it and is making its calls; each attempt at
 *               one is written as a model_calls row when it ends, and the
 *               round itself is not closed yet
 *   succeeded   it decided the reading, and its fields are the letter's
 *   failed      it was closed with no reading: a call failed, its readings
 *               differed, the host stopped it, the reading it decided was
 *               unsure of the due date or the amount, or the database refused
 *               that reading; failure_detail carries the developer's sentence
 *               about why
 *
 * Each status is written as the round reaches it, so a round whose request
 * was interrupted says how far it got: left on 'queued' its calls never
 * started, left on 'processing' it was taken and never closed, and the
 * model_calls rows under it are the attempts that ended before it stopped.
 */
export const runStatus = pgEnum("run_status", RUN_STATUSES);

/**
 * A task's life. 'upcoming' and 'overdue' are not values here, and there is no
 * column for them anywhere: a task becomes overdue because time passed, and
 * nothing in this system wakes at midnight to write that down. Both are worked
 * out while a screen is drawn, from the tick and today's date in the person's
 * zone. A stored flag would need a clock to keep it honest, and a stale flag
 * raises no error, it simply reads wrong.
 *
 * 'dismissed' is written by nothing in this release. Ticking is the only thing
 * that completes a task.
 */
export const taskState = pgEnum("task_state", TASK_STATES);

/**
 * 'a', 'b' for the body of a CHECK ... IN (...), from the same array the
 * TypeScript union comes from. Used where a column is text with a CHECK rather
 * than an enum type.
 *
 * The only `sql.raw` in the project. It is safe here because the values are
 * constants written in code, never anything a person typed.
 */
export function quotedList(values: readonly string[]): SQL {
  return sql.raw(values.map((value) => `'${value}'`).join(", "));
}

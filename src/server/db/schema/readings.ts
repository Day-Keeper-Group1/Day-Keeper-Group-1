// KAN-92: the rounds, model calls, fields and numbers of a reading, as tables.

/**
 * Extraction
 *
 * A letter's photographs are read under the scheme in docs/extraction.md and
 * come back as the six fields (src/lib/contract/fields.ts). The reading is
 * recorded whether it worked or not. Keeping the failures is what makes an
 * accuracy figure honest: a table holding only the readings that worked can be
 * quoted to say anything.
 *
 * KAN-63: one extraction_runs row per round of the scheme. A round is two
 * reader calls, and a judge call when they differ; each of those calls, and
 * each attempt at one, is a model_calls row under the round. A round whose
 * readings cannot be decided is closed as failed and the next round is a new
 * row, so the table says how many rounds a letter took and why each one ended.
 * The API reads a round only to find the one that succeeded; everything else
 * on it is the record of what happened, for whoever has to find out. There is
 * still no retake by the person (docs/scope.md).
 *
 * The totals on a round (judged, tokens, cost, duration) are written when the
 * round closes, from its model_calls rows, so the grid answers "what did this
 * round take" without a query. document_reading_totals, below model_calls,
 * adds the rounds of a letter up.
 *
 * One reading per letter all the same. The two unique indexes at the foot of
 * extraction_runs are not bookkeeping: at most one run per letter ever
 * succeeds, which is what makes a second answer to the same question arrive as
 * an error rather than as two sets of fields with nothing to say which one the
 * tables were written from; and at most one is under way at a time, so two
 * readers can never be racing over the same photographs. Every query that
 * reads a reading asks for the succeeded run and nothing else.
 *
 * Script-safe, for the reason ./index.ts gives.
 */

import { eq, sql } from "drizzle-orm";
import {
  alias,
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  pgView,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import {
  IDENTIFIER_STATUSES,
  MODEL_CALL_ROLES,
  MODEL_CALL_STATUSES,
} from "@/lib/contract/enums";
import { documents } from "./documents";
import { fieldStatus, quotedList, runStatus } from "./enums";

export const extractionRuns = pgTable(
  "extraction_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id").notNull(),
    status: runStatus("status").notNull().default("queued"),
    // Which implementation of the reader ran.
    provider: text("provider").notNull(),
    // The reader's exact model id, so a figure can name what produced it. Only
    // the reader's: whether a judge was called, and with which model, is
    // `judged` and the round's model_calls rows.
    model: text("model"),
    // The shape the payload was written in (CONTRACT_VERSION in
    // src/lib/contract/extraction.ts). Stored per run rather than assumed,
    // because the contract will change, and a stored payload read back weeks
    // later has to be able to say which rules it was written under.
    contractVersion: text("contract_version"),
    failureDetail: text("failure_detail"),
    // KAN-63: the reading the round decided, as one document: the fields each
    // taken from the readings that agreed, the numbers of both readings put
    // together. Not any one call's answer; each call's own answer is its
    // model_calls row. Null for a round that decided nothing.
    rawResponse: jsonb("raw_response"),
    // KAN-63: whether this round called the judge, because its two readings
    // differed.
    judged: boolean("judged").notNull().default(false),
    // KAN-63: every call of the round added up, failed attempts included when
    // the model reported what they used. Output includes reasoning, as Azure
    // reports it. Null when no call reported any (the mock).
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    // KAN-63: those calls at list price, in US dollars
    // (src/server/extraction/prices.ts). An estimate, not an invoice.
    estimatedCostUsd: numeric("estimated_cost_usd", {
      precision: 12,
      scale: 8,
      mode: "number",
    }),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    // KAN-63: how long the round took by the clock, from its start to the
    // moment it closed: both reader calls, the judge, every attempt and every
    // pause between attempts.
    durationMs: integer("duration_ms"),
  },
  (t) => [
    foreignKey({
      name: "extraction_runs_document_id_fkey",
      columns: [t.documentId],
      foreignColumns: [documents.id],
    }).onDelete("cascade"),
    // A failure that does not say anything is a row nobody can act on, and a
    // detail on a run that succeeded is a contradiction. Both directions are
    // worth refusing.
    check(
      "extraction_runs_failed_has_detail",
      sql`(${t.status} = 'failed') = (${t.failureDetail} IS NOT NULL)`,
    ),
    index("extraction_runs_status_idx")
      .on(t.status)
      .where(sql`${t.status} IN ('queued', 'processing')`),
    uniqueIndex("extraction_runs_one_success_per_document")
      .on(t.documentId)
      .where(sql`${t.status} = 'succeeded'`),
    uniqueIndex("extraction_runs_one_under_way_per_document")
      .on(t.documentId)
      .where(sql`${t.status} IN ('queued', 'processing')`),
  ],
);

/**
 * KAN-63: every model call a reading made.
 *
 * A letter is read under the scheme in docs/extraction.md: two reader calls a
 * round, a judge call when they differ, and a failed call made again. The
 * extraction_runs row is the round and carries the decided reading; these rows
 * are the calls under it, one per attempt, so the table says how many calls a
 * letter took, with which model, what each one answered and what it cost.
 * slot tells the two reader calls of a round apart.
 *
 * Tokens are as Azure reported them: cached_tokens is the part of
 * input_tokens served from its cache, and output_tokens includes
 * reasoning_tokens. A call that failed after the model answered (not JSON, or
 * outside the contract) was still billed, so its answer, duration, tokens and
 * cost are kept too; one that never reached the model has none of them.
 */
export const modelCalls = pgTable(
  "model_calls",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    extractionRunId: uuid("extraction_run_id").notNull(),
    // Text with a CHECK, not an enum type. The list is MODEL_CALL_ROLES in
    // src/lib/contract/enums.ts, and the CHECK below is built from the same
    // array; `status` works the same way with MODEL_CALL_STATUSES.
    role: text("role", { enum: MODEL_CALL_ROLES }).notNull(),
    slot: integer("slot").notNull(),
    attempt: integer("attempt").notNull(),
    status: text("status", { enum: MODEL_CALL_STATUSES }).notNull(),
    model: text("model"),
    effort: text("effort"),
    // What the model answered. For a call that succeeded, the reading as the
    // contract validator passed it. For a call whose answer was refused, the
    // answer as it came: the JSON when it was JSON outside the contract (the
    // failure_detail names where), the text as a JSON string when it was not
    // JSON. Null only for a call that never reached the model.
    rawResponse: jsonb("raw_response"),
    failureDetail: text("failure_detail"),
    inputTokens: integer("input_tokens"),
    cachedTokens: integer("cached_tokens"),
    reasoningTokens: integer("reasoning_tokens"),
    outputTokens: integer("output_tokens"),
    // At list price, in US dollars (src/server/extraction/prices.ts).
    estimatedCostUsd: numeric("estimated_cost_usd", {
      precision: 12,
      scale: 8,
      mode: "number",
    }),
    durationMs: integer("duration_ms"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    foreignKey({
      name: "model_calls_extraction_run_id_fkey",
      columns: [t.extractionRunId],
      foreignColumns: [extractionRuns.id],
    }).onDelete("cascade"),
    check(
      "model_calls_role",
      sql`${t.role} IN (${quotedList(MODEL_CALL_ROLES)})`,
    ),
    check(
      "model_calls_status",
      sql`${t.status} IN (${quotedList(MODEL_CALL_STATUSES)})`,
    ),
    check(
      "model_calls_failed_has_detail",
      sql`(${t.status} = 'failed') = (${t.failureDetail} IS NOT NULL)`,
    ),
    index("model_calls_run_idx").on(t.extractionRunId),
  ],
);

// The view reads the two tables under the short names d and r. PostgreSQL
// stores a view's definition with the aliases it was created with, so the
// names are part of the definition: renaming them is a migration.
const d = alias(documents, "d");
const r = alias(extractionRuns, "r");

/**
 * KAN-63: what reading each letter took, every round added up, one row a
 * letter.
 *
 * A view rather than columns on documents, for two reasons. It is worked out
 * from the rounds each time it is read, so it cannot disagree with them, and
 * no code has to remember to keep it up to date on every way a reading can
 * end. And documents is what the API and the screens read; these figures are
 * for whoever is looking into what a reading cost, and live beside the tables
 * they come from rather than among the columns a person is shown.
 *
 * duration_ms runs from the first round's start to the last round's close.
 * A letter still being read has no close yet, so its duration is null.
 */
export const documentReadingTotals = pgView("document_reading_totals").as(
  (qb) =>
    qb
      .select({
        documentId: sql<string>`${d.id}`.as("document_id"),
        issuer: d.issuer,
        status: d.status,
        uploadedAt: d.uploadedAt,
        rounds: sql<number>`count(${r.id})::integer`.as("rounds"),
        judgedRounds:
          sql<number>`(count(*) FILTER (WHERE ${r.judged}))::integer`.as(
            "judged_rounds",
          ),
        inputTokens: sql<number | null>`sum(${r.inputTokens})::integer`.as(
          "input_tokens",
        ),
        outputTokens: sql<number | null>`sum(${r.outputTokens})::integer`.as(
          "output_tokens",
        ),
        estimatedCostUsd: sql<string | null>`sum(${r.estimatedCostUsd})`.as(
          "estimated_cost_usd",
        ),
        durationMs: sql<
          number | null
        >`CASE WHEN bool_and(${r.finishedAt} IS NOT NULL) THEN (extract(epoch FROM max(${r.finishedAt}) - min(${r.startedAt})) * 1000)::integer END`.as(
          "duration_ms",
        ),
      })
      .from(d)
      .innerJoin(r, eq(r.documentId, d.id))
      .groupBy(d.id),
);

/**
 * One field of one reading.
 *
 * field_key is text rather than an enum because the six contract fields are a
 * floor and not a ceiling: a provider may return more, and storing it costs
 * less than deciding in advance to throw it away. That all six are present is
 * enforced by the contract validator, not here.
 *
 * 'uncertain' rows keep their extracted_value even though no screen ever shows
 * it; the reason is in src/lib/contract/extraction.ts. There are no correction
 * columns, because nobody edits a reading (src/lib/contract/api.ts).
 */
export const extractedFields = pgTable(
  "extracted_fields",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    extractionRunId: uuid("extraction_run_id").notNull(),
    fieldKey: text("field_key").notNull(),
    // What the model read; null when unreadable.
    extractedValue: text("extracted_value"),
    status: fieldStatus("status").notNull(),
    // 0.000 to 1.000 when the provider reports one.
    confidence: numeric("confidence", {
      precision: 4,
      scale: 3,
      mode: "number",
    }),
  },
  (t) => [
    foreignKey({
      name: "extracted_fields_extraction_run_id_fkey",
      columns: [t.extractionRunId],
      foreignColumns: [extractionRuns.id],
    }).onDelete("cascade"),
    unique("extracted_fields_unique_key").on(t.extractionRunId, t.fieldKey),
    check(
      "extracted_fields_confidence_range",
      sql`${t.confidence} IS NULL OR (${t.confidence} >= 0 AND ${t.confidence} <= 1)`,
    ),
    index("extracted_fields_run_idx").on(t.extractionRunId),
  ],
);

/**
 * KAN-58: every identifier one reading found printed on the letter.
 *
 * A letter prints several numbers a person could be asked for, and
 * extracted_fields keeps only the one in `reference`. These rows keep the rest,
 * each under the label the page printed beside it, in the order the reader
 * gave them. There is no 'unreadable' row: a number that could not be read is
 * not in the list. 'uncertain' rows are stored and never shown, the same rule
 * as for fields (src/lib/contract/extraction.ts).
 */
export const extractedIdentifiers = pgTable(
  "extracted_identifiers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    extractionRunId: uuid("extraction_run_id").notNull(),
    position: integer("position").notNull(),
    label: text("label").notNull(),
    value: text("value").notNull(),
    // A field_status column narrowed by the CHECK below to IDENTIFIER_STATUSES
    // (src/lib/contract/enums.ts): 'confirmed' or 'uncertain'.
    status: fieldStatus("status").notNull(),
  },
  (t) => [
    foreignKey({
      name: "extracted_identifiers_extraction_run_id_fkey",
      columns: [t.extractionRunId],
      foreignColumns: [extractionRuns.id],
    }).onDelete("cascade"),
    unique("extracted_identifiers_unique_position").on(
      t.extractionRunId,
      t.position,
    ),
    check(
      "extracted_identifiers_status",
      sql`${t.status} IN (${quotedList(IDENTIFIER_STATUSES)})`,
    ),
    index("extracted_identifiers_run_idx").on(t.extractionRunId),
  ],
);

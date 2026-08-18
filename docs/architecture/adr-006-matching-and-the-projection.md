# ADR 006: The reader searches its own archive, through a projection of the database

Status: accepted, 17 August 2026
Decision by: Jason (technical lead)

## Context

ADR 005 leaves one question open. When a batch is divided into letters, each
letter has to be placed: is this a new letter, or the rest of one that is
already here?

The obvious implementation is a query. Find documents belonging to this person
with the same issuer, or the same reference number, in the last few months, and
compare. It works on an electricity bill and falls over on the first thing that
is not a bill.

Letters are not a genre. A person will photograph a party invitation, and it
has a date, a place and a thing to do, and it has no issuer worth matching on
and no reference number at all. The save-the-date it belongs with says
"45 Elgin Street" where the invitation says "Carlton". A query written by us in
advance has to anticipate the shape of the correspondence, and there is no
shape.

## Decision

### The model searches. Code does not narrow first.

The matcher is given tools and a question, not a result set. It decides what to
look for, how many times, and what the answers mean.

The tools are deliberately the three a model is most fluent in, with the
signatures it already knows:

```
glob(pattern)                    -> paths
grep(pattern, path_glob?, ctx?)  -> [{ path, line, text }]
read(path, from?, to?)           -> the document
```

Three, not two. The loop is glob to find candidates, grep to narrow, read to
decide; without `read` the first two cannot reach a conclusion.

This choice is about where the fluency is. An enormous amount of what these
models have seen is exactly this: write a pattern, look at the hits, refine,
look again. That loop is also the thing a single similarity query cannot do,
because there is no meaningful way to reformulate a vector. And it leaves a
trail a person can audit: the pattern it searched and the lines it read, rather
than a cosine score nobody can argue with. For a project that has to
demonstrate its own correctness, that difference is worth a great deal.

### The corpus is a projection of the database, never a copy of it.

The tools do not read files. They read a **view**, assembled from `documents`
and the latest successful reading of each. A view cannot go stale, because it
is not a copy: it is the query.

This is not a small distinction and it is not theoretical. A mirror that is
written separately from the source drifts, and a stale mirror does not fail
loudly. It answers "nothing matches", confidently, about a world that has moved
on.

At this project's scale a sequential regex scan over a few hundred documents is
immaterial. When it stops being, the upgrade is a materialised view refreshed
inside the confirm transaction, or a stored column; the tools do not change.

### The path is the index.

```
2026/08/15-agl-energy-electricity-bill-4e7a.md
2026/09/04-sarah-whitfield-party-invitation-a3f2.md
no-date/services-australia-claim-form-9c11.md
```

`YYYY/MM/DD-issuer-type-shortid.md`, from the due date. Two levels of directory
mean `glob("2026/09/*")` filters a month without reading a byte.

The date is the **due date**, not the upload date, because the whole product is
organised around due dates and the calendar is the person's mental model of
their own archive. Carrying two date axes would mean the searcher has to hold
two. The upload timestamp is in the document's front matter, so it stays
searchable by content. Documents with no due date live under `no-date/`.

The filename matters more than the directories. The first search anyone writes,
model or person, is by who sent it: `glob("**/*agl-energy*")`. Which makes the
issuer slug load-bearing, and means it has to be **normalised**: the same
company arrives as `AGL Energy` on one letter and `AGL Energy Limited` on the
next. Slugged separately those are two directories, that search finds half of
them, and nothing announces the half it missed. Company suffixes (`Limited`, `Pty Ltd`, `Inc`) are stripped and the
result is normalised before it reaches a path.

### What a projected document looks like

```markdown
---
id: 4e7a23db-...
status: confirmed
uploaded: 2026-08-12T09:14+10:00
pages: 3
task: open, due 2026-08-15
---
# Electricity bill from AGL Energy

action_required: Pay the amount due
amount: $347.60
document_type: Electricity bill
due_date: 2026-08-15
issuer: AGL Energy
reference: 9201 4471 88

## What this is about
A quarterly electricity bill for the Carlton house, payable by direct debit or
BPAY, with a late fee after the due date.

## Also on the page
billing_period: 12 May to 11 Aug
concession: applied
```

The `task:` line is what became of the letter, derived live from the tasks
table at read time: `none`, `open, no date`, `open, due …`, or `completed …`.
It is in the projection rather than stored on documents because a stored flag
would need updating on every tick and untick, and a stale flag does not error,
it confidently lies. When the matcher weighs "do these new photos belong to
this letter?", whether that letter's task was ticked off three weeks ago is
exactly the kind of thing it should know.

An uncertain field is written as `(unreadable)`: storage keeps the model's
hedge for evaluation, but no projection carries a value the model was not sure
of (ADR 008). There is no page-text section; it left with `raw_text`.

Front matter carries the facts that are matched exactly. The six fields read as
lines because that is both legible and greppable. "Also on the page" is
`open_payload` laid flat, which is where the invitation's venue and dress code
already land today, invisibly. The page text is the last resort.

### `summary` comes back, as an index and never as a screen

"What this is about" is the field ADR 004 deferred.

That decision was right and it is not being overturned. Read its reasons again:
a generated prose summary is a hallucination surface, and it spends screen space
on readers least able to spot an invented sentence. **Both of those are about
showing it to someone.** As an index it is shown to no one; it only decides what
gets retrieved, and a bad retrieval is recoverable, because the model that reads
the candidates rejects it.

It is also the piece that makes literal search work at all on this corpus.
Every official letter says "amount due" and "account number" and "please retain
this for your records". Searching those words matches everything, which is the
same as matching nothing. The summary is the one part of the document written
in ordinary words, which means it is the only part likely to share vocabulary
with a query. Without it, `grep` is reduced to exact identifiers.

So that it can never reach a screen by accident, it lives on `documents` as a
column and **not** as a seventh contract field. `CONTRACT_FIELD_KEYS` stays six,
`ExtractedFieldView` never carries it, and the review screen therefore cannot
display it without someone deliberately adding it.

How it is written matters, because a bad summary is worse than none: one to
three sentences, naming the concrete particulars (places, people, what the
thing physically is), and **never restating the six fields**, which are already
above it verbatim and are only diluted by repetition. The test is whether it
uses the words this person would use if they were trying to remember the letter.

### Ownership is in the query, not in the question

Every one of the three tools carries `user_id` in its `WHERE` clause as
something the caller of the tool cannot set. The model chooses what to search
for; it does not choose whose archive to search.

This is not a hedge against the model being wrong about letters. It is the
difference between a wrong answer and pages attached to a stranger's document,
and those are not the same kind of mistake.

### Documents that have not been confirmed are searchable

The most common case for late pages is a person who uploaded a three-page form
and found the fourth page five minutes later. That document is still waiting to
be checked. A matcher that cannot see it does not merely miss; it reports "no
match, this is new" and produces two half-letters, which is worse than a miss
and harder to unpick.

Being findable is not the same as reaching the calendar. **The invariant in
`docs/api.md` is untouched**: only confirmed documents produce tasks, reminders
and marks. `status` is in the front matter, so the searcher can narrow by it
when it wants to.

### The tools are forgiving on purpose

Three ergonomics, all learned from watching what actually goes wrong:

- `glob` matches loosely against the whole path. A caller that passes `agl`
  instead of `**/*agl*` gets results rather than a lesson. A strict tool spends
  a round trip teaching syntax and then gets the syntax wrong again.
- `grep` returns the path with each hit, and the path carries the issuer and
  the type, so a match is often enough to decide without a `read` at all.
  Matching lines come with a line of context, not the whole document.
- An empty result says what was searched and how large the corpus was:
  `no matches for /agl/i across 47 documents`. A bare empty list cannot be
  told apart from a bad pattern, and the difference decides whether to widen
  or to stop.

### One ladder, climbed only as far as the miss rate demands

1. Literal case-insensitive regex, which is what this decision ships.
2. `pg_trgm`, if literal matching misses too often. It buys fuzzy matching and,
   separately, makes the regex queries indexable, so it is the answer to
   slowness as well as to strictness.
3. Embeddings, if trigrams are still not enough. `pgvector` is portable across
   every Postgres this project might run on, so ADR 003's ban on vendor-specific
   extensions is not in the way.

Each rung is added as a tool the model may call. None of them replaces the ones
below, and the model's code does not change when one arrives.

Nothing above rung one is built. The number that decides whether to climb is
how often the matcher fails to find a document that was there, and that number
does not exist yet.

## Consequences

- `documents` gains `summary` and a normalised issuer slug, and the projection
  is a view over it. See `db/schema.sql`.
- The matcher is a provider behind an interface, the way the reader is: it takes
  a letter and a corpus and returns a document id or nothing. Whether the
  implementation is our own tools over SQL, or an agent runtime with these tools
  already built in, is an implementation choice behind that interface and is not
  settled here.
- Every tool call is logged with its pattern and its hit count. That log is the
  matcher's accuracy record, and unlike a similarity score it can be read by a
  person deciding whether to trust it.
- Search costs turns rather than an index build. Three tool calls against a
  cheap text model are immaterial beside the one pass that looks at the images.

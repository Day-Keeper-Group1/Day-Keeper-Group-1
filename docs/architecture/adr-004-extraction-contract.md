# ADR 004: Six fields, a provider interface, and a mock that misbehaves

Status: accepted, 9 August 2026
Decision by: Jason (technical lead)

## Context

Module 1 reads a photograph. Module 4 turns what was read into tasks and
reminders. They are written by different people, and neither can start until
they agree on what passes between them. That agreement is the single most
load-bearing artefact in this project.

Separately: we have no model access. RACE was introduced on 5 August and nothing
has been granted. Development cannot wait for it.

## Decision

### The six fields

`document_type`, `issuer`, `action_required`, `due_date`, `amount`, `reference`.

These are the minimum a document must yield before it can become a task. **Six
is a floor, not a ceiling.** A provider that returns more is not punished: the
extra lands in the document's `open_payload`, untyped, rather than being thrown
away. But a payload missing one of the six is rejected, and a field the reader
could not read must say `unreadable` rather than be omitted. Silence and "I
could not read this" are different answers and the contract will not accept one
for the other.

### `summary` is deferred, not forgotten

The roadmap's Step 5 lists seven fields, the seventh being `summary`. It is not
in the contract.

A generated prose summary adds a surface for hallucination and spends screen
space that a large-type field list uses better, for readers who are precisely
the people least able to spot an invented sentence. `action_required` already
carries what a person has to do, in one line, extracted rather than composed.

If a summary is wanted later, the question to answer first is whether it helps
Margaret or only makes the product feel more complete to us. It is recorded in
`DEFERRED_FIELD_KEYS` so that whoever revisits it can see it was considered.

### Every field carries an envelope

`value`, `raw_text`, `status`, and an optional confidence.

`raw_text` is the part people skip and it is the part that matters. The review
screen shows "Found on document: 15/08/26" beside a parsed date, and that is
what turns confirming into checking. Without it, confirming is a rubber stamp
and the product's central safety claim is theatre.

Three states only: `confirmed`, `uncertain`, `unreadable`. There is no fourth
for "missing", because missing is a contract violation rather than a state.

### One provider interface, and a mock that behaves badly on purpose

`DocumentExtractionProvider` has one method. The mock is the default and needs
no credentials, so the entire product runs end to end today.

The mock takes two to seven seconds, is unsure about the due date roughly half
the time, cannot read the reference about one time in five, and fails outright
about one document in eight. That is deliberate. **A mock that always succeeds
instantly produces an interface with no waiting state, no correction path and no
failure path**, and all three of those are where this product actually lives. It
is also deterministic: the same document id always gives the same result, so a
test can assert on it and a demonstration does not surprise anyone.

### Failures are distinguished by what the person can do about them

- `transient` — our fault or the network's. Retried automatically up to three
  times, without telling anyone.
- `unreadable_image` — the photograph. The person is asked to retake it, which
  is something they can act on.
- `unsupported_document` — a dead end. Say so plainly rather than inviting a
  retake that will fail the same way.

This resolves a contradiction between the two prototypes, where the user sketch
offered a manual retake and the admin sketch logged "extraction retry
exhausted". Both are right, for different failures.

## Where the boundary sits

The provider speaks snake_case JSON, because that is what a model is asked to
produce and what every design document already calls these fields. The browser
receives camelCase, because three thousand lines of interface were already
written that way and the backend arrived second.

The translation must happen in exactly one place, `src/server/extraction`, so
there is one file to open when a name does not line up. This branch ships the
provider interface and the mock; the code that runs a reading and writes the
rows is to be built.

## Consequences

- No real provider is implemented. `AI_EXTRACTION_PROVIDER=openai` throws rather
  than silently falling back to the mock, because silently fabricating readings
  of real letters is the worst thing this system could do.
- Accuracy figures will name the provider and model that produced them; both are
  stored on every run.
- Adding a field to the contract means changing `CONTRACT_FIELD_KEYS`, the seed,
  the prompt, and the stored rows together. That friction is intentional.

## Revisions

**9 August 2026 — `due_time`, an optional seventh key.** An appointment happens
AT a time, not just BY a date; the prototype shows "Fri 4 Sep, 10:30 am" and a
`date` column silently truncates it. `due_time` (`HH:mm`, only when the page
prints one) is added to `OPTIONAL_FIELD_KEYS`: known to the contract, with
columns waiting for it, never required. **The six-field floor is unchanged** —
a provider that omits `due_time` is fully conformant. Its presence is also what
marks a document as an appointment for reminder scheduling (one reminder, the
day before, instead of two): see `src/lib/contract/reminders.ts`.

Same date: `FIELD_LABELS` rewritten to the prototype's vocabulary ("From",
"What to do", "Reference"). The keys did not change; the labels are read by
people who never chose this software and should not have to learn its words.

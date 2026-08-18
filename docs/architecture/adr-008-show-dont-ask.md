# ADR 008: The product shows, it never asks

Status: accepted, 18 August 2026
Decision by: Jason (technical lead)

## Context

The review screen used to be an exam. A field the model was not sure of came
back flagged, drew an amber box, asked "This was hard to read. Is it right?",
offered a text input, and refused to confirm until the person had either
edited the value or acknowledged it, with a `409` and an `acknowledged_at`
column enforcing that she had. Beside each value, a `raw_text` snippet was to
show what the page said, so that checking meant comparing rather than
remembering.

Two discoveries killed this, one at a time.

First, `raw_text` was standing on a foundation that had been removed. It was
designed when reading was going to be OCR plus a vision model: the OCR would
transcribe, the model would interpret, and the snippet would be genuinely
independent evidence beside the model's answer. Without the OCR stage, both
the value and the snippet come from the same model looking at the same pixels.
The same witness testifying twice is evidence of nothing, and showing it as
"check against this" would be theatre.

Second, and deeper: the exam interrogates the wrong party, in the only case
where it matters. When the model is unsure, the honest answers available to a
person in this product's audience are "go find the paper letter again" or
"guess". The product exists so that the paper can leave her life; the exam
quietly reintroduces it as the reference she is expected to consult. And she
is the person least equipped to adjudicate a model's hesitation, which is why
the product exists at all.

## Decision

**1. Trusting the model includes trusting its "I am not sure."** When the
model hedges, the product takes the hedge at face value instead of asking a
person to overrule it. `uncertain` survives in storage, because how often the
model hedges and what it guesses is evaluation data, but the server collapses
it to `unreadable` on the way out. No screen, no API response, and no
projection ever carries a value the model was not sure of. As far as the
product behaves, such a value does not exist.

**2. The calendar has exactly two sources: a confident read that a person has
seen, or nothing.** An uncertain date never reaches `documents.due_date`,
never becomes a task's date, never plans a reminder, never draws a dot. This
is the old promise ("never from a date you haven't checked") made structural:
there is no path by which an unchecked or hedged date can arrive anywhere,
so no procedure has to guard against it.

**3. The review screen shows, it never asks.** Rows the model read confidently
are displayed, read-only. Rows without a value are not drawn, because an empty
row invites an answer nobody is being asked for. When the date or the action
is missing, the card states it in one sentence with a full stop: "This letter
doesn't give a clear date. It's saved; nothing goes on your calendar." Her
whole job is recognition: does this match the letter? Confirming is an empty
`POST`, the person looked and nodded, and that is the entire message.

**4. Nothing is editable, and the one remedy is the camera.** There is no date
box, no field editing, no manual calendar entry. Whatever is wrong or missing,
whether the photo was poor or the letter itself never said, the person's one
move is photographing the letter again, through the same capture screen as
everything else. The matching step recognising the new photos as this letter
is what corrects the record. One entrance for everything: the product has two
verbs, photograph and tick, and a person never needs to learn a third.

**5. A letter with a clear action and no clear date still becomes a task.** It
sits in the list saying "No date", never reminds, never touches the calendar,
and stays until ticked: the list itself is the reminder. A letter with no
clear action becomes no task; it is kept, with its summary, as a letter.

## Why

**The safety claim got stronger by deleting its enforcement.** The exam proved
at best that somebody tapped a box. The structural version needs no proof: a
hedged value cannot be acted on because it is never allowed to become
actionable in the first place. This is the same shape as the calendar having
no data of its own and the reminder dispatcher checking the tick at fire time.
Every guard in this system is becoming a missing path rather than a checkpoint.

**Recognition is easy; entry is hard.** For this audience, reading a card and
nodding is a fundamentally different task from typing a date into a box on a
phone. The exam demanded the hard kind of work at the worst moment, about the
values least likely to be right. The camera, by contrast, is the one gesture
the product has already taught.

**The wrong-but-confident read has a remedy, and it is the same remedy.** If
the model confidently misreads an amount and she notices, she photographs the
letter again; the new reading arrives, the four-value comparison sees the
change, and the letter returns to be looked at. Correction is not a separate
feature; it is the ordinary flow, run again.

**What this costs, named honestly.** User corrections were going to be the
in-product accuracy signal (`corrected_value` against `extracted_value`); with
editing gone, that signal is gone, and accuracy measurement now rests entirely
on the synthetic evaluation line, where ground truth is known by construction.
And a person who cannot type a date also cannot rescue a letter the camera
genuinely cannot capture; the answer today is that the letter stays a dateless
task, on the list, in her sight, which is the product being honest about what
it could not read rather than pretending a workaround is a feature.

## Consequences

- The extraction contract is at version 2.0: `raw_text` is gone from the
  provider's field shape. `extracted_fields` has no `raw_text`,
  `corrected_value`, `corrected_at` or `acknowledged_at` columns; the reading
  is the only writer of that table, and step 3 no longer touches it.
- `ConfirmDocumentRequest` no longer exists; confirm is an empty POST whose
  only error is "already confirmed". The date-parse error path and
  `parseHumanDate`'s role in confirm went with it.
- `ExtractedFieldView` carries `status: "confirmed" | "unreadable"` and no
  `rawText`; the collapse from `uncertain` happens server-side, in one place.
- The `document_search` projection writes `(unreadable)` for anything not
  confident, and carries a `task:` line (none / open, no date / open, due … /
  completed … / dismissed) derived live from the tasks table, so the matching
  model knows what became of a letter without a stored flag that could go
  stale.
- The date-filling feature is deferred, not rejected: if it returns, it
  returns as a deliberate feature with its own design, not as a text box that
  happened to be lying around. Same for OCR: if the experiment line brings it
  back, `raw_text` can return with the independence that was the point of it.

## Revisions

**18 August 2026, written on day one.** The amber-box exam, the
`acknowledged` array and its `409`, the `corrected_value` overlay and the
"send only changed fields" rule were all specified in `docs/api.md` before
this decision and are dead. Do not propose them back piecemeal: an edit box
"just for the date", a "confirm you checked this" toggle, or a snippet shown
"just as a hint" each reintroduces the exam through a side door. The test for
any such proposal is the invariant in Decision 2: after it ships, are the
calendar's sources still exactly two?

# ADR 007: The tick is the only state, and the clock checks it when it rings

Status: accepted, 18 August 2026
Decision by: Jason (technical lead)

## Context

Completing a task used to be specified as a little machine. Ticking wrote to
two tables in one transaction: the task became `completed`, and every reminder
still waiting was flipped to `cancelled`. Unticking ran the machine backwards,
with a patch on the reverse gear: cancelled reminders returned to `scheduled`,
**except** those whose time had already passed, which had to stay cancelled so
that nothing would fire a nag about a deadline already gone. None of it was
wrong. All of it was bookkeeping, and the undo rule took a paragraph to
explain, which is how bookkeeping announces itself.

The review that killed it asked one question: a bill due 18 September, ticked
off today, unticked tomorrow. What has to happen? Under the machine: two
writes, then two writes back, minus the exception. What the person means is
nothing like that. She means "not done yet after all", and she should be able
to change her mind as often as she likes, until whenever she likes, without
the system keeping a ledger of her wavering.

## Decision

**1. A task stores one fact a person controls: whether it is ticked.**
Everything else a screen shows is worked out while drawing, from the tick and
today's date, in her timezone. Ticked means completed. Not ticked with the due
date behind today means overdue. Not ticked otherwise means upcoming. Nothing
writes "overdue" anywhere, so nothing has to notice midnight, and nothing can
forget to un-write it.

**2. Ticking is never locked.** Tick and untick work on any task, in either
direction, forever, wherever the row is visible: the home list while it is
there, the calendar's day sheet always. Unticking a task whose date has passed
makes it overdue by arithmetic, not by transition, and the home screen picks
it up again because the home screen shows every open task. There is no "too
late to change your mind".

**3. A reminder is a clock, and the clock checks the tick when it rings.**
Ticking writes nothing to reminders. Unticking writes nothing to reminders.
When a reminder's moment arrives, the dispatcher reads the task **at that
moment**: still open means send and write `sent`; already done means send
nothing and write `skipped`. That is the product's only judgement about
whether to nag, it happens at the only moment that matters, and it lives in
the one place that sends. The enum value `cancelled` is gone because nothing
writes it.

**4. Overdue is told in words, not colour.** `was due Wed 5 Aug` in the date
column, set bolder. Red already means a failed reading in this product, and
colour is never the only signal. No badge and no separate list: due-date
ascending puts an overdue date ahead of every upcoming one, so the pinning is
the sort.

**5. No severity, and no post-due nag.** The system cannot know whether an
overdue row is a fine or a party invitation, so it does not guess and does not
grade. After the due date, every reminder is in the past and the clock only
rings forward; the pinned row is the signal, and it stays until she ticks it.
Both are one decision: show the fact, let her judge the weight.

## Why

**The bookkeeping was a copy of the truth, and copies drift.** "Reminders
off" stored as cancelled rows is the same information as "the task is done",
written a second time in a second table. Every copy needs a transaction to
keep it honest and an undo rule to unwind it, and the undo rule needed an
exception within a week of being written. The fire-time check stores the truth
once and reads it at the moment of use. The pattern is the same one the
calendar already follows: it has no data of its own, so it cannot disagree
with the task list. The dispatcher has no opinion of its own, so it cannot
nag about a done task; there is no path for that bug to arrive by.

**Undo becomes trivial because there is nothing to undo.** The old design's
hardest question, which reminders come back, has no analogue. A reminder whose
time is ahead will find the task open when its moment comes. One whose time
has passed became `sent` or `skipped` and stays so, which is not a rule but a
description of time.

**She can waver freely because wavering writes nothing.** Tick at breakfast,
untick at lunch, tick again at dinner: three writes to one column of one row,
no ledger, no residue. The 9 am clock the next morning sees only where the
tick landed, which is the only thing that was ever true.

## Consequences

- `reminder_status` is `scheduled | sent | skipped | failed`. `skipped` is
  written only by the dispatcher, with no `sent_at`. The seed plants one: a
  bill ticked off before its last reminder's morning, so that morning's clock
  found it done and stayed silent.
- The complete and undo endpoints each write one row. Their sections in
  `docs/api.md` no longer mention reminders except to say they are untouched.
- The dispatcher (transport still undecided: cron, platform scheduler, or
  in-app) owns the send-or-skip judgement. Whatever wakes it up, the check is
  the same three lines.
- `planReminders()` is unchanged: reminders are still planned and stored as
  rows at confirm time, because each has its own fate to record (`sent`,
  `skipped`, `failed`) and the calendar draws its dots from them.
- The prototype draws all of it: derived overdue ("was due", bold, sorted to
  the top), tick and untick from home and from the day sheet, and three day
  sheet wordings for a reminder (goes out, went out, "No reminder, this is
  already done").

## Revisions

**18 August 2026, and the reason this section exists on day one.** The
cancel-on-complete transaction and the revive-except-past undo rule were
specified in `docs/api.md` before this decision and are dead. Do not propose
them back. Any future "keep reminder rows in step with the task" suggestion is
the same machine returning with new paint: the answer is that they were never
meant to be in step, because the rows record what the dispatcher did at each
moment, and the task records what is true now.

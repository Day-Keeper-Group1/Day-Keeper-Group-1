# What this release builds

The requirements baseline is [`project-description.md`](project-description.md), which
is quoted verbatim and never edited. This document says which part of it we are building
first. Where a document elsewhere in this repository describes behaviour that is not in
the list below, this document wins and that document is wrong.

## The release, end to end

1. A person signs in. Correct credentials, and they arrive.
2. They photograph one letter and upload it. A letter may run to several pages, and
   every photograph in an upload belongs to that one letter.
3. The upload is checked for the two things code can check: the file is an image we can
   read, and it is not larger than the limit.
4. One model call. A vision model looks at the photographs and returns the six fields.
5. Everything after that is ordinary code.
6. A screen shows what was read. It shows; it never asks. Nothing on it is editable and
   nothing on it is a question.
7. Confirming writes the tables. The letter is stored with its photographs, and the
   action it carries becomes a task with a due date.
8. The task appears on the home list and on the calendar.
9. Reminders fire seven days, three days and one day before the due date.
10. Ticking the task is the only thing that completes it, and an overdue task that has
    not been ticked sits at the top of the home list.
11. A letters area holds what has been read, and opening a letter shows the photographs
    that came with it.

A person can go from a piece of paper on the kitchen table to a reminder that arrives in
time, and the shortest description of the product is still two verbs: photograph, and
tick.

## Not in this release

- An upload holding more than one letter.
- Joining a later upload to a letter already in the system.
- A letter that asks for several payments on different dates, such as a council rates notice paid in four instalments. The release turns one letter into one task with one due date, so it cannot put every instalment on the calendar, and a reminder for only the first one would leave the rest to be missed.
- Rejection and repair: no "this is not a letter", no blurry photo rejection, no retake
  prompt, no apology for handwriting a model cannot read. The checks in step 3 are the
  only ones.
- The admin dashboard. The baseline names it among the first version deliverables, so
  its absence here is deliberate rather than an oversight. The operator role stays in
  the schema.
- Modules 2 and 3. Email and voice are the next phase in the baseline's own wording.

## Why this shape

The path above is the one where everything goes right: the credentials are correct, the
document is the right kind, and it can be read. Building that path first and completely
is worth more than covering every path partially, because a path that runs end to end
can be shown, measured and corrected, and a half-covered one can only be described.

## What did not change

Postgres holds the data and an object store holds the photographs. The reading returns
six fields and may return more, with the extra kept in `open_payload`. A value the model
was not sure of arrives as no value at all, and the screen says so in a sentence rather
than offering an empty box. A task's tick is its only state, and whether a task is
overdue is worked out from the clock when a reminder fires rather than stored. The theme
is Eucalypt and Wattle, and every rule in [`theme.md`](theme.md) still holds.

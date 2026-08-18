#import "lib.typ": *

#part("Before anything: whose nine in the morning")#anchor(<auth>)

Two tables come before the story starts, because everything else points at
them. `users` is a person: an email, a hashed password, a display name, a role.
`sessions` is the fact that somebody is signed in right now, kept as a row so
that signing out, or losing a phone, can end it immediately.

One column on `users` deserves a sentence of its own, because it is the kind of
thing that is invisible until it is wrong. `timezone` holds an IANA zone name,
defaulted to `Australia/Melbourne`. The product promises to remind her at nine
in the morning, and nine in the morning is meaningless until you know whose
morning. The same column decides when a task stops being due today and starts
being overdue: the answer is midnight where she lives, not midnight where the
server lives.

#tbl(
  columns: (auto, 1fr),
  [#t("users")], [Who she is. Email, password hash, display name, role, and the zone her mornings happen in.],
  [#t("sessions")], [A signed-in browser, as a row. The cookie holds a random token; the table holds its hash, so a database leak does not hand over live sessions.],
)

#step(1, "She photographs a pile")#anchor(<s1>)
#writes("upload_batches", "upload_pages")

#spread(
  "figures/02-scan-pile.png",
  [The capture screen. Four photographs so far, and the camera stays open.],
  [
    She points the camera at whatever came in the post. Not one letter: the
    pile. The screen says so in as many words, because the instinct is to
    photograph one thing and be careful about it, and being careful is the work
    this product is supposed to be doing for her.

    When she presses the button, two tables are written and the request returns.
    `upload_batches` is one row for the pile she just posted. `upload_pages` is
    one row per photograph, holding where the file went, what format it is, and
    how big.

    The photographs themselves are never in the database. The rows hold a path;
    the bytes are objects in a bucket. A database that holds images is a
    database whose backups are enormous and whose every query drags megabytes
    around for no reason.

    The upload answers as soon as the files are stored, not when the reading is
    done. Reading takes seconds, and a person holding a phone should not be
    watching a spinner for any of them.
  ],
)

#why[
  *The number on each photograph means less than it looks like it means.*
  `upload_pages.position` says where a photograph fell in the pile, and that is
  all it says. It does not say which letter the photograph belongs to, and it
  does not say what order that letter's pages read in. Somebody picking
  photographs out of their phone album destroys any such convention before it
  exists. The number survives for two jobs: it is the name the reading points
  at ("photograph 3"), and it is the only thing left to show her if the reading
  fails completely.
]

There are two limits, ten photographs and ten megabytes each, and they live in
one file that both the interface and the server import. That is the difference
between a capture screen that stops her at the tenth photograph and one that
lets her take fifteen and then rejects the lot.

#step(2, "The pile becomes letters")#anchor(<s2>)
#writes("grouping_runs", "documents", "document_pages")

#screens(
  "figures/03-batch-dividing.png",
  "figures/04-batch-divided-reading.png",
  [Left: the pile has been posted and nothing has looked at it yet, so the row
   says the only honest thing it knows, which is how many photographs it holds.
   Right: seconds later the same row has become one row per letter, plus one
   grey line for the photograph that was not a letter at all.],
)


This is the step the rest of the product hangs off, and it is the one a person
never sees happening. The reading looks at every photograph and answers with
the letters it found. Not a boundary flag per page, and not a similarity score:
a list of letters, each one saying which photographs make it up, in reading
order, what it appears to be, and why those photographs are one letter.

#v(2pt)
#image("figures/d2-dividing.png", width: 100%)
#v(6pt)


Each part of that answer earns its place. `photos` is which photographs, in the
order the letter reads, which the reading can see because the sheet says "Page
2 of 3" and the camera never could. `label` is what to call this letter, taken
off the letterhead, so that a letter has a name from the moment it has an id
rather than three rows all saying "reading..." for six seconds. `reason` is
required, because nobody is ever going to confirm this grouping and that
sentence is its only account of itself. `text` is the letter's words, so the
photographs are looked at once rather than twice.

`not_letters` is the other half of the answer. A photograph of a grandchild
stays a photograph of a grandchild. No letter is invented to hold it, and one
grey line on the queue says so, once, however many there were.

#why[
  *Why a model does this and not code.* Code can divide a pile if the pile
  obeys a rule. This one does not: one letter's pages arrive shuffled between
  another's, a receipt turns up in the middle, and the same photograph can
  catch two letters lying side by side on a table. A rule encodes an
  expectation, and the defining property of this input is that there is no
  expectation to encode. The more chaotic the input, the more completely the
  answer has to be judgement, because judgement is the only instrument that
  works where rules have nothing to stand on.

  *And why the same pass that looks at the pictures.* The evidence for a page
  boundary is visual: a letterhead, a logo, a change of layout. Almost none of
  it survives being flattened into text. Asking the reader for the words and
  then paying a second model to reconstruct the boundaries from those words is
  throwing away the evidence and then buying a guess.
]

When the manifest lands, letters are born: one row in `documents` per letter,
one row in `document_pages` per photograph it turned out to own. `documents`
carries the denormalised facts that lists and calendars need, so that drawing a
screen is not three joins per row. `document_pages.page_number` is the reading
order from the manifest, not the camera's.

== No screen asks whether the dividing was right

This is the decision that surprises people, so here is the argument.

A grouping mistake does not hide. If two letters were merged, she sees one
letter whose facts contradict each other. If one letter was split, she sees two
letters, one of which has half its fields missing. *Both of those land on the
review screen she is already looking at.* A confirmation step in front of it
would catch nothing that is not caught anyway, and it would charge a person who
is already overwhelmed by paperwork one more decision about a question she did
not know existed. Handing the sorting back is the failure this product exists
to prevent.

So the grouping is invisible. She is never told that photographs one and three
became one letter. She is told there is an electricity bill for \$347.60 due on
the fifteenth, and asked whether that is right.

There is one error this does not cover, and it is named rather than hidden: a
real letter judged to be no letter at all. That one lands nowhere. It never
becomes a document, and nothing downstream can notice what was never created.
It is the sharpest part of the bet this design takes, and page #pageof(<bets>) says how it
gets measured.

#step(3, "Each letter is read")#anchor(<s3>)
#writes("extraction_runs", "extracted_fields")

Once the letters exist they are read one at a time and independently, so a
batch of three turns into three rows that go from "reading" to "ready to check"
whenever each one finishes. `extraction_runs` is one attempt at one letter:
which provider, which model, what came back, and how long it took. Failed
attempts are kept, because a system that deletes its failures cannot report an
honest accuracy number and cannot show that a letter failed twice before it
worked.

`extracted_fields` is one row per field. There are six fields, and they are the
minimum a letter has to give up before it can become a task.

#tbl(
  columns: (auto, 1fr),
  [`document_type`], [What kind of letter this is. Electricity bill, claim form, appointment letter.],
  [`issuer`], [Who sent it.],
  [`action_required`], [What she has to do, in one line, taken off the page rather than composed.],
  [`due_date`], [The day it has to be done by.],
  [`amount`], [What it costs, kept as the page wrote it.],
  [`reference`], [The number she will be asked for when she pays or calls.],
)

Six is a floor and not a ceiling. A reader that returns more is not punished;
the extra lands in an open column and is kept. But all six must come back, and
a field that could not be read has to say `unreadable` rather than be left out.
"I could not read this" and saying nothing are different answers, and only one
of them is honest about what happened.

Two values are worth knowing about, because they look like bugs and are not.
A field can come back saying *no payment is required*, or *this letter has no
such thing*. An appointment letter has no reference number, and the reader
still returns the field, with that constant, marked confident. It means "I
looked, and it is not there", which is a different fact from "I could not see".
The interface is free to hide such a row rather than print "Reference: not
applicable" at a reader who is already working hard; hiding a row is not
dropping the data.

== The seventh field, and the job it came back for

The plan started with seven. The seventh was `summary`, one or two sentences
saying what a letter is about, and it was cut before anything was built. A
generated sentence is a surface for invention, and it would spend screen space
on the readers least able to catch an invented sentence, at a moment when
`action_required` already says what to do in one extracted line.

It came back three weeks later for a completely different job, and only because
both of the original objections were about *showing it to somebody*.

#why[
  *As an index it is shown to nobody.* It decides what gets retrieved when the
  matcher goes looking for a letter, and a bad retrieval is recoverable, because
  the model that reads the candidates throws it out. It also turns out to be the
  only part of a letter written in ordinary words. Every official letter says
  "amount due" and "please retain this for your records", so searching those
  words matches everything, which is the same as matching nothing.
]

So it lives on `documents` as a column and deliberately *not* as a seventh
contract field. The contract stays at six, `ExtractedFieldView` never carries
it, and the review screen therefore cannot show it unless somebody adds it on
purpose. The same sentence that was wrong on a screen is the thing that makes
the search work.

== The third state, and why no screen ever shows it#anchor(<hedge>)

#v(2pt)
#image("figures/d3-fields-wall.png", width: 100%)
#v(8pt)

Every field carries a status: `confirmed`, `uncertain`, or `unreadable`. The
middle one is the interesting one. It means the model produced a value it is
not sure of.

Storage keeps it, because how often the model hedges and what it guesses when
it hedges is exactly the data an accuracy experiment needs. *Nothing else keeps
it.* On the way out of the server it collapses to `unreadable`. It never
reaches an API response, never reaches a screen, never reaches the calendar,
and never reaches the search projection. As far as the product's behaviour is
concerned, a value the model was unsure of does not exist.

#why[
  *Trusting the model includes trusting its "I am not sure."* The alternative
  is to show the hedged value and ask her whether it is right, which sounds
  responsible and is not. She is the person least equipped to adjudicate a
  model's hesitation. The honest answers available to her are "go and find the
  paper letter again", which is the thing this product exists to end, or
  "guess". So the product takes the hedge at face value: it says nothing rather
  than something it does not stand behind.
]

#step(4, "She confirms")#anchor(<s4>)
#writes("documents", "tasks", "reminders")

#spread(
  "figures/06-review-full.png",
  [The review screen. Every value on it was read confidently. Nothing on it is
   editable, and nothing on it is a question.],
  [
    She reads the card, it matches the letter in her hand, and she taps once.
    That tap turns a photograph into something on her calendar, and it writes
    three tables inside one transaction: the document becomes confirmed, a task
    is created, and the reminders are planned as rows.

    The request carries nothing at all. There is no list of fields, because
    nothing here can be edited. There is no list of things she acknowledged,
    because a value the model was unsure of never reached the screen. She
    looked, she nodded, and that is the entire message.

    The card above the button is not decoration. It is produced by the same
    function that plans the reminder rows, called with the same date, so the
    two reminders she is promised are the two reminders that exist a second
    later.

    #promise[
      You will be asked whenever what you have to do changes, and never
      otherwise.
    ]
  ],
)

#tbl(
  columns: (auto, 1fr),
  [#t("documents")], [Status becomes confirmed, with the timestamp that records a person having seen this reading.],
  [#t("tasks")], [One row, pointing back at the letter it came from, so that three weeks later "what said so?" is one tap.],
  [#t("reminders")], [One row per reminder, each carrying its own fate to record later.],
)

== The schedule

A deadline gets three reminders, seven days, three days and one day before, all
at nine in the morning where she lives. An appointment gets one, the day
before, because nobody needs a week of warning about a dental check-up. What
separates the two is whether the letter printed a time.

#tbl(
  columns: (auto, auto, 1fr),
  [*Kind*], [*Reminders*], [*Why that*],
  [Deadline], [7, 3 and 1 days before], [Far enough out to act, close enough in to matter],
  [Appointment], [1 day before], [The date is the event, not a window to work in],
  [No date at all], [none], [The list itself is the reminder],
)

A reminder whose morning has already gone is never planned. The bill on the
screen above is due on the fifteenth and was confirmed on the tenth, so the
seven-day reminder would have landed on the eighth: it is not created, and the
card does not promise it. That is why the plan card and the calendar always
agree with each other.

== What the promise is made of

The review screen used to promise that nothing happens until she says so. It
can now promise something stronger, because the promise stopped depending on
anybody being careful:

#promise[
  The calendar has exactly two sources. A confident reading that a person has
  seen, or nothing.
]

An uncertain date never reaches `documents.due_date`. It never becomes a task's
date, never plans a reminder, never draws a dot. There is no path by which an
unchecked or hedged date can arrive anywhere, so no procedure has to guard
against it arriving. This is the shape almost every safety property in this
system has: not a checkpoint, a missing road.

#step(5, "The calendar")#anchor(<s5>)
#writes()

#spread(
  "figures/07-calendar.png",
  [August. Red dots are due dates, gold dots are reminder mornings. The list
   below is the same tasks in date order.],
  [
    *This step writes nothing and has no table of its own.* The calendar is
    drawn entirely from the task list: a red dot on each task's due date, a
    gold dot on each reminder's morning. There is no calendar endpoint either.

    That is not laziness, it is the point. A second source of dates is a second
    thing that can disagree with the first, on screen, in front of somebody who
    has no way to tell which one is lying. The calendar has no data, so it
    cannot disagree.

    It also makes the central safety claim structural rather than procedural.
    Only confirmed documents produce tasks; only tasks produce dots. A letter
    that is still being read, or waiting to be checked, or that failed, draws
    nothing. Not because something checks, but because there is nothing for it
    to draw from.

    Tapping a marked day brings up that day and nothing else.
  ],
)

#step(6, "She ticks it off")#anchor(<s6>)
#writes("tasks")

#spread(
  "figures/11-home-three-faces.png",
  [Three faces of a task: overdue in words and in bold, upcoming plainly,
   completed struck through and still on the list.],
  [
    She taps the circle. One column of one row changes. Nothing else in the
    database moves, and in particular *not one reminder row is touched*.

    Everything else on this screen is worked out while drawing it, from that
    tick and today's date. Ticked means done. Not ticked with the date behind
    today means overdue. Not ticked otherwise means upcoming. Nothing writes
    the word "overdue" anywhere, so nothing has to wake up at midnight to write
    it, and nothing can forget to unwrite it.

    Overdue is told in words, `was due Wed 5 Aug`, set bolder. Not in red: red
    already means a failed reading in this product, and colour is never the
    only signal for readers who may not see it. There is no badge and no
    separate overdue list either. Sorting by due date puts an overdue date
    ahead of every upcoming one, so the pinning is free.
  ],
)

== The clock checks the tick when it rings

#v(2pt)
#image("figures/d4-the-clock.png", width: 100%)
#v(8pt)

Here is the part that is easy to build wrong. The obvious design is that
ticking a task cancels its reminders, and unticking brings them back, except
the ones whose time has passed, which have to stay cancelled so that nothing
nags her about a deadline that is already gone.

None of that is wrong. All of it is bookkeeping, and the undo rule needed an
exception within a week of being written.

So there is no bookkeeping. When a reminder's moment arrives, the clock reads
the task *at that moment*. Still open means send it and write `sent`. Already
done means send nothing and write `skipped`. That is the product's only
judgement about whether to nag, it happens at the only moment that matters, and
it lives in the one place that sends.

#screens(
  "figures/09-daysheet-reminder-ahead.png",
  "figures/10-daysheet-reminder-done.png",
  [The same day, before and after the task was ticked. The day sheet does not
   store either sentence; it says what the clock would find if it rang now.],
)

Three consequences fall out, and none of them needed to be designed:

#tbl(
  columns: (auto, 1fr),
  [*"Reminders off" is true*], [It is not a stored flag. There is no path by which a done task gets nagged, so the sentence is a description of the machinery rather than a promise about it.],
  [*Undo is trivial*], [There is nothing to undo. A reminder still ahead will find the task open when its moment comes. One already past became `sent` or `skipped` and stays so, which is not a rule, it is a description of time.],
  [*She can waver*], [Tick at breakfast, untick at lunch, tick again at dinner. Three writes to one column, no ledger, no residue. Ticking is never locked, on any task, in either direction, forever.],
)

That last one was a requirement rather than a nicety. A bill due on 18
September, ticked off today and unticked tomorrow, has to just work, and so
does unticking it a week after its date, which makes it overdue again by
arithmetic. A product for somebody whose memory is unreliable cannot also
demand that she be sure the first time.

#pagebreak()

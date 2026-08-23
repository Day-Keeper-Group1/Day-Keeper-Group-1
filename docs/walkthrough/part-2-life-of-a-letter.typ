#import "lib.typ": *

#part("One letter, from the front door to the tick")

Six steps. For each one: the screen she sees, and the rows it writes. Some
steps write nothing at all, and those are worth noticing.

#v(6pt)

#step(1, "She photographs the letter")
#writes(`documents`, `document_pages`)

#screens(
  "figures/03-camera-empty.png",
  "figures/04-camera-pages.png",
  [The camera stays open across taps, so a three page letter is three taps
   rather than three trips. The button stays dim until there is at least one
   page.],
)

The photographs go to an object store rather than into the database, and the row
in #t("document_pages") holds the key to find them again. A photograph is large,
it never changes, and it is served straight from the bucket to the browser
rather than through the application.

#v(4pt)

#step(2, "The system reads it")
#writes(`extraction_runs`, `extracted_fields`, `ai_prompt_logs`)

#spread("figures/05-notification.png",
  [The notification, and behind it the letter waiting to be checked. The waiting
   was on the home screen, not on a spinner, so she could close the app.],
)[
  This is the only place in the product where a model is called. It takes about
  ten seconds, which is long enough that holding her on a loading screen would
  be a small cruelty and short enough that a queue would be over-engineering.
  So the request answers immediately, the interface polls, and the home screen
  carries the waiting.

  When it finishes, a notification arrives. The wording is deliberate: it says
  the letter is ready to check, and that nothing happens until she looks at it.
  It is an invitation, not a report of something already done.

  What comes back is six fields, each with a status. The definition of those
  six, and the rule that a reader may return more but never fewer, is in
  #raw("src/lib/contract/fields.ts").
]

#v(6pt)
#image("figures/d1-six-fields.png", width: 100%)
#v(3pt)
#block[
  #set text(font: sans, size: 8.5pt, fill: ink-dim)
  #set par(justify: false, leading: 0.5em)
  Three statuses live in the database and two reach a screen. The collapse
  happens once, on the server, on the way out.
]

#why[
  *A value the model was not sure of is not offered as a guess.* It reaches the
  screen as no value at all, and the card says so in a sentence.

  Show her a half sure date in grey and she will approve it with a nod. So it is
  not shown. A date nobody really checked has no way to reach the calendar.
]

#v(4pt)

#step(3, "She checks it")
#writes()

#spread("figures/07-review.png",
  [The whole screen. Nothing on it is editable and nothing on it is a question.],
)[
  This is the screen the product is built around, and it is the one that writes
  nothing at all.

  There are no inputs here on purpose. Her job is recognition, not data entry:
  does this match the letter in her hand? Recognition is something a tired
  person with poor eyesight can still do reliably. Entry is not.

  Under *what DayKeeper will do* is the plan, before it is a plan. Two reminder
  mornings and a calendar entry, named as dates rather than as settings. She is
  agreeing to a specific week, not to a feature.

  There are two reminders here rather than three because the bill was confirmed
  on the tenth and is due on the fifteenth. The seven day rung fell in the past,
  so it is not offered. The card and the rows written afterwards are planned by
  the same function so that the screen can never promise a reminder that never
  arrives.
]

#v(4pt)

#step(4, "Her yes writes the rows")
#writes(`tasks`, `reminders`, `documents`)

#screens(
  "figures/09-home-task.png",
  "figures/08-calendar.png",
  [The same letter, now a task on the list and three marks on the calendar: two
   reminder mornings in gold and the due date in red.],
)

Confirming is the only thing in the product that turns a reading into something
that will act on its own. Before it, the letter is a row and some fields. After
it, there is a task with a date and three alarm clocks set.

#why[
  *The calendar has exactly two sources: a confident reading a person has seen,
  or nothing.* There is no third path, no import, no inference from an
  unconfirmed letter. That is why the promise on the previous screen holds
  without anyone having to be careful.
]

#v(4pt)

#step(5, "A reminder rings")
#writes(`reminders`)

#spread("figures/10-daysheet.png",
  [Any day on the calendar opens like this. A reminder is a fact about a
   morning, not a notification setting.],
)[
  Seven days, three days and one day before, at nine in the morning. Every
  letter gets the same three, and a rung that would fall in the past is simply
  not planned.

  The rows are written at confirm time rather than worked out later, because
  each one has a fate of its own to record: sent, skipped, or failed. The
  calendar draws its gold marks from those rows.

  When one rings, it reads the task at that moment and decides right then
  whether to speak. Still open means send it. Already ticked means send nothing
  and write that down.
]

#v(6pt)
#image("figures/d2-the-clock.png", width: 100%)
#v(3pt)
#block[
  #set text(font: sans, size: 8.5pt, fill: ink-dim)
  #set par(justify: false, leading: 0.5em)
  Ticking writes one column of one row and touches nothing in the reminders
  table. The judgement is made at the moment of use, not stored in advance.
]

#why[
  *The alternative was bookkeeping.* Ticking would cancel every waiting
  reminder, unticking would revive them, except the ones whose time had passed.
  That is one truth written in two places. Every copy needs a transaction to keep
  it honest and an undo rule to unwind it.

  Reading the tick when the alarm rings stores it once. She can tick at
  breakfast, untick at lunch and tick again at dinner, and nothing has to keep
  up with her.
]

#v(4pt)

#step(6, "She ticks it")
#writes(`tasks`)

#spread("figures/13-ticked.png",
  [Struck through, still on the list, and told in words: done, reminders off.],
)[
  The tick is a task's only state. Overdue is not stored. It is worked out from
  the clock when somebody asks, in Melbourne time, so nothing goes overdue at
  eleven at night because a server sits in another country.

  A ticked task stays on the list for a week rather than vanishing, because
  vanishing is indistinguishable from having been lost. Its calendar entry stays
  forever, so the answer to "did I pay that" is still there in December.

  "Reminders off" is derived, not a switch. It is true because the tick is set,
  and it becomes false again the moment she unticks, with nothing to undo.
]

#v(4pt)

#part("The letters she has kept")

#screens(
  "figures/11-letters.png",
  "figures/12-letter-opened.png",
  [Every letter that has been read, and one of them opened with the photographs
   that came with it.],
)

Nothing in this area asks anything of her. It exists because a letter is
evidence, and because the photographs are the only copy of a piece of paper that
may well have gone in the bin. Opening a letter shows what was read and the
pages it was read from, which is also the only way to check the system against
the original.

#part("When the reading fails")

About one letter in eight cannot be read. The mock reader fails deliberately at
roughly that rate so the path is never untested.

In this release a failed reading is the end of the road. There is no retry, no
prompt to photograph it again, and no message suggesting the photograph was her
fault. The letter keeps its photographs and says plainly that it could not be
read.

#why[
  *That is a smaller promise than the product would like to make, and it is
  made honestly.* An earlier design offered her a way out of every failure:
  photograph it again, or a screen explaining which kind of failure it was.
  Every one of those paths needed the system to know why it had failed, and a
  model that cannot read a page is usually not able to say why. Offering a
  remedy that does not work is worse than offering none, so this release offers
  none and says so.
]



#import "lib.typ": *

#part("One letter, from the front door to the tick")

The quickest way to understand DayKeeper is to watch it handle one letter.
This part does that. The letter is an electricity bill from AGL: three pages,
\$347.60, due Saturday 15 August. Today, in every screenshot, is Monday
10 August.

Each step names the tables it writes. One step writes nothing at all, and it
is the most important screen in the product.

#v(6pt)

#step(1, "She photographs the letter")
#writes(`documents`, `document_pages`)

#screens(
  "figures/03-camera-empty.png",
  "figures/04-camera-pages.png",
  [The camera stays open across taps, so a three page letter is three taps
   rather than three trips. The upload button stays dim until there is at
   least one page.],
)

She taps the camera, photographs the three pages, and sends them. That is her
whole job here. She never says what the letter is, and she never will.

Two kinds of rows are written. One row in #t("documents"): the letter exists.
Three rows in #t("document_pages"): one per photograph. The photographs
themselves go to the bucket, not into the database. A photograph is large and
never changes, so the browser fetches it straight from the bucket, and the row
keeps only the key for finding it.

#step(2, "The system reads it")
#writes(`extraction_runs`, `extracted_fields`, `ai_prompt_logs`)

#spread("figures/05-notification.png",
  [The reading finished while the phone was in her bag. The message is what
   brings her back.],
)[
  The upload screen closes at once. She puts the phone down.

  About ten seconds later it buzzes: _Your letter is ready to check. Nothing
  happens until you look at it._

  In those ten seconds the product did its one clever thing. A vision model
  looked at the three photographs and answered six questions: what kind of
  letter this is, who sent it, what she has to do, by when, how much, and what
  reference to quote. For this bill: an electricity bill, from AGL Energy, pay
  the amount due, by 15 August, \$347.60, reference 9201~4471~88.

  The six questions, and the rule that a reader must answer all six every
  time, are in #raw("src/lib/contract/fields.ts"). The call and its exact
  prompt are stored in #t("extraction_runs") and #t("ai_prompt_logs"), so a
  wrong answer can always be traced to the call that produced it.

  On this bill the model was sure of all six. It is not always. Each answer
  carries a verdict: #raw("confirmed"), or #raw("uncertain") when it has a
  value it is not sure of, or #raw("unreadable") when it has nothing.
]

#block(breakable: false)[
  #v(4pt)
  #image("figures/d1-six-fields.png", width: 100%)
  #v(3pt)
  #set text(font: sans, size: 8.5pt, fill: ink-dim)
  #set par(justify: false, leading: 0.5em)
  A second bill, written to go wrong: the model was not sure of the
  reference number.
]

#why[
  *A value the model was not sure of is never offered as a guess.* Show her a
  half sure number in grey and she will approve it with a nod. So the row is
  not drawn at all. A date or an amount is different: left out, the card
  would say the letter has no date or nothing to pay. So if the model is not
  sure of either, the reading fails and she sees the red row instead. A date
  nobody really checked has no way to reach the calendar.
]

#step(3, "She checks it")
#writes()

#spread("figures/07-review.png",
  [The whole screen. Nothing on it is editable, and nothing on it is a
   question.],
)[
  She taps the letter and gets this screen. The top card is what the letter
  says. The bottom card is what DayKeeper will do about it: remind her on
  Wednesday the 12th and Friday the 14th, and put the due date on her
  calendar. One green button.

  Her whole job is to hold the letter in one hand and check the screen
  against it. Recognition is something a tired person with poor eyesight can
  still do reliably. Typing is not, so there is nothing to type.

  And this step writes nothing to the database. The screen shows, it never
  asks, so there is no answer to record.

  The reminder mornings follow one rule: nine in the morning, seven days
  before the due date, three days before, and one day before. Seven days
  before this bill's due date was 8 August. That morning is already gone, so
  the card offers two mornings instead of three. The card and the later rows
  are planned by the same function, so the screen can never promise a morning
  that never comes.

  The sentence under the plan is the product's one promise. The next two
  steps are how it is kept.
]

#step(4, "Her yes writes the rows")
#writes(`tasks`, `reminders`, `documents`)

#screens(
  "figures/09-home-task.png",
  "figures/08-calendar.png",
  [The same bill, now the third task on the list and three marks on the
   calendar: the two reminder mornings in gold, the due date in red.],
)

She taps *Looks right, save it*. Three writes happen together. One row in
#t("tasks"): pay AGL electricity bill, due 15 August. Two rows in
#t("reminders"): Wednesday at nine and Friday at nine, exactly the mornings
the card named. And the letter's row in #t("documents") is marked confirmed.
A short note says where the task went, and the screen moves on by itself: to
the next letter waiting, or, after the last one, to the calendar at the month
of the task she just saved. A letter that asks for nothing makes no task at
all and is simply kept in her letters.

This tap is the only thing in the product that turns a reading into something
that will act later. Before it, the bill was rows the model wrote and a screen
she could look at. After it, there is a task on her list and two alarm clocks
set.

#why[
  *Everything on the calendar got there the same way: a sure reading that a
  person looked at.* There is no import, no guess, and no other path. That is
  how the promise on the review screen is kept. Not by anyone being careful,
  but because no other path exists.
]

#step(5, "A reminder rings")
#writes(`reminders`)

#spread("figures/10-daysheet.png",
  [Wednesday 12 August, opened from the calendar. Any day can be opened to
   see what it holds.],
  w: 50mm,
)[
  Wednesday, nine in the morning. Her phone says: _Pay AGL electricity bill,
  due Sat 15 Aug._

  What sent it is the clock, the one part of the product that acts with
  nobody in the room. At nine it finds every reminder row whose morning has
  come. Then, for each one, it does one thing before speaking: it reads the
  task.

  This task is still open, so the reminder goes out and the row is marked
  #raw("sent"). Had she already ticked the bill off, the clock would send
  nothing and mark the row #raw("skipped"). Every row ends up marked one of
  three ways: sent, skipped, or failed.
]

#block(breakable: false)[
  #image("figures/d2-the-clock.png", width: 100%)
  #v(3pt)
  #set text(font: sans, size: 8.5pt, fill: ink-dim)
  #set par(justify: false, leading: 0.5em)
  A different bill through a fickle week: ticked, unticked, ticked again.
  Each alarm reads the tick at its own moment.
]

#why[
  *Why the clock reads the tick, instead of the tick cancelling reminders.*
  She ticks the bill at breakfast, unticks it at lunch, ticks it again at
  dinner. What must the system do to Friday's reminder each time? Nothing.
  Friday's alarm will read the tick on Friday.

  The design this replaced did the opposite: ticking cancelled the waiting
  reminders, and unticking revived them, except the ones whose morning had
  passed. The same fact kept in two places, and rules to keep the copies
  agreeing. Reading the tick at the moment it matters keeps it in one place,
  and lets her change her mind for free.
]

#step(6, "She ticks it")
#writes(`tasks`)

#spread("figures/13-ticked.png",
  [Struck through, still on the list, and told in words: done, reminders
   off.],
)[
  She pays the bill on Wednesday and ticks it off. One column of one row
  changes: the tick on the task.

  On Friday at nine the second alarm rings, reads the task, finds the tick,
  and stays silent. That is all "reminders off" is. It is not a switch stored
  anywhere. It is true because the tick is set, and it stops being true the
  moment she unticks.

  The ticked task stays on the list for a week, struck through, because a
  task that vanishes looks exactly like a task that was lost. Its calendar
  entry stays forever, so "did I pay that" still has an answer in December.

  Overdue works like reminders off: worked out, never stored. The water bill
  at the top of her list says _was due Wed 5 Aug_ because today is the 10th
  and nobody has ticked it. Every screen makes that comparison in Melbourne
  time at the moment it draws, so nothing goes overdue at eleven at night
  because a server sits in another country.
]

#part("The letters she has kept")

#screens(
  "figures/11-letters.png",
  "figures/12-letter-opened.png",
  [Every letter that has been read, and one of them opened: what was read,
   and the photographs it was read from.],
)

Nothing in this area asks anything of her. It exists because a letter is
evidence. The paper itself may well be in the bin, so the photographs are the
only copy. Opening a letter here is also the only way to check what the
system read against the original.

#part("When the reading fails")

About one letter in eight cannot be read at all. During development the model
is played by a stand-in reader, and the stand-in fails on purpose at roughly
that rate, so the failure path is exercised every day.

A model call that goes wrong is made again first, up to three tries in all,
while the letter still says "reading…". Each try is its own row in
#t("extraction_runs"), so the table shows how many calls a letter took. Only
when the last try fails is she told.

After that, a failed reading is the end of the road. The letter keeps its
photographs and says plainly that it could not be read. There is no prompt to
photograph it again, and nothing that suggests the failure was her fault.

#why[
  *A smaller promise, made honestly.* An earlier design offered her a way out
  of every failure: photograph it again, or a screen explaining what went
  wrong. Every one of those paths needed the system to know why it had
  failed, and a model that cannot read a page usually cannot say why. A
  remedy that does not work is worse than none, so this release offers none
  and says so.
]

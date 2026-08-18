#import "lib.typ": *

#part("When it does not go well")

Everything so far assumed the reading worked. A product for this reader is
judged on the other case, so this part is four ways things go wrong and what
each one is allowed to say to her.

#part("Three failures, three faces")

#spread(
  "figures/14-three-failures.png",
  [Three failed letters and two good ones, in one queue. The wording differs by
   cause; the control differs by what she can actually do about it.],
  [
    Failures are told apart by one question: what can she do about this? That
    is the only distinction that changes anything on screen, so it is the only
    distinction the product makes.

    *It was our fault.* The photographs are fine and something on our side
    broke. Three automatic retries have already happened and failed, silently,
    before this row appears. The wording leads with "it wasn't your photo",
    because this reader assumes every error is hers, and this one really is
    ours. The button re-reads the same photographs; there is nothing to
    re-take.

    *The photograph.* The letter exists and was recognised, the picture is just
    too poor to read. The pages are kept, because the reading that failed was
    judged against them. Her way out is to photograph it again.

    *We cannot read this kind of thing.* A handwritten note from a doctor. No
    photograph will fix handwriting. The only honest things to offer are an
    apology and a promise that the photograph is not lost.
  ],
)

#v(2pt)
#image("figures/d5-failures.png", width: 100%)
#v(6pt)

#why[
  *The button she should never meet.* "Try again" is a compromise and the
  record should say toward what. The ideal is that a transient failure is
  invisible: the system keeps retrying in the background, or somebody retries
  it from an operations console, or the provider is swapped over there when one
  of them is down. None of that is something she can be asked to know about.
  All of it is console-side work, deliberately out of scope this semester, and
  the one tap is the honest floor until it exists.
]

#screens(
  "figures/15-batch-no-letters.png",
  "figures/17-letters-no-date-kept.png",
  [Left: a pile with no letters in it at all. Nothing can proceed, so a plain
   card says so and the camera is the only button. Right: where the apology
   points. The letter we could not read is in her letters, with its photograph,
   and the note says exactly that.],
)

Two of these throw the photographs away, and the reasoning is the same in both
cases. A photograph the system has decided is not a letter, or a batch with no
letters in it, will never be shown on any screen again. A server for vulnerable
people that permanently holds a picture of somebody's grandchild which nothing
will ever display is a liability with no matching benefit.

After any of these, there is no special mode. The row goes away, and where
photographing again could change the answer, the camera opens. What she posts
next is an ordinary pile: nothing assumes it is that letter, or only that
letter, or any letter at all. If the re-photographed letter should be
reconnected to what is already here, recognising it is the reading's judgement,
not a wire we soldered in advance.

#part("The letter that names no date")

#spread(
  "figures/12-review-no-date.png",
  [A letter with a clear action and no date anywhere on it. The row for a date
   is not drawn at all, and the plan card is a sentence with a full stop.],
  [
    Sometimes the letter simply does not say when. Sometimes it does and the
    photograph would not give it up. From the product's side these are the same
    situation, and it has one answer for both.

    The letter still becomes a task. It sits in her list saying `No date`,
    never reminds her, never touches the calendar, and stays there until it is
    ticked. The list itself is the reminder.

    Notice what the screen does not do. There is no empty box inviting her to
    type the date, no amber warning, and no question mark. An empty row invites
    an answer that nobody is asking for, so the row is not drawn; the card
    states the situation once, in a sentence, and moves on.

    A letter with no clear action at all does not become a task. It is kept as
    a letter, with its photograph, and that is the whole of it.
  ],
)

#why[
  *Why she cannot type the date in herself.* It is the obvious feature and it
  was deliberately cut. For this reader, recognising a value on a card and
  typing a date into a box on a phone are not the same size of task, and the
  box would be demanded at the worst moment, about the values least likely to
  be right. So the product keeps two verbs. Whatever is wrong or missing, her
  one move is photographing the letter again, through the same camera as
  everything else, and the matching step is what connects the new reading to
  the old letter. The feature is deferred rather than rejected: if it comes
  back it comes back as a designed thing, not as a text box that happened to be
  lying around.
]

#spread(
  "figures/13-tasks-including-no-date.png",
  [The full list. Overdue at the top because its date is smallest, the dateless
   one at the bottom because it has no date to sort by.],
  [
    The dateless task is not a special case in the sort, it is the natural end
    of it. Due date ascending, and a task with no date goes last. One rule
    gives the overdue pinning and the dateless placement together, and neither
    of them is a line of code that could rot.

    This screen is also where the correction story ends up. If the model reads
    an amount confidently and gets it wrong, and she notices, she photographs
    the letter again. The new reading arrives, the comparison on the next page
    sees that the amount changed, and the letter comes back to be looked at.
    Correction is not a separate feature; it is the ordinary flow, run again.

    What that costs is worth naming. User corrections were going to be the
    in-product accuracy signal, and with editing gone that signal is gone. The
    numbers now come entirely from the synthetic evaluation line, where the
    truth is known by construction.
  ],
)

#part("Pages that arrive later")#anchor(<matching>)
#writes("matching_runs")

She uploads three pages of a form, and five minutes later finds the fourth in a
drawer. She photographs it. Nothing about that photograph says it belongs with
the other three.

So the question the system has to answer is: are these pages the rest of a
letter that is already here? The obvious implementation is a query. Find
documents from the same sender, or with the same reference number, in the last
few months. It works on an electricity bill and falls over on the first thing
that is not a bill.

Letters are not a genre. A party invitation has a date, a place and a thing to
do, and it has no issuer worth matching on and no reference number at all. The
save-the-date it belongs with says "Carlton" where the invitation says "45
Elgin Street": not one word in common. A query we write in advance has to
anticipate the shape of somebody's correspondence, and there is no shape.

== The model searches, code does not narrow first

The matcher gets tools and a question rather than a result set. Three tools,
chosen because they are the three any model is most fluent in:

#tbl(
  columns: (auto, 1fr),
  [`glob(pattern)`], [Find candidate letters by path],
  [`grep(pattern, ...)`], [Look inside them, with the path on every hit],
  [`read(path)`], [Read one in full and decide],
)

What they search is a *view* over the database, not a copy of it. That
distinction is the whole design. A copy written alongside the source drifts,
and a drifted index does not fail loudly: it answers "nothing matches",
confidently, about a world that has moved on. A view cannot drift, because it
is not a copy, it is the query.

The view presents each letter as a small document with a path built from its
due date and sender, front matter carrying the six fields, and a live line
saying what became of it (`open, due 2026-08-15`, `completed 2026-08-02`, or
`none`). That last line is derived at read time rather than stored, for exactly
the same reason as everything else in this document: a stored flag would need
updating on every tick and untick, and a stale flag does not error, it
confidently lies.

== Four values decide whether she is interrupted

When the late pages are placed against a letter she already confirmed, the
letter is read again as a whole, and then the new reading is compared to the
stored one on four values.

#tbl(
  columns: (auto, 1fr),
  [`action_required`], [What she has to do],
  [`due_date`], [Which day],
  [`due_time`], [What time, if it is an appointment],
  [`amount`], [How much],
)

If any of them changed, the letter goes back to needing review and she is asked
again, in a row that looks exactly like a new letter. If none of them changed,
the letter is updated silently and she is not told anything.

#why[
  *That comparison is code, not judgement.* Whether these pages belong to that
  letter, and what the letter now says, are the model's answers. Whether that
  changes what she has to do is `!=` on four values. Keeping it that way means
  the rule can be demonstrated and tested, instead of being a second
  probabilistic surface with no ground truth behind it.

  `amount` is in the list even though it is not literally "what and when". She
  still has to pay the AGL bill on the fifteenth whether it is \$347 or \$412,
  but paying the wrong number is a harm she carries.
]

Two things follow that are easy to miss. First, the letter's identity is never
on screen: she is never told "this was a late page for the letter you checked
on Tuesday", because that is our housekeeping and it costs her attention to
read. Second, every silent update is recorded in `matching_runs`, because it is
the one class of decision this system makes on her behalf that is invisible by
construction. If it is ever wrong, nothing else will surface it.

#part("Your letters")

#spread(
  "figures/16-letters-folders.png",
  [Months as folders, newest first, each letter named by what the reading found.
   Reached from a quiet line at the bottom of Home, not a fourth tab.],
  [
    Two screens in this product promise that a photograph is kept. This is
    where that promise is kept.

    It is the search projection, made visible. The months are the first level of
    the path the matcher globs over; the names are the sender and the type it
    read off the letterhead. Nothing has been renamed in storage, and there is
    no filing system underneath: the folder view is a rendering of the same
    letters, computed from the same reading.

    Letters that never became a task live here too. The one we apologised for
    is in the `No date` folder with its photograph and its note. So is the
    membership form with no date on it, next to the task it made.

    It is deliberately a quiet door. She can ignore this screen for a year and
    lose nothing, which is why it is a line at the bottom of Home rather than a
    tab competing for attention with the two things she actually has to do.
  ],
)

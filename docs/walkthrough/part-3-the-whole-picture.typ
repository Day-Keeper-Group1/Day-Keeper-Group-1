#import "lib.typ": *

#part("Where the model is called")

One place in the whole product calls a model. Everything downstream of it is
ordinary code and ordinary SQL, which is worth saying plainly because it is the
opposite of how a product like this is usually imagined.

#v(6pt)
#image("figures/d3-model-call.png", width: 100%)
#v(3pt)
#block[
  #set text(font: sans, size: 8.5pt, fill: ink-dim)
  #set par(justify: false, leading: 0.5em)
  The single call, and six things that look like judgement and are not.
]

#why[
  *Why a vision model rather than reading the text first.* A letter is designed
  for a human eye. Its meaning is carried by position: a box drawn around the
  number that matters, a heading in bold, and five payment methods printed side
  by side, each with its own reference number and nothing but a column to say
  which belongs to which. Text extraction keeps the characters and throws away
  the arrangement, and the arrangement is where half the meaning was. Reading
  the words first and then paying a second model to put the meaning back is
  discarding the evidence and then buying a guess.
]

The bottom half of that diagram is the more useful one. Six questions that sound
like they need judgement, and every one of them is a line of ordinary code:
whether a task is overdue, whose letters get read back, when a reminder goes
out, whether to send it, whether the upload can be read at all, and which letter
a page belongs to. The last of those used to need a model. It does not any more,
because she settles it by taking the photographs together.

#part("The ten tables")#anchor(<tables>)

The next page is the whole database at once, laid out along the same journey as
the previous part. Two things in it are worth knowing before you look, because
both are absences and an absence is easy to read past.

*The third column is empty.* The step where she checks the reading writes
nothing, because the screen shows and never asks, so there is no answer for it
to record. Every design that asked her a question needed somewhere to put the
answer, and this one does not.

*Nothing derivable is stored.* There is no overdue column, no reminders-off
flag, and no count of anything. Each of those would be a second copy of a truth
that already exists, and a second copy is a thing that can disagree with the
first. Whether a task is overdue is a comparison made at the moment somebody
asks, and whether its reminders are off is simply whether the tick is set.

The definition of every column, and the reason it exists, is in
#raw("db/schema.sql"). That file is the database rather than a description of
it: there are no migrations, so editing it and running #raw("npm run db:reset")
is the whole of changing the schema.

#page(flipped: true)[
  #v(4pt)
  #image("figures/d4-tables.png", width: 100%)
  #v(4pt)
  #block[
    #set text(font: sans, size: 9pt, fill: ink-dim)
    #set par(justify: false, leading: 0.55em)
    The last two steps share a column because they write at the same moment and
    neither writes the other: the reminder records what it decided, and the tick
    records that she is done.
  ]
]

#part("What is not settled")

This document describes a design, and a design has edges. These are the ones
that are known rather than the ones that are hidden.

#tbl(
  columns: (44mm, 1fr),
  [*Open question*], [*What is known about it*],

  [Who runs the clock], [The reminder rows and the rule for reading the tick are
  settled. What actually wakes up at nine in the morning, and where it runs, is
  not.],

  [How a reminder reaches her], [The row carries a channel. In app is drawn on
  the screens; email needs a sender the project does not have yet, and so does
  password reset.],

  [The upload at its limits], [A page count and a size are checked. What the
  screen does when a photograph is enormous, or when the connection drops
  halfway, is not drawn.],

  [Rate limiting on sign in], [The password hashing is deliberate and slow. The
  number of attempts is not yet bounded.],

  [Which model], [The reading is written against an interface rather than a
  provider, so the choice is a swap of one file. Which model, and how it is
  paid for, is being settled outside this document.],
)

#part("Where the answers live")#anchor(<jobs>)

Every fact in this repository has one home, and the home is usually the thing
itself rather than a document about it. This table is how to find it. If a
document and the code disagree, the code is right, which is why the code is
where the reasoning was put.

#tbl(
  columns: (1fr, 62mm),
  [*If you want to know*], [*Open*],

  [what this release builds, and what it does not], [`docs/scope.md`],
  [how to run the whole thing], [`docs/start-here.md`],
  [what each endpoint takes and returns], [`docs/api.md`],
  [the six fields, and why six is a floor], [`src/lib/contract/fields.ts`],
  [what a field status means, and `open_payload`], [`src/lib/contract/extraction.ts`],
  [why the review screen has no inputs], [`src/lib/contract/api.ts`],
  [the reminder ladder, and the clock check], [`src/lib/contract/reminders.ts`],
  [why every date is Melbourne and date only], [`src/lib/contract/dates.ts`],
  [every table and every column, with reasons], [`db/schema.sql`],
  [what a reader has to promise], [`src/server/extraction/provider.ts`],
  [how the mock reader misbehaves, and why], [`src/server/extraction/mock-provider.ts`],
  [sessions, and why the passwords are hashed that way], [`src/server/auth/`],
  [where the photographs live], [`src/server/storage.ts`],
  [the palette, the contrast, the type sizes], [`docs/theme.md`],
  [the conventions, and why this is one application], [`AGENTS.md`],
)

#v(4pt)

About to change something? Read #raw("docs/scope.md") first to see whether it is
in this release at all, then find the file above. This document is a tour, and a
tour is not a source: it is rebuilt from those files rather than the other way
round.

#import "lib.typ": *

#pagebreak()

#part("Where a model is called, and where it is not")#anchor(<models>)

The walk is over, so it is worth saying plainly where the intelligence in this
system actually sits, because "an AI app" usually means something vaguer than
what is going on here.

There are exactly two places a model is called. One looks at the photographs.
One searches what she already has. Everything else in the product is ordinary
code and ordinary SQL.

#v(4pt)
#image("figures/d6-models.png", width: 100%)
#v(8pt)

Two things on that picture are worth pausing on.

*The photographs are looked at once.* The pass that divides the pile is the same
pass that reads the fields, because the evidence for a page boundary is visual
and almost none of it survives being flattened into text. Splitting that into
two calls would mean paying twice and paying the second one to reconstruct what
the first one could already see.

*The seams are code, on purpose.* Whether these pages belong to that letter is
judgement, and it is the model's. Whether what she has to do has changed is
`!=` on four values. Whose archive gets searched is a `WHERE` clause the model
cannot set. Whether a manifest contradicts itself is arithmetic on page numbers.
Each of those is a place where being probably right was not good enough, so it
was moved somewhere it can be tested.

One consequence is worth stating for anyone deciding how much model access this
project needs: *the product runs end to end without any.* The default reader is
a mock that takes a few seconds, hedges about the due date roughly half the
time, cannot read the reference about one time in five, and fails outright about
one document in eight. That is deliberate. A mock that always succeeds instantly
produces an interface with no waiting state, no failure path and no hedging to
handle, and all three of those are where this product actually lives. Model
access changes the accuracy numbers, not whether the thing works.

#pagebreak()

#page(flipped: true, margin: (x: 18mm, top: 16mm, bottom: 14mm))[
  #anchor(<schemamap>)
  #block[
    #set text(font: sans, size: 15pt, fill: primary, weight: 700)
    The fourteen tables, and when each one is written
    #v(-1pt)
    #line(length: 100%, stroke: 0.6pt + rule)
  ]
  #v(2pt)
  #block[
    #set text(size: 9.5pt, fill: ink-dim)
    #set par(justify: false)
    The five steps along the top are the walk you have just taken. The ten
    tables under them carry a badge saying which steps write them; the four at
    the bottom sit off the path a letter travels. Step four has no badge
    anywhere, because the calendar writes nothing at all.
  ]
  #v(4pt)
  #align(center, image("figures/20-schema-map.png", height: 153mm, fit: "contain"))
]

#part("The decisions behind all of this")#anchor(<adrs>)

Everything in this document came from one of eight written decisions. They live
in `docs/architecture/` in the repository, one file each, and each one records
what was decided, what it was decided against, and what would have to be true
for it to be wrong. When something in the code looks odd, the reason is in one
of these rather than lost in a chat log.

#tbl(
  columns: (auto, 1fr, auto),
  [*ADR*], [*What it settles*], [*Where you saw it*],
  [001], [One Next.js application. The pages and the API are one project, deployed as one thing. No second service to keep in step.], [p. #pageof(<pieces>)],
  [002], [Our own users table and sessions as rows, reached through exactly one function, so that adopting a managed provider later replaces one file.], [p. #pageof(<auth>)],
  [003], [Plain PostgreSQL, one schema file, no migrations, and the photographs in an S3 bucket from the first day rather than on a disk we would have to unwrite.], [p. #pageof(<s1>)],
  [004], [Six fields as the floor, one provider interface, and a mock reader that fails and hedges on purpose so the interface has to handle both.], [p. #pageof(<s3>)],
  [005], [An upload is a pile, and the reading decides where the letters divide. No screen asks a person to confirm that division.], [p. #pageof(<s2>)],
  [006], [The matcher searches its own archive with glob, grep and read, over a view of the database rather than a copy.], [p. #pageof(<matching>)],
  [007], [The tick is the only state a task stores, and the clock checks it at the moment it rings.], [p. #pageof(<s6>)],
  [008], [The product shows, it never asks. Nothing is editable, hedged values never reach a screen, and the camera is the one remedy.], [p. #pageof(<hedge>)],
)

Two habits run through all eight, and they are worth stating on their own
because they explain decisions this document has not had room for.

== Every guard is becoming a missing path rather than a checkpoint

The calendar cannot show an unchecked date, because the calendar has no data of
its own. The dispatcher cannot nag about a finished task, because it reads the
task at the moment it rings. A hedged value cannot be acted on, because it is
never allowed to become actionable in the first place. None of those are
enforced by a check that somebody has to remember to write, and none of them
can be broken by somebody forgetting.

This is a deliberate direction rather than a coincidence. A checkpoint is a
promise that everybody will keep calling it. A missing path is a promise the
architecture keeps whether anyone is paying attention or not, and on a
five-person team over eight weeks that difference decides which promises are
still true at the end.

== The more chaotic the input, the more the answer has to be judgement

A person photographing a week of post produces input that obeys no rule, and
every attempt to write one down smuggles in an assumption nobody agreed to.
That is why the dividing is the model's answer and not a loop over page
boundaries, and why finding a letter in the archive is a search the model runs
rather than a query we wrote in advance.

The other half of the habit matters as much: *where judgement ends, code
begins, and the seam is always something binary.* Whether these pages belong to
that letter is judgement. Whether what she must do has changed is `!=` on four
values. Whether a manifest is self-consistent is arithmetic on page numbers.
Whose archive gets searched is a `WHERE` clause the model cannot set. Each of
those is a place where being merely probably right was not good enough, so it
was moved out of the model's hands and into something that can be tested.

#pagebreak()

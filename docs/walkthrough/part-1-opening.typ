#import "lib.typ": *

#part("The pile")

Margaret Wilson is 78. She lives alone in a brick house in the northern suburbs
of Melbourne, her cataracts are getting worse, and every bill she has still
arrives on paper. Her daughter is in Sydney and helps by phone. She has a
smartphone, and she uses it for calls and for photographs.

Once a week she clears the pile that has built up by the front door. She
photographs it the way anyone would: whatever is on top, then whatever is under
that. What she posts looks like this.

#v(4pt)
#image("figures/d1-the-pile.png", width: 100%)
#v(10pt)

Read it again in order and the problem states itself. The electricity bill is
photographs one and three, with a different letter in between. Photograph nine
holds two letters at once, because they were lying side by side on the table.
One is a picture of her grandson. One is a real letter too blurred to read, and
one is handwriting that nothing will ever read.

*There is no rule that sorts this.* Every rule anybody proposes encodes an
expectation, and the defining property of this input is that there is no
expectation to encode. Somebody picking photographs out of an album destroys any
convention before it exists.

That is the sentence the rest of this document answers. Nearly every decision
here traces back to that pile: why the reading and not our code decides where
the letters divide, why no screen asks her to confirm any of it, why the whole
product has only two verbs, and why the calendar is built so that a value nobody
checked has no path to reach it.

#why[
  *One thing to know before the screens.* The prototype has a fixed fictional
  today: *Monday 10 August 2026*. Every date in every screenshot is relative to
  it, which is why the water bill due on the fifth is already late and the
  pension form due on the eleventh is not. The prototype wears this date in its
  toolbar so nobody has to guess.
]

#part("What she gets back")

#grid(
  columns: (1fr, 1fr),
  gutter: 6mm,
  screen("figures/07-calendar.png",
    [The calendar. Red is a due date, gold is a morning she will be reminded.]),
  screen("figures/11-home-three-faces.png",
    [The list. Overdue in words at the top, upcoming below, done and struck
     through but still on the list.]),
)

#v(6pt)

One list of what to do and the day it has to be done, and a calendar drawn from
that same list. From where she is standing, that is the whole product.

The way she operates it is *two verbs: photograph, and tick.* She never types a
date, never sorts pages, never files anything, never names a document, and never
opens a settings screen to make any of it work. Everything else in this document
exists to keep that true.

#promise[
  Nothing happens until you say so, and never from a date you haven't checked.
]

That promise is on the review screen, and it is the sentence this document keeps
coming back to. The interesting part is that it is not kept by being careful. It
is kept by there being no path.

Who she is matters to the design more than usual, because the people this
product is for are the ones least able to absorb a mistake it makes. Eyes over
seventy, a memory that is not reliable, and a lifetime of assuming that when a
computer says no it is their own fault. So body text clears 7:1 contrast rather
than the usual 4.5:1, nothing is blue, colour is never the only signal, and an
error message never opens by describing something she did.

#v(6pt)
#image("figures/19-journey-strip.png", width: 100%)
#v(3pt)
#block[
  #set text(font: sans, size: 8.5pt, fill: ink-dim)
  #set par(justify: false)
  The five steps a letter goes through, which are also the middle of this
  document and the strip along the top of the database map on page
  #pageof(<schemamap>).
]

#v(6pt)

Five parts follow. This one. Then one letter's whole life, from the photograph
to the tick, which is five steps and most of the pages. Then what happens when
it does not go well, which is where a product like this is actually judged. Then
the fourteen tables, where a model is called, and the decisions behind all of
it. Finally what is still open, and where to start reading if you are about to
change something.

#part("The pieces")#anchor(<pieces>)

Seven things do all the work. Everything later in this document is one of them
doing its job.

#v(4pt)

#let piece(name, body) = box(
  fill: paper,
  stroke: 0.8pt + rule,
  radius: 4pt,
  inset: (x: 8pt, y: 7pt),
  width: 100%,
)[
  #set text(font: sans, size: 9pt, weight: 700, fill: primary)
  #name
  #v(2pt)
  #set text(font: serif, size: 8.5pt, weight: 400, fill: ink-dim)
  #set par(justify: false, leading: 0.5em)
  #body
]

#let arrow = align(horizon)[#text(size: 14pt, fill: rule)[→]]

#block(breakable: false)[
#grid(
  columns: (32mm, 6mm, 1fr, 6mm, 46mm),
  rows: (auto),
  gutter: 0pt,
  align: horizon,
  piece("Her browser")[
    A web page on a phone. No app store, no install.
  ],
  arrow,
  piece("One application")[
    The pages and the API are one Next.js project, deployed as one thing. There
    is no second service to keep in step with the first.
  ],
  arrow,
  grid(
    rows: (auto, auto, auto),
    row-gutter: 4pt,
    piece("PostgreSQL")[Fourteen tables. Everything except the photographs.],
    piece("An S3 bucket")[The photographs. MinIO on a laptop, a real bucket later; same protocol either way.],
    piece("Two model jobs")[One reads the pictures. One searches the archive.],
  ),
)

#v(6pt)

#grid(
  columns: (42mm, 6mm, 1fr),
  gutter: 0pt,
  align: horizon,
  piece("A clock")[
    Wakes up, sees which reminders are due, and decides one thing about each.
  ],
  arrow,
  [
    #set text(size: 9.5pt)
    #set par(justify: false, leading: 0.55em)
    The clock is separate from everything above because it runs when nobody is
    looking at anything. It is the only part of the system that acts without a
    person having just tapped something, which is exactly why step 6 spends a
    page on what it is allowed to decide.
  ],
)
]

#v(8pt)

*One application rather than two.* The project description names React and
Next.js in the same breath as Python and FastAPI, which reads as an invitation
to build a front end talking to a Python API. The scaffold this project stands
on was already a single Next.js application, and the decision was to keep it
that way. A second service is a permanent tax: two dependency sets, two
deployments, a network boundary to authenticate across, and a second set of
types kept identical to the first by hand. The one honest argument for Python is
that the AI ecosystem lives there, and it does not apply here, because calling a
vision model is an HTTP request in any language.

#pagebreak()

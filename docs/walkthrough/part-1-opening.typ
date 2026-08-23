#import "lib.typ": *

#part("The letter by the front door")

Margaret Wilson is 78. She lives alone in a brick house in the northern suburbs
of Melbourne, her cataracts are getting worse, and every bill she has still
arrives on paper. Her daughter is in Sydney and helps by phone. She has a
smartphone, and she uses it for calls and for photographs.

A letter arrives. It is a bill, or a form, or an appointment. Somewhere in it is
a date, and somewhere else is the one thing she has to do before that date. The
letter is designed to be read by a person with time and good light, and it will
sit by the front door until she has both.

What goes wrong is not that she cannot read it. It is that reading it is not
enough. The date has to survive the week between reading the letter and acting
on it, and nothing in the house is doing that job. Her daughter's phone calls
are doing that job.

*This product does one thing: it makes the date outlive the letter.* She
photographs the letter, and the date it carries becomes a task, a place on a
calendar, and three reminders. That is the whole of it.

#why[
  *One thing to know before the screens.* The prototype has a fixed fictional
  today: *Monday 10 August 2026*. Every date in every screenshot is relative to
  it, which is why the water bill due on the fifth is already late and the
  pension form due on the eleventh is not. The prototype wears this date in its
  toolbar so nobody has to guess.
]

#part("What she gets back")

#screens(
  "figures/09-home-task.png",
  "figures/08-calendar.png",
  [The list, and the calendar drawn from it. Overdue is told in words at the top
   rather than in red, because colour is never the only signal here.],
)

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

#part("What this release is, and what it is not")

This is the first release, and it is deliberately narrow. One upload is one
letter. It may run to several pages, and every photograph in it belongs to that
one letter, because she said so by taking them together.

That sentence is doing a lot of work. A larger design accepted a pile of mixed
post at once, worked out where one letter ended and the next began, and joined a
later upload to a letter already in the system. Each of those needed its own
model, its own prompt, its own way of being wrong quietly. Removing them is what
turns the rest of this document into something a small team finishes.

What is left is one model call whose answer has a fixed shape, and after that a
system made of tables, dates and a checkbox. The full list of what is in and
what is deferred is #raw("docs/scope.md"), which every other document in this
repository defers to.

#part("The pieces")#anchor(<pieces>)

Six things do all the work. Everything later in this document is one of them
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
    The pages, the API and the database access are one Next.js project in
    TypeScript, deployed as one thing.
  ],
  arrow,
  grid(
    rows: (auto, auto, auto),
    row-gutter: 4pt,
    piece("PostgreSQL")[Ten tables. Everything except the photographs.],
    piece("An S3 bucket")[The photographs. MinIO on a laptop, a real bucket later; same protocol either way.],
    piece("One model call")[It looks at the pages and returns six fields. Nothing else in the product calls a model.],
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
    person having just tapped something, which is exactly why the reminder step
    spends a page on what it is allowed to decide.
  ],
)
]

#v(8pt)

*One application, one language.* The pages, the route handlers and the database
access are one Next.js project in TypeScript. The gain shows up in
#raw("src/lib/contract/"): those types are the agreement between the browser and
the server, and both sides import the same file, so changing the shape of a
response is a compile error on both sides at once. Anything the browser must
never see is marked #raw("server-only"), which turns a leak into a build error
rather than a discovery. One dependency set, one deployment, one test run, and
one place to look when something is wrong.



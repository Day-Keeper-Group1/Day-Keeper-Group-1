// Page design and reusable pieces for the DayKeeper walkthrough.
//
// The palette is the product's own (Eucalypt & Wattle, docs/theme.md), so the
// document and the thing it describes look like they come from one place.

#let ink       = rgb("#1c1a15")
#let ink-dim   = rgb("#454b41")
#let rule      = rgb("#8a8265")
#let primary   = rgb("#17452c")
#let soft      = rgb("#d9e5d5")
#let warn-bg   = rgb("#f0e6cd")
#let warn-ink  = rgb("#4a3b20")
#let paper     = rgb("#fbf8f0")
#let sand      = rgb("#f4f0e4")

#let sans = ("Segoe UI", "Calibri", "Arial")
#let serif = ("Cambria", "Georgia", "Times New Roman")
#let mono = ("Consolas", "Courier New")

#let doc(body) = {
  set page(
    paper: "a4",
    margin: (x: 20mm, top: 22mm, bottom: 20mm),
    footer: context {
      let n = counter(page).get().first()
      if n > 1 {
        set text(size: 8.5pt, fill: ink-dim, font: sans)
        grid(
          columns: (1fr, auto),
          align: (left, right),
          [DayKeeper · P000473SE · Group 1],
          [#n],
        )
      }
    },
  )

  set text(font: serif, size: 10.5pt, fill: ink, lang: "en", hyphenate: true)
  set par(justify: true, leading: 0.62em, spacing: 1.1em)

  show heading.where(level: 1): it => block(above: 1.6em, below: 0.9em)[
    #set text(font: sans, size: 16pt, fill: primary, weight: 700)
    #it.body
  ]
  show heading.where(level: 2): it => block(above: 1.4em, below: 0.6em)[
    #set text(font: sans, size: 11pt, fill: primary, weight: 700)
    #it.body
  ]
  show raw: set text(font: mono, size: 9pt)
  show link: set text(fill: primary)

  body
}

// The cover. One picture, one sentence about what this is.
#let cover(figure-path) = {
  set page(margin: (x: 20mm, top: 26mm, bottom: 22mm))
  set text(hyphenate: false)
  v(0.35fr)
  grid(
    columns: (1fr, 62mm),
    gutter: 12mm,
    [
      #set text(font: sans)
      #text(size: 9.5pt, fill: ink-dim, tracking: 1.2pt)[RMIT COSC2648 · P000473SE · GROUP 1]
      #v(4pt)
      #text(size: 30pt, fill: primary, weight: 700)[DayKeeper]
      #v(-6pt)
      #block(width: 100%)[
        #set text(size: 15pt, fill: ink, weight: 400)
        A walk through the product, and the machinery behind each screen
      ]
      #v(10pt)
      #line(length: 100%, stroke: 0.8pt + rule)
      #v(10pt)
      #set text(font: serif, size: 10.5pt, fill: ink)
      #set par(justify: false, leading: 0.62em)
      This document follows one letter from the moment it is photographed to the
      moment the task it became is ticked off. Every screen you see is the
      working prototype; under each one is what the system does, which tables it
      writes, and why it was designed that way rather than another way.

      #v(6pt)
      It describes the shape of the system, not the state of the work. The board
      says who is doing what this week; this says what the thing is.

      #v(14pt)
      #set text(font: sans, size: 9.5pt, fill: ink-dim)
      #grid(
        columns: (auto, 1fr),
        row-gutter: 5pt,
        column-gutter: 10pt,
        [Written by], [Junchun Zhang, technical lead],
        [For], [Dr Golnoush Abaei (supervisor), and the team],
        [Screens], [the clickable prototype, `docs/prototype/user/`],
        [Version], [1.0],
      )
    ],
    image(figure-path, width: 100%),
  )
  v(1fr)
  line(length: 100%, stroke: 0.8pt + rule)
  v(4pt)
  block[
    #set text(font: sans, size: 9pt, fill: ink-dim)
    #grid(
      columns: (1fr, auto),
      align: (left, right),
      [Two verbs: photograph, and tick.],
      [Eucalypt \& Wattle, the team's theme, is the palette of this document too.],
    )
  ]
  pagebreak()
}

// A step number and its title, as a running band. Sticky, so a band can never
// be left stranded at the bottom of a page while its content starts the next.
#let step(n, title) = block(above: 1.8em, below: 1.0em, breakable: false, sticky: true)[
  #grid(
    columns: (auto, 1fr),
    gutter: 8pt,
    align: horizon,
    box(fill: primary, inset: (x: 7pt, y: 4pt), radius: 3pt)[
      #set text(font: sans, size: 8.5pt, fill: paper, weight: 700, tracking: 0.5pt)
      STEP #n
    ],
    [#set text(font: sans, size: 15pt, fill: primary, weight: 700)
     #title],
  )
  #v(-2pt)
  #line(length: 100%, stroke: 0.6pt + rule)
]

// A section that is not one of her steps. Sticky for the same reason as step.
#let part(title) = block(above: 1.8em, below: 1.0em, breakable: false, sticky: true)[
  #set text(font: sans, size: 15pt, fill: primary, weight: 700)
  #title
  #v(-2pt)
  #line(length: 100%, stroke: 0.6pt + rule)
]

// A phone screenshot with a caption under it.
#let screen(path, caption) = [
  #image(path, width: 100%)
  #v(3pt)
  #set text(font: sans, size: 8.5pt, fill: ink-dim)
  #set par(justify: false, leading: 0.5em)
  #caption
]

// Two screenshots side by side, sharing one caption. Sized by height rather
// than width: a phone screenshot is twice as tall as it is wide, so two of them
// at full column width eat most of a page and push whatever follows off it.
#let screens(a, b, caption, height: 96mm) = [
  #grid(
    columns: (1fr, 1fr),
    gutter: 5mm,
    align: center,
    image(a, height: height),
    image(b, height: height),
  )
  #v(3pt)
  #set text(font: sans, size: 8.5pt, fill: ink-dim)
  #set par(justify: false, leading: 0.5em)
  #caption
]

// Screenshot on the left, prose on the right. `w` is the screenshot column;
// narrowing it is the knob for fitting a diagram on the same page.
#let spread(path, caption, body, w: 56mm) = grid(
  columns: (w, 1fr),
  gutter: 9mm,
  screen(path, caption),
  body,
)

// The reason a thing is the way it is. Used sparingly.
#let why(body) = block(
  fill: warn-bg,
  inset: (x: 11pt, y: 9pt),
  radius: 4pt,
  width: 100%,
  above: 1.1em,
  below: 1.1em,
)[
  #set text(size: 10pt, fill: warn-ink)
  #body
]

// Something the product promises on screen, in its own words.
#let promise(body) = block(
  inset: (left: 12pt, y: 2pt),
  stroke: (left: 2.5pt + primary),
  width: 100%,
  above: 1.1em,
  below: 1.1em,
)[
  #set text(size: 11pt, fill: primary, style: "italic")
  #body
]

#let tbl(..args) = block(above: 1.1em, below: 1.2em)[
  #set text(size: 9.5pt)
  #table(
    stroke: (x, y) => (
      top: if y <= 1 { 0.6pt + rule } else { 0.3pt + rule.lighten(40%) },
      bottom: 0.6pt + rule,
    ),
    inset: (x: 6pt, y: 6pt),
    fill: (x, y) => if y == 0 { soft.lighten(40%) },
    ..args,
  )
]

// A table name, written the way the schema writes it.
#let t(name) = raw(name)

// An anchor to point a page reference at, and the reference itself. Page
// numbers are computed rather than typed, so nothing goes stale when a
// paragraph grows.
#let anchor(lbl) = [#metadata(none)#lbl]
#let pageof(lbl) = context [#counter(page).at(lbl).first()]

// Which tables a step writes, as a strip under the step band.
#let writes(..names) = block(below: 1.2em, sticky: true)[
  #set text(font: sans, size: 9pt, fill: ink-dim)
  Writes:
  #h(3pt)
  #if names.pos().len() == 0 { text(style: "italic")[nothing at all] }
  #names.pos().map(n => box(
    fill: sand,
    inset: (x: 6pt, y: 3pt),
    radius: 3pt,
    text(font: mono, size: 8.5pt, fill: ink, n),
  )).join(h(4pt))
]

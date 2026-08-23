# The walkthrough

`DayKeeper-walkthrough.pdf` follows one letter from the moment it is
photographed to the moment the task it became is ticked off. Every screen in it
is the working prototype; under each one is what the system does, which tables
it writes, and why it was designed that way rather than another way.

It describes the shape of the system, not the state of the work. The board says
who is doing what this week; this says what the thing is. It is also derived
rather than authoritative: the facts live in the files it points at, and if this
document and the code disagree, the code is right. See
[`../scope.md`](../scope.md) for what this release builds.

Read it if you are new here, or if you are about to change something and want
to know what it is connected to. The last page maps jobs to files.

## Rebuilding it

```bash
typst compile main.typ DayKeeper-walkthrough.pdf
```

`main.typ` is a spine that includes three parts: the opening, one letter's whole
life, and the whole picture. `lib.typ` holds the page design and the reusable
pieces (the step band, the screenshot layouts, the why block, the tables). Page
references inside the document are computed from anchors, so a paragraph can
grow without a cross-reference going stale.

## The pictures

`figures/` holds every image the PDF places, and they come from two places.

**Product screenshots** (`01-` to `13-`) are captures of
[`../prototype/user/daykeeper-sketch-live.html`](../prototype/user/daykeeper-sketch-live.html),
taken with the prototype driven into the state the caption describes. The
prototype exposes its own step functions on `window` (`signIn`, `addPhoto`,
`uploadLetter`, `openReview`, `confirmItem`, `toggleDone`, `openLetter`,
`openDay`, `go`, `reset`), so a capture script drives it by calling those rather
than by clicking. Capture the `.phone` element. Hide `#toast` first unless the
notification is the point of the shot, and set the phone's height to `auto` for
a screen taller than the frame.

**Diagrams** (`d1-` to `d4-`) are drawn as HTML in `diagrams/`, one file each,
sharing `diagrams/_style.css`. They use the product's own palette so a diagram
and a screenshot on the same page look like they come from one place.
`diagrams/source-images/` holds the letters a diagram embeds, which are
synthetic documents from the sample set.

To change a diagram, edit its HTML, open it in a browser, then capture the
`.sheet` element and save the result over the matching file in `figures/`. Two
things matter when capturing:

- **Set `document.body.style.zoom = '2'` before the capture.** A diagram is
  about 1500 CSS pixels wide and lands at 170mm on the page, so a capture at
  one times device pixels is too soft to read in print.
- **Keep body text in a diagram at 15px or larger.** At the size these land on
  the page, anything smaller falls below five points. Carry fewer words rather
  than smaller ones.

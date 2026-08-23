# The theme: Eucalypt & Wattle

Adopted 10 August 2026. A deep eucalypt green carries the weight, and wattle
gold appears only where something has to be seen.

The values are not decoration. This product is used by people who are mostly
over 70, and several of the choices below are the reason it is usable by them
at all. Read this page before changing a colour.

## Where it lives

| | |
|---|---|
| `src/app/globals.css` | **canonical.** The palette, plus shadcn's names pointed at it |
| `docs/prototype/user/daykeeper-sketch-live.html` | the same values inline, because that file has to open standalone. **The worked example**: open it in a browser to see what the theme is meant to look like on every screen |
| this file | what each token is for, and what it was measured against |

`tests/theme.test.ts` compares all three and fails if they disagree, so a value
changed in one place is caught rather than discovered months later on a screen
nobody was looking at.

## The five rules

Break one of these and choosing this theme was pointless.

**1. Body text clears 7:1, not 4.5:1.** Contrast sensitivity falls by as much
as 83% by age 80. WCAG AA is a floor written for the general population; this
product holds itself to AAA for body text and 3:1 for anything non-text that
carries meaning.

**2. Nothing is blue.** An ageing eye needs roughly 2400ms longer to tell blue
from yellow, so blue cannot carry anything that has to be caught quickly, and
it is not the primary colour. The lens yellows with age; blues drift and flatten.

**3. No pure white and no pure black.** White grounds glare badly for cataracts
and macular degeneration. The page and card tones are warm, aged-paper colours,
and the darkest ink still carries a trace of warmth.

**4. Gold is never text.** Saturated yellow on a light ground reaches about
2:1, which is a trap rather than a colour. Gold appears in exactly two places:
the lining of the focus ring, and the reminder dot on the calendar.

**5. Colour is never the only signal.** Every state carries a word as well as a
colour, and the selected tab is marked by weight and a bar rather than by hue.
Colour vision deficiency is common in this age group; a state that is only a
colour is a state some readers cannot see.

## The palette

| token | value | what it is for |
|---|---|---|
| `--bg` | `#f4f0e4` | the page. Warm paper, never white |
| `--bg-card` | `#fbf8f0` | cards, sheets, the bottom bar |
| `--ink` | `#1c1a15` | body text. Near-black with a trace of warmth |
| `--ink-dim` | `#454b41` | secondary text, still clearing 7:1 |
| `--line` | `#8a8265` | borders and rules. Deliberately dark enough to see: a person who cannot find the edge of an input does not know where to tap |
| `--primary` | `#17452c` | the pressable things. A dim, yellow-leaning green: drift towards teal and it becomes a SaaS dashboard, towards grey and it becomes a uniform |
| `--primary-ink` | `#f7f4ea` | text and icons on primary |
| `--primary-soft` | `#d9e5d5` | quiet green fills: thumbnails, the capture panel, calendar arrows |
| `--focus` | `#191a12` | the focus ring itself. Near-black, and thick |
| `--focus-ink` | `#ffd21f` | the gold lining inside the focus ring. Never text |
| `--danger` | `#8c0d07` | destructive, and a check that turned an upload away. Never the overdue state: overdue is told in words, see `src/lib/contract/api.ts` |
| `--danger-bg` | `#fbe6e2` | the tint behind danger text |
| `--success` | `#0f5130` | done, confirmed |
| `--success-bg` | `#d3e7d9` | the tint behind success text |
| `--warn-ink` | `#4a3b20` | bark brown: "we are not sure, please look" |
| `--warn-bg` | `#f0e6cd` | sandy yellow behind it |
| `--dot-due` | `#8c0d07` | the calendar's due marks |
| `--dot-rem` | `#b87500` | the calendar's reminder marks |

Sizes travel with the palette: `--fs-body` 19px, `--btn-h` 56px,
`--radius-card` 10px, `--radius-btn` 8px, `--border-w` 2px. Body text is at
least 18px and a primary button at least 48px tall; the corners are restrained
and the shadows almost absent, because the feel wanted here is the squareness
of officialdom rather than the roundness of a toy.

### Why "something is missing" gets no alarm colour

When a letter's date or action could not be read, the review card says so in a
sentence set in bark brown on sandy yellow rather than orange or red, and that
is deliberate: the person this is built for tends to blame herself, and an
orange exclamation mark reads as *I did something wrong*. What the message
actually means is only *the letter did not give this up; nothing goes on your
calendar*. It should feel like a pencil note in the margin of a letter, not a
parking ticket. (No screen shows a value the reader was unsure of, so there is
no "please check this" state to colour: see `src/lib/contract/api.ts`.)

### Why the focus ring is black with gold inside

The familiar government pairing is yellow with a black border, but yellow on a
light page does not clear 3:1 on its own. This inverts it: the ring is
near-black, which is about 15:1 against the page and impossible to miss, and
gold is the lining inside it, which reaches 12:1 against the black. Visually it
is still the black-and-gold warning pair, but every layer clears its line.

## Measured contrast

Every pair the interface actually renders, computed rather than eyeballed.
Lowest text pair 7.23:1, lowest non-text pair 3.37:1.

| pair | ratio | needs |
|---|---|---|
| body text on card | 16.4:1 | 7 |
| body text on page | 15.3:1 | 7 |
| secondary text on card | 8.5:1 | 7 |
| secondary text on page | 7.9:1 | 7 |
| button label on primary | 9.9:1 | 7 |
| the missing-value note on card | 10.2:1 | 7 |
| the missing-value note on its tint | 8.7:1 | 7 |
| danger text on card | 9.1:1 | 7 |
| danger on its tint | 8.1:1 | 7 |
| done on card | 8.8:1 | 7 |
| success on its tint | 7.2:1 | 7 |
| link on card | 10.3:1 | 7 |
| borders on card | 3.6:1 | 3 |
| borders on page | 3.4:1 | 3 |
| due dot on card | 9.1:1 | 3 |
| reminder dot on card | 3.5:1 | 3 |
| focus lining on ring | 12.1:1 | 3 |
| focus ring on page | 15.4:1 | 3 |

## Using it

In the application, prefer the shadcn semantic classes: `bg-background`,
`text-foreground`, `bg-card`, `bg-primary`, `text-muted-foreground`,
`border-border`. They are already pointed at this palette in `globals.css`, so
an ordinary `<Button>` comes out eucalypt green with no work.

For the states shadcn has no name for, use the DayKeeper classes:
`text-warn` on `bg-warn-bg`, `text-danger` on `bg-danger-bg`, `text-success` on
`bg-success-bg`, plus `text-ink-dim`, `border-line`, `bg-primary-soft`,
`bg-dot-due`, `bg-dot-rem`.

**Never type a hex value into a component.** If a colour you need is not in the
palette, that is a design question, not a styling one: bring it to the team
rather than inventing a nineteenth colour on the spot.

## Not decided yet

- **Dark mode.** The stock shadcn dark palette was removed rather than kept,
  because it was pure greyscale and cleared none of the rules above; leaving it
  meant one class on `<html>` could silently drop the product into an
  undesigned theme. A dark variant is real design work and gets its own
  contrast audit when someone does it.
- **The prototype's type scale.** The prototype carries the palette but its
  type is still the older, smaller scale. Build new screens at the sizes above
  rather than matching the sketch.

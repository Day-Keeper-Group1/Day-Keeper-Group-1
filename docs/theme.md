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
carries meaning. The standard says as much itself: 4.5:1 was set against
vision loss equivalent to about 20/40, which it calls the typical acuity of
an eighty year old, and 7:1 against 20/80. AA is drawn at the typical eighty
year old, and the people this is built for are the ones it stops at.

**2. Nothing is blue.** Blue costs an ageing eye measurable time. In a visual
search task, moving the colour cue from red-green to blue-yellow cost younger
observers about 170ms; the same move cost younger observers wearing lenses
that simulate an aged eye about 1000ms, and older observers about 2400ms. So
blue cannot carry anything that has to be caught quickly, and it is not the
primary colour. The lens yellows with age and lets less short-wavelength light
through; blues drift and flatten, and what colour vision loss there is in this
age group is mostly of the blue-yellow kind.

**3. No pure white and no pure black.** White grounds glare badly for cataracts
and macular degeneration; the print-accessibility guidance is to reach for a
very pale or pastel shade instead, and to settle the choice by light
reflectance value rather than by eye, with at least 20 points between two
colours and 30 preferred. The page and card tones are warm, aged-paper colours,
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

| `--button-hover` | `#123921` | the pressable things while the pointer is on them. A step darker than `--primary` rather than an opacity of it, so each high-contrast palette can name its own. Text on it clears 11.7:1 |
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

Sizes travel with the palette: `--btn-h` 56px, `--radius-card` 10px,
`--radius-btn` 8px, `--border-w` 2px. A primary button is at least 48px tall;
the corners are restrained and the shadows almost absent, because the feel
wanted here is the squareness of officialdom rather than the roundness of a
toy.

### Type

The prototype's sizes are the product's sizes: a 23px screen title, 16px task
rows, 13.5px captions, 12.5px card labels, and the rest as the prototype's CSS
sets them. `src/app/globals.css` gives each one a name (`text-title`,
`text-row`, `text-caption`, `text-label` and so on) beside the prototype rule
it comes from, and the screens drawn from the prototype use those names.

This replaces an earlier floor of 18px for body text. Applied on its own, the
floor enlarged the words without the layout they sit in, and the screens lost
the proportion that made the prototype readable in the first place: rows
wrapped, captions competed with titles, and cards crowded. Jason's ruling on
14 September 2026 was that the prototype is the design. Larger text remains
available without redesigning a screen: the phone's own text size setting, and
the Accessibility panel on desktop, both scale every one of these sizes,
because they are set in rem. `--fs-body` stays in the token block only because
the prototype carries it; nothing reads it.

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

## Where these numbers come from

The five rules were adopted on 10 August 2026 out of a study of ageing vision
and of how other products in this space handle it. The reasoning came across
into this file; the sources stayed behind in the study. This section brings
them across, added 18 September 2026, when the rules were about to be put in
front of an audience and every claim had to survive being looked up.

**Rule 1, the 83% and the 7:1 floor.** The 83% is from the W3C's own
literature review on older users, which states that "from the age of 40,
contrast sensitivity at higher spatial frequencies starts to decline until at
the age of 80 it has been reduced by up to 83%". Follow that citation and it
runs three deep: the review reads the figure off its own Figure 2, that
figure is reproduced from EveryEye (2004), and EveryEye drew it from Owsley,
Sekuler and Siemsen (1983). **So 83% is a value read off a derived chart, not
a percentage printed in the Owsley paper.** Anyone who chases it to the
primary source will find the curve and not the number, and that is the honest
answer to give them. Quote the W3C review, which is the document the figure
actually appears in.

Separately, WCAG's Understanding document explains why the threshold here is
7:1 and not 4.5:1: AA's 4.5:1 "compensated for the loss in contrast
sensitivity usually experienced by users with vision loss equivalent to
approximately 20/40 vision", and "20/40 is commonly reported as typical
visual acuity of elders at roughly age 80", while AAA's 7:1 answers to 20/80.
The two sources do different jobs. The 83% says how much is lost; the
Understanding document says which ratio that loss obliges. The argument wants
both.

**Rule 2, the 2400ms and nothing blue.** The figure is from Tamura and Sato
(2020), who ran a visual search task and reported that "among younger
observers, RTs in the CS task with distractors differed between the RG and YB
conditions by approximately 170 ms; this difference increased to 1000 and
2400 ms among younger observers with glasses and older observers,
respectively". Two things to keep straight when quoting it. It is the cost of
moving the colour cue from red-green to blue-yellow in a search task with
distractors, not a general claim that older people see blue 2400ms slower.
And the middle figure is the one that carries the argument: the same young
observers, merely wearing lenses that simulate an aged eye, went from 170ms
to 1000ms, which ties the cost to the optics rather than to age as such.

Prevalence sits beside the timing. Schneck and colleagues tested 865 people
aged 58 to 102 and found colour vision loss in this group to be predominantly
blue-yellow, attributed largely to lens yellowing. Tamura and Sato say what
it costs the people affected; Schneck says how many of them there are.

**Rule 3, no pure white.** RNIB's guidance for accessible print says to avoid
white and reach for a very pale or pastel shade, and gives a check that does
not depend on anyone's eye: at least 20 points of light reflectance value
between two colours, 30 preferred. The NIA and NLM checklist for
senior-friendly sites says the same from the other side, a light ground with
dark text but not the pure-white-on-pure-black extreme. Increased sensitivity
to bright light and glare is also a listed symptom of cataract.

**Rule 4** is arithmetic on top of the WCAG contrast formula: saturated
yellow on a light ground does not reach 3:1, so it cannot be text. **Rule 5**
follows from the prevalence in Schneck and colleagues: a state carried only
by hue is a state some of these readers cannot see.

**One caveat carried over.** The August study flagged exactly one of its own
figures as unverified: a 1.5 line height, where the note recorded that no
value specific to older users had been found and that WCAG 2.2 SC 1.4.12 Text
Spacing was standing in as a general substitute pending a second check. This
file sets no line-height rule, so nothing here rests on it. If one is ever
added, that figure needs a source of its own first.

### References

Macular Disease Foundation Australia. (n.d.). *Cataracts*.
https://www.mdfoundation.com.au/about-macular-disease/other-conditions/cataracts/

Owsley, C., Sekuler, R., & Siemsen, D. (1983). Contrast sensitivity
throughout adulthood. *Vision Research, 23*(7), 689–699.

Royal National Institute of Blind People. (n.d.). *How to choose colour and
contrast for printed materials for people with sight problems*.
https://media.rnib.org.uk/

Schneck, M. E., Haegerstrom-Portnoy, G., Lott, L. A., & Brabyn, J. A. (2014).
Comparison of panel D-15 tests in a large older population. *Optometry and
Vision Science, 91*(3), 284–290. https://doi.org/10.1097/OPX.0000000000000152

Tamura, S., & Sato, K. (2020). Age-related changes in visual search:
manipulation of colour cues based on cone contrast and opponent modulation
space. *Scientific Reports, 10*, 21328.
https://doi.org/10.1038/s41598-020-78303-4

World Wide Web Consortium. (2008). *Web accessibility for older users: A
literature review* (W3C Working Draft, 14 May 2008).
https://www.w3.org/TR/wai-age-literature/

World Wide Web Consortium. (n.d.). *Understanding success criterion 1.4.3:
Contrast (minimum)*. Web Content Accessibility Guidelines (WCAG) 2.2.
https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html

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
- **The pages not drawn from the prototype.** Sign in, register, forgot
  password, settings and accessibility keep Tailwind's own type ramp. They are
  the teammates' designs and are not measured against the prototype.

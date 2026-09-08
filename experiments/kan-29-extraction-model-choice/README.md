# KAN-29: which letters, which model, which effort

The reading step makes one model call per letter and gets back six fields. Before that call can be written into the product, two things have to be settled, and they have to be settled together: **which letters** the product promises to read, and **which model at which reasoning effort** reads them.

They are one question, not two, because stability is a property of the pair. A model that is perfect on bills and shaky on hospital letters is stable or not depending on whether hospital letters are in scope. So each experiment here fixes a set of letters and asks which model and effort is stable on that set; when nothing is, the next experiment narrows the set, or asks the same question more times, and looks again.

## What "best" means

Two criteria, in order.

**Stable first.** On every letter in scope, every field comes back right, every time. Not on average: every time. A field the model gets wrong and marks `confirmed` reaches the person's screen as fact, and the people this product is for are the least equipped to notice.

**Then cheapest.** Among the cells that are stable, the one that costs least per letter. A cell that is not stable is not in the running, however cheap.

## The four variables

An experiment is allowed to change exactly four things. Everything else is held the same across every experiment, so that when two experiments disagree the reason is one of these four and nothing else.

| Variable | What it is | Why it is a variable |
|---|---|---|
| **The letters** | Which of the synthetic letters are read. | Scope is a decision, and narrowing it is the main way a later experiment differs from an earlier one. |
| **The prompt** | What the model is told. | It has not changed yet. That does not make it a constant; it makes it a variable nobody has moved. |
| **The cells** | Which model, at which reasoning effort. | This is the choice being made. |
| **The repeats** | How many times each cell reads each letter. | One read cannot tell a real difference from ordinary variation. Asking again is how you find out which it was. |

## The letters

They are in [`data/synthetic-letters/`](../../data/synthetic-letters/), one folder each, with its pages and the answer key it is supposed to yield. They are synthetic: modelled on Australian correspondence a person in this position actually receives, with no real person, account or amount in them. The answer key was written when the letter was generated, not read back off the page, so a model and the key can disagree about what the page actually supports; where that happens it is recorded, not hidden.

## The experiments

| Folder | What it asked | What it found |
|---|---|---|
| [`01-full-grid/`](01-full-grid/) | On all fifteen letters, both models at all six efforts, one read each: which cells are stable? | Four cells scored full marks, at both ends of the effort scale for both models, with misses in between. That is more than one winner and less than a pattern, and one read per cell cannot say which. |

## Reading a results table

Each experiment's table has one row per cell. **Letters all right** is the stability column: a cell has to be full there before its cost is worth looking at. **Wrong and confirmed** is the number that matters most: a field the model got wrong and marked `confirmed`, which is the only kind of mistake a person ever sees, because the product hides `uncertain` and `unreadable` fields from the screen.

**Cost per letter** is Azure's published list price multiplied by the tokens Azure reported. What RACE pays per token is not known to the team, so it is an estimate at list, not an invoice; the price and exchange rate carry the date they were taken. **Seconds** were measured with several calls in flight at once and describe that condition, not one call on an idle connection.

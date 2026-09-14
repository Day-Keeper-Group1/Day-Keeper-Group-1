# Module 1, extraction: which letters, which model, which effort

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
| [`01-full-grid/`](01-full-grid/REPORT.md) | On all fifteen letters, both models at all six efforts, one read each: which cells are stable? | Four cells scored full marks, at both ends of the effort scale for both models, with misses in between. That is more than one winner and less than a pattern, and one read per cell cannot say which. |
| [`02-ten-repeats/`](02-ten-repeats/REPORT.md) | Same letters, same prompt, luna `medium`, `xhigh` and `max`, ten reads each: does a full cell stay full? | No. Eleven letters were right all thirty times; four flip between reads, each between the right answer and one particular wrong one. Higher effort flips less but still flips, even at `max`. 01's full marks were lucky reads. |

## The report

Every experiment ends in one file, `REPORT.md`, in its own folder. It has six sections, always the same six, in this order, because the order is the method: a question, a guess, a setup, an observation, an interpretation, a judgement. A reader who knows the shape can open any experiment and find what they want without reading the rest.

**1. Question.** One sentence. What this experiment asks, on which letters, and what would count as an answer. If it cannot be one sentence, it is two experiments.

**2. Hypothesis, and where it came from.** What was expected, stated before the run, and the reason it was expected: the earlier experiment, the observation, the hunch. Then one line each for what would confirm it and what would refute it. This is the section that proves the conclusion was not fitted to the result afterwards, and it is also where the human judgement lives; a hypothesis with no origin is a guess with no lesson in it.

**3. What varied, what was held.** Point at the four variable files rather than restating them, and say what check shows everything else really was the same. Short.

**4. Result.** The table from `npm run m1:report`, pasted as is, and the list of every miss. Numbers and nothing else: no adjectives, no explanation, no sentence that starts with "this shows". If a reader disagrees with section 5, section 4 has to be something they can still accept.

**5. Reading the result.** What the numbers mean. Which cells were full, what pattern is or is not there, where the misses cluster and what kind of failure each cluster is. This is the section that is allowed to reason, and every claim in it should point back at a row in section 4.

**6. Verdict.** Whether the hypothesis held, in the first sentence. Then what was settled either way, and what the next experiment could ask. A hypothesis that did not hold is not a failed experiment; it is the experiment doing its job, and the verdict says so plainly. The verdict does not make the next decision; it hands it over.

The report closes with how to reproduce it: the score and report commands, and a note that they re-mark the kept replies without calling the model.

## Reading a results table

Each experiment's table has one row per cell. **Letters all right** is the stability column: a cell has to be full there before its cost is worth looking at. **Wrong and confirmed** is the number that matters most: a field the model got wrong and marked `confirmed`, which is the only kind of mistake a person ever sees, because the product hides `uncertain` and `unreadable` fields from the screen.

Under it, **Every letter** turns the same scores round: one row per letter, one column per cell, `k/n` reads all right with the percentage beside it, and an **All reads** column pooling every cell. That is the table to read when the question is which letters are stable rather than which cells, and it is the shape a per-letter-type accuracy figure takes. A letter read `n/n` times has not been proved correct; it has had its per-read miss rate bounded, at roughly `3/n` with 95 percent confidence (exactly, `1 - 0.05^(1/n)`). Ten reads all right bound it at 26 percent, a hundred at 3 percent. The report prints the bound for its own `n`.

**Cost per letter** is Azure's published list price multiplied by the tokens Azure reported. What RACE pays per token is not known to the team, so it is an estimate at list, not an invoice. **Seconds** were measured with several calls in flight at once and describe that condition, not one call on an idle connection.

## Where the prices come from

Per-token prices are taken from LiteLLM's model price table, <https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json>, under the keys `azure/gpt-5.6-luna` and `azure/gpt-5.6-terra`. It is a maintained file that gets a commit when a price moves, which is why it is used rather than a price remembered or found in a forum post. The USD to AUD rate is from Frankfurter, <https://api.frankfurter.dev/v1/latest?base=USD&symbols=AUD>, which serves European Central Bank rates. Both are recorded in `shared/prices.ts` with the date and, for the price table, the commit they were read at.

**Every report states two things about money, and `npm run m1:report` prints both under the table.** What the whole run cost, as one number, so a reader knows what an experiment of this size spends before proposing another. And the source of the prices, by name and URL, with the date they were read, so a dollar figure can always be traced to the table it was multiplied from. A report that quotes a cost without its source is not finished.

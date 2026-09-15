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

Which letters are in scope, which were taken out and why, is recorded in [`data/synthetic-letters/README.md`](../../data/synthetic-letters/README.md). Each experiment's `letters.txt` says which of them it actually read.

## The experiments

| Folder | What it asked | What it found |
|---|---|---|
| [`01-full-grid/`](01-full-grid/REPORT.md) | On all fifteen letters, both models at all six efforts, one read each: which cells are stable? | Four cells scored full marks, at both ends of the effort scale for both models, with misses in between. That is more than one winner and less than a pattern, and one read per cell cannot say which. |
| [`02-ten-repeats/`](02-ten-repeats/REPORT.md) | Same letters, same prompt, luna `medium`, `xhigh` and `max`, ten reads each: does a full cell stay full? | No. Eleven letters were right all thirty times; four flip between reads, each between the right answer and one particular wrong one. Higher effort flips less but still flips, even at `max`. 01's full marks were lucky reads. |
| [`03-prompt-by-purpose/`](03-prompt-by-purpose/REPORT.md) | Same letters, ten reads, luna `medium`, luna `xhigh`, terra `low`; the prompt gains one section on choosing by what a number is for, not the word beside it. Does that stop the flipping? | Yes. luna `medium` and terra `low` read all fifteen right in 150 of 150 reads, zero wrong and confirmed; the ten stable letters did not drop a read. Screening only, and tested only on the pages that inspired the section. |
| [`04-action-words/`](04-action-words/REPORT.md) | Fourteen letters (the rates notice is out of scope), ten reads, luna `medium` and terra `low`; `action_required` now starts with one of eight action words and is scored for the first time. Do the models follow the new definition, and do the other four fields stay full? | All 280 reads gave the right action word, and the eleven letters with a named payee got the key's exact words every time. terra `low` read 140 of 140 right. luna `medium` slipped twice, both on letters that ask for nothing: one uncertain due date, and one confirmed premium given as the amount on the health statement, the value 02 saw twenty one times and 03 saw never. |
| [`05-vote-on-unseen-letters/`](05-vote-on-unseen-letters/REPORT.md) | Twenty five letters: the fourteen plus eleven the pipeline made that no experiment here had read. luna `medium` fifty reads and terra `low` twenty five per letter, replayed as twenty five trials of a vote scheme (luna twice; terra when the two differ). Does the prompt carry to letters it was not written against, and does the scheme catch what luna gets wrong? | On the fourteen, both cells stayed full except luna's known slip on the paid account (12 of 50) and four terra reads on the aged care statement. On the eleven, one letter was read right every time, three mostly, and six never by either cell: the two reads agree on the same wrong value, so the scheme returns it without calling terra. 429 of 625 trials right, 188 wrong with both reads agreeing, 8 sent to the person. The misses are the same kinds as before: a figure the letter reports taken as payable, a date worked out from a period, a voluntary request taken as a task, and a second number on the page taken as the reference. |
| [`06-stable-letters/`](06-stable-letters/REPORT.md) | The eighteen letters left in scope after every letter was read again for fields with more than one printed answer; the prompt gains three rules (due date and amount follow the action, a blank label is not unreadable, a date may be worked out only for an action the letter asks for) and the list of identifiers; luna `medium` twice with terra `low` as judge, twenty five trials. Under the setup the product will use, which letters read right every time? | Nine of eighteen read right in every read of both cells, and the vote scheme was right in every trial on eleven. The Discussion sorted every miss into four kinds and only one was the reader's: the plate on the parking notice, the ten digit number on the recall notice and the blank line on the collection card, and those three letters left scope. The other three kinds, a reference definition read literally, a scorer stricter than the page, and a vote rule that called two lists apart over optional numbers, were fixed before 07. |
| [`07-reference-by-belonging/`](07-reference-by-belonging/REPORT.md) | The fifteen letters left after 06, the same setup, the `reference` definition reworded and the scorer and vote rule fixed; twenty trials. Do the fifteen read right in every trial? | Not yet run. |

## The report

Every experiment ends in one file, `REPORT.md`, in its own folder. It has four sections, always the same four, in this order, because the order is how the work happens: what earlier runs showed and so what this one tries, how it was set up, what came out, and what to make of it. A reader who knows the shape can open any experiment and find what they want without reading the rest.

**Motivation.** What the earlier experiments found, named by folder, and so what this run sets out to learn. Two or three sentences, written before the run. Say what was expected going in, plainly, and which number decides the next step. This is the section that shows the conclusion was not fitted to the result afterwards.

**Design.** The four variables, one line each, with the ones that changed since the previous experiment marked as changed, plus anything else about how the run was made: calls in flight, a cell added after the run started, a model left out and why. A list, not a paragraph. The four files beside the report are the definition; this section is the reader's summary of them.

**Results.** The tables from `npm run m1:report`, pasted as they are: the per-cell table, the per-letter table with its bound sentence, the cost line with its sources, and every miss. Numbers and nothing else: no adjectives, no sentence that starts with "this shows". If a reader disagrees with the Discussion, the Results have to be something they can still accept.

**Discussion.** What the numbers say, what that settles, what it does not, and where the next run looks. It is the only section allowed to reason, and every claim in it points at a row in Results. It is written after the results have been read together by the people who decide the next run, never in the same sitting as the run; until then the section says so and stays empty.

The report closes with how to reproduce it: the score and report commands, and a note that they re-mark the kept replies without calling the model.

## Reading a results table

Each experiment's table has one row per cell. **Letters all right** is the stability column: a cell has to be full there before its cost is worth looking at. **Wrong and confirmed** is the number that matters most: a field the model got wrong and marked `confirmed`, which is the only kind of mistake a person ever sees, because the product hides `uncertain` and `unreadable` fields from the screen.

Under it, **Every letter** turns the same scores round: one row per letter, one column per cell, `k/n` reads all right with the percentage beside it, and an **All reads** column pooling every cell. That is the table to read when the question is which letters are stable rather than which cells, and it is the shape a per-letter-type accuracy figure takes. A letter read `n/n` times has not been proved correct; it has had its per-read miss rate bounded, at roughly `3/n` with 95 percent confidence (exactly, `1 - 0.05^(1/n)`). Ten reads all right bound it at 26 percent, a hundred at 3 percent. The report prints the bound for its own `n`.

**Cost per letter** is Azure's published list price multiplied by the tokens Azure reported. What RACE pays per token is not known to the team, so it is an estimate at list, not an invoice. **Seconds** were measured with several calls in flight at once and describe that condition, not one call on an idle connection.

## Where the prices come from

Per-token prices are taken from LiteLLM's model price table, <https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json>, under the keys `azure/gpt-5.6-luna` and `azure/gpt-5.6-terra`. It is a maintained file that gets a commit when a price moves, which is why it is used rather than a price remembered or found in a forum post. The USD to AUD rate is from Frankfurter, <https://api.frankfurter.dev/v1/latest?base=USD&symbols=AUD>, which serves European Central Bank rates. Both are recorded in `shared/prices.ts` with the date and, for the price table, the commit they were read at.

**Every report states two things about money, and `npm run m1:report` prints both under the table.** What the whole run cost, as one number, so a reader knows what an experiment of this size spends before proposing another. And the source of the prices, by name and URL, with the date they were read, so a dollar figure can always be traced to the table it was multiplied from. A report that quotes a cost without its source is not finished.

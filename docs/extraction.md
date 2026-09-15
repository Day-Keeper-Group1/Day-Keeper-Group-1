# Extraction: the model in use

What the reading step calls, and why. Newest decision on top. Each entry says what was chosen, which experiment report it rests on, and whether it is settled.

The code in `src/server/extraction/` follows this file, not the other way round. To change the prompt, the model or the effort there: run an experiment under `experiments/module-01-extraction/`, add an entry here that cites its report, then change the code to match.

## 2026-09-15 · the scheme, prompt and letters the product builds against, confirmed

**Scheme.** `gpt-5.6-luna` at `medium` reads the letter twice. If the two reads agree on every field, that is the answer. If they differ on a field, `gpt-5.6-terra` at `low` reads the letter once with the same prompt, and the value it matches is taken. If it matches neither read, the letter is read again from the start, up to five times in all. If the fifth attempt still has a field undecided, the reading fails and the product shows its read-failed state. What counts as agreeing is code, [`experiments/module-01-extraction/shared/vote.ts`](../experiments/module-01-extraction/shared/vote.ts); the scheme file is [`07-reference-by-belonging/scheme.txt`](../experiments/module-01-extraction/07-reference-by-belonging/scheme.txt) with retries raised from 0 to 5.

**Prompt.** [`07-reference-by-belonging/prompt.md`](../experiments/module-01-extraction/07-reference-by-belonging/prompt.md). `tests/extraction-prompt.test.ts` fails when the copy the server reads differs from it.

**Letters.** [`07-reference-by-belonging/letters.txt`](../experiments/module-01-extraction/07-reference-by-belonging/letters.txt), fifteen letters. Which letters left scope and why: [`data/synthetic-letters/README.md`](../data/synthetic-letters/README.md).

**Cost.** One letter under the scheme, at list price: about 18,700 input tokens and 770 output tokens per luna read, 310 output per terra read, A\$0.0053 a letter over all trials of 07. Per-read figures and the price sources are in [`07-reference-by-belonging/REPORT.md`](../experiments/module-01-extraction/07-reference-by-belonging/REPORT.md), Results.

**Basis.** [`07-reference-by-belonging/REPORT.md`](../experiments/module-01-extraction/07-reference-by-belonging/REPORT.md): 300 trials, 0 wrong; 299 right and 1 undecided without retry, 299 of 299 right with retries replayed. The retry has been replayed from kept reads, not run live.

**Status: confirmed**, 15 September 2026. The code in `src/server/extraction/` makes one luna read today; building the scheme is a product ticket.

## 2026-09-15 · the prompt gains three rules and the list of identifiers, provisional until 06 is run

**Prompt** as in `src/server/extraction/prompt.md`, which experiment 06 will read with the scheme below. Three rules were added because the misses both reads agreed on in 05 were all of the same kind: a rule the prompt had not stated, supplied by the model. Due date and amount follow the action: only Pay has an amount; only Pay, Attend, Return form and Collect have a due date; No action has neither. A label with nothing written after it means the letter gives no value, not that the value is unreadable. A date may be worked out from a period only when the letter asks for the action and counts the period from a printed date. The prompt also asks for every identifier the letter prints, each under its printed label, which the contract, the storage and the screens carry since KAN-58.

**Basis** [05-vote-on-unseen-letters/REPORT.md](../experiments/module-01-extraction/05-vote-on-unseen-letters/REPORT.md), the misses tallied there on 09, 21 and 25. The letters in scope were cut to eighteen the same day: every letter where the issuer, the action, the due date or the amount has more than one printed answer left, see `data/synthetic-letters/README.md`.

**Status: provisional.** Experiment 06 reads the eighteen with this prompt and the scheme. The entry that replaces this one names the letters that read right in every trial.

## 2026-09-15 · gpt-5.6-luna at medium, read twice, terra at low when the two reads differ, provisional

**Model** `gpt-5.6-luna` at `medium`, twice per letter; `gpt-5.6-terra` at `low` once, only when the two reads disagree on a field. **Prompt** as in [`experiments/module-01-extraction/05-vote-on-unseen-letters/prompt.md`](../experiments/module-01-extraction/05-vote-on-unseen-letters/prompt.md): the action-word definition of `action_required` from 04, with its examples.

**Basis** [04-action-words/REPORT.md](../experiments/module-01-extraction/04-action-words/REPORT.md) and [05-vote-on-unseen-letters/REPORT.md](../experiments/module-01-extraction/05-vote-on-unseen-letters/REPORT.md). On the fourteen letters in scope, twenty five trials each, the scheme was right in 323 of 325 trials; the two misses were one due date that both reads worked out the same way from "Terms: 14 days". On that letter luna alone missed 12 of 50 reads. On the driver licence renewal the scheme sent every misread customer number to the person rather than to the screen. terra alone read the eleven unseen letters no better than luna, at about seven times the price, and the scheme costs about a third of terra alone.

**What it does not fix.** When both reads give the same wrong value the judge is never called, and on four of the eleven unseen letters that is how every miss happened: a figure the letter only reports taken as payable, and a date left blank read as unreadable. Those are for the prompt and the contract, not for more reads. The reference field is being changed to carry every number a letter prints, which is the other half of the misses.

**Status: provisional.** The code in `src/server/extraction/` still makes one luna read; the scheme becomes code when the reference change lands and the fourteen letters read stably under it.

## 2026-09-14 · gpt-5.6-luna at medium, with the prompt from 03, provisional

**Model** `gpt-5.6-luna`. **Effort** `medium`. **Prompt** as in [`experiments/module-01-extraction/03-prompt-by-purpose/prompt.md`](../experiments/module-01-extraction/03-prompt-by-purpose/prompt.md): the contract's six definitions unchanged, plus one section on choosing when more than one thing on the page fits a field.

**Basis** [02-ten-repeats/REPORT.md](../experiments/module-01-extraction/02-ten-repeats/REPORT.md) and [03-prompt-by-purpose/REPORT.md](../experiments/module-01-extraction/03-prompt-by-purpose/REPORT.md). Read ten times with the earlier prompt, five of the fifteen letters flipped between reads on every cell of both models, and every confirmed miss was a number printed under a label that literally matched the field name. With the added section, luna `medium` read all fifteen letters right in 150 of 150 reads with zero wrong-and-confirmed fields, as did terra `low`; luna `xhigh` was 146/150 with its four misses all marked `uncertain`. luna `medium` is the cheapest of the three at about A$0.008 a letter at production prices.

**Status: provisional.** Ten reads per letter bound the per-read miss rate at about 26 percent with 95 percent confidence; that is screening, not certification. What replaces this entry, or confirms it, is a longer run on this cell and this prompt, and the same prompt on letters outside the fifteen.

## 2026-09-09 · gpt-5.6-luna at medium, provisional

**Model** `gpt-5.6-luna`. **Effort** `medium`. **Prompt** as in [`experiments/module-01-extraction/01-full-grid/prompt.md`](../experiments/module-01-extraction/01-full-grid/prompt.md).

**Basis** [01-full-grid/REPORT.md](../experiments/module-01-extraction/01-full-grid/REPORT.md). On the fifteen letters in scope, four cells scored full marks: luna `medium`, luna `xhigh`, terra `low`, terra `xhigh`. luna `medium` is the cheapest of the four at about A$0.008 a letter, against A$0.069 for terra `low`.

**Status: provisional.** The report's own verdict is that one read per cell cannot show stability: the full cells are separated from their neighbours by one or two letters, and effort does not order them. This choice is made so the reading step can be built now rather than after the next experiment. Experiment 02 will read the four full cells repeatedly. If luna `medium` holds, this entry is confirmed; if it does not, the entry above this one will say what replaced it.

# 03-prompt-by-purpose

Not yet run.

## Motivation

02-ten-repeats found that every `confirmed` miss on the five letters that flip is one of four answers, and each of the four is printed under a label that literally matches the field name in the prompt: three numbers labelled *Reference No* in a rates notice's payment panel, a *Ref* under BPAY on a penalty notice, a *Monthly amount you pay* line on a health statement that asks for nothing. The right answers sit under other labels (*Property ID*, *Infringement no.*) or follow from a sentence of prose. The prompt defines `reference` and `amount` by what they are called, and on these pages that has several literal matches; which one a model picks is where the two models differ and where a read flips.

This run keeps the contract's six definitions word for word and adds one section that says how to choose when more than one thing on the page fits: by what the number is for, not by the word beside it. Going in, the expectation is that `04`, `07` and `10` move towards 10/10 on both models, and that none of the ten letters that were stable in 02 drops a single read. The numbers that decide the next step are the per-letter counts for those thirteen letters, read beside 02's table. A prompt that fixes a flipping letter by breaking a stable one is rejected.

## Design

- **Letters**: the same fifteen as 01 and 02, unchanged. The ten that were stable in 02 are the regression test.
- **Prompt** (changed): 01's prompt plus one section, "When more than one thing on the page fits a field". The six contract definitions are untouched; `shared/prompt.ts` refuses a prompt in which they drift. `diff 01-full-grid/prompt.md 03-prompt-by-purpose/prompt.md` is the whole change.
- **Cells** (changed from 02): luna `medium`, luna `xhigh` and terra `low`: the cheapest effort of each model, plus the luna cell that read best for its price in 02. 02 showed effort is not the lever for these letters and that the two models flip on different ones, so the change is tested on both and effort is not spent.
- **Repeats**: ten, as in 02, so the two per-letter tables can be read side by side.
- 450 calls, four in flight.

## Results

Not yet run.

## Discussion

Not yet written.

## Reproducing this

```
npm run m1:score  03-prompt-by-purpose
npm run m1:report 03-prompt-by-purpose
```

re-marks the replies in `runs/` and prints the tables above without calling the model. `npm run m1:matrix 03-prompt-by-purpose` makes the calls; it skips any that already succeeded.

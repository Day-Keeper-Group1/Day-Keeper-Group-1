# 07-reference-by-belonging

Not yet run. Set up 15 September 2026, against RACE's Azure AI Foundry endpoint.

## Motivation

06 asked which of eighteen letters read right every time under the product's setup, and its Discussion sorted every miss into four kinds. Three letters left scope for the third kind, a reading error: the plate on the parking notice, the ten digit number on the recall notice, the blank line on the collection card. The other three kinds were not the reader's, and each is answered before this run.

The first kind was the prompt's own wording. The new definition of `reference` said "the one the letter tells them to quote", and on a letter that never says which number to quote, terra answered Not applicable in 15 of 25 reads on 19, 12 of 25 on 14 and 11 of 25 on 10, with the number sitting in the identifiers list of the same reply. The definition now says that when the letter names no number to quote, the reference is the number that belongs to the person or the matter, and that it is never Not applicable while such a number is printed.

The second kind was the scorer holding a value to the key's spelling when the page supports the model's: "#6429746 DFD" against "6429746 DFD" on 21, and an article number with the barcode line's spaces on 25. The scorer now compares a reference without whitespace and without a leading "#".

The fourth kind was the vote scheme's rule for the identifiers list, which called two reads apart whenever one listed an optional number the other did not, and sent 98 of 450 trials to the person for that alone. Two lists now agree when one is within the other; only a value one read gives and the other gives differently calls the judge.

Re-marked under the new scorer and scheme, 06's kept reads give 417 of 450 trials right, 20 wrong and 13 to the person, against 312, 36 and 102 before; the remaining wrong trials are the reference wording on 10, 14 and 19 and the three letters that left. So the question here is narrow: with the wording fixed and the three letters gone, do the fifteen read right in every trial? The expectation going in is that they do. The number that decides the next step is the count of letters with any trial not right.

## Design

- **Letters** (changed): the fifteen in scope after 06: 06's eighteen less 06, 13 and 25. `letters.txt` lists them.
- **Prompt** (changed): the product prompt as of 15 September, after 06. One definition differs from 06's prompt, `reference`, as the Motivation says; the text is in `src/lib/contract/fields.ts`.
- **Cells**: luna `medium` and terra `low`, as in 06, with their own repeat counts: luna forty reads per letter, terra twenty.
- **Repeats** (changed): twenty trials of the scheme per letter, replayed from the kept reads by `shared/vote.ts` as in 06. Twenty rather than twenty five so that the run takes about twenty minutes with ten calls in flight.
- **Scoring** (changed): as in 06, with two changes made after 06 was read: a reference is compared without whitespace and without a leading "#", and two reads agree on the identifiers list when one list is within the other. Both changes re-mark 06 as well; its report keeps the marks it was read under, and the re-marked figures are given above.
- 900 calls, ten in flight.

## Results

Not yet run.

## Discussion

Not yet written.

## Reproducing this

```
npm run m1:score  07-reference-by-belonging
npm run m1:report 07-reference-by-belonging
npm run m1:vote   07-reference-by-belonging
```

The first re-marks the replies in `runs/`, the second prints the per-cell and per-letter tables, the third replays the scheme; none calls the model. `npm run m1:matrix 07-reference-by-belonging -- --workers 10` makes the calls; it skips any that already succeeded.

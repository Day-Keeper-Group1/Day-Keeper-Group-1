# 09-contact-has-a-due-date

Run 24 September 2026 against RACE's Azure AI Foundry endpoint. KAN-68.

## Motivation

Experiment 08 read the re-dated letters with 07's prompt, nothing else changed. Fourteen letters read right in every read. The fifteenth, 08, the welfare information request, did not, and every miss was the same one. The rebuilt letter asks for one figure within 21 days, online or by phone if she cannot do it online. Readers called that Contact, which is a fair reading of the page, and the prompt says Contact has no due date, so the 2 November deadline was thrown away. Two reads that both answer Contact and Not applicable agree, the judge is never called, and a wrong answer reaches the screen marked confirmed.

The rule is wrong for Contact in general, not only for this letter. Getting in touch with an organisation very often has a deadline: a compliance letter that says "phone us within 28 days" is Contact with a date. The question here is whether the smallest change to that rule reads all fifteen letters right.

## Design

One variable changed from 08: the prompt, one sentence of it, the due_date definition in `FIELD_DESCRIPTIONS` in `src/lib/contract/fields.ts`, copied into `prompt.md`.

- Before: "Only Pay, Attend, Return form and Collect have one. ... For No action, Take medicine, Stop using and Contact, and whenever no date is printed and no such period is given, write Not applicable."
- After: "Only Pay, Attend, Return form, Collect and Contact have one. ... For No action, Take medicine and Stop using, and whenever no date is printed and no such period is given, write Not applicable."

The wider idea in KAN-68, that the date follows the letter whatever the action, was not tried. Taken literally it would let the four No action statements and the medicine label start returning dates they print for other reasons. Moving Contact alone frees the one action that has deadlines and touches nothing else.

- **Letters**: the fifteen re-dated letters, as in 08.
- **Cells**: luna `medium`, forty reads per letter; terra `low`, twenty. As in 07 and 08.
- **Scheme**: 07's `scheme.txt`, replayed from the kept reads by `shared/vote.ts`: luna twice, terra when they differ, no retry. Replayed again with five retries, as the product runs it.
- **Answer key**: letter 08's key also accepts Contact as the action (`also_accepted`), ruled 24 September 2026. Its README says why: for a woman of 78, "phone them before 2 November" is a fair reading, and either word must come with the date. The same key is used to re-mark 08, so the two experiments are marked by one definition of right.

900 calls, ten in flight. 69 of them failed first time with Azure's `500 Gateway cannot authenticate upstream services` and succeeded when the matrix was run again; `matrix.log` keeps both passes. No reply was lost or edited.

## Results

The full output is beside this report: `report-output.md`, `vote-output.md` and `vote-retries-5-output.md`.

| Model | Effort | Letters all right | Fields right | Wrong and confirmed |
|---|---|---|---|---|
| luna | medium | 600/600 (100%) | 3600/3600 | 0 |
| terra | low | 300/300 (100%) | 1800/1800 | 0 |

Every letter read right in every read, 40 of 40 for luna and 20 of 20 for terra. No field anywhere was wrong.

**The vote scheme: 300 trials, 300 right, 0 wrong, 0 undecided**, with or without retries. The pair disagreed in 23 trials, all on the reference or the list of identifiers, and in every one of them the judge sided with the right read.

**Letter 08**, the letter this experiment is about: all 60 reads answered Contact Public Payments Office, and all 60 gave 2026-11-02. Under 08 the same letter read right in 18 of 60 and the scheme was right in 4 of 20 trials. Two things made the difference, and both were needed: the prompt now keeps the date, and the key now accepts the word every reader chose. Neither alone passes: 08 re-marked with the new key but the old prompt still fails on the date.

**Cost**: about A\$0.0052 a letter under the scheme, averaged over the fifteen letters, against A\$0.0053 in 07. The whole run cost US\$4.03 (A\$5.58) at list price.

## Discussion

One sentence moved and one letter's answer key gained a second accepted word. Fifteen letters now read right in 900 of 900 calls and 300 of 300 trials. The four statements that ask for nothing and the medicine label, which the change could have disturbed, read exactly as before.

Two things this does not show. It says nothing about a Contact letter whose deadline is printed in a form this set does not contain; the only Contact reading in the fifteen is 08. And 300 trials all right bound the scheme's per-letter miss rate at 1.0% with 95% confidence over this mix of letters, which is the same bound 07 gave.

Every reader chose Contact for 08 and none chose Return form. On 24 September, after this run, the key's first answer for 08 became Contact and Return form moved to the accepted list, and the README now argues for Contact. What counts as right did not change: both words are accepted, and re-marking gives the same numbers.

## Reproducing this

```
npm run m1:matrix 09-contact-has-a-due-date -- --workers 10
npm run m1:score  09-contact-has-a-due-date
npm run m1:report 09-contact-has-a-due-date
npm run m1:vote   09-contact-has-a-due-date
npm run m1:vote   09-contact-has-a-due-date -- --retries 5
```

Calls that already succeeded are skipped, so the first command only calls the model for what is missing.

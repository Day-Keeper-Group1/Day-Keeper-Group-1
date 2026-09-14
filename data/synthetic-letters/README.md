# Synthetic letters

Each folder is one synthetic letter: its page images, the answer key it should yield (`ground-truth.json`), and a `README.md` that says where the letter comes from and where each of its six fields is printed. The letters were made by a generation pipeline outside this repository, for a fictional person, Mrs M A Wilson. No real person, account or amount is in them.

This file records which letters are in scope for the current release, and why any letter was taken out. A letter that is out of scope keeps its folder. It is still a correct sample, and it will be useful when the product can handle what it asks for.

| Letter | In scope | Why |
|---|---|---|
| [`01-electricity-bill`](01-electricity-bill/) | Yes | |
| [`02-gas-bill`](02-gas-bill/) | Yes | |
| [`03-water-bill`](03-water-bill/) | Yes | |
| [`04-council-rates-notice`](04-council-rates-notice/) | No, taken out 14 September 2026 | The notice sets out a year of rates paid in four instalments, due 30 September 2026, 30 November 2026, 28 February 2027 and 31 May 2027. The release turns one letter into one task with one due date, so it can only remind her of the first instalment. See "Not in this release" in [`docs/scope.md`](../../docs/scope.md). Experiments 01 to 03 read this letter before it was taken out, and their reports are left as they were run. |
| [`05-animal-registration-overdue-notice`](05-animal-registration-overdue-notice/) | Yes | |
| [`06-parking-infringement-notice`](06-parking-infringement-notice/) | Yes | |
| [`07-penalty-reminder-notice`](07-penalty-reminder-notice/) | Yes | |
| [`08-welfare-information-request`](08-welfare-information-request/) | Yes | |
| [`09-specialist-account-statement`](09-specialist-account-statement/) | Yes | |
| [`10-private-health-annual-statement`](10-private-health-annual-statement/) | Yes | |
| [`11-aged-care-monthly-statement`](11-aged-care-monthly-statement/) | Yes | |
| [`12-failure-to-vote-notice`](12-failure-to-vote-notice/) | Yes | |
| [`13-product-recall-notice`](13-product-recall-notice/) | Yes | |
| [`14-super-annual-member-statement`](14-super-annual-member-statement/) | Yes | |
| [`15-insurance-key-facts-sheet`](15-insurance-key-facts-sheet/) | Yes | |
| [`16-driver-licence-renewal-notice`](16-driver-licence-renewal-notice/) | Yes | Added 14 September 2026. Besides the payment, the notice asks for a photograph visit within three months of paying, with no printed date; that visit is not carried. |
| [`17-vehicle-registration-renewal-notice`](17-vehicle-registration-renewal-notice/) | Yes | Added 14 September 2026. A second printed deadline, re-applying for the concession by 12 September 2026, is not carried. |
| [`18-medicare-benefit-statement`](18-medicare-benefit-statement/) | Yes | Added 14 September 2026. Asks for nothing. |
| [`19-outpatient-appointment-letter`](19-outpatient-appointment-letter/) | Yes | Added 14 September 2026. |
| [`20-discharge-summary`](20-discharge-summary/) | No, taken out 14 September 2026 | The summary asks the person for several things: a general practitioner visit within seven days, a booked physiotherapy appointment on 27 May 2026, a new prescription before the supplied medicines run out, and medicine and driving instructions. One task with one due date cannot carry them. See "Not in this release" in [`docs/scope.md`](../../docs/scope.md). Experiment 05 read this letter before it was taken out, and its report is left as it was run; its answer key takes the general practitioner visit. |
| [`21-dispensed-medicine-label`](21-dispensed-medicine-label/) | Yes | Added 14 September 2026. A standing daily instruction with no date. |
| [`22-aged-care-notice-of-decision`](22-aged-care-notice-of-decision/) | Yes | Added 14 September 2026. The action has no printed date. |
| [`23-home-insurance-renewal`](23-home-insurance-renewal/) | Yes | Added 14 September 2026. |
| [`24-motor-insurance-renewal`](24-motor-insurance-renewal/) | Yes | Added 14 September 2026. Asks for nothing; the premium is taken by direct debit. |
| [`25-postal-collection-card`](25-postal-collection-card/) | Yes | Added 14 September 2026. The card's "Collect by" line is blank, so the task has no printed date. |
| [`26-charity-appeal-letter`](26-charity-appeal-letter/) | Yes | Added 14 September 2026. A donation appeal; asks for nothing the person must do. |

The answer keys for letters 01 to 15 were written by the pipeline when each letter was generated and are being checked by a person, letter by letter, against the pages. The keys for letters 16 to 26 were written on 14 September 2026 from the pages, by the rules in the reading prompt: a due date must be printed as a date, a figure the letter only reports is not an amount payable, and the reference is the number the letter tells the person to quote. Each letter's `README.md` says where every value is printed. Where a letter prints two numbers a person could fairly quote, or reads two ways, the key lists the other reading under `also_accepted` and the experiments count both as right; the README explains the first. A letter's row here changes if a check finds a problem with the letter itself.

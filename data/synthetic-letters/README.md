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

The answer keys were written by the pipeline when each letter was generated. They are being checked by a person, letter by letter, against the pages. A letter's row here changes if that check finds a problem with the letter itself.

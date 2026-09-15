## 06-stable-letters

| Model | Effort | Letters all right | Fields right | Wrong and confirmed | Input tokens | Output tokens | Reasoning tokens | Seconds | Cost per letter |
|---|---|---|---|---|---|---|---|---|---|
| luna | medium | 772/900 (86%) | 5263/5400 | 128 | 17525 | 726 | 431 | 9.3 | $0.0013 (A$0.0019) |
| terra | low | 376/450 (84%) | 2625/2700 | 64 | 17525 | 323 | 124 | 5.6 | $0.0088 (A$0.0122) |

### Every letter

| Letter | luna medium | terra low | All reads | Wrong and confirmed |
|---|---|---|---|---|
| 01-electricity-bill | 50/50 (100%) | 25/25 (100%) | 75/75 (100%) | 0 |
| 02-gas-bill | 50/50 (100%) | 25/25 (100%) | 75/75 (100%) | 0 |
| 03-water-bill | 50/50 (100%) | 25/25 (100%) | 75/75 (100%) | 0 |
| 05-animal-registration-overdue-notice | 50/50 (100%) | 25/25 (100%) | 75/75 (100%) | 0 |
| 06-parking-infringement-notice | **3/50 (6%)** | 25/25 (100%) | **28/75 (37%)** | 47 |
| 07-penalty-reminder-notice | 50/50 (100%) | 25/25 (100%) | 75/75 (100%) | 0 |
| 08-welfare-information-request | 50/50 (100%) | 25/25 (100%) | 75/75 (100%) | 0 |
| 09-specialist-account-statement | **49/50 (98%)** | 25/25 (100%) | **74/75 (99%)** | 1 |
| 10-private-health-annual-statement | 50/50 (100%) | **14/25 (56%)** | **64/75 (85%)** | 11 |
| 12-failure-to-vote-notice | 50/50 (100%) | 25/25 (100%) | 75/75 (100%) | 0 |
| 13-product-recall-notice | **42/50 (84%)** | 25/25 (100%) | **67/75 (89%)** | 16 |
| 14-super-annual-member-statement | 50/50 (100%) | **13/25 (52%)** | **63/75 (84%)** | 12 |
| 15-insurance-key-facts-sheet | 50/50 (100%) | 25/25 (100%) | 75/75 (100%) | 0 |
| 16-driver-licence-renewal-notice | 50/50 (100%) | 25/25 (100%) | 75/75 (100%) | 0 |
| 19-outpatient-appointment-letter | **46/50 (92%)** | **10/25 (40%)** | **56/75 (75%)** | 19 |
| 21-dispensed-medicine-label | **0/50 (0%)** | **2/25 (8%)** | **2/75 (3%)** | 73 |
| 23-home-insurance-renewal | 50/50 (100%) | 25/25 (100%) | 75/75 (100%) | 0 |
| 25-postal-collection-card | **32/50 (64%)** | **12/25 (48%)** | **44/75 (59%)** | 13 |

A letter read 50/50 times bounds its per-read miss rate at 6% (95%, exact binomial).

**This run: 1350 calls, $5.16 (A$7.15) in total.**

Cost is Azure's public list price multiplied by the tokens Azure reported per call. Prices are from LiteLLM's model price table (https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json, commit 9eaf15bc, 2026-09-07). The exchange rate USD 1 = AUD 1.3861 is from Frankfurter (European Central Bank rates) (https://api.frankfurter.dev/v1/latest?base=USD&symbols=AUD, 2026-09-08). What RACE pays per token is not known to the team, so this is an estimate at list, not an invoice. Seconds were measured with four calls in flight.

### Every miss

| Model | Effort | Letter | Repeat | Field | Key | Model said | Status |
|---|---|---|---|---|---|---|---|
| luna | medium | 06-parking-infringement-notice | 1 | identifiers | 7717145263; 9XK·7QJ | 7717145263; 9XR·7QJ; 701; 4797 2573 7796 |  |
| luna | medium | 06-parking-infringement-notice | 2 | identifiers | 7717145263; 9XK·7QJ | 7717145263; 9XR·7QJ; 701 |  |
| luna | medium | 06-parking-infringement-notice | 3 | identifiers | 7717145263; 9XK·7QJ | 7717145263; 9XR·7QJ; 701; 4797 2573 7796 |  |
| luna | medium | 06-parking-infringement-notice | 4 | identifiers | 7717145263; 9XK·7QJ | 7717145263; 9XR 7QJ; 701 |  |
| luna | medium | 06-parking-infringement-notice | 5 | identifiers | 7717145263; 9XK·7QJ | 7717145263; 9XR·7QJ; 701; 4797 2573 7796 |  |
| luna | medium | 06-parking-infringement-notice | 6 | identifiers | 7717145263; 9XK·7QJ | 7717145263; 9XR 7QJ; 701; 4797 2573 7796 |  |
| luna | medium | 06-parking-infringement-notice | 7 | identifiers | 7717145263; 9XK·7QJ | 7717145263; 9XR 7QJ; 701; 4797 2573 7796 |  |
| luna | medium | 06-parking-infringement-notice | 8 | identifiers | 7717145263; 9XK·7QJ | 7717145263; 9XR·7QJ; 701; 4797 2573 7796 |  |
| luna | medium | 06-parking-infringement-notice | 10 | identifiers | 7717145263; 9XK·7QJ | 7717145263; 9XR·7QJ; 701 |  |
| luna | medium | 06-parking-infringement-notice | 11 | identifiers | 7717145263; 9XK·7QJ | 7717145263; 9XR 7QJ; 701; 4797 2573 7796 |  |
| luna | medium | 06-parking-infringement-notice | 12 | identifiers | 7717145263; 9XK·7QJ | 7717145263; 9XR 7QJ; 701 |  |
| luna | medium | 06-parking-infringement-notice | 13 | identifiers | 7717145263; 9XK·7QJ | 7717145263; 9XR·7QJ; 701; 4797 2573 7796 |  |
| luna | medium | 06-parking-infringement-notice | 14 | identifiers | 7717145263; 9XK·7QJ | 7717145263; 9XR·7QJ; 701 |  |
| luna | medium | 06-parking-infringement-notice | 15 | identifiers | 7717145263; 9XK·7QJ | 7717145263; 9XR 7QJ; 701 |  |
| luna | medium | 06-parking-infringement-notice | 16 | identifiers | 7717145263; 9XK·7QJ | 7717145263; 9XR·7QJ; 701; 4797 2573 7796 |  |
| luna | medium | 06-parking-infringement-notice | 17 | identifiers | 7717145263; 9XK·7QJ | 7717145263; 9XR·7QJ; 701; 4797 2573 7796 |  |
| luna | medium | 06-parking-infringement-notice | 18 | identifiers | 7717145263; 9XK·7QJ | 7717145263; 9XR·7QJ; 701 |  |
| luna | medium | 06-parking-infringement-notice | 19 | identifiers | 7717145263; 9XK·7QJ | 7717145263; 9XR·7QJ; 701; 4797 2573 7796 |  |
| luna | medium | 06-parking-infringement-notice | 20 | identifiers | 7717145263; 9XK·7QJ | 7717145263; 9XR 7QJ; 701; 4797 2573 7796 |  |
| luna | medium | 06-parking-infringement-notice | 21 | identifiers | 7717145263; 9XK·7QJ | 7717145263; 9XR·7QJ; 701 |  |
| luna | medium | 06-parking-infringement-notice | 22 | identifiers | 7717145263; 9XK·7QJ | 7717145263; 9XR 7QJ; 701; 4797 2573 7796 |  |
| luna | medium | 06-parking-infringement-notice | 23 | identifiers | 7717145263; 9XK·7QJ | 7717145263; 9XR·7QJ; 701; 4797 2573 7796 |  |
| luna | medium | 06-parking-infringement-notice | 25 | identifiers | 7717145263; 9XK·7QJ | 7717145263; 9XR·7QJ; 701; 4797 2573 7796 |  |
| luna | medium | 06-parking-infringement-notice | 26 | identifiers | 7717145263; 9XK·7QJ | 7717145263; 9XR·7QJ; 701; 4797 2573 7796 |  |
| luna | medium | 06-parking-infringement-notice | 27 | identifiers | 7717145263; 9XK·7QJ | 7717145263; 9XR·7QJ; 701 |  |
| luna | medium | 06-parking-infringement-notice | 28 | identifiers | 7717145263; 9XK·7QJ | 7717145263; 9XR·7QJ; 701; 4797 2573 7796 |  |
| luna | medium | 06-parking-infringement-notice | 29 | identifiers | 7717145263; 9XK·7QJ | 7717145263; 9XR·7QJ; 701 |  |
| luna | medium | 06-parking-infringement-notice | 30 | identifiers | 7717145263; 9XK·7QJ | 7717145263; 9XR·7QJ; 701; 4797 2573 7796 |  |
| luna | medium | 06-parking-infringement-notice | 31 | identifiers | 7717145263; 9XK·7QJ | 7717145263; 9XR 7QJ; 701; 4797 2573 7796 |  |
| luna | medium | 06-parking-infringement-notice | 32 | identifiers | 7717145263; 9XK·7QJ | 7717145263; 9XR 7QJ; 701 |  |
| luna | medium | 06-parking-infringement-notice | 33 | identifiers | 7717145263; 9XK·7QJ | 7717145263; 9XR 7QJ; 701; 4797 2573 7796 |  |
| luna | medium | 06-parking-infringement-notice | 34 | identifiers | 7717145263; 9XK·7QJ | 7717145263; 9XR 7QJ; 701 |  |
| luna | medium | 06-parking-infringement-notice | 35 | identifiers | 7717145263; 9XK·7QJ | 7717145263; 9XR·7QJ; 701; 4797 2573 7796 |  |
| luna | medium | 06-parking-infringement-notice | 36 | identifiers | 7717145263; 9XK·7QJ | 7717145263; 9XR 7QJ; 701; 4797 2573 7796 |  |
| luna | medium | 06-parking-infringement-notice | 38 | identifiers | 7717145263; 9XK·7QJ | 7717145263; 9XR·7QJ; 701; 4797 2573 7796 |  |
| luna | medium | 06-parking-infringement-notice | 39 | identifiers | 7717145263; 9XK·7QJ | 7717145263; 9XR·7QJ; 701; 4797 2573 7796 |  |
| luna | medium | 06-parking-infringement-notice | 40 | identifiers | 7717145263; 9XK·7QJ | 7717145263; 9XR·7QJ; 701; 4797 2573 7796 |  |
| luna | medium | 06-parking-infringement-notice | 41 | identifiers | 7717145263; 9XK·7QJ | 7717145263; 9XR·7QJ; 701; 4797 2573 7796 |  |
| luna | medium | 06-parking-infringement-notice | 42 | identifiers | 7717145263; 9XK·7QJ | 7717145263; 9XR·7QJ; 701; 4797 2573 7796 |  |
| luna | medium | 06-parking-infringement-notice | 43 | identifiers | 7717145263; 9XK·7QJ | 7717145263; 9XR·7QJ; 701 |  |
| luna | medium | 06-parking-infringement-notice | 44 | identifiers | 7717145263; 9XK·7QJ | 7717145263; 9XR·7QJ; 701 |  |
| luna | medium | 06-parking-infringement-notice | 45 | identifiers | 7717145263; 9XK·7QJ | 7717145263; 9XR 7QJ; 701; 4797 2573 7796 |  |
| luna | medium | 06-parking-infringement-notice | 46 | identifiers | 7717145263; 9XK·7QJ | 7717145263; 9XR·7QJ; 701 |  |
| luna | medium | 06-parking-infringement-notice | 47 | identifiers | 7717145263; 9XK·7QJ | 7717145263; 9XR·7QJ; 701 |  |
| luna | medium | 06-parking-infringement-notice | 48 | identifiers | 7717145263; 9XK·7QJ | 7717145263; 9XR·7QJ; 701; 4797 2573 7796 |  |
| luna | medium | 06-parking-infringement-notice | 49 | identifiers | 7717145263; 9XK·7QJ | 7717145263; 9XR·7QJ; 701 |  |
| luna | medium | 06-parking-infringement-notice | 50 | identifiers | 7717145263; 9XK·7QJ | 7717145263; 9XR·7QJ; 701; 4797 2573 7796 |  |
| luna | medium | 09-specialist-account-statement | 14 | issuer | Mr Andrew Reid | Andrew Reid Ophthalmic Surgeon – Consulting Rooms | confirmed |
| luna | medium | 13-product-recall-notice | 2 | reference | 9512653343 | 951265334343 | confirmed |
| luna | medium | 13-product-recall-notice | 2 | identifiers | 9512653343 | KCH-2400WH; KCH-2400GR; KCH-2000WH; KCH-2000GR; 5550001–5589999; 951265334343 |  |
| luna | medium | 13-product-recall-notice | 8 | reference | 9512653343 | 95126534343 | confirmed |
| luna | medium | 13-product-recall-notice | 8 | identifiers | 9512653343 | KCH-2400WH; KCH-2400GR; KCH-2000WH; KCH-2000GR; 5550001; 5589999; 95126534343 |  |
| luna | medium | 13-product-recall-notice | 19 | reference | 9512653343 | 95126534343 | confirmed |
| luna | medium | 13-product-recall-notice | 19 | identifiers | 9512653343 | KCH-2400WH; KCH-2400GR; KCH-2000WH; KCH-2000GR; 5550001 and 5589999; 95126534343 |  |
| luna | medium | 13-product-recall-notice | 27 | reference | 9512653343 | 9512655343 | confirmed |
| luna | medium | 13-product-recall-notice | 27 | identifiers | 9512653343 | 9512655343; KCH-2400WH; KCH-2400GR; KCH-2000WH; KCH-2000GR; 5550001 to 5589999 |  |
| luna | medium | 13-product-recall-notice | 36 | reference | 9512653343 | 95126534343 | confirmed |
| luna | medium | 13-product-recall-notice | 36 | identifiers | 9512653343 | 95126534343; KCH-2400WH; KCH-2400GR; KCH-2000WH; KCH-2000GR; 5550001 and 5589999 |  |
| luna | medium | 13-product-recall-notice | 41 | reference | 9512653343 | 9512655343 | confirmed |
| luna | medium | 13-product-recall-notice | 41 | identifiers | 9512653343 | 9512655343; KCH-2400WH; KCH-2400GR; KCH-2000WH; KCH-2000GR; 5550001 to 5589999 |  |
| luna | medium | 13-product-recall-notice | 47 | reference | 9512653343 | 951265334343 | confirmed |
| luna | medium | 13-product-recall-notice | 47 | identifiers | 9512653343 | KCH-2400WH; KCH-2400GR; KCH-2000WH; KCH-2000GR; 951265334343 |  |
| luna | medium | 13-product-recall-notice | 49 | reference | 9512653343 | 95126534343 | confirmed |
| luna | medium | 13-product-recall-notice | 49 | identifiers | 9512653343 | KCH-2400WH; KCH-2400GR; KCH-2000WH; KCH-2000GR; 5550001 to 5589999; 95126534343 |  |
| luna | medium | 19-outpatient-appointment-letter | 5 | reference | UR 6938509 | Not applicable | confirmed |
| luna | medium | 19-outpatient-appointment-letter | 24 | reference | UR 6938509 | Not applicable | confirmed |
| luna | medium | 19-outpatient-appointment-letter | 33 | reference | UR 6938509 | Not applicable | confirmed |
| luna | medium | 19-outpatient-appointment-letter | 46 | reference | UR 6938509 | Not applicable | confirmed |
| luna | medium | 21-dispensed-medicine-label | 1 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 2 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 3 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 4 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 5 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 6 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 7 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 8 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 9 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 10 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 11 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 12 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 13 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 14 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 15 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 16 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 17 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 18 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 19 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 20 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 21 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 22 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 23 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 24 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 25 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 26 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 27 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 28 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 29 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 30 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 31 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 32 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 33 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 34 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 35 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 36 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 37 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 38 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 39 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 40 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 41 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 42 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 43 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 44 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 45 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 46 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 47 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 48 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 49 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 50 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| luna | medium | 25-postal-collection-card | 4 | reference | RS431545614AU | R S 4 3 1 5 4 5 6 1 4 A U | confirmed |
| luna | medium | 25-postal-collection-card | 12 | reference | RS431545614AU | R S 4 3 1 5 4 5 6 1 4 A U | confirmed |
| luna | medium | 25-postal-collection-card | 18 | reference | RS431545614AU | R S 4 3 1 5 4 5 6 1 4 A U | confirmed |
| luna | medium | 25-postal-collection-card | 20 | reference | RS431545614AU | R S 4 3 1 5 4 5 6 1 4 A U | confirmed |
| luna | medium | 25-postal-collection-card | 21 | due_date | null | null | unreadable |
| luna | medium | 25-postal-collection-card | 22 | due_date | null | null | unreadable |
| luna | medium | 25-postal-collection-card | 23 | reference | RS431545614AU | R S 4 3 1 5 4 5 6 1 4 A U | confirmed |
| luna | medium | 25-postal-collection-card | 25 | reference | RS431545614AU | R S 4 3 1 5 4 5 6 1 4 A U | confirmed |
| luna | medium | 25-postal-collection-card | 26 | due_date | null | 2025-08-25 | uncertain |
| luna | medium | 25-postal-collection-card | 30 | due_date | null | 25/8 | uncertain |
| luna | medium | 25-postal-collection-card | 32 | due_date | null | null | unreadable |
| luna | medium | 25-postal-collection-card | 32 | reference | RS431545614AU | R S 4 3 1 5 4 5 6 1 4 A U | confirmed |
| luna | medium | 25-postal-collection-card | 33 | due_date | null | null | unreadable |
| luna | medium | 25-postal-collection-card | 34 | due_date | null | null | unreadable |
| luna | medium | 25-postal-collection-card | 35 | due_date | null | null | unreadable |
| luna | medium | 25-postal-collection-card | 42 | reference | RS431545614AU | R S 4 3 1 5 4 5 6 1 4 A U | confirmed |
| luna | medium | 25-postal-collection-card | 43 | due_date | null | null | unreadable |
| luna | medium | 25-postal-collection-card | 45 | reference | RS431545614AU | R S 4 3 1 5 4 5 6 1 4 A U | confirmed |
| luna | medium | 25-postal-collection-card | 48 | reference | RS431545614AU | R S 4 3 1 5 4 5 6 1 4 A U | confirmed |
| terra | low | 10-private-health-annual-statement | 1 | reference | 65921613 | Not applicable | confirmed |
| terra | low | 10-private-health-annual-statement | 2 | reference | 65921613 | Not applicable | confirmed |
| terra | low | 10-private-health-annual-statement | 3 | reference | 65921613 | Not applicable | confirmed |
| terra | low | 10-private-health-annual-statement | 5 | reference | 65921613 | Not applicable | confirmed |
| terra | low | 10-private-health-annual-statement | 6 | reference | 65921613 | Not applicable | confirmed |
| terra | low | 10-private-health-annual-statement | 8 | reference | 65921613 | Not applicable | confirmed |
| terra | low | 10-private-health-annual-statement | 9 | reference | 65921613 | Not applicable | confirmed |
| terra | low | 10-private-health-annual-statement | 15 | reference | 65921613 | Not applicable | confirmed |
| terra | low | 10-private-health-annual-statement | 19 | reference | 65921613 | Not applicable | confirmed |
| terra | low | 10-private-health-annual-statement | 21 | reference | 65921613 | Not applicable | confirmed |
| terra | low | 10-private-health-annual-statement | 24 | reference | 65921613 | Not applicable | confirmed |
| terra | low | 14-super-annual-member-statement | 2 | reference | 12 242 124 | Not applicable | confirmed |
| terra | low | 14-super-annual-member-statement | 3 | reference | 12 242 124 | Not applicable | confirmed |
| terra | low | 14-super-annual-member-statement | 7 | reference | 12 242 124 | Not applicable | confirmed |
| terra | low | 14-super-annual-member-statement | 8 | reference | 12 242 124 | Not applicable | confirmed |
| terra | low | 14-super-annual-member-statement | 10 | reference | 12 242 124 | Not applicable | confirmed |
| terra | low | 14-super-annual-member-statement | 11 | reference | 12 242 124 | Not applicable | confirmed |
| terra | low | 14-super-annual-member-statement | 12 | reference | 12 242 124 | Not applicable | confirmed |
| terra | low | 14-super-annual-member-statement | 14 | reference | 12 242 124 | Not applicable | confirmed |
| terra | low | 14-super-annual-member-statement | 16 | reference | 12 242 124 | Not applicable | confirmed |
| terra | low | 14-super-annual-member-statement | 20 | reference | 12 242 124 | Not applicable | confirmed |
| terra | low | 14-super-annual-member-statement | 21 | reference | 12 242 124 | Not applicable | confirmed |
| terra | low | 14-super-annual-member-statement | 23 | reference | 12 242 124 | Not applicable | confirmed |
| terra | low | 19-outpatient-appointment-letter | 1 | reference | UR 6938509 | Not applicable | confirmed |
| terra | low | 19-outpatient-appointment-letter | 4 | reference | UR 6938509 | Not applicable | confirmed |
| terra | low | 19-outpatient-appointment-letter | 6 | reference | UR 6938509 | Not applicable | confirmed |
| terra | low | 19-outpatient-appointment-letter | 7 | reference | UR 6938509 | Not applicable | confirmed |
| terra | low | 19-outpatient-appointment-letter | 9 | reference | UR 6938509 | Not applicable | confirmed |
| terra | low | 19-outpatient-appointment-letter | 10 | reference | UR 6938509 | Not applicable | confirmed |
| terra | low | 19-outpatient-appointment-letter | 11 | reference | UR 6938509 | Not applicable | confirmed |
| terra | low | 19-outpatient-appointment-letter | 13 | reference | UR 6938509 | Not applicable | confirmed |
| terra | low | 19-outpatient-appointment-letter | 14 | reference | UR 6938509 | Not applicable | confirmed |
| terra | low | 19-outpatient-appointment-letter | 16 | reference | UR 6938509 | Not applicable | confirmed |
| terra | low | 19-outpatient-appointment-letter | 17 | reference | UR 6938509 | Not applicable | confirmed |
| terra | low | 19-outpatient-appointment-letter | 18 | reference | UR 6938509 | Not applicable | confirmed |
| terra | low | 19-outpatient-appointment-letter | 19 | reference | UR 6938509 | Not applicable | confirmed |
| terra | low | 19-outpatient-appointment-letter | 23 | reference | UR 6938509 | Not applicable | confirmed |
| terra | low | 19-outpatient-appointment-letter | 24 | reference | UR 6938509 | Not applicable | confirmed |
| terra | low | 21-dispensed-medicine-label | 1 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| terra | low | 21-dispensed-medicine-label | 2 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| terra | low | 21-dispensed-medicine-label | 3 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| terra | low | 21-dispensed-medicine-label | 4 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| terra | low | 21-dispensed-medicine-label | 5 | reference | 6429746 DFD | Not applicable | confirmed |
| terra | low | 21-dispensed-medicine-label | 6 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| terra | low | 21-dispensed-medicine-label | 7 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| terra | low | 21-dispensed-medicine-label | 8 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| terra | low | 21-dispensed-medicine-label | 9 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| terra | low | 21-dispensed-medicine-label | 10 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| terra | low | 21-dispensed-medicine-label | 11 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| terra | low | 21-dispensed-medicine-label | 12 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| terra | low | 21-dispensed-medicine-label | 13 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| terra | low | 21-dispensed-medicine-label | 14 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| terra | low | 21-dispensed-medicine-label | 15 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| terra | low | 21-dispensed-medicine-label | 16 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| terra | low | 21-dispensed-medicine-label | 17 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| terra | low | 21-dispensed-medicine-label | 18 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| terra | low | 21-dispensed-medicine-label | 20 | reference | 6429746 DFD | Not applicable | confirmed |
| terra | low | 21-dispensed-medicine-label | 22 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| terra | low | 21-dispensed-medicine-label | 23 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| terra | low | 21-dispensed-medicine-label | 24 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| terra | low | 21-dispensed-medicine-label | 25 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| terra | low | 25-postal-collection-card | 2 | due_date | null | null | unreadable |
| terra | low | 25-postal-collection-card | 2 | reference | RS431545614AU | R S 4 3 1 5 4 5 6 1 4 A U | confirmed |
| terra | low | 25-postal-collection-card | 6 | due_date | null | null | unreadable |
| terra | low | 25-postal-collection-card | 7 | due_date | null | null | unreadable |
| terra | low | 25-postal-collection-card | 8 | reference | RS431545614AU | R S 4 3 1 5 4 5 6 1 4 A U | confirmed |
| terra | low | 25-postal-collection-card | 9 | due_date | null | null | unreadable |
| terra | low | 25-postal-collection-card | 10 | due_date | null | null | unreadable |
| terra | low | 25-postal-collection-card | 12 | due_date | null | null | unreadable |
| terra | low | 25-postal-collection-card | 13 | due_date | null | null | unreadable |
| terra | low | 25-postal-collection-card | 16 | due_date | null | null | unreadable |
| terra | low | 25-postal-collection-card | 17 | due_date | null | null | unreadable |
| terra | low | 25-postal-collection-card | 19 | due_date | null | null | unreadable |
| terra | low | 25-postal-collection-card | 20 | reference | RS431545614AU | R S 4 3 1 5 4 5 6 1 4 A U | confirmed |
| terra | low | 25-postal-collection-card | 22 | due_date | null | null | unreadable |

## 05-vote-on-unseen-letters

| Model | Effort | Letters all right | Fields right | Wrong and confirmed | Input tokens | Output tokens | Reasoning tokens | Seconds | Cost per letter |
|---|---|---|---|---|---|---|---|---|---|
| luna | medium | 848/1250 (68%) | 5666/6250 | 457 | 22424 | 604 | 223 | 6.6 | $0.0013 (A$0.0018) |
| terra | low | 431/625 (69%) | 2866/3125 | 238 | 22424 | 262 | 83 | 5.2 | $0.0096 (A$0.0132) |

### Every letter

| Letter | luna medium | terra low | All reads | Wrong and confirmed |
|---|---|---|---|---|
| 01-electricity-bill | 50/50 (100%) | 25/25 (100%) | 75/75 (100%) | 0 |
| 02-gas-bill | 50/50 (100%) | 25/25 (100%) | 75/75 (100%) | 0 |
| 03-water-bill | 50/50 (100%) | 25/25 (100%) | 75/75 (100%) | 0 |
| 05-animal-registration-overdue-notice | 50/50 (100%) | 25/25 (100%) | 75/75 (100%) | 0 |
| 06-parking-infringement-notice | 50/50 (100%) | 25/25 (100%) | 75/75 (100%) | 0 |
| 07-penalty-reminder-notice | 50/50 (100%) | 25/25 (100%) | 75/75 (100%) | 0 |
| 08-welfare-information-request | 50/50 (100%) | 25/25 (100%) | 75/75 (100%) | 0 |
| 09-specialist-account-statement | **38/50 (76%)** | **24/25 (96%)** | **62/75 (83%)** | 0 |
| 10-private-health-annual-statement | 50/50 (100%) | 25/25 (100%) | 75/75 (100%) | 0 |
| 11-aged-care-monthly-statement | 50/50 (100%) | **21/25 (84%)** | **71/75 (95%)** | 4 |
| 12-failure-to-vote-notice | 50/50 (100%) | 25/25 (100%) | 75/75 (100%) | 0 |
| 13-product-recall-notice | 50/50 (100%) | 25/25 (100%) | 75/75 (100%) | 0 |
| 14-super-annual-member-statement | 50/50 (100%) | 25/25 (100%) | 75/75 (100%) | 0 |
| 15-insurance-key-facts-sheet | 50/50 (100%) | 25/25 (100%) | 75/75 (100%) | 0 |
| 16-driver-licence-renewal-notice | **14/50 (28%)** | **6/25 (24%)** | **20/75 (27%)** | 30 |
| 17-vehicle-registration-renewal-notice | **41/50 (82%)** | 25/25 (100%) | **66/75 (88%)** | 8 |
| 18-medicare-benefit-statement | **0/50 (0%)** | **0/25 (0%)** | **0/75 (0%)** | 125 |
| 19-outpatient-appointment-letter | **47/50 (94%)** | 25/25 (100%) | **72/75 (96%)** | 3 |
| 20-discharge-summary | **0/50 (0%)** | **0/25 (0%)** | **0/75 (0%)** | 45 |
| 21-dispensed-medicine-label | **0/50 (0%)** | **0/25 (0%)** | **0/75 (0%)** | 136 |
| 22-aged-care-notice-of-decision | **0/50 (0%)** | **0/25 (0%)** | **0/75 (0%)** | 81 |
| 23-home-insurance-renewal | 50/50 (100%) | 25/25 (100%) | 75/75 (100%) | 0 |
| 24-motor-insurance-renewal | **0/50 (0%)** | **0/25 (0%)** | **0/75 (0%)** | 93 |
| 25-postal-collection-card | **8/50 (16%)** | **5/25 (20%)** | **13/75 (17%)** | 10 |
| 26-charity-appeal-letter | **0/50 (0%)** | **0/25 (0%)** | **0/75 (0%)** | 160 |

A letter read 50/50 times bounds its per-read miss rate at 6% (95%, exact binomial).

**This run: 1875 calls, $7.55 (A$10.46) in total.**

Cost is Azure's public list price multiplied by the tokens Azure reported per call. Prices are from LiteLLM's model price table (https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json, commit 9eaf15bc, 2026-09-07). The exchange rate USD 1 = AUD 1.3861 is from Frankfurter (European Central Bank rates) (https://api.frankfurter.dev/v1/latest?base=USD&symbols=AUD, 2026-09-08). What RACE pays per token is not known to the team, so this is an estimate at list, not an invoice. Seconds were measured with four calls in flight.

### Every miss

| Model | Effort | Letter | Repeat | Field | Key | Model said | Status |
|---|---|---|---|---|---|---|---|
| luna | medium | 09-specialist-account-statement | 2 | due_date | null | 2026-07-14 | uncertain |
| luna | medium | 09-specialist-account-statement | 8 | due_date | null | 2026-07-14 | uncertain |
| luna | medium | 09-specialist-account-statement | 9 | due_date | null | 2026-07-14 | uncertain |
| luna | medium | 09-specialist-account-statement | 13 | due_date | null | 2026-07-14 | uncertain |
| luna | medium | 09-specialist-account-statement | 18 | due_date | null | 2026-07-14 | uncertain |
| luna | medium | 09-specialist-account-statement | 19 | due_date | null | 2026-07-14 | uncertain |
| luna | medium | 09-specialist-account-statement | 20 | due_date | null | 2026-07-14 | uncertain |
| luna | medium | 09-specialist-account-statement | 32 | due_date | null | 2026-07-14 | uncertain |
| luna | medium | 09-specialist-account-statement | 36 | due_date | null | 2026-07-14 | uncertain |
| luna | medium | 09-specialist-account-statement | 39 | due_date | null | 2026-07-14 | uncertain |
| luna | medium | 09-specialist-account-statement | 40 | due_date | null | 2026-07-14 | uncertain |
| luna | medium | 09-specialist-account-statement | 50 | due_date | null | 2026-07-14 | uncertain |
| luna | medium | 16-driver-licence-renewal-notice | 1 | reference | 05 502 615 | 812 466 305 | uncertain |
| luna | medium | 16-driver-licence-renewal-notice | 2 | reference | 05 502 615 | 812 46 305 | uncertain |
| luna | medium | 16-driver-licence-renewal-notice | 3 | reference | 05 502 615 | 812 466 305 | uncertain |
| luna | medium | 16-driver-licence-renewal-notice | 4 | reference | 05 502 615 | 812 466 305 | uncertain |
| luna | medium | 16-driver-licence-renewal-notice | 5 | reference | 05 502 615 | 812 46 305 | uncertain |
| luna | medium | 16-driver-licence-renewal-notice | 7 | reference | 05 502 615 | 812 46 305 | uncertain |
| luna | medium | 16-driver-licence-renewal-notice | 8 | reference | 05 502 615 | 812 466 305 | confirmed |
| luna | medium | 16-driver-licence-renewal-notice | 10 | reference | 05 502 615 | 812 46 305 | confirmed |
| luna | medium | 16-driver-licence-renewal-notice | 11 | reference | 05 502 615 | 812 46 305 | uncertain |
| luna | medium | 16-driver-licence-renewal-notice | 15 | reference | 05 502 615 | 812 46 305 | uncertain |
| luna | medium | 16-driver-licence-renewal-notice | 16 | reference | 05 502 615 | 812 466 305 | confirmed |
| luna | medium | 16-driver-licence-renewal-notice | 17 | reference | 05 502 615 | 812 466 305 | uncertain |
| luna | medium | 16-driver-licence-renewal-notice | 18 | reference | 05 502 615 | 812 46 305 | uncertain |
| luna | medium | 16-driver-licence-renewal-notice | 19 | reference | 05 502 615 | 812 466 305 | uncertain |
| luna | medium | 16-driver-licence-renewal-notice | 20 | reference | 05 502 615 | 812 46 305 | uncertain |
| luna | medium | 16-driver-licence-renewal-notice | 21 | reference | 05 502 615 | 05 502 615; 812 46 305 | uncertain |
| luna | medium | 16-driver-licence-renewal-notice | 22 | reference | 05 502 615 | 812 466 305 | uncertain |
| luna | medium | 16-driver-licence-renewal-notice | 23 | reference | 05 502 615 | 812 466 305 | uncertain |
| luna | medium | 16-driver-licence-renewal-notice | 26 | reference | 05 502 615 | 812 466 305 | confirmed |
| luna | medium | 16-driver-licence-renewal-notice | 27 | reference | 05 502 615 | 812 466 305 | confirmed |
| luna | medium | 16-driver-licence-renewal-notice | 29 | reference | 05 502 615 | 812 466 305 | confirmed |
| luna | medium | 16-driver-licence-renewal-notice | 30 | reference | 05 502 615 | 812 46 305 | confirmed |
| luna | medium | 16-driver-licence-renewal-notice | 32 | reference | 05 502 615 | 812 466 305 | uncertain |
| luna | medium | 16-driver-licence-renewal-notice | 34 | reference | 05 502 615 | 812 46 305 | confirmed |
| luna | medium | 16-driver-licence-renewal-notice | 35 | reference | 05 502 615 | 812 46 305 | uncertain |
| luna | medium | 16-driver-licence-renewal-notice | 39 | reference | 05 502 615 | 812 46 305 | uncertain |
| luna | medium | 16-driver-licence-renewal-notice | 40 | reference | 05 502 615 | 812 466 305 | uncertain |
| luna | medium | 16-driver-licence-renewal-notice | 41 | reference | 05 502 615 | 812 466 305 | confirmed |
| luna | medium | 16-driver-licence-renewal-notice | 43 | reference | 05 502 615 | 812 46 305 | uncertain |
| luna | medium | 16-driver-licence-renewal-notice | 44 | reference | 05 502 615 | 812 466 305 | uncertain |
| luna | medium | 16-driver-licence-renewal-notice | 45 | reference | 05 502 615 | 812 466 305 | uncertain |
| luna | medium | 16-driver-licence-renewal-notice | 46 | reference | 05 502 615 | 812 466 305 | confirmed |
| luna | medium | 16-driver-licence-renewal-notice | 47 | reference | 05 502 615 | 812 466 305 | uncertain |
| luna | medium | 16-driver-licence-renewal-notice | 48 | reference | 05 502 615 | 812 466 305 | uncertain |
| luna | medium | 16-driver-licence-renewal-notice | 49 | reference | 05 502 615 | 812 46 305 | uncertain |
| luna | medium | 16-driver-licence-renewal-notice | 50 | reference | 05 502 615 | 812 466 305 | confirmed |
| luna | medium | 17-vehicle-registration-renewal-notice | 3 | reference | 812 466 305 | 9XK-7QJ | confirmed |
| luna | medium | 17-vehicle-registration-renewal-notice | 12 | reference | 812 466 305 | 9XK·7QJ | confirmed |
| luna | medium | 17-vehicle-registration-renewal-notice | 17 | reference | 812 466 305 | 9XK·7QJ | confirmed |
| luna | medium | 17-vehicle-registration-renewal-notice | 23 | reference | 812 466 305 | 9XK·7QJ | confirmed |
| luna | medium | 17-vehicle-registration-renewal-notice | 24 | reference | 812 466 305 | 9XK·7QJ | confirmed |
| luna | medium | 17-vehicle-registration-renewal-notice | 25 | reference | 812 466 305 | 9XK·7QJ | confirmed |
| luna | medium | 17-vehicle-registration-renewal-notice | 27 | reference | 812 466 305 | 9XK-7QJ | confirmed |
| luna | medium | 17-vehicle-registration-renewal-notice | 47 | reference | 812 466 305 | 9XK-7QJ | uncertain |
| luna | medium | 17-vehicle-registration-renewal-notice | 48 | reference | 812 466 305 | 9XK·7QJ | confirmed |
| luna | medium | 18-medicare-benefit-statement | 1 | reference | 4378 31830 2 | 37-364928 | confirmed |
| luna | medium | 18-medicare-benefit-statement | 1 | issuer | Patient Rebate Scheme | claimstead | confirmed |
| luna | medium | 18-medicare-benefit-statement | 2 | reference | 4378 31830 2 | 37-364928 | confirmed |
| luna | medium | 18-medicare-benefit-statement | 2 | issuer | Patient Rebate Scheme | claimstead | confirmed |
| luna | medium | 18-medicare-benefit-statement | 3 | reference | 4378 31830 2 | 37-364928 | confirmed |
| luna | medium | 18-medicare-benefit-statement | 3 | issuer | Patient Rebate Scheme | claimstead | confirmed |
| luna | medium | 18-medicare-benefit-statement | 4 | reference | 4378 31830 2 | 37-364928 | confirmed |
| luna | medium | 18-medicare-benefit-statement | 4 | issuer | Patient Rebate Scheme | claimstead | confirmed |
| luna | medium | 18-medicare-benefit-statement | 5 | reference | 4378 31830 2 | 37-364928 | confirmed |
| luna | medium | 18-medicare-benefit-statement | 5 | issuer | Patient Rebate Scheme | claimstead | confirmed |
| luna | medium | 18-medicare-benefit-statement | 6 | reference | 4378 31830 2 | 37-364928 | confirmed |
| luna | medium | 18-medicare-benefit-statement | 6 | issuer | Patient Rebate Scheme | claimstead | confirmed |
| luna | medium | 18-medicare-benefit-statement | 7 | reference | 4378 31830 2 | 37-364928 | confirmed |
| luna | medium | 18-medicare-benefit-statement | 7 | issuer | Patient Rebate Scheme | claimstead | confirmed |
| luna | medium | 18-medicare-benefit-statement | 8 | reference | 4378 31830 2 | 37-364928 | confirmed |
| luna | medium | 18-medicare-benefit-statement | 8 | issuer | Patient Rebate Scheme | claimstead | confirmed |
| luna | medium | 18-medicare-benefit-statement | 9 | reference | 4378 31830 2 | 37-364928 | confirmed |
| luna | medium | 18-medicare-benefit-statement | 9 | issuer | Patient Rebate Scheme | claimstead | confirmed |
| luna | medium | 18-medicare-benefit-statement | 10 | reference | 4378 31830 2 | 37-364928 | confirmed |
| luna | medium | 18-medicare-benefit-statement | 10 | issuer | Patient Rebate Scheme | claimstead | confirmed |
| luna | medium | 18-medicare-benefit-statement | 11 | reference | 4378 31830 2 | 37-364928 | confirmed |
| luna | medium | 18-medicare-benefit-statement | 11 | issuer | Patient Rebate Scheme | claimstead | confirmed |
| luna | medium | 18-medicare-benefit-statement | 12 | reference | 4378 31830 2 | 37-364928 | confirmed |
| luna | medium | 18-medicare-benefit-statement | 12 | issuer | Patient Rebate Scheme | claimstead | confirmed |
| luna | medium | 18-medicare-benefit-statement | 13 | reference | 4378 31830 2 | 37-3644928 | confirmed |
| luna | medium | 18-medicare-benefit-statement | 13 | issuer | Patient Rebate Scheme | claimstead | confirmed |
| luna | medium | 18-medicare-benefit-statement | 14 | reference | 4378 31830 2 | 37-364928 | confirmed |
| luna | medium | 18-medicare-benefit-statement | 14 | issuer | Patient Rebate Scheme | claimstead | confirmed |
| luna | medium | 18-medicare-benefit-statement | 15 | reference | 4378 31830 2 | 37-364928 | confirmed |
| luna | medium | 18-medicare-benefit-statement | 15 | issuer | Patient Rebate Scheme | claimstead | confirmed |
| luna | medium | 18-medicare-benefit-statement | 16 | reference | 4378 31830 2 | 37-364928 | confirmed |
| luna | medium | 18-medicare-benefit-statement | 16 | issuer | Patient Rebate Scheme | claimstead | confirmed |
| luna | medium | 18-medicare-benefit-statement | 17 | reference | 4378 31830 2 | 37-364928 | confirmed |
| luna | medium | 18-medicare-benefit-statement | 17 | issuer | Patient Rebate Scheme | claimstead | confirmed |
| luna | medium | 18-medicare-benefit-statement | 18 | reference | 4378 31830 2 | 37-364928 | confirmed |
| luna | medium | 18-medicare-benefit-statement | 18 | issuer | Patient Rebate Scheme | claimstead | confirmed |
| luna | medium | 18-medicare-benefit-statement | 19 | reference | 4378 31830 2 | 37-364928 | confirmed |
| luna | medium | 18-medicare-benefit-statement | 19 | issuer | Patient Rebate Scheme | claimstead | confirmed |
| luna | medium | 18-medicare-benefit-statement | 20 | reference | 4378 31830 2 | 37-364928 | confirmed |
| luna | medium | 18-medicare-benefit-statement | 20 | issuer | Patient Rebate Scheme | claimstead | confirmed |
| luna | medium | 18-medicare-benefit-statement | 21 | reference | 4378 31830 2 | 37-364928 | confirmed |
| luna | medium | 18-medicare-benefit-statement | 21 | issuer | Patient Rebate Scheme | claimstead | confirmed |
| luna | medium | 18-medicare-benefit-statement | 22 | reference | 4378 31830 2 | 37-3644928 | confirmed |
| luna | medium | 18-medicare-benefit-statement | 22 | issuer | Patient Rebate Scheme | claimstead | confirmed |
| luna | medium | 18-medicare-benefit-statement | 23 | reference | 4378 31830 2 | 37-364928 | confirmed |
| luna | medium | 18-medicare-benefit-statement | 23 | issuer | Patient Rebate Scheme | claimstead | confirmed |
| luna | medium | 18-medicare-benefit-statement | 24 | reference | 4378 31830 2 | 37-364928 | confirmed |
| luna | medium | 18-medicare-benefit-statement | 24 | issuer | Patient Rebate Scheme | claimstead | confirmed |
| luna | medium | 18-medicare-benefit-statement | 25 | reference | 4378 31830 2 | 37-364928 | confirmed |
| luna | medium | 18-medicare-benefit-statement | 25 | issuer | Patient Rebate Scheme | claimstead | confirmed |
| luna | medium | 18-medicare-benefit-statement | 26 | reference | 4378 31830 2 | 37-364928 | confirmed |
| luna | medium | 18-medicare-benefit-statement | 26 | issuer | Patient Rebate Scheme | claimstead | confirmed |
| luna | medium | 18-medicare-benefit-statement | 27 | reference | 4378 31830 2 | 37-364928 | confirmed |
| luna | medium | 18-medicare-benefit-statement | 27 | issuer | Patient Rebate Scheme | claimstead | confirmed |
| luna | medium | 18-medicare-benefit-statement | 28 | reference | 4378 31830 2 | 37-364928 | confirmed |
| luna | medium | 18-medicare-benefit-statement | 28 | issuer | Patient Rebate Scheme | claimstead | confirmed |
| luna | medium | 18-medicare-benefit-statement | 29 | reference | 4378 31830 2 | 37-364928 | confirmed |
| luna | medium | 18-medicare-benefit-statement | 29 | issuer | Patient Rebate Scheme | claimstead | confirmed |
| luna | medium | 18-medicare-benefit-statement | 30 | reference | 4378 31830 2 | 37-364928 | confirmed |
| luna | medium | 18-medicare-benefit-statement | 30 | issuer | Patient Rebate Scheme | claimstead | confirmed |
| luna | medium | 18-medicare-benefit-statement | 31 | reference | 4378 31830 2 | 37-364928 | confirmed |
| luna | medium | 18-medicare-benefit-statement | 31 | issuer | Patient Rebate Scheme | claimstead | confirmed |
| luna | medium | 18-medicare-benefit-statement | 32 | reference | 4378 31830 2 | 37-364928 | confirmed |
| luna | medium | 18-medicare-benefit-statement | 32 | issuer | Patient Rebate Scheme | claimstead | confirmed |
| luna | medium | 18-medicare-benefit-statement | 33 | reference | 4378 31830 2 | 37-364928 | confirmed |
| luna | medium | 18-medicare-benefit-statement | 33 | issuer | Patient Rebate Scheme | claimstead | confirmed |
| luna | medium | 18-medicare-benefit-statement | 34 | reference | 4378 31830 2 | 37-364928 | confirmed |
| luna | medium | 18-medicare-benefit-statement | 34 | issuer | Patient Rebate Scheme | claimstead | confirmed |
| luna | medium | 18-medicare-benefit-statement | 35 | reference | 4378 31830 2 | 37-364928 | confirmed |
| luna | medium | 18-medicare-benefit-statement | 35 | issuer | Patient Rebate Scheme | claimstead | confirmed |
| luna | medium | 18-medicare-benefit-statement | 36 | reference | 4378 31830 2 | 37-364928 | confirmed |
| luna | medium | 18-medicare-benefit-statement | 36 | issuer | Patient Rebate Scheme | claimstead | confirmed |
| luna | medium | 18-medicare-benefit-statement | 37 | reference | 4378 31830 2 | 37-364928 | confirmed |
| luna | medium | 18-medicare-benefit-statement | 37 | issuer | Patient Rebate Scheme | claimstead | confirmed |
| luna | medium | 18-medicare-benefit-statement | 38 | reference | 4378 31830 2 | 37-364928 | confirmed |
| luna | medium | 18-medicare-benefit-statement | 38 | issuer | Patient Rebate Scheme | claimstead | confirmed |
| luna | medium | 18-medicare-benefit-statement | 39 | reference | 4378 31830 2 | 37-364928 | confirmed |
| luna | medium | 18-medicare-benefit-statement | 39 | issuer | Patient Rebate Scheme | claimstead | confirmed |
| luna | medium | 18-medicare-benefit-statement | 40 | reference | 4378 31830 2 | 37-364928 | confirmed |
| luna | medium | 18-medicare-benefit-statement | 40 | issuer | Patient Rebate Scheme | claimstead | confirmed |
| luna | medium | 18-medicare-benefit-statement | 41 | reference | 4378 31830 2 | 37-364928 | confirmed |
| luna | medium | 18-medicare-benefit-statement | 41 | issuer | Patient Rebate Scheme | claimstead | confirmed |
| luna | medium | 18-medicare-benefit-statement | 42 | reference | 4378 31830 2 | 37-364928 | confirmed |
| luna | medium | 18-medicare-benefit-statement | 42 | issuer | Patient Rebate Scheme | claimstead | confirmed |
| luna | medium | 18-medicare-benefit-statement | 43 | reference | 4378 31830 2 | 37-364928 | confirmed |
| luna | medium | 18-medicare-benefit-statement | 43 | issuer | Patient Rebate Scheme | claimstead | confirmed |
| luna | medium | 18-medicare-benefit-statement | 44 | reference | 4378 31830 2 | 37-364928 | confirmed |
| luna | medium | 18-medicare-benefit-statement | 44 | issuer | Patient Rebate Scheme | claimstead | confirmed |
| luna | medium | 18-medicare-benefit-statement | 45 | reference | 4378 31830 2 | 37-364928 | confirmed |
| luna | medium | 18-medicare-benefit-statement | 45 | issuer | Patient Rebate Scheme | claimstead | confirmed |
| luna | medium | 18-medicare-benefit-statement | 46 | reference | 4378 31830 2 | 37-364928 | confirmed |
| luna | medium | 18-medicare-benefit-statement | 46 | issuer | Patient Rebate Scheme | claimstead | confirmed |
| luna | medium | 18-medicare-benefit-statement | 47 | reference | 4378 31830 2 | 37-364928 | confirmed |
| luna | medium | 18-medicare-benefit-statement | 47 | issuer | Patient Rebate Scheme | claimstead | confirmed |
| luna | medium | 18-medicare-benefit-statement | 48 | reference | 4378 31830 2 | 37-364928 | confirmed |
| luna | medium | 18-medicare-benefit-statement | 48 | issuer | Patient Rebate Scheme | claimstead | confirmed |
| luna | medium | 18-medicare-benefit-statement | 49 | reference | 4378 31830 2 | 37-364928 | confirmed |
| luna | medium | 18-medicare-benefit-statement | 49 | issuer | Patient Rebate Scheme | claimstead | confirmed |
| luna | medium | 18-medicare-benefit-statement | 50 | reference | 4378 31830 2 | 37-364928 | confirmed |
| luna | medium | 18-medicare-benefit-statement | 50 | issuer | Patient Rebate Scheme | claimstead | confirmed |
| luna | medium | 19-outpatient-appointment-letter | 12 | reference | UR 6938509 | Not applicable | confirmed |
| luna | medium | 19-outpatient-appointment-letter | 39 | reference | UR 6938509 | Not applicable | confirmed |
| luna | medium | 19-outpatient-appointment-letter | 49 | reference | UR 6938509 | Not applicable | confirmed |
| luna | medium | 20-discharge-summary | 1 | due_date | null | 2026-05-24 | confirmed |
| luna | medium | 20-discharge-summary | 2 | due_date | null | 2026-05-27 | uncertain |
| luna | medium | 20-discharge-summary | 3 | due_date | null | 2026-05-24 | uncertain |
| luna | medium | 20-discharge-summary | 4 | due_date | null | 2026-05-24 | uncertain |
| luna | medium | 20-discharge-summary | 5 | due_date | null | 2026-05-24 | uncertain |
| luna | medium | 20-discharge-summary | 5 | action_required | Attend general practitioner | Contact Dr Susan Patel for medication and blood pressure review | confirmed |
| luna | medium | 20-discharge-summary | 6 | due_date | null | 2026-05-24 | uncertain |
| luna | medium | 20-discharge-summary | 6 | action_required | Attend general practitioner | Contact Dr Susan Patel to arrange a general practitioner review of medicines and blood pressure | confirmed |
| luna | medium | 20-discharge-summary | 7 | due_date | null | 2026-05-24 | uncertain |
| luna | medium | 20-discharge-summary | 8 | due_date | null | 2026-05-24 | uncertain |
| luna | medium | 20-discharge-summary | 9 | due_date | null | 2026-05-24 | uncertain |
| luna | medium | 20-discharge-summary | 10 | due_date | null | 2026-05-24 | uncertain |
| luna | medium | 20-discharge-summary | 10 | action_required | Attend general practitioner | Contact GP for medication and blood pressure review | confirmed |
| luna | medium | 20-discharge-summary | 11 | due_date | null | 2026-05-27 | confirmed |
| luna | medium | 20-discharge-summary | 12 | due_date | null | 2026-05-27 | uncertain |
| luna | medium | 20-discharge-summary | 13 | due_date | null | 2026-05-27 | uncertain |
| luna | medium | 20-discharge-summary | 14 | due_date | null | 2026-05-24 | uncertain |
| luna | medium | 20-discharge-summary | 15 | due_date | null | 2026-05-24 | uncertain |
| luna | medium | 20-discharge-summary | 16 | due_date | null | 2026-05-24 | uncertain |
| luna | medium | 20-discharge-summary | 17 | due_date | null | 2026-05-24 | uncertain |
| luna | medium | 20-discharge-summary | 17 | action_required | Attend general practitioner | Contact Dr Susan Patel for medication and blood pressure review | confirmed |
| luna | medium | 20-discharge-summary | 18 | due_date | null | 2026-05-24 | uncertain |
| luna | medium | 20-discharge-summary | 19 | due_date | null | 2026-05-27 | confirmed |
| luna | medium | 20-discharge-summary | 20 | due_date | null | 2026-05-24 | uncertain |
| luna | medium | 20-discharge-summary | 21 | due_date | null | 2026-05-24 | uncertain |
| luna | medium | 20-discharge-summary | 22 | due_date | null | 2026-05-27 | uncertain |
| luna | medium | 20-discharge-summary | 23 | due_date | null | 2026-05-27 | confirmed |
| luna | medium | 20-discharge-summary | 24 | due_date | null | 2026-05-24 | uncertain |
| luna | medium | 20-discharge-summary | 25 | due_date | null | 2026-05-24 | uncertain |
| luna | medium | 20-discharge-summary | 26 | due_date | null | 2026-05-24 | uncertain |
| luna | medium | 20-discharge-summary | 27 | due_date | null | 2026-05-24 | uncertain |
| luna | medium | 20-discharge-summary | 28 | due_date | null | 2026-05-24 | uncertain |
| luna | medium | 20-discharge-summary | 29 | due_date | null | 2026-05-24 | uncertain |
| luna | medium | 20-discharge-summary | 30 | due_date | null | 2026-05-27 | confirmed |
| luna | medium | 20-discharge-summary | 31 | due_date | null | 2026-05-24 | uncertain |
| luna | medium | 20-discharge-summary | 32 | due_date | null | 2026-05-27 | confirmed |
| luna | medium | 20-discharge-summary | 33 | due_date | null | 2026-05-24 | uncertain |
| luna | medium | 20-discharge-summary | 34 | due_date | null | 2026-05-24 | uncertain |
| luna | medium | 20-discharge-summary | 35 | due_date | null | 2026-05-24 | uncertain |
| luna | medium | 20-discharge-summary | 36 | due_date | null | 2026-05-27 | confirmed |
| luna | medium | 20-discharge-summary | 37 | due_date | null | 2026-05-24 | uncertain |
| luna | medium | 20-discharge-summary | 38 | due_date | null | 2026-05-24 | uncertain |
| luna | medium | 20-discharge-summary | 39 | due_date | null | 2026-05-24 | uncertain |
| luna | medium | 20-discharge-summary | 40 | due_date | null | 2026-05-27 | confirmed |
| luna | medium | 20-discharge-summary | 41 | due_date | null | 2026-05-27 | uncertain |
| luna | medium | 20-discharge-summary | 42 | due_date | null | 2026-05-24 | uncertain |
| luna | medium | 20-discharge-summary | 43 | due_date | null | 2026-05-27 | confirmed |
| luna | medium | 20-discharge-summary | 44 | due_date | null | 2026-05-27 | confirmed |
| luna | medium | 20-discharge-summary | 45 | due_date | null | 2026-05-27 | uncertain |
| luna | medium | 20-discharge-summary | 46 | due_date | null | 2026-05-24 | uncertain |
| luna | medium | 20-discharge-summary | 47 | due_date | null | 2026-05-27 | uncertain |
| luna | medium | 20-discharge-summary | 48 | due_date | null | 2026-05-24 | uncertain |
| luna | medium | 20-discharge-summary | 49 | due_date | null | 2026-05-24 | uncertain |
| luna | medium | 20-discharge-summary | 50 | due_date | null | 2026-05-24 | uncertain |
| luna | medium | 21-dispensed-medicine-label | 1 | amount | null | $7.70 | confirmed |
| luna | medium | 21-dispensed-medicine-label | 1 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 2 | amount | null | $7.70 | confirmed |
| luna | medium | 21-dispensed-medicine-label | 3 | amount | null | $7.70 | confirmed |
| luna | medium | 21-dispensed-medicine-label | 3 | reference | 6429746 DFD | Ref #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 4 | amount | null | $7.70 | confirmed |
| luna | medium | 21-dispensed-medicine-label | 4 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 5 | amount | null | $7.70 | confirmed |
| luna | medium | 21-dispensed-medicine-label | 5 | reference | 6429746 DFD | Ref #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 6 | amount | null | $7.70 | confirmed |
| luna | medium | 21-dispensed-medicine-label | 7 | amount | null | $7.70 | confirmed |
| luna | medium | 21-dispensed-medicine-label | 7 | reference | 6429746 DFD | Ref #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 8 | amount | null | $7.70 | confirmed |
| luna | medium | 21-dispensed-medicine-label | 8 | reference | 6429746 DFD | Ref #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 9 | amount | null | $7.70 | confirmed |
| luna | medium | 21-dispensed-medicine-label | 9 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 10 | amount | null | $7.70 | confirmed |
| luna | medium | 21-dispensed-medicine-label | 10 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 11 | amount | null | $7.70 | confirmed |
| luna | medium | 21-dispensed-medicine-label | 11 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 12 | amount | null | $7.70 | confirmed |
| luna | medium | 21-dispensed-medicine-label | 12 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 13 | amount | null | $7.70 | confirmed |
| luna | medium | 21-dispensed-medicine-label | 13 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 14 | amount | null | $7.70 | confirmed |
| luna | medium | 21-dispensed-medicine-label | 14 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 15 | amount | null | $7.70 | confirmed |
| luna | medium | 21-dispensed-medicine-label | 15 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 16 | amount | null | $7.70 | confirmed |
| luna | medium | 21-dispensed-medicine-label | 16 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 17 | amount | null | $7.70 | confirmed |
| luna | medium | 21-dispensed-medicine-label | 17 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 18 | amount | null | $7.70 | confirmed |
| luna | medium | 21-dispensed-medicine-label | 18 | reference | 6429746 DFD | Ref #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 19 | amount | null | $7.70 | confirmed |
| luna | medium | 21-dispensed-medicine-label | 19 | reference | 6429746 DFD | Ref #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 20 | amount | null | $7.70 | confirmed |
| luna | medium | 21-dispensed-medicine-label | 20 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 21 | amount | null | $7.70 | confirmed |
| luna | medium | 21-dispensed-medicine-label | 21 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 22 | amount | null | $7.70 | confirmed |
| luna | medium | 21-dispensed-medicine-label | 22 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 23 | amount | null | $7.70 | confirmed |
| luna | medium | 21-dispensed-medicine-label | 23 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 24 | amount | null | $7.70 | confirmed |
| luna | medium | 21-dispensed-medicine-label | 24 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 25 | amount | null | $7.70 | confirmed |
| luna | medium | 21-dispensed-medicine-label | 25 | reference | 6429746 DFD | Ref #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 26 | amount | null | $7.70 | confirmed |
| luna | medium | 21-dispensed-medicine-label | 26 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 27 | amount | null | $7.70 | confirmed |
| luna | medium | 21-dispensed-medicine-label | 27 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 28 | amount | null | $7.70 | confirmed |
| luna | medium | 21-dispensed-medicine-label | 28 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 29 | amount | null | $7.70 | confirmed |
| luna | medium | 21-dispensed-medicine-label | 29 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 30 | amount | null | $7.70 | confirmed |
| luna | medium | 21-dispensed-medicine-label | 30 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 31 | amount | null | $7.70 | confirmed |
| luna | medium | 21-dispensed-medicine-label | 31 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 32 | amount | null | $7.70 | confirmed |
| luna | medium | 21-dispensed-medicine-label | 32 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 33 | amount | null | $7.70 | confirmed |
| luna | medium | 21-dispensed-medicine-label | 33 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 34 | amount | null | $7.70 | confirmed |
| luna | medium | 21-dispensed-medicine-label | 34 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 35 | amount | null | $7.70 | confirmed |
| luna | medium | 21-dispensed-medicine-label | 35 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 36 | amount | null | $7.70 | confirmed |
| luna | medium | 21-dispensed-medicine-label | 36 | reference | 6429746 DFD | Ref #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 37 | amount | null | $7.70 | confirmed |
| luna | medium | 21-dispensed-medicine-label | 37 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 38 | amount | null | $7.70 | confirmed |
| luna | medium | 21-dispensed-medicine-label | 38 | reference | 6429746 DFD | Ref #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 39 | amount | null | $7.70 | confirmed |
| luna | medium | 21-dispensed-medicine-label | 39 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 40 | amount | null | $7.70 | confirmed |
| luna | medium | 21-dispensed-medicine-label | 40 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 41 | amount | null | $7.70 | confirmed |
| luna | medium | 21-dispensed-medicine-label | 42 | amount | null | $7.70 | confirmed |
| luna | medium | 21-dispensed-medicine-label | 43 | amount | null | $7.70 | confirmed |
| luna | medium | 21-dispensed-medicine-label | 43 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 44 | amount | null | $7.70 | confirmed |
| luna | medium | 21-dispensed-medicine-label | 44 | reference | 6429746 DFD | Ref #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 45 | amount | null | $7.70 | confirmed |
| luna | medium | 21-dispensed-medicine-label | 46 | amount | null | $7.70 | confirmed |
| luna | medium | 21-dispensed-medicine-label | 46 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 47 | amount | null | $7.70 | confirmed |
| luna | medium | 21-dispensed-medicine-label | 47 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 48 | amount | null | $7.70 | confirmed |
| luna | medium | 21-dispensed-medicine-label | 48 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 49 | amount | null | $7.70 | confirmed |
| luna | medium | 21-dispensed-medicine-label | 49 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| luna | medium | 21-dispensed-medicine-label | 50 | amount | null | $7.70 | confirmed |
| luna | medium | 22-aged-care-notice-of-decision | 1 | reference | AC87542 | RC532986 | confirmed |
| luna | medium | 22-aged-care-notice-of-decision | 2 | reference | AC87542 | RC532986 | confirmed |
| luna | medium | 22-aged-care-notice-of-decision | 3 | reference | AC87542 | RC532986 | confirmed |
| luna | medium | 22-aged-care-notice-of-decision | 4 | reference | AC87542 | RC532986 | confirmed |
| luna | medium | 22-aged-care-notice-of-decision | 5 | reference | AC87542 | RC532986 | confirmed |
| luna | medium | 22-aged-care-notice-of-decision | 6 | reference | AC87542 | RC532986 | confirmed |
| luna | medium | 22-aged-care-notice-of-decision | 7 | reference | AC87542 | RC532986 | confirmed |
| luna | medium | 22-aged-care-notice-of-decision | 8 | reference | AC87542 | RC532986 | confirmed |
| luna | medium | 22-aged-care-notice-of-decision | 9 | reference | AC87542 | RC532986 | confirmed |
| luna | medium | 22-aged-care-notice-of-decision | 10 | reference | AC87542 | RC532986 | confirmed |
| luna | medium | 22-aged-care-notice-of-decision | 11 | reference | AC87542 | RC532986 | confirmed |
| luna | medium | 22-aged-care-notice-of-decision | 12 | reference | AC87542 | RC532986 | confirmed |
| luna | medium | 22-aged-care-notice-of-decision | 13 | reference | AC87542 | RC532986 | confirmed |
| luna | medium | 22-aged-care-notice-of-decision | 14 | reference | AC87542 | RC532986 | confirmed |
| luna | medium | 22-aged-care-notice-of-decision | 15 | reference | AC87542 | RC532986 | confirmed |
| luna | medium | 22-aged-care-notice-of-decision | 16 | reference | AC87542 | RC532986 | confirmed |
| luna | medium | 22-aged-care-notice-of-decision | 17 | reference | AC87542 | RC532986 | confirmed |
| luna | medium | 22-aged-care-notice-of-decision | 18 | reference | AC87542 | RC532986 | confirmed |
| luna | medium | 22-aged-care-notice-of-decision | 19 | reference | AC87542 | RC532986 | confirmed |
| luna | medium | 22-aged-care-notice-of-decision | 20 | reference | AC87542 | RC532986 | confirmed |
| luna | medium | 22-aged-care-notice-of-decision | 21 | reference | AC87542 | RC532986 | confirmed |
| luna | medium | 22-aged-care-notice-of-decision | 22 | due_date | null | 2026-07-02 | confirmed |
| luna | medium | 22-aged-care-notice-of-decision | 22 | reference | AC87542 | RC532986 | confirmed |
| luna | medium | 22-aged-care-notice-of-decision | 23 | reference | AC87542 | RC532986 | confirmed |
| luna | medium | 22-aged-care-notice-of-decision | 24 | reference | AC87542 | RC532986 | confirmed |
| luna | medium | 22-aged-care-notice-of-decision | 25 | reference | AC87542 | RC532986 | confirmed |
| luna | medium | 22-aged-care-notice-of-decision | 26 | reference | AC87542 | RC532986 | confirmed |
| luna | medium | 22-aged-care-notice-of-decision | 27 | due_date | null | 2026-07-02 | uncertain |
| luna | medium | 22-aged-care-notice-of-decision | 27 | reference | AC87542 | RC532986 | confirmed |
| luna | medium | 22-aged-care-notice-of-decision | 28 | reference | AC87542 | RC532986 | confirmed |
| luna | medium | 22-aged-care-notice-of-decision | 29 | reference | AC87542 | RC532986 | confirmed |
| luna | medium | 22-aged-care-notice-of-decision | 30 | reference | AC87542 | RC532986 | confirmed |
| luna | medium | 22-aged-care-notice-of-decision | 31 | reference | AC87542 | RC532986 | confirmed |
| luna | medium | 22-aged-care-notice-of-decision | 32 | due_date | null | 2026-07-02 | uncertain |
| luna | medium | 22-aged-care-notice-of-decision | 32 | reference | AC87542 | RC532986 | confirmed |
| luna | medium | 22-aged-care-notice-of-decision | 33 | reference | AC87542 | RC532986 | confirmed |
| luna | medium | 22-aged-care-notice-of-decision | 34 | reference | AC87542 | RC532986 | confirmed |
| luna | medium | 22-aged-care-notice-of-decision | 35 | reference | AC87542 | RC532986 | confirmed |
| luna | medium | 22-aged-care-notice-of-decision | 35 | action_required | Contact a Support at Home provider | No action | confirmed |
| luna | medium | 22-aged-care-notice-of-decision | 36 | reference | AC87542 | RC532986 | confirmed |
| luna | medium | 22-aged-care-notice-of-decision | 37 | reference | AC87542 | RC532986 | confirmed |
| luna | medium | 22-aged-care-notice-of-decision | 38 | reference | AC87542 | RC532986 | confirmed |
| luna | medium | 22-aged-care-notice-of-decision | 39 | reference | AC87542 | RC532986 | confirmed |
| luna | medium | 22-aged-care-notice-of-decision | 40 | reference | AC87542 | RC532986 | confirmed |
| luna | medium | 22-aged-care-notice-of-decision | 41 | due_date | null | 2026-07-02 | confirmed |
| luna | medium | 22-aged-care-notice-of-decision | 41 | reference | AC87542 | RC532986 | confirmed |
| luna | medium | 22-aged-care-notice-of-decision | 42 | reference | AC87542 | RC532986 | confirmed |
| luna | medium | 22-aged-care-notice-of-decision | 43 | reference | AC87542 | RC532986 | confirmed |
| luna | medium | 22-aged-care-notice-of-decision | 44 | reference | AC87542 | RC532986 | confirmed |
| luna | medium | 22-aged-care-notice-of-decision | 45 | reference | AC87542 | RC532986 | confirmed |
| luna | medium | 22-aged-care-notice-of-decision | 46 | reference | AC87542 | RC532986 | confirmed |
| luna | medium | 22-aged-care-notice-of-decision | 47 | reference | AC87542 | RC532986 | confirmed |
| luna | medium | 22-aged-care-notice-of-decision | 48 | reference | AC87542 | RC532986 | confirmed |
| luna | medium | 22-aged-care-notice-of-decision | 49 | reference | AC87542 | RC532986 | confirmed |
| luna | medium | 22-aged-care-notice-of-decision | 50 | reference | AC87542 | RC532986 | confirmed |
| luna | medium | 22-aged-care-notice-of-decision | 50 | issuer | Bramworth Hospital | Bromworth Hospital Aged Care Assessment Service | confirmed |
| luna | medium | 24-motor-insurance-renewal | 1 | amount | null | $684.35 | confirmed |
| luna | medium | 24-motor-insurance-renewal | 2 | due_date | null | 2026-09-18 | confirmed |
| luna | medium | 24-motor-insurance-renewal | 2 | amount | null | $684.35 | confirmed |
| luna | medium | 24-motor-insurance-renewal | 2 | action_required | No action | Contact Quillhaven Insurance if you do not want to renew | confirmed |
| luna | medium | 24-motor-insurance-renewal | 3 | amount | null | $684.35 | confirmed |
| luna | medium | 24-motor-insurance-renewal | 4 | amount | null | $684.35 | confirmed |
| luna | medium | 24-motor-insurance-renewal | 5 | amount | null | $684.35 | confirmed |
| luna | medium | 24-motor-insurance-renewal | 6 | amount | null | $684.35 | confirmed |
| luna | medium | 24-motor-insurance-renewal | 7 | amount | null | $684.35 | confirmed |
| luna | medium | 24-motor-insurance-renewal | 8 | amount | null | $684.35 | confirmed |
| luna | medium | 24-motor-insurance-renewal | 9 | amount | null | $684.35 | confirmed |
| luna | medium | 24-motor-insurance-renewal | 10 | due_date | null | 2026-10-18 | uncertain |
| luna | medium | 24-motor-insurance-renewal | 10 | amount | null | $684.35 | confirmed |
| luna | medium | 24-motor-insurance-renewal | 10 | action_required | No action | Pay Quillhaven Insurance | confirmed |
| luna | medium | 24-motor-insurance-renewal | 11 | due_date | null | 2026-09-18 | confirmed |
| luna | medium | 24-motor-insurance-renewal | 11 | amount | null | $684.35 | confirmed |
| luna | medium | 24-motor-insurance-renewal | 11 | action_required | No action | Contact Quillhaven Insurance before renewal if you do not want to renew | confirmed |
| luna | medium | 24-motor-insurance-renewal | 12 | due_date | null | 2026-09-18 | confirmed |
| luna | medium | 24-motor-insurance-renewal | 12 | amount | null | $684.35 | confirmed |
| luna | medium | 24-motor-insurance-renewal | 12 | action_required | No action | Contact Quillhaven Insurance if not renewing | confirmed |
| luna | medium | 24-motor-insurance-renewal | 13 | amount | null | $684.35 | confirmed |
| luna | medium | 24-motor-insurance-renewal | 14 | amount | null | $684.35 | confirmed |
| luna | medium | 24-motor-insurance-renewal | 15 | amount | null | $684.35 | confirmed |
| luna | medium | 24-motor-insurance-renewal | 16 | amount | null | $684.35 | confirmed |
| luna | medium | 24-motor-insurance-renewal | 17 | amount | null | $684.35 | confirmed |
| luna | medium | 24-motor-insurance-renewal | 18 | due_date | null | 2026-10-18 | uncertain |
| luna | medium | 24-motor-insurance-renewal | 18 | amount | null | $684.35 | confirmed |
| luna | medium | 24-motor-insurance-renewal | 18 | action_required | No action | Pay Quillhaven Insurance | confirmed |
| luna | medium | 24-motor-insurance-renewal | 19 | due_date | null | 2026-10-18 | uncertain |
| luna | medium | 24-motor-insurance-renewal | 19 | amount | null | $684.35 | confirmed |
| luna | medium | 24-motor-insurance-renewal | 20 | amount | null | $684.35 | confirmed |
| luna | medium | 24-motor-insurance-renewal | 21 | amount | null | $684.35 | confirmed |
| luna | medium | 24-motor-insurance-renewal | 22 | amount | null | $684.35 | confirmed |
| luna | medium | 24-motor-insurance-renewal | 23 | amount | null | $684.35 | confirmed |
| luna | medium | 24-motor-insurance-renewal | 24 | amount | null | $684.35 | confirmed |
| luna | medium | 24-motor-insurance-renewal | 25 | amount | null | $684.35 | confirmed |
| luna | medium | 24-motor-insurance-renewal | 26 | due_date | null | 2026-09-18 | confirmed |
| luna | medium | 24-motor-insurance-renewal | 26 | amount | null | $684.35 | confirmed |
| luna | medium | 24-motor-insurance-renewal | 26 | action_required | No action | Contact Quillhaven Insurance before expiry if not renewing | confirmed |
| luna | medium | 24-motor-insurance-renewal | 27 | amount | null | $684.35 | confirmed |
| luna | medium | 24-motor-insurance-renewal | 28 | amount | null | $684.35 | confirmed |
| luna | medium | 24-motor-insurance-renewal | 29 | amount | null | $684.35 | confirmed |
| luna | medium | 24-motor-insurance-renewal | 30 | due_date | null | 2026-09-18 | confirmed |
| luna | medium | 24-motor-insurance-renewal | 30 | amount | null | $684.35 | confirmed |
| luna | medium | 24-motor-insurance-renewal | 30 | action_required | No action | Contact Quillhaven Insurance before 18 September 2026 to stop renewal | confirmed |
| luna | medium | 24-motor-insurance-renewal | 31 | due_date | null | 2026-09-18 | confirmed |
| luna | medium | 24-motor-insurance-renewal | 31 | amount | null | $684.35 | confirmed |
| luna | medium | 24-motor-insurance-renewal | 31 | action_required | No action | Contact Quillhaven Insurance if you do not want to renew | confirmed |
| luna | medium | 24-motor-insurance-renewal | 32 | amount | null | $684.35 | confirmed |
| luna | medium | 24-motor-insurance-renewal | 33 | amount | null | $684.35 | confirmed |
| luna | medium | 24-motor-insurance-renewal | 34 | amount | null | $684.35 | confirmed |
| luna | medium | 24-motor-insurance-renewal | 35 | due_date | null | 2026-09-18 | uncertain |
| luna | medium | 24-motor-insurance-renewal | 35 | amount | null | $684.35 | confirmed |
| luna | medium | 24-motor-insurance-renewal | 36 | amount | null | $684.35 | confirmed |
| luna | medium | 24-motor-insurance-renewal | 37 | due_date | null | 2026-09-18 | confirmed |
| luna | medium | 24-motor-insurance-renewal | 37 | amount | null | $684.35 | confirmed |
| luna | medium | 24-motor-insurance-renewal | 37 | action_required | No action | Contact Quillhaven Insurance before expiry if not renewing | confirmed |
| luna | medium | 24-motor-insurance-renewal | 38 | amount | null | $684.35 | confirmed |
| luna | medium | 24-motor-insurance-renewal | 39 | amount | null | $684.35 | confirmed |
| luna | medium | 24-motor-insurance-renewal | 40 | amount | null | $684.35 | confirmed |
| luna | medium | 24-motor-insurance-renewal | 41 | amount | null | $684.35 | confirmed |
| luna | medium | 24-motor-insurance-renewal | 42 | due_date | null | 2026-09-18 | confirmed |
| luna | medium | 24-motor-insurance-renewal | 42 | amount | null | $684.35 | confirmed |
| luna | medium | 24-motor-insurance-renewal | 42 | action_required | No action | Contact Quillhaven Insurance if you do not want to renew | confirmed |
| luna | medium | 24-motor-insurance-renewal | 43 | amount | null | $684.35 | confirmed |
| luna | medium | 24-motor-insurance-renewal | 44 | amount | null | $684.35 | confirmed |
| luna | medium | 24-motor-insurance-renewal | 45 | amount | null | $684.35 | confirmed |
| luna | medium | 24-motor-insurance-renewal | 46 | amount | null | $684.35 | confirmed |
| luna | medium | 24-motor-insurance-renewal | 47 | amount | null | $684.35 | confirmed |
| luna | medium | 24-motor-insurance-renewal | 48 | amount | null | $684.35 | confirmed |
| luna | medium | 24-motor-insurance-renewal | 49 | amount | null | $684.35 | confirmed |
| luna | medium | 24-motor-insurance-renewal | 50 | amount | null | $684.35 | confirmed |
| luna | medium | 25-postal-collection-card | 1 | due_date | null | null | unreadable |
| luna | medium | 25-postal-collection-card | 2 | due_date | null | null | unreadable |
| luna | medium | 25-postal-collection-card | 3 | due_date | null | null | unreadable |
| luna | medium | 25-postal-collection-card | 4 | due_date | null | null | unreadable |
| luna | medium | 25-postal-collection-card | 5 | due_date | null | null | unreadable |
| luna | medium | 25-postal-collection-card | 6 | due_date | null | null | unreadable |
| luna | medium | 25-postal-collection-card | 7 | due_date | null | null | unreadable |
| luna | medium | 25-postal-collection-card | 9 | due_date | null | null | unreadable |
| luna | medium | 25-postal-collection-card | 10 | due_date | null | null | unreadable |
| luna | medium | 25-postal-collection-card | 11 | due_date | null | null | unreadable |
| luna | medium | 25-postal-collection-card | 12 | due_date | null | null | unreadable |
| luna | medium | 25-postal-collection-card | 13 | due_date | null | null | unreadable |
| luna | medium | 25-postal-collection-card | 14 | due_date | null | null | unreadable |
| luna | medium | 25-postal-collection-card | 14 | reference | RS431545614AU | R S 4 3 1 5 4 5 6 1 4 A U | confirmed |
| luna | medium | 25-postal-collection-card | 15 | due_date | null | null | unreadable |
| luna | medium | 25-postal-collection-card | 16 | due_date | null | null | unreadable |
| luna | medium | 25-postal-collection-card | 18 | due_date | null | null | unreadable |
| luna | medium | 25-postal-collection-card | 19 | due_date | null | null | unreadable |
| luna | medium | 25-postal-collection-card | 20 | due_date | null | null | unreadable |
| luna | medium | 25-postal-collection-card | 21 | due_date | null | null | unreadable |
| luna | medium | 25-postal-collection-card | 22 | due_date | null | null | unreadable |
| luna | medium | 25-postal-collection-card | 23 | due_date | null | null | unreadable |
| luna | medium | 25-postal-collection-card | 24 | due_date | null | null | unreadable |
| luna | medium | 25-postal-collection-card | 25 | due_date | null | null | unreadable |
| luna | medium | 25-postal-collection-card | 26 | due_date | null | null | unreadable |
| luna | medium | 25-postal-collection-card | 27 | due_date | null | null | unreadable |
| luna | medium | 25-postal-collection-card | 28 | due_date | null | null | unreadable |
| luna | medium | 25-postal-collection-card | 30 | due_date | null | null | unreadable |
| luna | medium | 25-postal-collection-card | 31 | due_date | null | null | unreadable |
| luna | medium | 25-postal-collection-card | 32 | due_date | null | null | unreadable |
| luna | medium | 25-postal-collection-card | 34 | due_date | null | null | unreadable |
| luna | medium | 25-postal-collection-card | 35 | due_date | null | null | unreadable |
| luna | medium | 25-postal-collection-card | 37 | due_date | null | null | unreadable |
| luna | medium | 25-postal-collection-card | 38 | due_date | null | null | unreadable |
| luna | medium | 25-postal-collection-card | 39 | due_date | null | null | unreadable |
| luna | medium | 25-postal-collection-card | 40 | due_date | null | null | unreadable |
| luna | medium | 25-postal-collection-card | 41 | due_date | null | null | unreadable |
| luna | medium | 25-postal-collection-card | 42 | due_date | null | null | unreadable |
| luna | medium | 25-postal-collection-card | 42 | reference | RS431545614AU | R S 4 3 1 5 4 5 6 1 4 A U | confirmed |
| luna | medium | 25-postal-collection-card | 43 | due_date | null | null | unreadable |
| luna | medium | 25-postal-collection-card | 45 | due_date | null | null | unreadable |
| luna | medium | 25-postal-collection-card | 47 | due_date | null | null | unreadable |
| luna | medium | 25-postal-collection-card | 48 | due_date | null | null | unreadable |
| luna | medium | 25-postal-collection-card | 50 | due_date | null | null | unreadable |
| luna | medium | 26-charity-appeal-letter | 1 | due_date | null | 2026-09-30 | confirmed |
| luna | medium | 26-charity-appeal-letter | 1 | action_required | No action | Return form to Pentmere Foundation | confirmed |
| luna | medium | 26-charity-appeal-letter | 2 | due_date | null | 2026-09-30 | confirmed |
| luna | medium | 26-charity-appeal-letter | 2 | action_required | No action | Return form to Pentmere Foundation | confirmed |
| luna | medium | 26-charity-appeal-letter | 3 | due_date | null | 2026-09-30 | confirmed |
| luna | medium | 26-charity-appeal-letter | 3 | amount | null | Not applicable | confirmed |
| luna | medium | 26-charity-appeal-letter | 3 | action_required | No action | Return form to Pentmere Foundation | confirmed |
| luna | medium | 26-charity-appeal-letter | 4 | due_date | null | 2026-09-30 | confirmed |
| luna | medium | 26-charity-appeal-letter | 4 | action_required | No action | Return form to Pentmere Foundation | confirmed |
| luna | medium | 26-charity-appeal-letter | 5 | due_date | null | 2026-09-30 | confirmed |
| luna | medium | 26-charity-appeal-letter | 5 | action_required | No action | Return form to Pentmere Foundation | confirmed |
| luna | medium | 26-charity-appeal-letter | 6 | due_date | null | 2026-09-30 | confirmed |
| luna | medium | 26-charity-appeal-letter | 6 | action_required | No action | Return form to Pentmere Foundation | confirmed |
| luna | medium | 26-charity-appeal-letter | 7 | due_date | null | 2026-09-30 | confirmed |
| luna | medium | 26-charity-appeal-letter | 7 | action_required | No action | Return form to Pentmere Foundation | confirmed |
| luna | medium | 26-charity-appeal-letter | 8 | due_date | null | 2026-09-30 | confirmed |
| luna | medium | 26-charity-appeal-letter | 8 | action_required | No action | Return form to Pentmere Foundation | confirmed |
| luna | medium | 26-charity-appeal-letter | 9 | due_date | null | 2026-09-30 | confirmed |
| luna | medium | 26-charity-appeal-letter | 9 | action_required | No action | Return form to Pentmere Foundation | confirmed |
| luna | medium | 26-charity-appeal-letter | 10 | due_date | null | 2026-09-30 | confirmed |
| luna | medium | 26-charity-appeal-letter | 10 | action_required | No action | Return form to Pentmere Foundation | confirmed |
| luna | medium | 26-charity-appeal-letter | 11 | due_date | null | 2026-09-30 | confirmed |
| luna | medium | 26-charity-appeal-letter | 11 | action_required | No action | Return form to Pentmere Foundation | confirmed |
| luna | medium | 26-charity-appeal-letter | 12 | due_date | null | 2026-09-30 | confirmed |
| luna | medium | 26-charity-appeal-letter | 12 | action_required | No action | Return form to Pentmere Foundation | confirmed |
| luna | medium | 26-charity-appeal-letter | 13 | due_date | null | 2026-09-30 | confirmed |
| luna | medium | 26-charity-appeal-letter | 13 | action_required | No action | Return form to Pentmere Foundation | confirmed |
| luna | medium | 26-charity-appeal-letter | 14 | due_date | null | 2026-09-30 | confirmed |
| luna | medium | 26-charity-appeal-letter | 14 | action_required | No action | Return form to Pentmere Foundation | confirmed |
| luna | medium | 26-charity-appeal-letter | 15 | due_date | null | 2026-09-30 | confirmed |
| luna | medium | 26-charity-appeal-letter | 15 | action_required | No action | Return form to Pentmere Foundation | confirmed |
| luna | medium | 26-charity-appeal-letter | 16 | due_date | null | 2026-09-30 | confirmed |
| luna | medium | 26-charity-appeal-letter | 16 | amount | null | Not applicable | confirmed |
| luna | medium | 26-charity-appeal-letter | 16 | action_required | No action | Return form to Pentmere Foundation | confirmed |
| luna | medium | 26-charity-appeal-letter | 17 | due_date | null | 2026-09-30 | confirmed |
| luna | medium | 26-charity-appeal-letter | 17 | action_required | No action | Return form to Pentmere Foundation | confirmed |
| luna | medium | 26-charity-appeal-letter | 18 | due_date | null | 2026-09-30 | confirmed |
| luna | medium | 26-charity-appeal-letter | 18 | action_required | No action | Return form to Pentmere Foundation | confirmed |
| luna | medium | 26-charity-appeal-letter | 19 | due_date | null | 2026-09-30 | confirmed |
| luna | medium | 26-charity-appeal-letter | 19 | action_required | No action | Return form to Pentmere Foundation | confirmed |
| luna | medium | 26-charity-appeal-letter | 20 | due_date | null | 2026-09-30 | confirmed |
| luna | medium | 26-charity-appeal-letter | 20 | action_required | No action | Return form to Pentmere Foundation | confirmed |
| luna | medium | 26-charity-appeal-letter | 21 | due_date | null | 2026-09-30 | confirmed |
| luna | medium | 26-charity-appeal-letter | 21 | action_required | No action | Return form to Pentmere Foundation | confirmed |
| luna | medium | 26-charity-appeal-letter | 22 | due_date | null | 2026-09-30 | confirmed |
| luna | medium | 26-charity-appeal-letter | 22 | action_required | No action | Return form to Pentmere Foundation | confirmed |
| luna | medium | 26-charity-appeal-letter | 23 | due_date | null | 2026-09-30 | confirmed |
| luna | medium | 26-charity-appeal-letter | 23 | action_required | No action | Return form to Pentmere Foundation | confirmed |
| luna | medium | 26-charity-appeal-letter | 24 | due_date | null | 2026-09-30 | confirmed |
| luna | medium | 26-charity-appeal-letter | 24 | action_required | No action | Return form to Pentmere Foundation | confirmed |
| luna | medium | 26-charity-appeal-letter | 25 | due_date | null | 2026-09-30 | confirmed |
| luna | medium | 26-charity-appeal-letter | 25 | action_required | No action | Return form to Pentmere Foundation | confirmed |
| luna | medium | 26-charity-appeal-letter | 26 | due_date | null | 2026-09-30 | confirmed |
| luna | medium | 26-charity-appeal-letter | 26 | action_required | No action | Return form to Pentmere Foundation | confirmed |
| luna | medium | 26-charity-appeal-letter | 27 | due_date | null | 2026-09-30 | confirmed |
| luna | medium | 26-charity-appeal-letter | 27 | action_required | No action | Return form to Pentmere Foundation | confirmed |
| luna | medium | 26-charity-appeal-letter | 28 | due_date | null | 2026-09-30 | confirmed |
| luna | medium | 26-charity-appeal-letter | 28 | action_required | No action | Return form to Pentmere Foundation | confirmed |
| luna | medium | 26-charity-appeal-letter | 29 | due_date | null | 2026-09-30 | confirmed |
| luna | medium | 26-charity-appeal-letter | 29 | action_required | No action | Return form to Pentmere Foundation | confirmed |
| luna | medium | 26-charity-appeal-letter | 30 | due_date | null | 2026-09-30 | confirmed |
| luna | medium | 26-charity-appeal-letter | 30 | action_required | No action | Return form to Pentmere Foundation | confirmed |
| luna | medium | 26-charity-appeal-letter | 31 | due_date | null | 2026-09-30 | confirmed |
| luna | medium | 26-charity-appeal-letter | 31 | action_required | No action | Return form to Pentmere Foundation | confirmed |
| luna | medium | 26-charity-appeal-letter | 32 | due_date | null | 2026-09-30 | confirmed |
| luna | medium | 26-charity-appeal-letter | 32 | action_required | No action | Return form to Pentmere Foundation | confirmed |
| luna | medium | 26-charity-appeal-letter | 33 | due_date | null | 2026-09-30 | confirmed |
| luna | medium | 26-charity-appeal-letter | 33 | action_required | No action | Return form to Pentmere Foundation | confirmed |
| luna | medium | 26-charity-appeal-letter | 34 | due_date | null | 2026-09-30 | confirmed |
| luna | medium | 26-charity-appeal-letter | 34 | action_required | No action | Return form to Pentmere Foundation | confirmed |
| luna | medium | 26-charity-appeal-letter | 35 | due_date | null | 2026-09-30 | confirmed |
| luna | medium | 26-charity-appeal-letter | 35 | action_required | No action | Return form to Pentmere Foundation | confirmed |
| luna | medium | 26-charity-appeal-letter | 36 | due_date | null | 2026-09-30 | confirmed |
| luna | medium | 26-charity-appeal-letter | 36 | action_required | No action | Return form to Pentmere Foundation | confirmed |
| luna | medium | 26-charity-appeal-letter | 37 | due_date | null | 2026-09-30 | confirmed |
| luna | medium | 26-charity-appeal-letter | 37 | amount | null | $35, $50, $100 or My choice | uncertain |
| luna | medium | 26-charity-appeal-letter | 37 | action_required | No action | Return form to Pentmere Foundation | confirmed |
| luna | medium | 26-charity-appeal-letter | 38 | due_date | null | 2026-09-30 | confirmed |
| luna | medium | 26-charity-appeal-letter | 38 | action_required | No action | Return form to Pentmere Foundation | confirmed |
| luna | medium | 26-charity-appeal-letter | 39 | due_date | null | 2026-09-30 | confirmed |
| luna | medium | 26-charity-appeal-letter | 39 | action_required | No action | Return form to Pentmere Foundation | confirmed |
| luna | medium | 26-charity-appeal-letter | 40 | due_date | null | 2026-09-30 | confirmed |
| luna | medium | 26-charity-appeal-letter | 40 | action_required | No action | Return form to Pentmere Foundation | confirmed |
| luna | medium | 26-charity-appeal-letter | 41 | due_date | null | 2026-09-30 | confirmed |
| luna | medium | 26-charity-appeal-letter | 41 | action_required | No action | Return form to Pentmere Foundation | confirmed |
| luna | medium | 26-charity-appeal-letter | 42 | due_date | null | 2026-09-30 | confirmed |
| luna | medium | 26-charity-appeal-letter | 42 | action_required | No action | Return form to Pentmere Foundation | confirmed |
| luna | medium | 26-charity-appeal-letter | 43 | due_date | null | 2026-09-30 | confirmed |
| luna | medium | 26-charity-appeal-letter | 43 | action_required | No action | Return form to Pentmere Foundation | confirmed |
| luna | medium | 26-charity-appeal-letter | 44 | due_date | null | 2026-09-30 | confirmed |
| luna | medium | 26-charity-appeal-letter | 44 | action_required | No action | Return form to Pentmere Foundation | confirmed |
| luna | medium | 26-charity-appeal-letter | 45 | due_date | null | 2026-09-30 | confirmed |
| luna | medium | 26-charity-appeal-letter | 45 | action_required | No action | Return form to Pentmere Foundation | confirmed |
| luna | medium | 26-charity-appeal-letter | 46 | due_date | null | 2026-09-30 | confirmed |
| luna | medium | 26-charity-appeal-letter | 46 | amount | null | Not applicable | confirmed |
| luna | medium | 26-charity-appeal-letter | 46 | action_required | No action | Return form to Pentmere Foundation | confirmed |
| luna | medium | 26-charity-appeal-letter | 47 | due_date | null | 2026-09-30 | confirmed |
| luna | medium | 26-charity-appeal-letter | 47 | action_required | No action | Return form to Pentmere Foundation | confirmed |
| luna | medium | 26-charity-appeal-letter | 48 | due_date | null | 2026-09-30 | confirmed |
| luna | medium | 26-charity-appeal-letter | 48 | action_required | No action | Return form to Pentmere Foundation | confirmed |
| luna | medium | 26-charity-appeal-letter | 49 | due_date | null | 2026-09-30 | confirmed |
| luna | medium | 26-charity-appeal-letter | 49 | action_required | No action | Return form to Pentmere Foundation | confirmed |
| luna | medium | 26-charity-appeal-letter | 50 | due_date | null | 2026-09-30 | confirmed |
| luna | medium | 26-charity-appeal-letter | 50 | action_required | No action | Return form to Pentmere Foundation | confirmed |
| terra | low | 09-specialist-account-statement | 20 | due_date | null | 2026-07-14 | uncertain |
| terra | low | 11-aged-care-monthly-statement | 14 | action_required | No action | Contact Thornhurst Health if you have concerns | confirmed |
| terra | low | 11-aged-care-monthly-statement | 17 | action_required | No action | Contact Thornhurst Health if you have concerns | confirmed |
| terra | low | 11-aged-care-monthly-statement | 18 | action_required | No action | Contact Thornhurst Health provider with concerns | confirmed |
| terra | low | 11-aged-care-monthly-statement | 25 | action_required | No action | Contact Thornhurst Health if you have concerns | confirmed |
| terra | low | 16-driver-licence-renewal-notice | 1 | reference | 05 502 615 | 812 466 305 | confirmed |
| terra | low | 16-driver-licence-renewal-notice | 2 | reference | 05 502 615 | 812 466 305 | confirmed |
| terra | low | 16-driver-licence-renewal-notice | 4 | reference | 05 502 615 | 812 466 305 | confirmed |
| terra | low | 16-driver-licence-renewal-notice | 5 | reference | 05 502 615 | 812 466 305 | confirmed |
| terra | low | 16-driver-licence-renewal-notice | 6 | reference | 05 502 615 | 812 466 305 | confirmed |
| terra | low | 16-driver-licence-renewal-notice | 7 | reference | 05 502 615 | 812 466 305 | confirmed |
| terra | low | 16-driver-licence-renewal-notice | 9 | reference | 05 502 615 | 812 466 305 | confirmed |
| terra | low | 16-driver-licence-renewal-notice | 10 | reference | 05 502 615 | 812 466 305 | confirmed |
| terra | low | 16-driver-licence-renewal-notice | 11 | reference | 05 502 615 | 812 466 305 | confirmed |
| terra | low | 16-driver-licence-renewal-notice | 13 | reference | 05 502 615 | 812 466 305 | confirmed |
| terra | low | 16-driver-licence-renewal-notice | 14 | reference | 05 502 615 | 812 466 305 | confirmed |
| terra | low | 16-driver-licence-renewal-notice | 15 | reference | 05 502 615 | 812 466 305 | confirmed |
| terra | low | 16-driver-licence-renewal-notice | 16 | reference | 05 502 615 | 812 466 305 | confirmed |
| terra | low | 16-driver-licence-renewal-notice | 17 | reference | 05 502 615 | 812 466 305 | confirmed |
| terra | low | 16-driver-licence-renewal-notice | 18 | reference | 05 502 615 | 812 466 305 | confirmed |
| terra | low | 16-driver-licence-renewal-notice | 21 | reference | 05 502 615 | 812 466 305 | confirmed |
| terra | low | 16-driver-licence-renewal-notice | 22 | reference | 05 502 615 | 812 466 305 | confirmed |
| terra | low | 16-driver-licence-renewal-notice | 23 | reference | 05 502 615 | 812 466 305 | confirmed |
| terra | low | 16-driver-licence-renewal-notice | 24 | reference | 05 502 615 | 812 466 305 | confirmed |
| terra | low | 18-medicare-benefit-statement | 1 | reference | 4378 31830 2 | 37-364928 | confirmed |
| terra | low | 18-medicare-benefit-statement | 2 | reference | 4378 31830 2 | 37-364928 | confirmed |
| terra | low | 18-medicare-benefit-statement | 3 | reference | 4378 31830 2 | 37-364928 | confirmed |
| terra | low | 18-medicare-benefit-statement | 4 | reference | 4378 31830 2 | 37-364928 | confirmed |
| terra | low | 18-medicare-benefit-statement | 5 | reference | 4378 31830 2 | 37-364928 | confirmed |
| terra | low | 18-medicare-benefit-statement | 6 | reference | 4378 31830 2 | 37-364928 | confirmed |
| terra | low | 18-medicare-benefit-statement | 7 | reference | 4378 31830 2 | 37-364928 | confirmed |
| terra | low | 18-medicare-benefit-statement | 8 | reference | 4378 31830 2 | 37-364928 | confirmed |
| terra | low | 18-medicare-benefit-statement | 9 | reference | 4378 31830 2 | 37-364928 | confirmed |
| terra | low | 18-medicare-benefit-statement | 10 | reference | 4378 31830 2 | 37-364928 | confirmed |
| terra | low | 18-medicare-benefit-statement | 11 | reference | 4378 31830 2 | 37-364928 | confirmed |
| terra | low | 18-medicare-benefit-statement | 12 | reference | 4378 31830 2 | 37-364928 | confirmed |
| terra | low | 18-medicare-benefit-statement | 13 | reference | 4378 31830 2 | 37-364928 | confirmed |
| terra | low | 18-medicare-benefit-statement | 14 | reference | 4378 31830 2 | 37-364928 | confirmed |
| terra | low | 18-medicare-benefit-statement | 15 | reference | 4378 31830 2 | 37-364928 | confirmed |
| terra | low | 18-medicare-benefit-statement | 16 | reference | 4378 31830 2 | 37-364928 | confirmed |
| terra | low | 18-medicare-benefit-statement | 17 | reference | 4378 31830 2 | 37-364928 | confirmed |
| terra | low | 18-medicare-benefit-statement | 18 | reference | 4378 31830 2 | 37-364928 | confirmed |
| terra | low | 18-medicare-benefit-statement | 19 | reference | 4378 31830 2 | 37-364928 | confirmed |
| terra | low | 18-medicare-benefit-statement | 20 | reference | 4378 31830 2 | 37-364928 | confirmed |
| terra | low | 18-medicare-benefit-statement | 21 | reference | 4378 31830 2 | 37-364928 | confirmed |
| terra | low | 18-medicare-benefit-statement | 22 | reference | 4378 31830 2 | 37-364928 | confirmed |
| terra | low | 18-medicare-benefit-statement | 23 | reference | 4378 31830 2 | 37-364928 | confirmed |
| terra | low | 18-medicare-benefit-statement | 24 | reference | 4378 31830 2 | 37-364928 | confirmed |
| terra | low | 18-medicare-benefit-statement | 25 | reference | 4378 31830 2 | 37-364928 | confirmed |
| terra | low | 20-discharge-summary | 1 | due_date | null | 2026-05-27 | confirmed |
| terra | low | 20-discharge-summary | 2 | action_required | Attend general practitioner | Stop using ibuprofen 200 mg | confirmed |
| terra | low | 20-discharge-summary | 3 | due_date | null | 2026-05-24 | confirmed |
| terra | low | 20-discharge-summary | 3 | action_required | Attend general practitioner | Contact Dr Susan Patel for GP review | confirmed |
| terra | low | 20-discharge-summary | 4 | due_date | null | 2026-05-27 | confirmed |
| terra | low | 20-discharge-summary | 5 | due_date | null | 2026-05-27 | confirmed |
| terra | low | 20-discharge-summary | 6 | due_date | null | 2026-05-27 | confirmed |
| terra | low | 20-discharge-summary | 7 | due_date | null | 2026-05-27 | confirmed |
| terra | low | 20-discharge-summary | 8 | due_date | null | 2026-05-27 | confirmed |
| terra | low | 20-discharge-summary | 8 | reference | 6938509 | Not applicable | confirmed |
| terra | low | 20-discharge-summary | 9 | due_date | null | 2026-05-24 | confirmed |
| terra | low | 20-discharge-summary | 9 | action_required | Attend general practitioner | Contact Dr Susan Patel for GP review | confirmed |
| terra | low | 20-discharge-summary | 10 | due_date | null | 2026-05-27 | confirmed |
| terra | low | 20-discharge-summary | 11 | due_date | null | 2026-05-27 | confirmed |
| terra | low | 20-discharge-summary | 12 | due_date | null | 2026-05-27 | confirmed |
| terra | low | 20-discharge-summary | 13 | due_date | null | 2026-05-27 | confirmed |
| terra | low | 20-discharge-summary | 14 | due_date | null | 2026-05-27 | confirmed |
| terra | low | 20-discharge-summary | 15 | due_date | null | 2026-05-27 | confirmed |
| terra | low | 20-discharge-summary | 16 | due_date | null | 2026-05-27 | confirmed |
| terra | low | 20-discharge-summary | 17 | due_date | null | 2026-05-27 | confirmed |
| terra | low | 20-discharge-summary | 18 | due_date | null | 2026-05-27 | confirmed |
| terra | low | 20-discharge-summary | 19 | due_date | null | 2026-05-27 | confirmed |
| terra | low | 20-discharge-summary | 20 | due_date | null | 2026-05-24 | confirmed |
| terra | low | 20-discharge-summary | 20 | action_required | Attend general practitioner | Contact Dr Susan Patel for GP review | confirmed |
| terra | low | 20-discharge-summary | 21 | due_date | null | 2026-05-24 | confirmed |
| terra | low | 20-discharge-summary | 21 | action_required | Attend general practitioner | Contact Dr Susan Patel for GP review | confirmed |
| terra | low | 20-discharge-summary | 22 | due_date | null | 2026-05-27 | confirmed |
| terra | low | 20-discharge-summary | 23 | due_date | null | 2026-05-27 | confirmed |
| terra | low | 20-discharge-summary | 24 | due_date | null | 2026-05-27 | confirmed |
| terra | low | 20-discharge-summary | 25 | due_date | null | 2026-05-24 | confirmed |
| terra | low | 20-discharge-summary | 25 | action_required | Attend general practitioner | Contact Dr Susan Patel for GP review | confirmed |
| terra | low | 21-dispensed-medicine-label | 1 | amount | null | $7.70 | confirmed |
| terra | low | 21-dispensed-medicine-label | 1 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| terra | low | 21-dispensed-medicine-label | 2 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| terra | low | 21-dispensed-medicine-label | 3 | amount | null | $7.70 | confirmed |
| terra | low | 21-dispensed-medicine-label | 3 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| terra | low | 21-dispensed-medicine-label | 4 | amount | null | $7.70 | confirmed |
| terra | low | 21-dispensed-medicine-label | 4 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| terra | low | 21-dispensed-medicine-label | 5 | amount | null | $7.70 | confirmed |
| terra | low | 21-dispensed-medicine-label | 6 | amount | null | $7.70 | confirmed |
| terra | low | 21-dispensed-medicine-label | 6 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| terra | low | 21-dispensed-medicine-label | 7 | amount | null | $7.70 | confirmed |
| terra | low | 21-dispensed-medicine-label | 7 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| terra | low | 21-dispensed-medicine-label | 8 | amount | null | $7.70 | confirmed |
| terra | low | 21-dispensed-medicine-label | 8 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| terra | low | 21-dispensed-medicine-label | 9 | amount | null | $7.70 | confirmed |
| terra | low | 21-dispensed-medicine-label | 9 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| terra | low | 21-dispensed-medicine-label | 10 | amount | null | $7.70 | confirmed |
| terra | low | 21-dispensed-medicine-label | 10 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| terra | low | 21-dispensed-medicine-label | 11 | amount | null | $7.70 | confirmed |
| terra | low | 21-dispensed-medicine-label | 11 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| terra | low | 21-dispensed-medicine-label | 12 | amount | null | $7.70 | confirmed |
| terra | low | 21-dispensed-medicine-label | 13 | amount | null | $7.70 | confirmed |
| terra | low | 21-dispensed-medicine-label | 13 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| terra | low | 21-dispensed-medicine-label | 14 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| terra | low | 21-dispensed-medicine-label | 15 | amount | null | $7.70 | confirmed |
| terra | low | 21-dispensed-medicine-label | 15 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| terra | low | 21-dispensed-medicine-label | 16 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| terra | low | 21-dispensed-medicine-label | 17 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| terra | low | 21-dispensed-medicine-label | 18 | amount | null | $7.70 | confirmed |
| terra | low | 21-dispensed-medicine-label | 19 | amount | null | $7.70 | confirmed |
| terra | low | 21-dispensed-medicine-label | 19 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| terra | low | 21-dispensed-medicine-label | 20 | amount | null | $7.70 | uncertain |
| terra | low | 21-dispensed-medicine-label | 20 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| terra | low | 21-dispensed-medicine-label | 21 | amount | null | $7.70 | confirmed |
| terra | low | 21-dispensed-medicine-label | 21 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| terra | low | 21-dispensed-medicine-label | 22 | amount | null | $7.70 | confirmed |
| terra | low | 21-dispensed-medicine-label | 22 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| terra | low | 21-dispensed-medicine-label | 23 | amount | null | $7.70 | confirmed |
| terra | low | 21-dispensed-medicine-label | 23 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| terra | low | 21-dispensed-medicine-label | 24 | amount | null | $7.70 | confirmed |
| terra | low | 21-dispensed-medicine-label | 24 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| terra | low | 21-dispensed-medicine-label | 25 | amount | null | $7.70 | confirmed |
| terra | low | 21-dispensed-medicine-label | 25 | reference | 6429746 DFD | #6429746 DFD | confirmed |
| terra | low | 22-aged-care-notice-of-decision | 1 | reference | AC87542 | RC532986 | confirmed |
| terra | low | 22-aged-care-notice-of-decision | 2 | reference | AC87542 | RC532986 | confirmed |
| terra | low | 22-aged-care-notice-of-decision | 3 | reference | AC87542 | RC532986 | confirmed |
| terra | low | 22-aged-care-notice-of-decision | 4 | reference | AC87542 | RC532986 | confirmed |
| terra | low | 22-aged-care-notice-of-decision | 5 | reference | AC87542 | RC532986 | confirmed |
| terra | low | 22-aged-care-notice-of-decision | 6 | reference | AC87542 | RC532986 | confirmed |
| terra | low | 22-aged-care-notice-of-decision | 7 | reference | AC87542 | RC532986 | confirmed |
| terra | low | 22-aged-care-notice-of-decision | 8 | reference | AC87542 | RC532986 | confirmed |
| terra | low | 22-aged-care-notice-of-decision | 8 | action_required | Contact a Support at Home provider | No action | confirmed |
| terra | low | 22-aged-care-notice-of-decision | 9 | reference | AC87542 | RC532986 | confirmed |
| terra | low | 22-aged-care-notice-of-decision | 10 | reference | AC87542 | RC532986 | confirmed |
| terra | low | 22-aged-care-notice-of-decision | 11 | reference | AC87542 | RC532986 | confirmed |
| terra | low | 22-aged-care-notice-of-decision | 12 | reference | AC87542 | RC532986 | confirmed |
| terra | low | 22-aged-care-notice-of-decision | 13 | reference | AC87542 | RC532986 | confirmed |
| terra | low | 22-aged-care-notice-of-decision | 14 | reference | AC87542 | RC532986 | confirmed |
| terra | low | 22-aged-care-notice-of-decision | 15 | reference | AC87542 | RC532986 | confirmed |
| terra | low | 22-aged-care-notice-of-decision | 16 | reference | AC87542 | RC532986 | confirmed |
| terra | low | 22-aged-care-notice-of-decision | 17 | reference | AC87542 | RC532986 | confirmed |
| terra | low | 22-aged-care-notice-of-decision | 18 | reference | AC87542 | RC532986 | confirmed |
| terra | low | 22-aged-care-notice-of-decision | 19 | reference | AC87542 | RC532986 | confirmed |
| terra | low | 22-aged-care-notice-of-decision | 20 | reference | AC87542 | RC532986 | confirmed |
| terra | low | 22-aged-care-notice-of-decision | 21 | reference | AC87542 | RC532986 | confirmed |
| terra | low | 22-aged-care-notice-of-decision | 22 | reference | AC87542 | RC532986 | confirmed |
| terra | low | 22-aged-care-notice-of-decision | 23 | reference | AC87542 | RC532986 | confirmed |
| terra | low | 22-aged-care-notice-of-decision | 23 | action_required | Contact a Support at Home provider | No action | confirmed |
| terra | low | 22-aged-care-notice-of-decision | 24 | reference | AC87542 | RC532986 | confirmed |
| terra | low | 22-aged-care-notice-of-decision | 25 | reference | AC87542 | RC532986 | confirmed |
| terra | low | 24-motor-insurance-renewal | 1 | amount | null | $684.35 | confirmed |
| terra | low | 24-motor-insurance-renewal | 2 | amount | null | $684.35 | confirmed |
| terra | low | 24-motor-insurance-renewal | 3 | amount | null | $684.35 | confirmed |
| terra | low | 24-motor-insurance-renewal | 4 | amount | null | $684.35 | confirmed |
| terra | low | 24-motor-insurance-renewal | 5 | amount | null | $684.35 | confirmed |
| terra | low | 24-motor-insurance-renewal | 6 | amount | null | $684.35 | confirmed |
| terra | low | 24-motor-insurance-renewal | 7 | amount | null | $684.35 | confirmed |
| terra | low | 24-motor-insurance-renewal | 8 | amount | null | $684.35 | confirmed |
| terra | low | 24-motor-insurance-renewal | 9 | amount | null | $684.35 | confirmed |
| terra | low | 24-motor-insurance-renewal | 10 | amount | null | $684.35 | confirmed |
| terra | low | 24-motor-insurance-renewal | 11 | amount | null | $684.35 | confirmed |
| terra | low | 24-motor-insurance-renewal | 12 | amount | null | $684.35 | confirmed |
| terra | low | 24-motor-insurance-renewal | 13 | amount | null | $684.35 | confirmed |
| terra | low | 24-motor-insurance-renewal | 14 | amount | null | $684.35 | confirmed |
| terra | low | 24-motor-insurance-renewal | 15 | amount | null | $684.35 | confirmed |
| terra | low | 24-motor-insurance-renewal | 16 | amount | null | $684.35 | confirmed |
| terra | low | 24-motor-insurance-renewal | 17 | amount | null | $684.35 | confirmed |
| terra | low | 24-motor-insurance-renewal | 18 | amount | null | $684.35 | confirmed |
| terra | low | 24-motor-insurance-renewal | 19 | amount | null | $684.35 | confirmed |
| terra | low | 24-motor-insurance-renewal | 20 | amount | null | $684.35 | confirmed |
| terra | low | 24-motor-insurance-renewal | 21 | amount | null | $684.35 | confirmed |
| terra | low | 24-motor-insurance-renewal | 22 | amount | null | $684.35 | confirmed |
| terra | low | 24-motor-insurance-renewal | 23 | amount | null | $684.35 | confirmed |
| terra | low | 24-motor-insurance-renewal | 24 | amount | null | $684.35 | confirmed |
| terra | low | 24-motor-insurance-renewal | 25 | amount | null | $684.35 | confirmed |
| terra | low | 25-postal-collection-card | 1 | due_date | null | null | unreadable |
| terra | low | 25-postal-collection-card | 1 | reference | RS431545614AU | R S 4 3 1 5 4 5 6 1 4 A U | confirmed |
| terra | low | 25-postal-collection-card | 2 | due_date | null | null | unreadable |
| terra | low | 25-postal-collection-card | 3 | due_date | null | null | unreadable |
| terra | low | 25-postal-collection-card | 5 | due_date | null | null | unreadable |
| terra | low | 25-postal-collection-card | 6 | due_date | null | null | unreadable |
| terra | low | 25-postal-collection-card | 7 | due_date | null | null | unreadable |
| terra | low | 25-postal-collection-card | 7 | reference | RS431545614AU | R S 4 3 1 5 4 5 6 1 4 A U | confirmed |
| terra | low | 25-postal-collection-card | 8 | due_date | null | null | unreadable |
| terra | low | 25-postal-collection-card | 9 | due_date | null | null | unreadable |
| terra | low | 25-postal-collection-card | 9 | reference | RS431545614AU | R S 4 3 1 5 4 5 6 1 4 A U | confirmed |
| terra | low | 25-postal-collection-card | 10 | due_date | null | null | unreadable |
| terra | low | 25-postal-collection-card | 11 | due_date | null | null | unreadable |
| terra | low | 25-postal-collection-card | 12 | due_date | null | null | unreadable |
| terra | low | 25-postal-collection-card | 13 | reference | RS431545614AU | R S 4 3 1 5 4 5 6 1 4 A U | confirmed |
| terra | low | 25-postal-collection-card | 14 | due_date | null | null | unreadable |
| terra | low | 25-postal-collection-card | 14 | reference | RS431545614AU | R S 4 3 1 5 4 5 6 1 4 A U | confirmed |
| terra | low | 25-postal-collection-card | 18 | due_date | null | null | unreadable |
| terra | low | 25-postal-collection-card | 18 | reference | RS431545614AU | R S 4 3 1 5 4 5 6 1 4 A U | confirmed |
| terra | low | 25-postal-collection-card | 20 | due_date | null | null | unreadable |
| terra | low | 25-postal-collection-card | 21 | due_date | null | null | unreadable |
| terra | low | 25-postal-collection-card | 21 | reference | RS431545614AU | R S 4 3 1 5 4 5 6 1 4 A U | confirmed |
| terra | low | 25-postal-collection-card | 22 | due_date | null | null | unreadable |
| terra | low | 25-postal-collection-card | 22 | reference | RS431545614AU | R S 4 3 1 5 4 5 6 1 4 A U | confirmed |
| terra | low | 25-postal-collection-card | 23 | due_date | null | null | unreadable |
| terra | low | 25-postal-collection-card | 24 | due_date | null | null | unreadable |
| terra | low | 25-postal-collection-card | 25 | due_date | null | null | unreadable |
| terra | low | 26-charity-appeal-letter | 1 | due_date | null | 2026-09-30 | confirmed |
| terra | low | 26-charity-appeal-letter | 1 | action_required | No action | Return form to Pentmere Foundation | confirmed |
| terra | low | 26-charity-appeal-letter | 2 | due_date | null | 2026-09-30 | confirmed |
| terra | low | 26-charity-appeal-letter | 2 | action_required | No action | Return form to Pentmere Foundation | confirmed |
| terra | low | 26-charity-appeal-letter | 3 | due_date | null | 2026-09-30 | confirmed |
| terra | low | 26-charity-appeal-letter | 3 | action_required | No action | Return form to Pentmere Foundation | confirmed |
| terra | low | 26-charity-appeal-letter | 4 | due_date | null | 2026-09-30 | confirmed |
| terra | low | 26-charity-appeal-letter | 4 | action_required | No action | Return form to Pentmere Foundation | confirmed |
| terra | low | 26-charity-appeal-letter | 5 | due_date | null | 2026-09-30 | confirmed |
| terra | low | 26-charity-appeal-letter | 5 | action_required | No action | Return form to Pentmere Foundation | confirmed |
| terra | low | 26-charity-appeal-letter | 6 | due_date | null | 2026-09-30 | confirmed |
| terra | low | 26-charity-appeal-letter | 6 | amount | null | Not applicable | confirmed |
| terra | low | 26-charity-appeal-letter | 6 | action_required | No action | Return form to Pentmere Foundation | confirmed |
| terra | low | 26-charity-appeal-letter | 7 | due_date | null | 2026-09-30 | confirmed |
| terra | low | 26-charity-appeal-letter | 7 | action_required | No action | Return form to Pentmere Foundation | confirmed |
| terra | low | 26-charity-appeal-letter | 8 | due_date | null | 2026-09-30 | confirmed |
| terra | low | 26-charity-appeal-letter | 8 | action_required | No action | Return form to Pentmere Foundation | confirmed |
| terra | low | 26-charity-appeal-letter | 9 | due_date | null | 2026-09-30 | confirmed |
| terra | low | 26-charity-appeal-letter | 9 | action_required | No action | Return form to Pentmere Foundation | confirmed |
| terra | low | 26-charity-appeal-letter | 10 | due_date | null | 2026-09-30 | confirmed |
| terra | low | 26-charity-appeal-letter | 10 | action_required | No action | Return form to Pentmere Foundation | confirmed |
| terra | low | 26-charity-appeal-letter | 11 | due_date | null | 2026-09-30 | confirmed |
| terra | low | 26-charity-appeal-letter | 11 | action_required | No action | Return form to Pentmere Foundation | confirmed |
| terra | low | 26-charity-appeal-letter | 12 | due_date | null | 2026-09-30 | confirmed |
| terra | low | 26-charity-appeal-letter | 12 | action_required | No action | Return form to Pentmere Foundation | confirmed |
| terra | low | 26-charity-appeal-letter | 13 | due_date | null | 2026-09-30 | confirmed |
| terra | low | 26-charity-appeal-letter | 13 | action_required | No action | Return form to Pentmere Foundation | confirmed |
| terra | low | 26-charity-appeal-letter | 14 | due_date | null | 2026-09-30 | confirmed |
| terra | low | 26-charity-appeal-letter | 14 | action_required | No action | Return form to Pentmere Foundation | confirmed |
| terra | low | 26-charity-appeal-letter | 15 | due_date | null | 2026-09-30 | confirmed |
| terra | low | 26-charity-appeal-letter | 15 | action_required | No action | Return form to Pentmere Foundation | confirmed |
| terra | low | 26-charity-appeal-letter | 16 | due_date | null | 2026-09-30 | confirmed |
| terra | low | 26-charity-appeal-letter | 16 | action_required | No action | Return form to Pentmere Foundation | confirmed |
| terra | low | 26-charity-appeal-letter | 17 | due_date | null | 2026-09-30 | confirmed |
| terra | low | 26-charity-appeal-letter | 17 | amount | null | Not applicable | confirmed |
| terra | low | 26-charity-appeal-letter | 17 | action_required | No action | Return form to Pentmere Foundation | confirmed |
| terra | low | 26-charity-appeal-letter | 18 | due_date | null | 2026-09-30 | confirmed |
| terra | low | 26-charity-appeal-letter | 18 | amount | null | Not applicable | confirmed |
| terra | low | 26-charity-appeal-letter | 18 | action_required | No action | Return form to Pentmere Foundation | confirmed |
| terra | low | 26-charity-appeal-letter | 19 | due_date | null | 2026-09-30 | confirmed |
| terra | low | 26-charity-appeal-letter | 19 | action_required | No action | Return form to Pentmere Foundation | confirmed |
| terra | low | 26-charity-appeal-letter | 20 | due_date | null | 2026-09-30 | confirmed |
| terra | low | 26-charity-appeal-letter | 20 | amount | null | Not applicable | confirmed |
| terra | low | 26-charity-appeal-letter | 20 | action_required | No action | Return form to Pentmere Foundation | confirmed |
| terra | low | 26-charity-appeal-letter | 21 | due_date | null | 2026-09-30 | confirmed |
| terra | low | 26-charity-appeal-letter | 21 | amount | null | Not applicable | confirmed |
| terra | low | 26-charity-appeal-letter | 21 | action_required | No action | Return form to Pentmere Foundation | confirmed |
| terra | low | 26-charity-appeal-letter | 22 | due_date | null | 2026-09-30 | confirmed |
| terra | low | 26-charity-appeal-letter | 22 | amount | null | Not applicable | confirmed |
| terra | low | 26-charity-appeal-letter | 22 | action_required | No action | Return form to Pentmere Foundation | confirmed |
| terra | low | 26-charity-appeal-letter | 23 | due_date | null | 2026-09-30 | confirmed |
| terra | low | 26-charity-appeal-letter | 23 | amount | null | Not applicable | confirmed |
| terra | low | 26-charity-appeal-letter | 23 | action_required | No action | Return form to Pentmere Foundation | confirmed |
| terra | low | 26-charity-appeal-letter | 24 | due_date | null | 2026-09-30 | confirmed |
| terra | low | 26-charity-appeal-letter | 24 | action_required | No action | Return form to Pentmere Foundation | confirmed |
| terra | low | 26-charity-appeal-letter | 25 | due_date | null | 2026-09-30 | confirmed |
| terra | low | 26-charity-appeal-letter | 25 | action_required | No action | Return form to Pentmere Foundation | confirmed |

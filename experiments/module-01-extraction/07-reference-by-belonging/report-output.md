## 07-reference-by-belonging

| Model | Effort | Letters all right | Fields right | Wrong and confirmed | Input tokens | Output tokens | Reasoning tokens | Seconds | Cost per letter |
|---|---|---|---|---|---|---|---|---|---|
| luna | medium | 598/600 (100%) | 3596/3600 | 2 | 18681 | 769 | 391 | 8.5 | $0.0014 (A$0.0020) |
| terra | low | 300/300 (100%) | 1800/1800 | 0 | 18681 | 310 | 112 | 5.2 | $0.0100 (A$0.0138) |

### Every letter

| Letter | luna medium | terra low | All reads | Wrong and confirmed |
|---|---|---|---|---|
| 01-electricity-bill | 40/40 (100%) | 20/20 (100%) | 60/60 (100%) | 0 |
| 02-gas-bill | 40/40 (100%) | 20/20 (100%) | 60/60 (100%) | 0 |
| 03-water-bill | 40/40 (100%) | 20/20 (100%) | 60/60 (100%) | 0 |
| 05-animal-registration-overdue-notice | 40/40 (100%) | 20/20 (100%) | 60/60 (100%) | 0 |
| 07-penalty-reminder-notice | 40/40 (100%) | 20/20 (100%) | 60/60 (100%) | 0 |
| 08-welfare-information-request | 40/40 (100%) | 20/20 (100%) | 60/60 (100%) | 0 |
| 09-specialist-account-statement | 40/40 (100%) | 20/20 (100%) | 60/60 (100%) | 0 |
| 10-private-health-annual-statement | 40/40 (100%) | 20/20 (100%) | 60/60 (100%) | 0 |
| 12-failure-to-vote-notice | 40/40 (100%) | 20/20 (100%) | 60/60 (100%) | 0 |
| 14-super-annual-member-statement | 40/40 (100%) | 20/20 (100%) | 60/60 (100%) | 0 |
| 15-insurance-key-facts-sheet | 40/40 (100%) | 20/20 (100%) | 60/60 (100%) | 0 |
| 16-driver-licence-renewal-notice | **38/40 (95%)** | 20/20 (100%) | **58/60 (97%)** | 2 |
| 19-outpatient-appointment-letter | 40/40 (100%) | 20/20 (100%) | 60/60 (100%) | 0 |
| 21-dispensed-medicine-label | 40/40 (100%) | 20/20 (100%) | 60/60 (100%) | 0 |
| 23-home-insurance-renewal | 40/40 (100%) | 20/20 (100%) | 60/60 (100%) | 0 |

A letter read 40/40 times bounds its per-read miss rate at 7% (95%, exact binomial).

**This run: 900 calls, $3.84 (A$5.32) in total.**

Cost is Azure's public list price multiplied by the tokens Azure reported per call. Prices are from LiteLLM's model price table (https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json, commit 9eaf15bc, 2026-09-07). The exchange rate USD 1 = AUD 1.3861 is from Frankfurter (European Central Bank rates) (https://api.frankfurter.dev/v1/latest?base=USD&symbols=AUD, 2026-09-08). What RACE pays per token is not known to the team, so this is an estimate at list, not an invoice. Seconds were measured with several calls in flight; the experiment's Design section says how many.

### Every miss

| Model | Effort | Letter | Repeat | Field | Key | Model said | Status |
|---|---|---|---|---|---|---|---|
| luna | medium | 16-driver-licence-renewal-notice | 11 | reference | 05 502 615 | 812 46 305 | uncertain |
| luna | medium | 16-driver-licence-renewal-notice | 11 | identifiers | 05 502 615; 812 466 305 | 05 502 615; 812 46 305 |  |
| luna | medium | 16-driver-licence-renewal-notice | 34 | reference | 05 502 615 | 812 46 305 | uncertain |
| luna | medium | 16-driver-licence-renewal-notice | 34 | identifiers | 05 502 615; 812 466 305 | 05 502 615; 812 46 305 |  |

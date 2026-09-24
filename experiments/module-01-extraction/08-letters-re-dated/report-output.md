## 08-letters-re-dated

| Model | Effort | Letters all right | Fields right | Wrong and confirmed | Input tokens | Output tokens | Reasoning tokens | Seconds | Cost per letter |
|---|---|---|---|---|---|---|---|---|---|
| luna | medium | 571/600 (95%) | 3571/3600 | 29 | 18685 | 836 | 378 | 8.3 | $0.0015 (A$0.0020) |
| terra | low | 287/300 (96%) | 1787/1800 | 13 | 18685 | 305 | 113 | 5.0 | $0.0092 (A$0.0128) |

### Every letter

| Letter | luna medium | terra low | All reads | Wrong and confirmed |
|---|---|---|---|---|
| 01-electricity-bill | 40/40 (100%) | 20/20 (100%) | 60/60 (100%) | 0 |
| 02-gas-bill | 40/40 (100%) | 20/20 (100%) | 60/60 (100%) | 0 |
| 03-water-bill | 40/40 (100%) | 20/20 (100%) | 60/60 (100%) | 0 |
| 05-animal-registration-overdue-notice | 40/40 (100%) | 20/20 (100%) | 60/60 (100%) | 0 |
| 07-penalty-reminder-notice | 40/40 (100%) | 20/20 (100%) | 60/60 (100%) | 0 |
| 08-welfare-information-request | **11/40 (28%)** | **7/20 (35%)** | **18/60 (30%)** | 42 |
| 09-specialist-account-statement | 40/40 (100%) | 20/20 (100%) | 60/60 (100%) | 0 |
| 10-private-health-annual-statement | 40/40 (100%) | 20/20 (100%) | 60/60 (100%) | 0 |
| 12-failure-to-vote-notice | 40/40 (100%) | 20/20 (100%) | 60/60 (100%) | 0 |
| 14-super-annual-member-statement | 40/40 (100%) | 20/20 (100%) | 60/60 (100%) | 0 |
| 15-insurance-key-facts-sheet | 40/40 (100%) | 20/20 (100%) | 60/60 (100%) | 0 |
| 16-driver-licence-renewal-notice | 40/40 (100%) | 20/20 (100%) | 60/60 (100%) | 0 |
| 19-outpatient-appointment-letter | 40/40 (100%) | 20/20 (100%) | 60/60 (100%) | 0 |
| 21-dispensed-medicine-label | 40/40 (100%) | 20/20 (100%) | 60/60 (100%) | 0 |
| 23-home-insurance-renewal | 40/40 (100%) | 20/20 (100%) | 60/60 (100%) | 0 |

A letter read 40/40 times bounds its per-read miss rate at 7% (95%, exact binomial).

**This run: 900 calls, $3.65 (A$5.06) in total.**

Cost is Azure's public list price multiplied by the tokens Azure reported per call. Prices are from LiteLLM's model price table (https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json, commit 9eaf15bc, 2026-09-07). The exchange rate USD 1 = AUD 1.3861 is from Frankfurter (European Central Bank rates) (https://api.frankfurter.dev/v1/latest?base=USD&symbols=AUD, 2026-09-08). What RACE pays per token is not known to the team, so this is an estimate at list, not an invoice. Seconds were measured with several calls in flight; the experiment's Design section says how many.

### Every miss

| Model | Effort | Letter | Repeat | Field | Key | Model said | Status |
|---|---|---|---|---|---|---|---|
| luna | medium | 08-welfare-information-request | 2 | due_date | 2026-11-02 | Not applicable | confirmed |
| luna | medium | 08-welfare-information-request | 5 | due_date | 2026-11-02 | Not applicable | confirmed |
| luna | medium | 08-welfare-information-request | 6 | due_date | 2026-11-02 | Not applicable | confirmed |
| luna | medium | 08-welfare-information-request | 7 | due_date | 2026-11-02 | Not applicable | confirmed |
| luna | medium | 08-welfare-information-request | 8 | due_date | 2026-11-02 | Not applicable | confirmed |
| luna | medium | 08-welfare-information-request | 9 | due_date | 2026-11-02 | Not applicable | confirmed |
| luna | medium | 08-welfare-information-request | 12 | due_date | 2026-11-02 | Not applicable | confirmed |
| luna | medium | 08-welfare-information-request | 13 | due_date | 2026-11-02 | Not applicable | confirmed |
| luna | medium | 08-welfare-information-request | 14 | due_date | 2026-11-02 | Not applicable | confirmed |
| luna | medium | 08-welfare-information-request | 15 | due_date | 2026-11-02 | Not applicable | confirmed |
| luna | medium | 08-welfare-information-request | 16 | due_date | 2026-11-02 | Not applicable | confirmed |
| luna | medium | 08-welfare-information-request | 17 | due_date | 2026-11-02 | Not applicable | confirmed |
| luna | medium | 08-welfare-information-request | 18 | due_date | 2026-11-02 | Not applicable | confirmed |
| luna | medium | 08-welfare-information-request | 19 | due_date | 2026-11-02 | Not applicable | confirmed |
| luna | medium | 08-welfare-information-request | 20 | due_date | 2026-11-02 | Not applicable | confirmed |
| luna | medium | 08-welfare-information-request | 22 | due_date | 2026-11-02 | Not applicable | confirmed |
| luna | medium | 08-welfare-information-request | 24 | due_date | 2026-11-02 | Not applicable | confirmed |
| luna | medium | 08-welfare-information-request | 25 | due_date | 2026-11-02 | Not applicable | confirmed |
| luna | medium | 08-welfare-information-request | 26 | due_date | 2026-11-02 | Not applicable | confirmed |
| luna | medium | 08-welfare-information-request | 27 | due_date | 2026-11-02 | Not applicable | confirmed |
| luna | medium | 08-welfare-information-request | 29 | due_date | 2026-11-02 | Not applicable | confirmed |
| luna | medium | 08-welfare-information-request | 30 | due_date | 2026-11-02 | Not applicable | confirmed |
| luna | medium | 08-welfare-information-request | 32 | due_date | 2026-11-02 | Not applicable | confirmed |
| luna | medium | 08-welfare-information-request | 35 | due_date | 2026-11-02 | Not applicable | confirmed |
| luna | medium | 08-welfare-information-request | 36 | due_date | 2026-11-02 | Not applicable | confirmed |
| luna | medium | 08-welfare-information-request | 37 | due_date | 2026-11-02 | Not applicable | confirmed |
| luna | medium | 08-welfare-information-request | 38 | due_date | 2026-11-02 | Not applicable | confirmed |
| luna | medium | 08-welfare-information-request | 39 | due_date | 2026-11-02 | Not applicable | confirmed |
| luna | medium | 08-welfare-information-request | 40 | due_date | 2026-11-02 | Not applicable | confirmed |
| terra | low | 08-welfare-information-request | 1 | due_date | 2026-11-02 | Not applicable | confirmed |
| terra | low | 08-welfare-information-request | 2 | due_date | 2026-11-02 | Not applicable | confirmed |
| terra | low | 08-welfare-information-request | 3 | due_date | 2026-11-02 | Not applicable | confirmed |
| terra | low | 08-welfare-information-request | 4 | due_date | 2026-11-02 | Not applicable | confirmed |
| terra | low | 08-welfare-information-request | 5 | due_date | 2026-11-02 | Not applicable | confirmed |
| terra | low | 08-welfare-information-request | 7 | due_date | 2026-11-02 | Not applicable | confirmed |
| terra | low | 08-welfare-information-request | 8 | due_date | 2026-11-02 | Not applicable | confirmed |
| terra | low | 08-welfare-information-request | 10 | due_date | 2026-11-02 | Not applicable | confirmed |
| terra | low | 08-welfare-information-request | 11 | due_date | 2026-11-02 | Not applicable | confirmed |
| terra | low | 08-welfare-information-request | 14 | due_date | 2026-11-02 | Not applicable | confirmed |
| terra | low | 08-welfare-information-request | 16 | due_date | 2026-11-02 | Not applicable | confirmed |
| terra | low | 08-welfare-information-request | 19 | due_date | 2026-11-02 | Not applicable | confirmed |
| terra | low | 08-welfare-information-request | 20 | due_date | 2026-11-02 | Not applicable | confirmed |

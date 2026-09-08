/**
 * Public list prices, for the cost column of the report.
 *
 * These are Azure's published per-token prices, taken from LiteLLM's price
 * table rather than typed from memory, and they are list prices: what RACE
 * actually pays per token is not known to the team, so a cost here is an
 * estimate at list, not an invoice.
 *
 * Reasoning tokens are billed as output and are already inside
 * `output_tokens` in what Azure reports, so they are not added twice.
 *
 * Source: https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json
 *         keys `azure/gpt-5.6-luna` and `azure/gpt-5.6-terra`, commit 9eaf15bc, 2026-09-07
 * FX:     https://api.frankfurter.dev/v1/latest?base=USD&symbols=AUD, 2026-09-08
 */

import type { Model } from "./config";

/** USD per token. */
export const PRICES: Record<
  Model,
  { input: number; cachedInput: number; output: number }
> = {
  "gpt-5.6-luna": { input: 2e-7, cachedInput: 2e-8, output: 1.2e-6 },
  "gpt-5.6-terra": { input: 2e-6, cachedInput: 2e-7, output: 1.2e-5 },
};

export const PRICES_AS_OF = "2026-09-07";

export const USD_TO_AUD = 1.3861;
export const FX_AS_OF = "2026-09-08";

export function usdFor(
  model: Model,
  usage: { input_tokens: number; cached_tokens: number; output_tokens: number },
): number {
  const p = PRICES[model];
  const fresh = Math.max(usage.input_tokens - usage.cached_tokens, 0);
  return (
    fresh * p.input +
    usage.cached_tokens * p.cachedInput +
    usage.output_tokens * p.output
  );
}

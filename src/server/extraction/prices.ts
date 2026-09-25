/**
 * Public list prices, so a model call can be written down with what it cost.
 *
 * KAN-63: moved here from the experiments, which import it, so the product's
 * audit columns and an experiment report multiply the same numbers. No
 * server-only import and relative paths only, for the same reason as
 * ./agreement.ts.
 *
 * These are Azure's published per-token prices, taken from LiteLLM's price
 * table rather than typed from memory, and they are list prices: what RACE
 * actually pays per token is not known to the team, so a cost here is an
 * estimate at list, not an invoice. Dollars are US dollars, the currency the
 * table is in; turning them into Australian dollars is a rate that changes
 * daily, so it is done where a figure is reported and never stored.
 *
 * Reasoning tokens are billed as output and are already inside
 * `output_tokens` in what Azure reports, so they are not added twice.
 *
 * Source: https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json
 *         keys `azure/gpt-5.6-luna` and `azure/gpt-5.6-terra`, commit 9eaf15bc, 2026-09-07
 */

/** USD per token. */
export const PRICES: Record<
  string,
  { input: number; cachedInput: number; output: number }
> = {
  "gpt-5.6-luna": { input: 2e-7, cachedInput: 2e-8, output: 1.2e-6 },
  "gpt-5.6-terra": { input: 2e-6, cachedInput: 2e-7, output: 1.2e-5 },
};

export const PRICES_AS_OF = "2026-09-07";
export const PRICE_SOURCE =
  "https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json";
export const PRICE_SOURCE_NAME = "LiteLLM's model price table";
export const PRICE_SOURCE_COMMIT = "9eaf15bc";

/**
 * What a call cost at list, in US dollars.
 *
 * Null when there is nothing to price: no usage was reported (the mock, or a
 * call that never reached the model), or the model is not in the table.
 */
export function estimatedCostUsd(
  model: string | null,
  usage: {
    input_tokens: number;
    cached_tokens: number;
    output_tokens: number;
  } | null,
): number | null {
  const p = model ? PRICES[model] : undefined;
  if (!p || !usage) return null;
  const fresh = Math.max(usage.input_tokens - usage.cached_tokens, 0);
  return (
    fresh * p.input +
    usage.cached_tokens * p.cachedInput +
    usage.output_tokens * p.output
  );
}

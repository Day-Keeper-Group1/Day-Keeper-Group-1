/**
 * Public list prices, for the cost column of the report.
 *
 * The prices themselves live in the product, src/server/extraction/prices.ts,
 * where the reading records what each call cost; an experiment and the product
 * multiply the same table. What stays here is the exchange rate, which only a
 * report uses.
 *
 * FX: https://api.frankfurter.dev/v1/latest?base=USD&symbols=AUD, 2026-09-08
 */

import {
  PRICES,
  PRICES_AS_OF,
  PRICE_SOURCE,
  PRICE_SOURCE_COMMIT,
  PRICE_SOURCE_NAME,
  estimatedCostUsd,
} from "../../../src/server/extraction/prices";
import type { Model } from "./config";

export {
  PRICES,
  PRICES_AS_OF,
  PRICE_SOURCE,
  PRICE_SOURCE_COMMIT,
  PRICE_SOURCE_NAME,
};

export const USD_TO_AUD = 1.3861;
export const FX_AS_OF = "2026-09-08";
export const FX_SOURCE =
  "https://api.frankfurter.dev/v1/latest?base=USD&symbols=AUD";
export const FX_SOURCE_NAME = "Frankfurter (European Central Bank rates)";

export function usdFor(
  model: Model,
  usage: { input_tokens: number; cached_tokens: number; output_tokens: number },
): number {
  return estimatedCostUsd(model, usage) ?? 0;
}

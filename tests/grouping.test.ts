/**
 * Dividing a batch of photographs into letters.
 *
 * No person is ever asked to confirm that the division was right, so these
 * tests are the only place the rules are looked in the eye: every photograph
 * comes back, the first page cannot continue something that does not exist,
 * and the groups are assembled by us rather than taken on the provider's word.
 */

import { describe, expect, it } from "vitest";
import {
  GROUPING_CONTRACT_VERSION,
  assembleGroups,
  parseGroupingResult,
  safeParseGroupingResult,
} from "@/lib/contract/grouping";

/** Four photographs: a two-page rates notice, then a two-page renewal. */
const pile = {
  contract_version: GROUPING_CONTRACT_VERSION,
  provider: "mock",
  model: "mock-specimen-v1",
  pages: [
    {
      position: 1,
      text: "City of Yarra rates notice",
      starts_new_document: true,
      reason: "letterhead at the top of the page",
    },
    {
      position: 2,
      text: "instalment table continued",
      starts_new_document: false,
      reason: "continues the instalment table from the previous page",
    },
    {
      position: 3,
      text: "RACV Insurance renewal",
      starts_new_document: true,
      reason: "a different letterhead and a new reference number",
    },
    {
      position: 4,
      text: "policy schedule",
      starts_new_document: false,
      reason: "page 2 of 2, same policy number",
    },
  ],
};

describe("a pile of post", () => {
  it("becomes as many letters as there are first pages", () => {
    const groups = assembleGroups(parseGroupingResult(pile));
    expect(groups).toHaveLength(2);
    expect(groups.map((g) => g.positions)).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  it("carries the reading's account of why each letter started", () => {
    const groups = assembleGroups(parseGroupingResult(pile));
    expect(groups[1].reason).toBe(
      "a different letterhead and a new reference number",
    );
  });

  it("puts the pages back in order when they come back shuffled", () => {
    const shuffled = { ...pile, pages: [...pile.pages].reverse() };
    const groups = assembleGroups(parseGroupingResult(shuffled));
    expect(groups.map((g) => g.positions)).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  it("is one letter when nothing starts anything new after the first", () => {
    const oneLetter = {
      ...pile,
      pages: pile.pages.map((p, i) => ({ ...p, starts_new_document: i === 0 })),
    };
    expect(assembleGroups(parseGroupingResult(oneLetter))).toHaveLength(1);
  });

  it("is four letters when every page starts one", () => {
    const allSeparate = {
      ...pile,
      pages: pile.pages.map((p) => ({ ...p, starts_new_document: true })),
    };
    expect(assembleGroups(parseGroupingResult(allSeparate))).toHaveLength(4);
  });
});

describe("what the reading is not allowed to say", () => {
  it("refuses a batch with a page missing", () => {
    // The failure this catches is silent: the letter is simply short, and
    // nothing downstream can tell that a page of it was dropped.
    const missing = {
      ...pile,
      pages: pile.pages.filter((p) => p.position !== 3),
    };
    const result = safeParseGroupingResult(missing);
    expect(result.success).toBe(false);
  });

  it("refuses the same page twice", () => {
    const duplicated = { ...pile, pages: [...pile.pages, pile.pages[0]] };
    expect(safeParseGroupingResult(duplicated).success).toBe(false);
  });

  it("refuses a first page that continues something", () => {
    const headless = {
      ...pile,
      pages: pile.pages.map((p) =>
        p.position === 1 ? { ...p, starts_new_document: false } : p,
      ),
    };
    expect(safeParseGroupingResult(headless).success).toBe(false);
  });

  it("refuses a boundary with no account of itself", () => {
    const unexplained = {
      ...pile,
      pages: pile.pages.map((p) => ({ ...p, reason: "" })),
    };
    expect(safeParseGroupingResult(unexplained).success).toBe(false);
  });

  it("allows a blank page, because a blank sheet happens", () => {
    const blank = {
      ...pile,
      pages: pile.pages.map((p) => (p.position === 2 ? { ...p, text: "" } : p)),
    };
    expect(safeParseGroupingResult(blank).success).toBe(true);
  });
});

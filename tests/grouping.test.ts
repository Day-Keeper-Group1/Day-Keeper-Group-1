/**
 * Dividing a pile of photographs into letters.
 *
 * The pile obeys no rules and the tests honour that: the sample pile here is
 * deliberately shuffled, with the pages of two letters interleaved and a
 * photograph in the middle that is no letter at all. No person is ever asked
 * to confirm the division, so these tests are the only place its rules are
 * looked in the eye, and the rules are few on purpose: the judgement is the
 * model's, and the only thing refused is a manifest that contradicts itself.
 */

import { describe, expect, it } from "vitest";
import {
  GROUPING_CONTRACT_VERSION,
  parseGroupingResult,
  safeParseGroupingResult,
} from "@/lib/contract/grouping";

/**
 * Five photographs, picked from an album in no useful order:
 *   1  rates notice, page 1
 *   2  insurance renewal, page 1
 *   3  rates notice, page 2
 *   4  a grandchild, not a letter
 *   5  insurance renewal, page 2
 */
const pile = {
  contract_version: GROUPING_CONTRACT_VERSION,
  provider: "mock",
  model: "mock-specimen-v1",
  letters: [
    {
      photos: [1, 3],
      label: "City of Yarra, rates notice",
      reason: "same letterhead and the instalment table continues across them",
    },
    {
      photos: [2, 5],
      label: "RACV Insurance, policy renewal",
      reason:
        "same policy number on both sheets, marked page 1 of 2 and 2 of 2",
    },
  ],
  not_letters: [
    { photo: 4, reason: "a photograph of a person, not a document" },
  ],
};

describe("a chaotic pile", () => {
  it("becomes the letters the reading found, however they were shuffled", () => {
    const result = parseGroupingResult(pile, 5);
    expect(result.letters).toHaveLength(2);
    expect(result.letters.map((l) => l.photos)).toEqual([
      [1, 3],
      [2, 5],
    ]);
  });

  it("keeps the reading's page order, never the camera's", () => {
    // The model says photo 3 is page one because the page says so. Nothing is
    // allowed to "helpfully" sort it back into capture order.
    const shuffledLetter = {
      ...pile,
      letters: [{ ...pile.letters[0], photos: [3, 1] }, pile.letters[1]],
    };
    const result = parseGroupingResult(shuffledLetter, 5);
    expect(result.letters[0].photos).toEqual([3, 1]);
  });

  it("lets a photograph be no letter at all, with an account of what it is", () => {
    const result = parseGroupingResult(pile, 5);
    expect(result.not_letters).toEqual([
      { photo: 4, reason: "a photograph of a person, not a document" },
    ]);
  });

  it("accepts a pile with no letters in it, which is an answer, not a failure", () => {
    const noLetters = {
      ...pile,
      letters: [],
      not_letters: [1, 2, 3, 4, 5].map((photo) => ({
        photo,
        reason: "holiday photographs",
      })),
    };
    expect(safeParseGroupingResult(noLetters, 5).success).toBe(true);
  });

  it("allows one photograph to sit in two letters", () => {
    // Two letters lying side by side, caught in one frame. Chaos is honoured,
    // not corrected.
    const shared = {
      ...pile,
      letters: [pile.letters[0], { ...pile.letters[1], photos: [2, 5, 1] }],
    };
    expect(safeParseGroupingResult(shared, 5).success).toBe(true);
  });

  it("carries every letter's name and account", () => {
    const result = parseGroupingResult(pile, 5);
    expect(result.letters.map((l) => l.label)).toEqual([
      "City of Yarra, rates notice",
      "RACV Insurance, policy renewal",
    ]);
    expect(result.letters[1].reason).toContain("policy number");
  });
});

describe("what a manifest is not allowed to do: contradict itself", () => {
  it("may not cite a photograph that does not exist", () => {
    const result = safeParseGroupingResult(pile, 4); // photo 5 is cited
    expect(result.success).toBe(false);
    expect(result.issues.join(" ")).toContain("does not exist");
  });

  it("may not pass over a photograph in silence", () => {
    // The silent failure: a page vanishes into the gap and the letter is
    // simply short, with nothing downstream able to tell.
    const silent = { ...pile, not_letters: [] };
    const result = safeParseGroupingResult(silent, 5);
    expect(result.success).toBe(false);
    expect(result.issues.join(" ")).toContain("unaccounted");
  });

  it("may not use the same photograph twice in one letter", () => {
    const doubled = {
      ...pile,
      letters: [{ ...pile.letters[0], photos: [1, 3, 1] }, pile.letters[1]],
    };
    expect(safeParseGroupingResult(doubled, 5).success).toBe(false);
  });

  it("may not call a photograph a letter's page and also not a letter", () => {
    const bothWays = {
      ...pile,
      not_letters: [
        ...pile.not_letters,
        { photo: 1, reason: "just a receipt" },
      ],
    };
    expect(safeParseGroupingResult(bothWays, 5).success).toBe(false);
  });

  it("may not leave a letter nameless or unexplained", () => {
    const nameless = {
      ...pile,
      letters: [{ ...pile.letters[0], label: "  " }, pile.letters[1]],
    };
    expect(safeParseGroupingResult(nameless, 5).success).toBe(false);

    const unexplained = {
      ...pile,
      letters: [{ ...pile.letters[0], reason: "" }, pile.letters[1]],
    };
    expect(safeParseGroupingResult(unexplained, 5).success).toBe(false);
  });
});

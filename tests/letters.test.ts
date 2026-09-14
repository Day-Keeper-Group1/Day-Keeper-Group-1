/**
 * How Your letters is filed.
 *
 * The ordering asserted here is the product's filing cabinet: newest month at
 * the top, days ascending inside it, and one folder at the end for everything
 * that has no date to be filed by. If someone changes that deliberately, this
 * is where the old arrangement is looked in the eye first.
 */

import { describe, expect, it } from "vitest";
import { FAILURE_MESSAGE, type DocumentSummary } from "@/lib/contract/api";
import { NO_DATE_FOLDER, groupLetters, letterStatusLine } from "@/lib/letters";

/** A letter, with only the parts a folder or a status line looks at. */
function letter(overrides: Partial<DocumentSummary> = {}): DocumentSummary {
  return {
    id: overrides.label ?? "id",
    issuer: "AGL Energy",
    documentType: "Electricity bill",
    label: "AGL Energy · Electricity bill",
    status: "confirmed",
    uploadedAt: "2026-08-10T01:00:00.000Z",
    pageCount: 1,
    ...overrides,
  };
}

describe("filing letters into folders", () => {
  it("puts the newest month first and ascending days inside it", () => {
    const folders = groupLetters([
      letter({ label: "July 14", dueDate: "2026-07-14" }),
      letter({ label: "Aug 22", dueDate: "2026-08-22" }),
      letter({ label: "Aug 5", dueDate: "2026-08-05" }),
      letter({ label: "Sep 1", dueDate: "2026-09-01" }),
    ]);

    expect(folders.map((folder) => folder.heading)).toEqual([
      "September 2026",
      "August 2026",
      "July 2026",
    ]);
    expect(folders[1].letters.map((doc) => doc.label)).toEqual([
      "Aug 5",
      "Aug 22",
    ]);
  });

  it("keeps months of the same name in different years apart", () => {
    const folders = groupLetters([
      letter({ label: "2025", dueDate: "2025-08-11" }),
      letter({ label: "2026", dueDate: "2026-08-11" }),
    ]);

    expect(folders.map((folder) => folder.heading)).toEqual([
      "August 2026",
      "August 2025",
    ]);
  });

  it("gathers everything dateless into one folder at the end, newest upload first", () => {
    const folders = groupLetters([
      letter({
        label: "read yesterday",
        status: "failed",
        uploadedAt: "2026-08-09T01:00:00.000Z",
        failure: { message: FAILURE_MESSAGE },
      }),
      letter({ label: "has a date", dueDate: "2026-08-15" }),
      letter({
        label: "reading now",
        status: "processing",
        uploadedAt: "2026-08-10T04:00:00.000Z",
      }),
      letter({
        label: "no date on it",
        status: "confirmed",
        uploadedAt: "2026-08-10T02:00:00.000Z",
      }),
    ]);

    expect(folders.map((folder) => folder.heading)).toEqual([
      "August 2026",
      NO_DATE_FOLDER,
    ]);
    expect(folders[1].letters.map((doc) => doc.label)).toEqual([
      "reading now",
      "no date on it",
      "read yesterday",
    ]);
  });

  it("leaves letters sharing a day in the order the server sent them", () => {
    const folders = groupLetters([
      letter({ label: "first", dueDate: "2026-08-15" }),
      letter({ label: "second", dueDate: "2026-08-15" }),
    ]);

    expect(folders[0].letters.map((doc) => doc.label)).toEqual([
      "first",
      "second",
    ]);
  });

  it("does not touch the list it was handed", () => {
    const docs = [
      letter({ label: "later", dueDate: "2026-08-22" }),
      letter({ label: "earlier", dueDate: "2026-08-05" }),
    ];
    groupLetters(docs);
    expect(docs.map((doc) => doc.label)).toEqual(["later", "earlier"]);
  });

  it("files nothing when there is nothing", () => {
    expect(groupLetters([])).toEqual([]);
  });
});

describe("the line under a letter's name", () => {
  it("says a letter is being read", () => {
    expect(letterStatusLine(letter({ status: "processing" }))).toBe("reading…");
  });

  it("says what went wrong in the words everything else uses", () => {
    expect(
      letterStatusLine(
        letter({ status: "failed", failure: { message: FAILURE_MESSAGE } }),
      ),
    ).toBe(FAILURE_MESSAGE);
  });

  it("says a letter is waiting for her, and how much of it there is", () => {
    expect(letterStatusLine(letter({ status: "needs-review" }))).toBe(
      "ready to check",
    );
    expect(
      letterStatusLine(letter({ status: "needs-review", pageCount: 3 })),
    ).toBe("ready to check · 3 pages");
  });

  it("says when a letter she has dealt with is due", () => {
    expect(
      letterStatusLine(letter({ status: "confirmed", dueDate: "2026-08-15" })),
    ).toBe("due Sat 15 Aug");
    expect(
      letterStatusLine(letter({ status: "archived", dueDate: "2026-08-15" })),
    ).toBe("due Sat 15 Aug");
  });

  it("says nothing about a letter that named no date", () => {
    expect(letterStatusLine(letter({ status: "confirmed" }))).toBe("");
  });
});

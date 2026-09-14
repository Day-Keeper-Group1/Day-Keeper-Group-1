// KAN-57: Your letters, as month folders and a one line status, worked out away from the screen.

/**
 * The letters area's two rules.
 *
 * A letter is filed by the month its date falls in, newest month first, days
 * ascending inside, and everything without a date gathers into one folder at
 * the end. That last folder is not an error state. A letter still being read
 * has no date yet, a letter whose reading failed never got one, and a letter
 * that named no date never will; all three live in the same place, which is the
 * place a person looks when a letter is not where she expected it.
 *
 * Nothing is renamed anywhere. The folders are a view over the same letters the
 * server sent, so a letter cannot be in the list and out of its folder.
 *
 * Pure, and kept out of the page, because the ordering is the part worth
 * testing and a component is the hardest place to test it.
 */

import { FAILURE_MESSAGE, type DocumentSummary } from "@/lib/contract/api";
import { formatDueDate } from "@/lib/contract/dates";

/**
 * Month names for a folder heading.
 *
 * src/lib/contract/dates.ts writes the three date styles the interface uses,
 * and a month with its year is not one of them, so these live here rather than
 * as a fourth style added to a module the whole product depends on. Written out
 * rather than asked of Intl for the reason that file gives: these strings are
 * product copy, and Intl's month names move with the ICU build underneath.
 */
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** The folder everything dateless falls into, named once so the tests agree. */
export const NO_DATE_FOLDER = "No date";

export type LetterFolder = {
  /** 'August 2026', or NO_DATE_FOLDER. */
  heading: string;
  letters: DocumentSummary[];
};

/** 'YYYY-MM-DD' to the folder it belongs in: '2026-08-15' to 'August 2026'. */
function monthHeading(isoDate: string): string {
  const [year, month] = isoDate.split("-");
  return `${MONTH_NAMES[Number(month) - 1]} ${year}`;
}

/**
 * Every letter, filed.
 *
 * Newest month first because the letter she wants is almost always a recent
 * one, and days ascending inside because within a month she is reading down a
 * list of deadlines rather than a history. The two directions look inconsistent
 * written down and are not: the first orders folders, the second orders a
 * month's own days the way a calendar does.
 *
 * Letters sharing a day keep the order the server sent them in, which is newest
 * upload first.
 */
export function groupLetters(docs: DocumentSummary[]): LetterFolder[] {
  const dated = docs.filter((doc) => doc.dueDate);
  const dateless = docs.filter((doc) => !doc.dueDate);

  const ordered = dated.slice().sort((a, b) => {
    const monthA = a.dueDate!.slice(0, 7);
    const monthB = b.dueDate!.slice(0, 7);
    if (monthA !== monthB) return monthB.localeCompare(monthA);
    return a.dueDate!.localeCompare(b.dueDate!);
  });

  const folders: LetterFolder[] = [];
  for (const doc of ordered) {
    const heading = monthHeading(doc.dueDate!);
    const open = folders[folders.length - 1];
    if (open && open.heading === heading) {
      open.letters.push(doc);
    } else {
      folders.push({ heading, letters: [doc] });
    }
  }

  if (dateless.length > 0) {
    folders.push({
      heading: NO_DATE_FOLDER,
      // Newest upload first: with no date to file them by, when she took the
      // photograph is the only order these rows have.
      letters: dateless
        .slice()
        .sort((a, b) => Date.parse(b.uploadedAt) - Date.parse(a.uploadedAt)),
    });
  }

  return folders;
}

/**
 * The small line under a letter's name.
 *
 * One line, and sometimes none. A letter still being read says so, a letter
 * that failed says the one sentence src/lib/contract/api.ts words for every
 * surface, a letter waiting for her nod says it is ready and how much of it
 * there is, and a letter already dealt with says when it is due. A confirmed
 * letter that named no date has nothing left to say, so it says nothing rather
 * than filling the space.
 */
export function letterStatusLine(doc: DocumentSummary): string {
  switch (doc.status) {
    case "processing":
      return "reading…";
    case "failed":
      // The sentence is on the summary so a list can draw it without a second
      // request; the fallback is here only because the contract marks the whole
      // object optional.
      return doc.failure?.message ?? FAILURE_MESSAGE;
    case "needs-review":
      return doc.pageCount > 1
        ? `ready to check · ${doc.pageCount} pages`
        : "ready to check";
    default:
      return doc.dueDate ? `due ${formatDueDate(doc.dueDate, "short")}` : "";
  }
}

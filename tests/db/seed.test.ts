// KAN-92: the world `npm run db:seed` plants, planted on a test database with no bucket.

/**
 * The seed.
 *
 * db/lib/seed-world.ts writes the rows a demonstration starts from, and
 * db/seed.ts hands it the function that puts each photograph in the bucket.
 * Here it is handed one that stores nothing and answers a number. So the same
 * rows are planted on a test database with no bucket, and no image is opened:
 * all that is read from data/synthetic-letters is each letter's
 * ground-truth.json and the names of its page files.
 *
 * What ended up in the tables is read through the witness. What Margaret
 * would see is asked of getHome(), which her home screen is drawn from.
 *
 * The seed counts its dates from today in Melbourne, so nothing here names a
 * date: the tests say how the dates sit against each other and against the
 * day the seed ran.
 */

import { beforeEach, describe, expect, it } from "vitest";

import { addDays, todayInZone } from "@/lib/contract/dates";
import { db } from "@/server/db";
import { getHome } from "@/server/documents";

import { seedWorld, type StorePage } from "../../db/lib/seed-world";
import { rows, snapshot } from "./support/witness";

const MELBOURNE = "Australia/Melbourne";

/** What the stand-in for the bucket says every page weighed. */
const PAGE_BYTES = 1234;

/** How many rows the seed leaves in each table. */
const SEEDED = {
  audit_logs: 6,
  document_pages: 9,
  documents: 5,
  extracted_fields: 30,
  extracted_identifiers: 14,
  extraction_runs: 5,
  model_calls: 0,
  reminders: 15,
  sessions: 0,
  tasks: 5,
  users: 7,
};

/** Every page the seed asked to have stored, in the order it asked. */
let stored: Array<{ file: string; key: string }>;

const storePage: StorePage = async (page) => {
  stored.push(page);
  return PAGE_BYTES;
};

/**
 * Today in Melbourne just before the seed ran and just after. The same day
 * twice, except in a run that crosses midnight there, where the seed's own
 * today is one of the two.
 */
let seededOn: string[];

async function rowCounts(): Promise<Record<string, number>> {
  return Object.fromEntries(
    Object.entries(await snapshot()).map(([table, found]) => [
      table,
      found.length,
    ]),
  );
}

beforeEach(async () => {
  stored = [];
  const before = todayInZone(MELBOURNE);
  await seedWorld(db(), storePage);
  seededOn = [before, todayInZone(MELBOURNE)];
});

describe("the rows the seed plants", () => {
  it("are seven accounts, five confirmed letters and everything a confirmed letter has", async () => {
    expect(await rowCounts()).toEqual(SEEDED);

    expect(await rows(`SELECT DISTINCT status FROM documents`)).toEqual([
      { status: "confirmed" },
    ]);
    // Where the fields came from, said plainly: no model was called.
    expect(
      await rows(
        `SELECT DISTINCT status, provider, model FROM extraction_runs`,
      ),
    ).toEqual([{ status: "succeeded", provider: "seed", model: "answer-key" }]);
    expect(
      await rows(
        `SELECT state, count(*)::integer AS tasks FROM tasks GROUP BY state ORDER BY state`,
      ),
    ).toEqual([
      { state: "open", tasks: 3 },
      { state: "completed", tasks: 2 },
    ]);
  });

  it("hold no account outside example.com, which is what lets the next reset through", async () => {
    // db/lib/real-accounts.ts refuses to destroy a database holding an account
    // from anywhere else, and asks the same column.
    expect(
      await rows(
        `SELECT email FROM users WHERE email_canonical NOT LIKE '%@example.com'`,
      ),
    ).toEqual([]);
    expect(
      await rows(
        `SELECT role, count(*)::integer AS accounts FROM users GROUP BY role ORDER BY role`,
      ),
    ).toEqual([
      { role: "user", accounts: 6 },
      { role: "platform_operator", accounts: 1 },
    ]);
  });

  it("point each page at the key its photograph was stored under, with the size that came back", async () => {
    const pages = await rows<{
      storage_path: string;
      spelled: string;
      page_number: number;
      mime_type: string;
      byte_size: number;
    }>(
      `SELECT p.storage_path,
              'uploads/' || d.user_id || '/' || d.id || '/' || p.page_number || '.png' AS spelled,
              p.page_number, p.mime_type, p.byte_size
         FROM document_pages p
         JOIN documents d ON d.id = p.document_id`,
    );

    expect(pages).toHaveLength(SEEDED.document_pages);
    for (const page of pages) {
      // The shape uploadObjectKey() in src/server/storage.ts gives a key.
      expect(page.storage_path).toBe(page.spelled);
      expect(page.mime_type).toBe("image/png");
      expect(page.byte_size).toBe(PAGE_BYTES);
    }

    // One request to store per row, under that row's key, for that page's file.
    expect(stored.map((page) => page.key).sort()).toEqual(
      pages.map((page) => page.storage_path).sort(),
    );
    for (const page of stored) {
      // The fixtures are named page-01.png, page-02.png; a key carries 1, 2.
      const inKey = Number(page.key.match(/\/(\d+)\.png$/)?.[1]);
      const inFile = Number(page.file.match(/page-(\d+)\.png$/)?.[1]);
      expect(inFile, page.file).toBe(inKey);
    }
  });

  it("are one world, not two, when the seed runs again", async () => {
    await seedWorld(db(), storePage);

    expect(await rowCounts()).toEqual(SEEDED);
  });
});

describe("what Margaret sees after the seed", () => {
  it("is nothing to check, a reminder today on each open task, and two ticks", async () => {
    const [margaret] = await rows<{ id: string }>(
      `SELECT id FROM users WHERE email = 'margaret@example.com'`,
    );

    const home = await getHome(margaret.id, MELBOURNE);

    expect(home.counts).toEqual({ needsReview: 0, processing: 0, failed: 0 });
    expect(home.inbox).toEqual([]);

    // Both ticks are a day old, inside the week Home keeps showing a tick for.
    expect(home.tasks).toHaveLength(5);
    const open = home.tasks.filter((task) => task.status !== "completed");
    expect(open.map((task) => task.status)).toEqual([
      "upcoming",
      "upcoming",
      "upcoming",
    ]);

    // The three rungs of the ladder land on one day, and it is the day the
    // seed ran: due in seven days, in three, and tomorrow.
    const [first, ...others] = open.map((task) =>
      task.reminders.map((reminder) => reminder.localDate),
    );
    const onEveryTask = first.filter((day) =>
      others.every((days) => days.includes(day)),
    );
    expect(onEveryTask).toHaveLength(1);
    const [today] = onEveryTask;
    expect(seededOn).toContain(today);
    expect(open.map((task) => task.dueDate)).toEqual([
      addDays(today, 1),
      addDays(today, 3),
      addDays(today, 7),
    ]);
  });
});

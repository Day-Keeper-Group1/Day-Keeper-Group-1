/**
 * Seed data.
 *
 * KAN-74: the seed is for showing the product, and it holds only what time
 * refuses to hand over. A letter photographed during a demonstration is read,
 * checked and put on the calendar in front of whoever is watching, so none of
 * that belongs here. What cannot be made on the spot is a reminder that is
 * already due: a letter photographed today cannot have a seven day reminder
 * that falls on today. So Margaret's world is three letters whose reminders all
 * fall on today, and two tasks she has already ticked off, which are there
 * only to show the account has been used. Nothing is waiting to be checked.
 *
 * The letters are not invented. Their photographs are the real pages under
 * data/synthetic-letters, and their fields are that folder's
 * ground-truth.json, so the screen and the photograph describe the same letter.
 * With one exception, stated where it happens: the three reminder letters take
 * a due date counted from today, so the seed never goes stale, and on those
 * three the date on the screen is not the date printed on the page.
 *
 * Everything is synthetic. No real person, account number or amount appears
 * here, and none may be added: the project cannot lawfully hold real
 * correspondence.
 *
 * This writes objects as well as rows. `npm run db:reset` therefore runs
 * schema, then storage, then this: the bucket has to be empty before the seed
 * fills it. Run `npm run db:seed` on its own and the bucket keeps the previous
 * run's objects alongside the new ones; that is what `npm run db:reset` clears.
 *
 * KAN-92: this file is the entry point: the two guards, the bucket, and the
 * bytes of each photograph. The rows are written by seedWorld() in
 * db/lib/seed-world.ts, which is handed the function that stores a page, so a
 * test can plant the same world with no bucket.
 *
 *   npm run db:seed
 */

import { readFileSync } from "node:fs";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { dbCause } from "../src/server/db/errors";
import { connect, databaseUrl, loadEnv, refuseIfNotLocal } from "./lib/connect";
import { refuseIfRealAccounts } from "./lib/real-accounts";
import { seedWorld } from "./lib/seed-world";
import {
  ensureBucket,
  storageFromEnv,
  storageUnreachableMessage,
} from "../scripts/lib/storage-client";

loadEnv();
const url = databaseUrl();

// The same guard db/reset.ts has, for the same reason: the seed truncates
// every table.
refuseIfNotLocal(url, "seed", "The seed truncates every table.");

/** PNG's first eight bytes, which readPageImage() holds each fixture to. */
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

async function main() {
  // The seed truncates every table before it writes, so it destroys exactly
  // what a reset does. db/lib/real-accounts.ts explains why this asks the
  // database rather than trusting DK_ALLOW_REMOTE_RESET.
  await refuseIfRealAccounts(
    url,
    "The seed empties every table before it writes.",
  );

  const storage = storageFromEnv();
  // On a fresh machine the bucket may not exist yet, and `npm run db:seed`
  // alone skips the script that makes it.
  await ensureBucket(storage);

  const { db, pool } = connect(url);
  try {
    // Each page's bytes into the bucket, under the key seedWorld() spelled for
    // it. `image/png` because that key ends in `.png`: db/lib/seed-world.ts,
    // above seedPages(), says why the two have to agree.
    await seedWorld(db, async ({ file, key }) => {
      const bytes = readPageImage(file);
      await storage.s3.send(
        new PutObjectCommand({
          Bucket: storage.bucket,
          Key: key,
          Body: bytes,
          ContentType: "image/png",
        }),
      );
      return bytes.byteLength;
    });

    console.log(`
Seeded.

  Sign in as        margaret@example.com / daykeeper
  Operator account  operator@example.com / daykeeper

  Team accounts     saiii@example.com  / Saiii123
                    gerry@example.com  / Gerry123
                    xceed@example.com  / Xceed123
                    jason@example.com  / Jason123
                    hiruni@example.com / Hiruni123

  Margaret has three reminders today, one on each rung of the ladder:
    home insurance, due in 7 days
    water bill,     due in 3 days
    parking fine,   due tomorrow
  and two tasks ticked off yesterday. Nothing is waiting to be checked.

Every page above has a real photograph in the bucket. Photograph a letter in
the app to see one read, checked and put on the calendar.
`);
  } finally {
    await pool.end();
  }
}

/**
 * One page file, as bytes, with the single failure worth naming caught here:
 * a clone made without Git LFS holds a small text pointer where each image
 * should be, and uploading that puts 130 bytes of text behind every letter.
 */
function readPageImage(file: string): Buffer {
  const bytes = readFileSync(file);
  if (!bytes.subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC)) {
    throw new Error(
      `${file} is not a PNG.\n\n` +
        `The synthetic letters are stored with Git LFS, and this is the\n` +
        `pointer file that stands in for one. Install git-lfs, run\n` +
        `'git lfs pull', and seed again.`,
    );
  }
  return bytes;
}

main().catch((error) => {
  const code = (error as { code?: string }).code;
  if (code === "ECONNREFUSED" || code === "ENOTFOUND") {
    console.error(
      storageUnreachableMessage(process.env.STORAGE_ENDPOINT ?? ""),
    );
    process.exit(1);
  }
  // When a statement failed, the driver's own error and not Drizzle's wrapper,
  // whose message quotes every value bound to the statement
  // (src/server/db/errors.ts). Any other error is printed as it is.
  console.error(dbCause(error));
  process.exit(1);
});

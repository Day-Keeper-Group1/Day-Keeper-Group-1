// KAN-86: the command behind the Demo accounts button.

/**
 * Change what one demonstration account holds.
 *
 *   npm run account:clear -- hiruni@example.com
 *   npm run account:refresh-margaret
 *
 * The first empties that account: its letters, tasks, reminders and
 * photographs. The second does the same to Margaret, then gives her the
 * letters in db/demo/margaret.json, dated from today. No other account is
 * touched, and only @example.com accounts can be changed at all
 * (db/lib/demo-accounts.ts says why that is the guard).
 *
 * Against the deployed site this is run by the Demo accounts workflow on
 * GitHub (.github/workflows/demo-accounts.yml), the Run workflow button, with
 * the database and the bucket from the staging environment. Locally it uses
 * .env.local like every other script.
 */

import { dbCause } from "../src/server/db/errors";
import {
  AccountRefused,
  clearAccount,
  refreshMargaret,
} from "./lib/demo-accounts";
import { connect, databaseUrl, loadEnv, maskedUrl } from "./lib/connect";
import {
  deleteKeys,
  listKeys,
  pageUploader,
  storageFromEnv,
} from "../scripts/lib/storage-client";

const USAGE =
  "Usage:\n\n" +
  "  npm run account:clear -- <someone>@example.com\n" +
  "  npm run account:refresh-margaret";

loadEnv();
const url = databaseUrl();
const [command, email] = process.argv.slice(2);

async function main() {
  if (command !== "clear" && command !== "refresh-margaret") {
    console.error(USAGE);
    process.exit(1);
  }

  const storage = storageFromEnv();
  const store = {
    put: pageUploader(storage),
    list: (prefix: string) => listKeys(storage, prefix),
    remove: (keys: string[]) => deleteKeys(storage, keys),
  };

  const { db, pool } = connect(url);
  try {
    if (command === "clear") {
      const gone = await clearAccount(db, email, store);
      console.log(
        `Cleared ${email?.trim().toLowerCase()} on ${maskedUrl(url)}: ` +
          `${gone.letters} letter(s), ${gone.tasks} task(s) and ` +
          `${gone.photographs} photograph(s) removed. The account itself is kept.`,
      );
    } else {
      const { removed, planted } = await refreshMargaret(db, store);
      console.log(
        `Refreshed margaret@example.com on ${maskedUrl(url)}: removed ` +
          `${removed.letters} letter(s), ${removed.tasks} task(s) and ` +
          `${removed.photographs} photograph(s), then planted ${planted} ` +
          "letter(s) from db/demo/margaret.json, dated from today.",
      );
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  if (error instanceof AccountRefused) {
    console.error(error.message);
  } else {
    // The driver's own error, out of Drizzle's wrapper (src/server/db/errors.ts).
    console.error(dbCause(error));
  }
  process.exit(1);
});

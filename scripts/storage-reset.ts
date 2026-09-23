/**
 * Make the bucket exist, and make it empty.
 *
 * `db:reset` throws away every row, which throws away every path. Without this
 * the objects those paths pointed at would stay in the bucket forever, so a
 * teammate's storage would slowly fill with bytes nothing references while the
 * database looks clean. Resetting the two together keeps "reset" meaning the
 * same thing on both sides.
 *
 * It also creates the bucket on a fresh machine, so that nobody has to open the
 * storage console and click New Bucket before the first upload works.
 *
 * Order matters, and `npm run db:reset` now runs schema, then this, then the
 * seed. The seed writes the seeded letters' photographs into the bucket, so
 * emptying it afterwards deleted them the moment they arrived and left every
 * letter on screen as a broken image. Empty first, fill second, which is the
 * order the database half has always used.
 *
 * A consequence worth knowing: run `npm run storage:reset` on its own and the
 * rows that survive it point at objects that are gone. `npm run db:reset` puts
 * both sides back.
 *
 * This script talks to storage directly rather than through
 * `src/server/storage.ts`, for the same reason `db/reset.ts` does not use
 * `src/server/db.ts`: those modules are `server-only`, which throws outside
 * Next.js. The client itself is in `scripts/lib/storage-client.ts`, shared with
 * the seed.
 *
 *   npm run storage:reset
 */

import { DeleteObjectsCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { config } from "dotenv";

import { refuseIfRealAccounts } from "../db/real-accounts";
import {
  ensureBucket,
  storageFromEnv,
  storageUnreachableMessage,
} from "./lib/storage-client";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

const storage = storageFromEnv();
const { s3, bucket, endpoint } = storage;

/**
 * The same guard `db/reset.ts` has, and for the same reason: this empties a
 * bucket. Pointing it at anything shared has to be deliberate.
 */
const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)([:/]|$)/.test(endpoint);
if (!isLocal && process.env.DK_ALLOW_REMOTE_RESET !== "yes") {
  console.error(
    `Refusing to empty a bucket that is not local.\n\n` +
      `  STORAGE_ENDPOINT: ${endpoint}\n` +
      `  STORAGE_BUCKET:   ${bucket}\n\n` +
      `This deletes every object in it. If you really mean it, set DK_ALLOW_REMOTE_RESET=yes.`,
  );
  process.exit(1);
}

async function emptyBucket(): Promise<number> {
  let removed = 0;
  let token: string | undefined;

  do {
    const listed = await s3.send(
      new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: token }),
    );
    const keys = (listed.Contents ?? [])
      .map((object) => object.Key)
      .filter((key): key is string => Boolean(key));

    if (keys.length > 0) {
      await s3.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: keys.map((Key) => ({ Key })) },
        }),
      );
      removed += keys.length;
    }

    token = listed.IsTruncated ? listed.NextContinuationToken : undefined;
  } while (token);

  return removed;
}

async function main() {
  // The photographs in this bucket belong to the rows in that database, so a
  // database holding accounts nobody seeded means a bucket holding their
  // letters. Checking the database to decide about the bucket looks indirect
  // and is the only evidence there is: an object gives no sign of who it
  // belongs to, and asking the bucket "are these real?" has no answer.
  //
  // A database that cannot be reached stops this too, which is the right way
  // round: unable to tell is not permission to delete.
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error(
      "DATABASE_URL is not set, so there is no way to tell whose photographs\n" +
        "these are. Copy .env.example to .env.local first.",
    );
    process.exit(1);
  }
  await refuseIfRealAccounts(
    databaseUrl,
    `Every object in '${bucket}' is one of their letters.`,
  );

  await ensureBucket(storage);
  const removed = await emptyBucket();
  console.log(
    removed === 0
      ? `Storage ready: bucket '${bucket}' is empty.`
      : `Storage ready: bucket '${bucket}' emptied, ${removed} object(s) removed.`,
  );
}

main().catch((error) => {
  const code = (error as { code?: string }).code;
  if (code === "ECONNREFUSED" || code === "ENOTFOUND") {
    console.error(storageUnreachableMessage(endpoint));
    process.exit(1);
  }
  console.error(error);
  process.exit(1);
});

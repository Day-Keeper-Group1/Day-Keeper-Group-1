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
 * This script talks to storage directly rather than through
 * `src/server/storage.ts`, for the same reason `db/reset.ts` does not use
 * `src/server/db.ts`: those modules are `server-only`, which throws outside
 * Next.js.
 *
 *   npm run storage:reset
 */

import {
  CreateBucketCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

const endpoint = process.env.STORAGE_ENDPOINT;
const bucket = process.env.STORAGE_BUCKET ?? "daykeeper";
const accessKeyId = process.env.STORAGE_ACCESS_KEY;
const secretAccessKey = process.env.STORAGE_SECRET_KEY;

if (!endpoint || !accessKeyId || !secretAccessKey) {
  console.error(
    "Storage is not configured. Copy .env.example to .env.local first.",
  );
  process.exit(1);
}

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

const s3 = new S3Client({
  endpoint,
  region: "us-east-1",
  forcePathStyle: true,
  credentials: { accessKeyId, secretAccessKey },
});

async function ensureBucket(): Promise<void> {
  try {
    await s3.send(new CreateBucketCommand({ Bucket: bucket }));
  } catch (error) {
    // Already ours is the normal case after the first run.
    const name = (error as { name?: string }).name;
    if (name !== "BucketAlreadyOwnedByYou" && name !== "BucketAlreadyExists") {
      throw error;
    }
  }
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
  await ensureBucket();
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
    console.error(
      `Cannot reach storage at ${endpoint}.\n\n` +
        `Start it with: docker compose up -d`,
    );
    process.exit(1);
  }
  console.error(error);
  process.exit(1);
});

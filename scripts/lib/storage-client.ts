/**
 * The storage client for scripts that run outside Next.js.
 *
 * Three of them talk to the bucket: `db/seed.ts` writes the photographs the
 * seeded letters are made of, `scripts/storage-reset.ts` empties it, and
 * `db/demo-accounts.ts` removes one account's photographs.
 * Neither can import `src/server/storage.ts`, which is `server-only` and throws
 * outside Next, the same way `db/reset.ts` cannot use `src/server/db/index.ts`.
 * So the client is built here once instead of once per script, and the
 * endpoint, the address style and the credentials are read in a single place.
 *
 * Call these after dotenv has loaded: the environment is read at call time.
 */

import { readFileSync } from "node:fs";
import {
  CreateBucketCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import type { StorePage } from "../../db/lib/seed-world";

export type ScriptStorage = {
  s3: S3Client;
  bucket: string;
  /** Kept for error messages: a script that cannot reach storage says where. */
  endpoint: string;
};

/**
 * Build the client, or explain what is missing and stop. A script holding half
 * its configuration cannot do anything useful, so this exits rather than
 * handing back something every caller would have to check.
 */
export function storageFromEnv(): ScriptStorage {
  const endpoint = process.env.STORAGE_ENDPOINT;
  const bucket = process.env.STORAGE_BUCKET ?? "daykeeper";
  const region = process.env.STORAGE_REGION ?? "us-east-1";
  const accessKeyId = process.env.STORAGE_ACCESS_KEY;
  const secretAccessKey = process.env.STORAGE_SECRET_KEY;

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    console.error(
      "Storage is not configured. Copy .env.example to .env.local first.",
    );
    process.exit(1);
  }

  return {
    // Buckets addressed by path rather than by subdomain, and a region the
    // protocol demands, MinIO ignores and a real bucket does not. Both choices
    // match src/server/storage.ts, which is where the reasoning is written
    // down. The default mirrors STORAGE_REGION in env.ts, which this file
    // cannot import.
    s3: new S3Client({
      endpoint,
      region,
      forcePathStyle: true,
      credentials: { accessKeyId, secretAccessKey },
    }),
    bucket,
    endpoint,
  };
}

/**
 * Make the bucket exist, so that nobody has to open the storage console and
 * click New Bucket before the first write works. Already ours is the normal
 * case after the first run and not a problem.
 */
export async function ensureBucket(storage: ScriptStorage): Promise<void> {
  try {
    await storage.s3.send(new CreateBucketCommand({ Bucket: storage.bucket }));
  } catch (error) {
    const name = (error as { name?: string }).name;
    if (name !== "BucketAlreadyOwnedByYou" && name !== "BucketAlreadyExists") {
      throw error;
    }
  }
}

/**
 * The sentence a script should print when storage is not answering. Both
 * scripts hit the same wall on a machine where docker is down.
 */
export function storageUnreachableMessage(endpoint: string): string {
  return (
    `Cannot reach storage at ${endpoint}.\n\n` +
    `Start it with: docker compose up -d`
  );
}

/**
 * Every key in the bucket that starts with `prefix`, all of them: the listing
 * comes back a thousand at a time, so it is followed to the end. An empty
 * prefix is every key in the bucket.
 */
export async function listKeys(
  storage: ScriptStorage,
  prefix: string,
): Promise<string[]> {
  const keys: string[] = [];
  let token: string | undefined;
  do {
    const listed = await storage.s3.send(
      new ListObjectsV2Command({
        Bucket: storage.bucket,
        Prefix: prefix || undefined,
        ContinuationToken: token,
      }),
    );
    for (const object of listed.Contents ?? []) {
      if (object.Key) keys.push(object.Key);
    }
    token = listed.IsTruncated ? listed.NextContinuationToken : undefined;
  } while (token);
  return keys;
}

/** Delete these keys, a thousand to a request, which is as many as one takes. */
export async function deleteKeys(
  storage: ScriptStorage,
  keys: string[],
): Promise<void> {
  for (let start = 0; start < keys.length; start += 1000) {
    await storage.s3.send(
      new DeleteObjectsCommand({
        Bucket: storage.bucket,
        Delete: {
          Objects: keys.slice(start, start + 1000).map((Key) => ({ Key })),
        },
      }),
    );
  }
}

/** PNG's first eight bytes, which every fixture page is held to. */
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * The function the seed is handed to store a page: the file's bytes into the
 * bucket under the key the seed spelled, answering how many bytes it was.
 * `image/png` because that key ends in `.png`: db/lib/seed-world.ts, above
 * seedPages(), says why the two have to agree.
 *
 * One failure is worth naming here: a clone made without Git LFS holds a small
 * text pointer where each image should be, and uploading that puts 130 bytes
 * of text behind every letter.
 */
export function pageUploader(storage: ScriptStorage): StorePage {
  return async ({ file, key }) => {
    const bytes = readFileSync(file);
    if (!bytes.subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC)) {
      throw new Error(
        `${file} is not a PNG.\n\n` +
          `The synthetic letters are stored with Git LFS, and this is the\n` +
          `pointer file that stands in for one. Install git-lfs, run\n` +
          `'git lfs pull', and run this again.`,
      );
    }
    await storage.s3.send(
      new PutObjectCommand({
        Bucket: storage.bucket,
        Key: key,
        Body: bytes,
        ContentType: "image/png",
      }),
    );
    return bytes.byteLength;
  };
}

/**
 * The storage client for scripts that run outside Next.js.
 *
 * Two of them talk to the bucket: `db/seed.ts` writes the photographs the
 * seeded letters are made of, and `scripts/storage-reset.ts` empties it.
 * Neither can import `src/server/storage.ts`, which is `server-only` and throws
 * outside Next, the same way `db/reset.ts` cannot use `src/server/db.ts`. So
 * the client is built here once instead of once per script, and the endpoint,
 * the address style and the credentials are read in a single place.
 *
 * Call these after dotenv has loaded: the environment is read at call time.
 */

import { CreateBucketCommand, S3Client } from "@aws-sdk/client-s3";

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
    // protocol demands and MinIO ignores. Both choices match
    // src/server/storage.ts, which is where the reasoning is written down.
    s3: new S3Client({
      endpoint,
      region: "us-east-1",
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

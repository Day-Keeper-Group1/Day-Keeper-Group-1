/**
 * File storage: where the photographs actually live.
 *
 * The database holds a key and never the bytes. This module is the only place
 * that reads or writes those bytes. Nothing else in the application should
 * touch a file system or an S3 client directly, because the one thing this
 * module buys us is that moving from the MinIO in docker-compose.yml to a real
 * bucket is an environment change rather than a search through the code.
 *
 * Photographs are objects rather than rows for three reasons that arrive
 * together. A row holding a few megabytes of JPEG drags those megabytes through
 * every query that selects it, and through every backup and dump of the table.
 * A browser cannot be handed a row, so the bytes would travel out through the
 * application on every view, where a bucket hands out a link it signed and is
 * done. And a letter's photographs are written once and read occasionally,
 * which is the access pattern object storage is built for.
 *
 * It talks the S3 protocol, which MinIO, AWS S3, Cloudflare R2 and Supabase
 * Storage all speak. That is deliberate. The alternative, writing to the
 * server's own disk during development and moving to a bucket later, sounds
 * like the smaller step and is not: it is a second implementation of storage,
 * and the second one gets written during deployment week, by whoever is
 * deploying, against code that by then has grown file-handling habits in
 * several places. Most hosts that run a Next.js app throw the disk away between
 * deployments anyway, so the disk version could not survive to be migrated.
 * Written against MinIO today, it is the same code that runs against a real
 * bucket later: the endpoint and the credentials are environment variables and
 * nothing else moves.
 *
 * Server-only. A client component importing this would put the storage
 * credentials in the browser bundle.
 *
 * One controlled exception: `scripts/storage-reset.ts` speaks to storage
 * without going through here, the same way `db/reset.ts` bypasses `db.ts`. A
 * script that runs outside Next cannot import a `server-only` module.
 */

import "server-only";
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env, publicStorageEndpoint } from "./env";

/**
 * MinIO addresses buckets by path (`host/bucket/key`), not by subdomain
 * (`bucket.host/key`), and so does every S3 service when asked. Asking keeps
 * one address style everywhere, including hosts whose certificates would not
 * cover a bucket subdomain.
 *
 * The region is required by the protocol and ignored by MinIO. When this moves
 * to a real bucket the value comes from the environment with the rest.
 */
const REGION = "us-east-1";

function clientFor(endpoint: string): S3Client {
  return new S3Client({
    endpoint,
    region: REGION,
    forcePathStyle: true,
    credentials: {
      accessKeyId: env().STORAGE_ACCESS_KEY,
      secretAccessKey: env().STORAGE_SECRET_KEY,
    },
  });
}

/**
 * One client per process, for the same reason as the database pool: Next.js
 * reloads modules on every edit in development, and a fresh client per reload
 * leaks sockets until something gives.
 *
 * Two of them. `internal` does the work over whatever address the server can
 * reach. `signing` exists only to build links for the browser, which may have
 * to use a different address; see STORAGE_PUBLIC_ENDPOINT. On a laptop they
 * are the same address and the second client costs nothing.
 */
const globalForStorage = globalThis as unknown as {
  __daykeeperS3?: S3Client;
  __daykeeperS3Signing?: S3Client;
};

function internal(): S3Client {
  globalForStorage.__daykeeperS3 ??= clientFor(env().STORAGE_ENDPOINT);
  return globalForStorage.__daykeeperS3;
}

function signing(): S3Client {
  globalForStorage.__daykeeperS3Signing ??= clientFor(publicStorageEndpoint());
  return globalForStorage.__daykeeperS3Signing;
}

/**
 * File extensions by content type.
 *
 * The extension is cosmetic: it makes an object legible in the storage viewer
 * when someone is trying to see what was uploaded. What the object IS travels
 * in its content type, which is stored with it.
 *
 * The list is what a phone camera produces, because a photograph is what this
 * release accepts. Anything else still gets a key, ending .bin, and the check
 * that a file is an image we can read happens before the bytes reach here.
 */
const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

/**
 * Where one photograph goes.
 *
 * `uploads/{user}/{letter}/{page}.{ext}`, and three things follow from that
 * shape. The person is the first segment, so everything one person owns is one
 * prefix: deleting an account, or counting what it costs, is a prefix
 * operation. The letter is the second, so its pages sit together and every
 * `document_pages.storage_path` for one letter shares a prefix too. And the key
 * is derived rather than random, so an upload that is retried writes over
 * itself instead of leaving a twin that nothing references.
 *
 * The letter can be in the path because an upload is one letter: the document
 * row exists before its photographs are stored, and the page number is the
 * order the photographs were taken in.
 */
export function uploadObjectKey(params: {
  userId: string;
  documentId: string;
  pageNumber: number;
  contentType: string;
}): string {
  const ext = EXTENSIONS[params.contentType.toLowerCase()] ?? "bin";
  return `uploads/${params.userId}/${params.documentId}/${params.pageNumber}.${ext}`;
}

/** Store one photograph. Overwrites the same key without complaint. */
export async function putObject(
  key: string,
  body: Uint8Array,
  contentType: string,
): Promise<void> {
  await internal().send(
    new PutObjectCommand({
      Bucket: env().STORAGE_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

/**
 * How long a link to a photograph stays good. Long enough to look at a letter
 * and think about it, short enough that a link copied out of the page stops
 * working. It is not a security boundary on its own: the route that hands the
 * link out is where ownership is checked.
 */
export const SIGNED_URL_TTL_SECONDS = 15 * 60;

/** A time-limited link the browser can load the image with. */
export function signedObjectUrl(
  key: string,
  ttlSeconds: number = SIGNED_URL_TTL_SECONDS,
): Promise<string> {
  return getSignedUrl(
    signing(),
    new GetObjectCommand({ Bucket: env().STORAGE_BUCKET, Key: key }),
    { expiresIn: ttlSeconds },
  );
}

/**
 * Throw photographs away.
 *
 * Nothing on screen deletes a letter in this release, so this exists for the
 * moments where bytes and rows would otherwise drift apart: a document row that
 * goes has to take its objects with it, because ON DELETE CASCADE reaches rows
 * and never a bucket. The storage test uses it to clean up after its own round
 * trip, which is the only caller today.
 *
 * Deleting nothing is not an error, so a caller can pass whatever it has.
 */
export async function deleteObjects(keys: readonly string[]): Promise<void> {
  if (keys.length === 0) return;
  await internal().send(
    new DeleteObjectsCommand({
      Bucket: env().STORAGE_BUCKET,
      Delete: { Objects: keys.map((Key) => ({ Key })) },
    }),
  );
}

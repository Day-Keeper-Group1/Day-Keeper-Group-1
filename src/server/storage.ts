/**
 * File storage: where the photographs actually live.
 *
 * The database holds a path and never the bytes (ADR 003). This module is the
 * only place that reads or writes those bytes. Nothing else in the application
 * should touch a file system or an S3 client directly, because the one thing
 * this module buys us is that moving from the MinIO in docker-compose.yml to a
 * real bucket is an environment change rather than a search through the code.
 *
 * It talks the S3 protocol, which MinIO, AWS S3, Cloudflare R2 and Supabase
 * Storage all speak. That is deliberate: the alternative, writing to the
 * server's own disk during development, is a second implementation that has to
 * be unwritten before anything can be deployed, and Next.js hosts generally
 * throw away the disk between deployments anyway.
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
 */
const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "application/pdf": "pdf",
};

/**
 * Where one photograph goes.
 *
 * `uploads/{user}/{batch}/{position}.{ext}`, and three things follow from that
 * shape. The person is the first segment, so everything one person owns is one
 * prefix: deleting an account, or counting what it costs, is a prefix
 * operation. The batch is the second, so the pile they photographed stays
 * together no matter how the reading later divides it into letters. And the
 * key is derived rather than random, so an upload that is retried writes over
 * itself instead of leaving a twin that nothing references.
 *
 * There is no document in the path, because at upload time there is no
 * document yet: letters are born later, when the reading says how many there
 * are. `document_pages.storage_path` then points at this same object. Copying
 * the bytes under a second key would double the storage to record something
 * the database already records.
 */
export function uploadObjectKey(params: {
  userId: string;
  batchId: string;
  position: number;
  contentType: string;
}): string {
  const ext = EXTENSIONS[params.contentType.toLowerCase()] ?? "bin";
  return `uploads/${params.userId}/${params.batchId}/${params.position}.${ext}`;
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
 * Two of the three failures do this: a photograph that is not a letter, and a
 * batch that held no letters at all. Both are cases where keeping the bytes
 * would mean a server that permanently holds a picture of somebody's
 * grandchild that no screen will ever show. The third failure, a letter too
 * blurred to read, keeps its pages: the reading that failed was looking at
 * them, and the person's way out is to photograph it again.
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

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
 * The region is required by the protocol and ignored by MinIO. A real bucket
 * does not ignore it, so it comes from the environment with the rest; see
 * STORAGE_REGION in env.ts.
 */

function clientFor(endpoint: string): S3Client {
  return new S3Client({
    endpoint,
    region: env().STORAGE_REGION,
    forcePathStyle: true,
    // Left to itself the SDK signs a checksum of the body into every upload
    // link, and at signing time the body is empty, so the link carries the
    // checksum of nothing. Supabase and MinIO both ignore it; a bucket that
    // checked it would refuse every photograph. Checksums are still sent where the
    // protocol requires one, such as deleting several objects at once.
    requestChecksumCalculation: "WHEN_REQUIRED",
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
 * The same table, for the one test that has to compare it with something.
 *
 * src/server/image-type.ts reads bytes and answers with a type; this turns a
 * type into a suffix. They describe the same set of formats from opposite
 * ends, and a format one knows and the other does not is a photograph stored
 * as .bin or a suffix nothing can produce. Exported so the test can say so,
 * and named to make clear that nothing in the application should reach for it.
 */
export const EXTENSIONS_FOR_TEST: Readonly<Record<string, string>> = EXTENSIONS;

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
 * How long a permission to upload stays good.
 *
 * Much shorter than a link to read one. A read link is handed to someone
 * looking at their own letter and may sit on screen while they think; an
 * upload link is used within seconds of being asked for, by a page that
 * already has the bytes in hand. Anything longer is a window for a link that
 * leaked out of a log or a history to still be worth something.
 */
export const UPLOAD_URL_TTL_SECONDS = 5 * 60;

/**
 * A time-limited permission for the browser to write one object itself.
 *
 * The bytes go from the phone to the bucket without passing through the
 * application, which is what makes a photograph bigger than a few megabytes
 * possible at all: a host that runs this as functions caps the body of a
 * request to it, and a camera photograph is regularly over that cap.
 *
 * The key is a parameter and every caller derives it with uploadObjectKey()
 * from a user id the request was authenticated as. It must never be a value a
 * caller read off the wire: a signature is permission to write exactly the key
 * it was signed for, so a key chosen by the sender is permission to write over
 * anybody's photograph.
 *
 * Signed with the public endpoint, like signedObjectUrl and for the same
 * reason: this one is used by the browser, not by us.
 *
 * The content type is signed too, so the object lands labelled as what it was
 * declared to be rather than as whatever the uploader felt like saying. That
 * is a label, not a guarantee about the bytes; src/server/image-type.ts is
 * what checks the bytes, afterwards.
 */
export function signedUploadUrl(
  key: string,
  contentType: string,
  ttlSeconds: number = UPLOAD_URL_TTL_SECONDS,
): Promise<string> {
  return getSignedUrl(
    signing(),
    new PutObjectCommand({
      Bucket: env().STORAGE_BUCKET,
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn: ttlSeconds },
  );
}

/**
 * Read one stored photograph back.
 *
 * Needed because an object the browser wrote is the first thing in this system
 * the server has never seen. Everything downstream — checking it is the kind
 * of file it claims to be, and reading the letter — needs the bytes, and this
 * is the one fetch they share.
 *
 * `length` fetches only the opening bytes, for a caller that needs to know
 * what a file is and not what it says: a HTTP range, so the bucket sends
 * twelve bytes rather than eight megabytes.
 */
export async function getObject(
  key: string,
  length?: number,
): Promise<{ bytes: Buffer; contentType?: string; byteSize: number }> {
  const response = await internal().send(
    new GetObjectCommand({
      Bucket: env().STORAGE_BUCKET,
      Key: key,
      ...(length === undefined ? {} : { Range: `bytes=0-${length - 1}` }),
    }),
  );

  const body = response.Body;
  if (!body) throw new Error(`storage returned no body for ${key}`);

  return {
    bytes: Buffer.from(await body.transformToByteArray()),
    contentType: response.ContentType,
    // What the bucket holds, which is the number worth having: ContentLength
    // on a ranged response describes the range, so a partial read reports the
    // whole object's size from the range header instead.
    byteSize: rangeTotal(response.ContentRange) ?? response.ContentLength ?? 0,
  };
}

/** The total after the slash in "bytes 0-11/8391218", or undefined. */
function rangeTotal(contentRange: string | undefined): number | undefined {
  const total = contentRange?.split("/")[1];
  if (!total || total === "*") return undefined;
  const parsed = Number(total);
  return Number.isFinite(parsed) ? parsed : undefined;
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

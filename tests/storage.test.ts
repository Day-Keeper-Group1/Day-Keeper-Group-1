/**
 * File storage.
 *
 * Two halves. The key layout is pure and always runs: it is a promise about
 * where a photograph can be found, and the database's paths are worthless if it
 * drifts. The round trip needs the MinIO from docker-compose.yml and skips with
 * a hint when nothing answers, because a teammate who has not started Docker
 * should get a sentence rather than a wall of red.
 *
 * The round trip is worth its keep for one reason: it stores an object and then
 * loads it back through a signed link, over HTTP, the way the browser will.
 * That is exactly the step that breaks when the address the server signs with
 * is not the address the caller can reach.
 */

import { config } from "dotenv";
import { describe, expect, it } from "vitest";
import {
  deleteObjects,
  putObject,
  signedObjectUrl,
  uploadObjectKey,
} from "@/server/storage";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

describe("upload keys", () => {
  it("puts the person first and the letter second", () => {
    const key = uploadObjectKey({
      userId: "11111111-1111-1111-1111-111111111111",
      documentId: "22222222-2222-2222-2222-222222222222",
      pageNumber: 3,
      contentType: "image/jpeg",
    });

    expect(key).toBe(
      "uploads/11111111-1111-1111-1111-111111111111/22222222-2222-2222-2222-222222222222/3.jpg",
    );
  });

  it("is derived, so the same photograph retried lands on the same object", () => {
    const params = {
      userId: "user",
      documentId: "letter",
      pageNumber: 1,
      contentType: "image/png",
    };
    expect(uploadObjectKey(params)).toBe(uploadObjectKey(params));
  });

  it("keeps a phone's own format rather than pretending everything is a jpeg", () => {
    const heic = uploadObjectKey({
      userId: "user",
      documentId: "letter",
      pageNumber: 1,
      contentType: "image/heic",
    });
    expect(heic.endsWith(".heic")).toBe(true);
  });

  it("does not guess an extension it does not know", () => {
    const key = uploadObjectKey({
      userId: "user",
      documentId: "letter",
      pageNumber: 1,
      contentType: "application/octet-stream",
    });
    expect(key.endsWith(".bin")).toBe(true);
  });
});

const endpoint = process.env.STORAGE_ENDPOINT;
const configured = Boolean(
  endpoint && process.env.STORAGE_ACCESS_KEY && process.env.STORAGE_SECRET_KEY,
);

/** Any HTTP answer means it is there; only a network error means it is not. */
async function reachable(url: string): Promise<boolean> {
  try {
    await fetch(url, { signal: AbortSignal.timeout(2000) });
    return true;
  } catch {
    return false;
  }
}

const storageIsUp = configured && (await reachable(endpoint!));

if (!storageIsUp) {
  console.warn(
    `[storage.test] skipping the round trip: nothing is answering at ${
      endpoint ?? "(STORAGE_ENDPOINT unset)"
    }. Start it with: docker compose up -d`,
  );
}

describe.skipIf(!storageIsUp)("round trip through storage", () => {
  const key = uploadObjectKey({
    userId: "test-user",
    documentId: "test-letter",
    pageNumber: 1,
    contentType: "image/png",
  });
  const body = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]);

  it("stores bytes and hands back a link that loads them", async () => {
    try {
      await putObject(key, body, "image/png");

      const url = await signedObjectUrl(key, 60);
      const response = await fetch(url);

      expect(response.ok).toBe(true);
      expect(response.headers.get("content-type")).toBe("image/png");
      expect(new Uint8Array(await response.arrayBuffer())).toEqual(body);
    } finally {
      await deleteObjects([key]);
    }
  });

  it("means it when it deletes", async () => {
    await putObject(key, body, "image/png");
    const url = await signedObjectUrl(key, 60);
    await deleteObjects([key]);

    const response = await fetch(url);
    expect(response.ok).toBe(false);
  });

  it("deleting nothing is not an error", async () => {
    await expect(deleteObjects([])).resolves.toBeUndefined();
  });
});

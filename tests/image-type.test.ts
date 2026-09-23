/**
 * Reading a file's type out of its first bytes.
 *
 * Pure and always runs: no bucket, no database, no network. The point of the
 * module is that it disagrees with what a sender claims, so the tests that
 * matter most are the ones where a thing calls itself a photograph and is not.
 */

import { describe, expect, it } from "vitest";

import { SNIFF_BYTES, sniffImageType } from "@/server/image-type";
import { EXTENSIONS_FOR_TEST } from "@/server/storage";

/** Bytes that open a real file of each kind, and nothing after them. */
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const RIFF = [0x52, 0x49, 0x46, 0x46];
const WEBP = [0x57, 0x45, 0x42, 0x50];
const FTYP = [0x66, 0x74, 0x79, 0x70];

const bytes = (...parts: number[][]) => Uint8Array.from(parts.flat());
const ascii = (text: string) => [...text].map((c) => c.charCodeAt(0));
const pad = (n: number) => Array<number>(n).fill(0);

describe("what the bytes say", () => {
  it("knows a PNG", () => {
    expect(sniffImageType(bytes(PNG, pad(8)))).toBe("image/png");
  });

  // A phone writes JFIF, Exif or raw JPEG depending on how the picture was
  // taken, and the fourth byte is what differs. Matching it would reject
  // photographs for being the wrong flavour of the format we accept.
  it.each([0xe0, 0xe1, 0xdb])("knows a JPEG whose fourth byte is %s", (b) => {
    expect(sniffImageType(bytes([0xff, 0xd8, 0xff, b], pad(8)))).toBe(
      "image/jpeg",
    );
  });

  it("knows a WebP, which names itself after a length it must skip", () => {
    expect(sniffImageType(bytes(RIFF, pad(4), WEBP))).toBe("image/webp");
  });

  it.each(["heic", "mif1", "msf1"])("knows a HEIF of brand %s", (brand) => {
    expect(sniffImageType(bytes(pad(4), FTYP, ascii(brand)))).toBe(
      "image/heic",
    );
  });
});

describe("what the bytes refuse", () => {
  it("refuses an executable that calls itself a photograph", () => {
    // MZ, which is where a Windows executable begins. Renaming it .png and
    // letting the browser label it image/png is the whole attack, and it is
    // the one thing the current upload path does not catch.
    expect(sniffImageType(bytes(ascii("MZ"), pad(20)))).toBeNull();
  });

  it("refuses a PDF, which is an honest file of the wrong kind", () => {
    expect(sniffImageType(bytes(ascii("%PDF-1.7"), pad(8)))).toBeNull();
  });

  it("refuses a RIFF that is not a WebP", () => {
    // A .wav is RIFF too. Stopping at "RIFF" would accept one.
    expect(sniffImageType(bytes(RIFF, pad(4), ascii("WAVE")))).toBeNull();
  });

  it("refuses an ISO container whose brand is not a still image", () => {
    // An .mp4 has the same ftyp header; only the brand separates it.
    expect(sniffImageType(bytes(pad(4), FTYP, ascii("isom")))).toBeNull();
  });

  it("refuses a file too short to identify rather than guessing", () => {
    expect(sniffImageType(Uint8Array.from([0x89, 0x50]))).toBeNull();
    expect(sniffImageType(new Uint8Array(0))).toBeNull();
  });

  it("refuses a PNG signature that is almost right", () => {
    expect(
      sniffImageType(
        bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x00], pad(8)),
      ),
    ).toBeNull();
  });
});

describe("agreement with the key layout", () => {
  // uploadObjectKey turns a type into a file suffix; this module turns bytes
  // into a type. A type one of them knows and the other does not means an
  // accepted photograph stored as .bin, or a suffix nothing can ever produce.
  it("names only types storage can give a suffix", () => {
    const sniffable = ["image/png", "image/jpeg", "image/webp", "image/heic"];
    for (const mimeType of sniffable) {
      expect(Object.keys(EXTENSIONS_FOR_TEST)).toContain(mimeType);
    }
  });
});

describe("how much is needed", () => {
  it("needs no more bytes than it says it does", () => {
    // A caller checking an object without downloading all of it asks for
    // SNIFF_BYTES. If any signature reached further, that caller would get a
    // null for a file that is fine.
    expect(
      sniffImageType(bytes(RIFF, pad(4), WEBP).subarray(0, SNIFF_BYTES)),
    ).toBe("image/webp");
    expect(
      sniffImageType(
        bytes(pad(4), FTYP, ascii("heic")).subarray(0, SNIFF_BYTES),
      ),
    ).toBe("image/heic");
  });
});

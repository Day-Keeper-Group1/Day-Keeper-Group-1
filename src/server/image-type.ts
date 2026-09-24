/**
 * What a file actually is, read from its first bytes.
 *
 * Every other part of the upload path takes the browser's word for it. A
 * multipart part carries a Content-Type the browser wrote, and
 * validateUpload() checks that it begins "image/" — which a file named
 * invoice.exe renamed to invoice.png satisfies, because the browser guesses
 * from the extension and the extension is whatever the sender typed. So today
 * the bucket will hold whatever a signed-in person sends it, under a key that
 * claims to be a photograph.
 *
 * That is worth closing on its own, and closing it is not optional once the
 * browser uploads straight into the bucket: the object exists before the
 * server has seen a byte of it, so the only place left to look is afterwards,
 * at what actually landed.
 *
 * A format's first bytes are not a security boundary by themselves — they are
 * four or eight bytes anyone can prepend — and nothing here pretends
 * otherwise. What this does buy is that an object the bucket labels image/png
 * decodes as a PNG, so the reader downstream is handed the kind of thing it
 * was built for, and a file that is quietly something else is refused at the
 * door rather than stored under a photograph's name.
 *
 * The list is EXTENSIONS in src/server/storage.ts, from the other side: that
 * one turns a type into a file suffix, this one turns bytes into a type. They
 * describe the same set and have to stay in step, which tests/image-type.test.ts
 * checks.
 */

import "server-only";

/**
 * The first bytes each accepted format begins with.
 *
 * JPEG is the three bytes that open every variant; the fourth differs by
 * flavour (JFIF, Exif, raw) and a phone produces all three, so matching four
 * would reject photographs for being the wrong brand of JPEG.
 */
const SIGNATURES: ReadonlyArray<{
  mimeType: string;
  magic: readonly number[];
}> = [
  {
    mimeType: "image/png",
    magic: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  },
  { mimeType: "image/jpeg", magic: [0xff, 0xd8, 0xff] },
];

/**
 * WebP and HEIC are containers, so their first bytes name the container and
 * the format proper is named a little further in.
 *
 * WebP is a RIFF file: "RIFF", four bytes of length, then "WEBP". HEIC and
 * HEIF are ISO base media files: four bytes of length, "ftyp", then a brand.
 * Apple writes several brands depending on how the picture was taken, and a
 * photograph straight off an iPhone is usually heic or mif1.
 */
const HEIF_BRANDS = new Set([
  "heic",
  "heix",
  "hevc",
  "hevx",
  "heim",
  "heis",
  "hevm",
  "hevs",
  "mif1",
  "msf1",
]);

/**
 * The type these bytes really are, or null for anything not on the list.
 *
 * Null covers both "this is some other image format" and "this is not an image
 * at all", because the caller does the same thing with either: refuse it. The
 * difference would only matter if there were a second list to fall back to.
 */
export function sniffImageType(bytes: Uint8Array): string | null {
  for (const { mimeType, magic } of SIGNATURES) {
    if (bytes.length < magic.length) continue;
    if (magic.every((byte, index) => bytes[index] === byte)) return mimeType;
  }

  const ascii = (start: number, end: number) =>
    Buffer.from(bytes.subarray(start, end)).toString("latin1");

  if (bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") {
    return "image/webp";
  }

  if (bytes.length >= 12 && ascii(4, 8) === "ftyp") {
    const brand = ascii(8, 12);
    // heif is the still-image brand; heic is the one a phone writes. Both end
    // up as image/heic here, because that is the type the rest of the system
    // and EXTENSIONS in storage.ts already know, and the distinction changes
    // nothing any caller does.
    if (HEIF_BRANDS.has(brand)) return "image/heic";
  }

  return null;
}

/**
 * How many bytes sniffImageType needs. A caller fetching an object only to
 * check it can ask for this much rather than the whole photograph.
 */
export const SNIFF_BYTES = 12;

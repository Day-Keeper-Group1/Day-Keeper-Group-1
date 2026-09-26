/**
 * Making a phone photograph small enough to send, and no smaller.
 *
 * A current phone camera writes three to six megabytes per frame. That is
 * more picture than the reader needs, and every byte of it crosses the network
 * twice: into the bucket, and out again to be read. It is also how this began
 * (KAN-75): a letter of two pages photographed on a phone was more than the
 * host would take in one request, and the page sat on "Sending...". The
 * photographs now go straight to the bucket, which has no such limit, and
 * they are still redrawn smaller in the browser before they go.
 *
 * The line is a file size, not a ratio. A photograph at or under it goes as
 * it is, whatever camera took it, because a small file from a poor camera is
 * already as much picture as there is, and squeezing it further only loses
 * what little it has.
 *
 * The target is what the reader was measured on. The synthetic letters in
 * data/synthetic-letters/ are A4 pages at 300 dpi, 2483 by 3508 pixels and
 * 600 to 800 KB, and every accuracy figure in docs/extraction.md was read off
 * pictures that size. So a photograph is never drawn with a long side under
 * 3508 pixels, and only the JPEG quality goes down after that. If even the
 * lowest quality leaves it over the line it is sent anyway: the server's own
 * limit, MAX_PAGE_BYTES, is ten times larger, and a page sent large is better
 * than a page not sent.
 *
 * The arithmetic is pure and exported so that tests can hold it without a
 * canvas. shrinkPhoto() is the one part that needs a browser.
 */

/** At or under this many bytes, a photograph is sent untouched. */
export const SHRINK_ABOVE_BYTES = 1024 * 1024;

/** The long side of the pages the reader was measured on, in pixels. */
export const LONG_SIDE_PX = 3508;

/** JPEG qualities to try, best first. The last one is the floor. */
export const JPEG_QUALITIES = [0.85, 0.75, 0.65, 0.55, 0.5] as const;

export function needsShrinking(byteSize: number): boolean {
  return byteSize > SHRINK_ABOVE_BYTES;
}

/**
 * The size to draw a photograph at: its own size when its long side is
 * already within LONG_SIDE_PX, otherwise scaled down so the long side is
 * exactly that. Never scaled up.
 */
export function targetSize(
  width: number,
  height: number,
): { width: number; height: number } {
  const longSide = Math.max(width, height);
  if (longSide <= LONG_SIDE_PX) return { width, height };
  const scale = LONG_SIDE_PX / longSide;
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}

/**
 * The photograph to send in place of `file`.
 *
 * Anything that goes wrong along the way, such as a format this browser cannot
 * decode, sends the original instead. A photograph she deliberately took is
 * never dropped here; the server decides whether it can be taken.
 */
export async function shrinkPhoto(file: File): Promise<File> {
  if (!needsShrinking(file.size)) return file;

  let bitmap: ImageBitmap;
  try {
    // The default orientation handling applies the camera's rotation tag, so
    // a page held sideways is drawn the way it was seen.
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }

  try {
    const { width, height } = targetSize(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, width, height);

    let smallest: Blob | null = null;
    for (const quality of JPEG_QUALITIES) {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", quality),
      );
      if (!blob) break;
      smallest = blob;
      if (!needsShrinking(blob.size)) break;
    }

    // A redrawn file that came out no smaller is no improvement.
    if (!smallest || smallest.size >= file.size) return file;
    const name = file.name.replace(/\.[^.]*$/, "") + ".jpg";
    return new File([smallest], name, {
      type: "image/jpeg",
      lastModified: file.lastModified,
    });
  } catch {
    return file;
  } finally {
    bitmap.close();
  }
}

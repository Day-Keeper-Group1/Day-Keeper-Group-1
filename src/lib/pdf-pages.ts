/**
 * A PDF, turned into the photographs the rest of the product expects. (KAN-85)
 *
 * A letter that arrived by email is a PDF, and the upload box on a phone
 * already offers her Files, so she can pick one. Nothing past the capture
 * screen learns that it happened: each page is drawn here, in her browser, as
 * a PNG, and those join the upload as if she had chosen several photographs at
 * once. The endpoint, the bucket, the reader and the page viewer stay what
 * they are, images in and images out.
 *
 * Each page is drawn at 300 dpi, which is how the letters the reading scheme
 * was measured on were made: an A4 page comes out 2480 pixels wide, as the
 * pages under data/synthetic-letters are. A PDF page is therefore the input
 * docs/extraction.md already has numbers for, and it needs no experiment of
 * its own.
 *
 * pdf.js is the legacy build, the one its authors support on Safari 18 and on
 * browsers a few versions old; the people this is for do not all keep their
 * phones current. It is loaded only when a PDF is picked, so someone who only
 * ever photographs never downloads it.
 *
 * Browser only: it draws on a canvas.
 */

/** 300 dpi over the 72 points to the inch a PDF measures its pages in. */
const SCALE = 300 / 72;

/**
 * The largest canvas Safari on a phone will draw, in pixels. An A4 page at
 * 300 dpi is about 8.7 million; only a poster-sized page would come near this,
 * and such a page is drawn smaller rather than not at all.
 */
const MAX_CANVAS_AREA = 16_777_216;

export function isPdf(file: File): boolean {
  return (
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
  );
}

/** The PDF could not be opened: damaged, locked with a password, or not a PDF. */
export class PdfUnreadable extends Error {}

/**
 * The PDF has more pages than there is room for. Refused whole, like an upload
 * of too many photographs, because a letter missing its last pages is not the
 * letter.
 */
export class PdfTooLong extends Error {
  constructor(readonly pageCount: number) {
    super(`This PDF has ${pageCount} pages.`);
  }
}

type PdfJs = typeof import("pdfjs-dist/legacy/build/pdf.mjs");

let loading: Promise<PdfJs> | null = null;

/**
 * pdf.js, with its worker started once.
 *
 * The worker is where the PDF is parsed. Without one pdf.js quietly does the
 * work on the page's own thread, and drawing a page at 300 dpi there freezes
 * the screen she is looking at. `new Worker(new URL(..., import.meta.url))` is
 * the form the bundler recognises and ships as its own file.
 */
function loadPdfJs(): Promise<PdfJs> {
  loading ??= import("pdfjs-dist/legacy/build/pdf.mjs").then((pdfjs) => {
    pdfjs.GlobalWorkerOptions.workerPort = new Worker(
      new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url),
      { type: "module" },
    );
    return pdfjs;
  });
  return loading;
}

/**
 * Every page of the PDF as a PNG, in page order, named after the PDF so the
 * pages still sort together: `bill.pdf` becomes `bill-page-01.png` and on.
 * Throws PdfTooLong before drawing anything when it has more than `room` pages.
 */
export async function pdfToPages(file: File, room: number): Promise<File[]> {
  const doc = await openPdf(file);
  if (doc.numPages > room) {
    void doc.loadingTask.destroy();
    throw new PdfTooLong(doc.numPages);
  }
  const base = file.name.replace(/\.pdf$/i, "");
  const digits = Math.max(2, String(doc.numPages).length);
  // One canvas, reused page after page and emptied in between, because a
  // phone holds only so many canvases of this size before it refuses to draw.
  const canvas = document.createElement("canvas");
  const pages: File[] = [];

  try {
    for (let number = 1; number <= doc.numPages; number += 1) {
      const page = await doc.getPage(number);
      const size = page.getViewport({ scale: 1 });
      const area = size.width * size.height * SCALE * SCALE;
      const scale =
        area > MAX_CANVAS_AREA
          ? SCALE * Math.sqrt(MAX_CANVAS_AREA / area)
          : SCALE;
      const viewport = page.getViewport({ scale });

      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      await page.render({ canvas, viewport }).promise;
      page.cleanup();

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );
      if (!blob) throw new PdfUnreadable(`Page ${number} could not be drawn.`);
      const name = `${base}-page-${String(number).padStart(digits, "0")}.png`;
      pages.push(new File([blob], name, { type: "image/png" }));

      canvas.width = 0;
      canvas.height = 0;
    }
  } finally {
    void doc.loadingTask.destroy();
  }

  return pages;
}

async function openPdf(file: File) {
  const pdfjs = await loadPdfJs();
  try {
    const data = new Uint8Array(await file.arrayBuffer());
    return await pdfjs.getDocument({ data }).promise;
  } catch (cause) {
    throw new PdfUnreadable("This PDF could not be opened.", { cause });
  }
}

import { after } from "next/server";
import {
  MAX_PAGE_BYTES,
  MAX_PAGES,
  type DocumentSummary,
} from "@/lib/contract/api";
import { fail, json, route } from "@/server/api/respond";
import { requireUser } from "@/server/auth/session";
import { query, queryOne, transaction } from "@/server/db";
import { extractionProvider } from "@/server/extraction";
import { runExtraction } from "@/server/extraction/runner";
import { deleteObjects, putObject, uploadObjectKey } from "@/server/storage";

type DocumentRow = { id: string; uploaded_at: Date };

type DocumentSummaryRow = {
  id: string;
  issuer: string | null;
  document_type: string | null;
  status: DocumentSummary["status"];
  due_date: string | null;
  due_time: string | null;
  amount_text: string | null;
  reference: string | null;
  uploaded_at: Date;
  page_count: number;
};

export const GET = route(async () => {
  const user = await requireUser();
  const documents = await query<DocumentSummaryRow>(
    `SELECT d.id, d.issuer, d.document_type, d.status, d.due_date, d.due_time,
            d.amount_text, d.reference, d.uploaded_at, COUNT(p.id)::int AS page_count
       FROM documents d
       LEFT JOIN document_pages p ON p.document_id = d.id
      WHERE d.user_id = $1
      GROUP BY d.id
      ORDER BY d.uploaded_at DESC`,
    [user.id],
  );

  return json(
    documents.map((document) => ({
      id: document.id,
      issuer: document.issuer,
      documentType: document.document_type,
      label:
        document.issuer && document.document_type
          ? `${document.issuer} · ${document.document_type}`
          : `New letter · ${document.page_count} ${document.page_count === 1 ? "photo" : "photos"}`,
      status: document.status,
      ...(document.due_date && { dueDate: document.due_date }),
      ...(document.due_time && { dueTime: document.due_time }),
      ...(document.amount_text && { amount: document.amount_text }),
      ...(document.reference && { reference: document.reference }),
      uploadedAt: document.uploaded_at.toISOString(),
      pageCount: document.page_count,
    })) satisfies DocumentSummary[],
  );
});

export const POST = route(async (request: Request) => {
  const user = await requireUser();
  const form = await request.formData().catch(() => null);
  const pages =
    form
      ?.getAll("pages")
      .filter((item): item is File => item instanceof File) ?? [];

  if (pages.length === 0) {
    return fail("invalid_request", "Please attach at least one photo.", {
      pages: "Choose a photo to upload.",
    });
  }
  if (pages.length > MAX_PAGES) {
    return fail(
      "invalid_request",
      `You can upload up to ${MAX_PAGES} photos at once.`,
      { pages: "Too many photos." },
    );
  }
  for (const [index, page] of pages.entries()) {
    if (!page.type.startsWith("image/")) {
      return fail(
        "invalid_request",
        "Please attach photos, not other file types.",
        { pages: `Page ${index + 1} is not an image.` },
      );
    }
    if (page.size > MAX_PAGE_BYTES) {
      return fail("invalid_request", `Each photo must be 10 MB or smaller.`, {
        pages: `Page ${index + 1} is larger than 10 MB.`,
      });
    }
  }

  const provider = extractionProvider();
  const document = await queryOne<DocumentRow>(
    `INSERT INTO documents (user_id) VALUES ($1) RETURNING id, uploaded_at`,
    [user.id],
  );
  if (!document) throw new Error("Document insert returned no row");

  const storedKeys: string[] = [];
  try {
    const uploads = await Promise.all(
      pages.map(async (page, index) => {
        const storagePath = uploadObjectKey({
          userId: user.id,
          documentId: document.id,
          pageNumber: index + 1,
          contentType: page.type,
        });
        await putObject(
          storagePath,
          new Uint8Array(await page.arrayBuffer()),
          page.type,
        );
        storedKeys.push(storagePath);
        return {
          storagePath,
          mimeType: page.type,
          byteSize: page.size,
          pageNumber: index + 1,
        };
      }),
    );
    await transaction(async (client) => {
      for (const upload of uploads) {
        await client.query(
          `INSERT INTO document_pages (document_id, page_number, storage_path, mime_type, byte_size)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            document.id,
            upload.pageNumber,
            upload.storagePath,
            upload.mimeType,
            upload.byteSize,
          ],
        );
      }
      await client.query(
        `INSERT INTO extraction_runs (document_id, provider, model)
         VALUES ($1, $2, $3)`,
        [document.id, provider.name, provider.model],
      );
    });
  } catch (error) {
    await deleteObjects(storedKeys);
    await query(`DELETE FROM documents WHERE id = $1`, [document.id]);
    throw error;
  }

  after(() => runExtraction(document.id));
  const response: DocumentSummary = {
    id: document.id,
    issuer: null,
    documentType: null,
    label: `New letter · ${pages.length} ${pages.length === 1 ? "photo" : "photos"}`,
    status: "processing",
    uploadedAt: document.uploaded_at.toISOString(),
    pageCount: pages.length,
  };
  return json(response, 201);
});

import "server-only";
import type { DocumentDetail, DocumentSummary } from "@/lib/contract/api";
import { FIELD_LABELS, type ContractFieldKey } from "@/lib/contract/fields";
import { query, queryOne } from "@/server/db";

type DocumentRow = {
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

function summary(row: DocumentRow): DocumentSummary {
  return {
    id: row.id,
    issuer: row.issuer,
    documentType: row.document_type,
    label:
      row.issuer && row.document_type
        ? `${row.issuer} · ${row.document_type}`
        : `New letter · ${row.page_count} ${row.page_count === 1 ? "photo" : "photos"}`,
    status: row.status,
    ...(row.due_date && { dueDate: row.due_date }),
    ...(row.due_time && { dueTime: row.due_time }),
    ...(row.amount_text && { amount: row.amount_text }),
    ...(row.reference && { reference: row.reference }),
    uploadedAt: row.uploaded_at.toISOString(),
    pageCount: row.page_count,
  };
}

export async function documentDetailForUser(
  userId: string,
  documentId: string,
): Promise<DocumentDetail | null> {
  const row = await queryOne<DocumentRow>(
    `SELECT d.id, d.issuer, d.document_type, d.status, d.due_date, d.due_time,
            d.amount_text, d.reference, d.uploaded_at, COUNT(p.id)::int AS page_count
       FROM documents d LEFT JOIN document_pages p ON p.document_id = d.id
      WHERE d.id = $1 AND d.user_id = $2 GROUP BY d.id`,
    [documentId, userId],
  );
  if (!row) return null;
  const fields = await query<{
    field_key: string;
    extracted_value: string | null;
    status: "confirmed" | "uncertain" | "unreadable";
  }>(
    `SELECT ef.field_key, ef.extracted_value, ef.status
       FROM extraction_runs er JOIN extracted_fields ef ON ef.extraction_run_id = er.id
      WHERE er.document_id = $1 AND er.status = 'succeeded'`,
    [documentId],
  );
  const pages = await query<{ id: string; page_number: number }>(
    `SELECT id, page_number FROM document_pages WHERE document_id = $1 ORDER BY page_number`,
    [documentId],
  );
  return {
    ...summary(row),
    fields: fields.map((field) => ({
      key: field.field_key,
      label:
        FIELD_LABELS[field.field_key as ContractFieldKey] ?? field.field_key,
      value: field.status === "confirmed" ? field.extracted_value : null,
      status: field.status === "confirmed" ? "confirmed" : "unreadable",
    })),
    pages: pages.map((page) => ({
      id: page.id,
      pageNumber: page.page_number,
      url: `/api/documents/${documentId}/pages/${page.page_number}`,
    })),
  };
}

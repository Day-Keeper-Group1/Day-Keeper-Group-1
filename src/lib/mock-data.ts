import type { Status } from "@/components/status-badge";

export type MockDocument = {
  id: string;
  issuer: string;
  documentType: string;
  status: Extract<
    Status,
    "processing" | "needs-review" | "confirmed" | "failed" | "archived"
  >;
  dueDate?: string;
  amount?: string;
  reference?: string;
  uploadedAt: string;
};

export type MockTask = {
  id: string;
  title: string;
  documentId?: string;
  issuer: string;
  dueDate: string;
  status: Extract<Status, "overdue" | "upcoming" | "completed">;
};

export const MOCK_DOCUMENTS: MockDocument[] = [
  // Its extraction below has a hedged date and an unreadable reference, so
  // the summary carries neither: a value the model was not sure of never
  // reaches a summary (ADR 008).
  {
    id: "doc_1",
    issuer: "Yarra Valley Water",
    documentType: "Utility bill",
    status: "needs-review",
    amount: "$142.30",
    uploadedAt: "2026-08-04",
  },
  {
    id: "doc_2",
    issuer: "Centrelink",
    documentType: "Government letter",
    status: "confirmed",
    dueDate: "2026-08-05",
    reference: "CRN-2201884",
    uploadedAt: "2026-08-03",
  },
  {
    id: "doc_3",
    issuer: "Metro Trains Melbourne",
    documentType: "Fine notice",
    status: "processing",
    uploadedAt: "2026-08-06",
  },
  {
    id: "doc_4",
    issuer: "Bupa",
    documentType: "Medical letter",
    status: "failed",
    uploadedAt: "2026-08-02",
  },
  {
    id: "doc_5",
    issuer: "Telstra",
    documentType: "Utility bill",
    status: "archived",
    dueDate: "2026-07-18",
    amount: "$79.00",
    uploadedAt: "2026-07-10",
  },
];

export const MOCK_TASKS: MockTask[] = [
  // Tasks exist only for confirmed letters, so every documentId below points
  // at one; the needs-review water bill has no task yet.
  {
    id: "task_2",
    title: "Respond to Centrelink review",
    documentId: "doc_2",
    issuer: "Centrelink",
    dueDate: "2026-08-05",
    status: "overdue",
  },
  {
    id: "task_3",
    title: "Pay Telstra bill",
    documentId: "doc_5",
    issuer: "Telstra",
    dueDate: "2026-07-18",
    status: "completed",
  },
];

export function getDocumentById(id: string) {
  return MOCK_DOCUMENTS.find((doc) => doc.id === id);
}

/**
 * A field as a screen sees it: two states only. Storage knows a third
 * (`uncertain`), but the server collapses it to `unreadable` on the way out:
 * a value the model was not sure of does not exist as far as any screen is
 * concerned, and nobody is asked about it. See ADR 008.
 */
export type ExtractedField = {
  key: string;
  label: string;
  value: string;
  status: Extract<Status, "confirmed" | "unreadable">;
};

const MOCK_EXTRACTIONS: Record<string, ExtractedField[]> = {
  doc_1: [
    {
      key: "document_type",
      label: "Document type",
      value: "Utility bill",
      status: "confirmed",
    },
    {
      key: "issuer",
      label: "Issuer",
      value: "Yarra Valley Water",
      status: "confirmed",
    },
    {
      key: "action_required",
      label: "Action required",
      value: "Pay bill",
      status: "confirmed",
    },
    // Storage holds this one as `uncertain` with the model's guess; what the
    // browser receives is the collapsed form: no value. The screen's message
    // line, not this row, is what tells the person the date is missing.
    {
      key: "due_date",
      label: "Due date",
      value: "",
      status: "unreadable",
    },
    {
      key: "amount",
      label: "Amount",
      value: "$142.30",
      status: "confirmed",
    },
    {
      key: "reference",
      label: "Reference number",
      value: "",
      status: "unreadable",
    },
  ],
};

export function getExtractionFields(documentId: string): ExtractedField[] {
  if (MOCK_EXTRACTIONS[documentId]) return MOCK_EXTRACTIONS[documentId];

  const document = getDocumentById(documentId);
  if (!document) return [];

  const fields: ExtractedField[] = [
    {
      key: "document_type",
      label: "Document type",
      value: document.documentType,
      status: "confirmed",
    },
    {
      key: "issuer",
      label: "Issuer",
      value: document.issuer,
      status: "confirmed",
    },
  ];
  if (document.dueDate) {
    fields.push({
      key: "due_date",
      label: "Due date",
      value: document.dueDate,
      status: "confirmed",
    });
  }
  if (document.amount) {
    fields.push({
      key: "amount",
      label: "Amount",
      value: document.amount,
      status: "confirmed",
    });
  }
  if (document.reference) {
    fields.push({
      key: "reference",
      label: "Reference number",
      value: document.reference,
      status: "confirmed",
    });
  }
  return fields;
}

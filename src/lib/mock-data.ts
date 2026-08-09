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
  {
    id: "doc_1",
    issuer: "Yarra Valley Water",
    documentType: "Utility bill",
    status: "needs-review",
    dueDate: "2026-08-15",
    amount: "$142.30",
    reference: "YVW-88213",
    uploadedAt: "2026-08-04",
  },
  {
    id: "doc_2",
    issuer: "Centrelink",
    documentType: "Government letter",
    status: "confirmed",
    dueDate: "2026-08-20",
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
  {
    id: "task_1",
    title: "Pay water bill",
    documentId: "doc_1",
    issuer: "Yarra Valley Water",
    dueDate: "2026-08-15",
    status: "upcoming",
  },
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

export type ExtractedField = {
  key: string;
  label: string;
  value: string;
  rawText: string;
  status: Extract<Status, "confirmed" | "uncertain" | "unreadable">;
};

const MOCK_EXTRACTIONS: Record<string, ExtractedField[]> = {
  doc_1: [
    {
      key: "document_type",
      label: "Document type",
      value: "Utility bill",
      rawText: "Electricity & water usage statement",
      status: "confirmed",
    },
    {
      key: "issuer",
      label: "Issuer",
      value: "Yarra Valley Water",
      rawText: "Yarra Valley Water Corporation",
      status: "confirmed",
    },
    {
      key: "action_required",
      label: "Action required",
      value: "Pay bill",
      rawText: "Please pay by the due date shown below",
      status: "confirmed",
    },
    {
      key: "due_date",
      label: "Due date",
      value: "2026-08-15",
      rawText: "15/08/26",
      status: "uncertain",
    },
    {
      key: "amount",
      label: "Amount",
      value: "$142.30",
      rawText: "$142.30",
      status: "confirmed",
    },
    {
      key: "reference",
      label: "Reference number",
      value: "",
      rawText: "(smudged in photo)",
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
      rawText: document.documentType,
      status: "confirmed",
    },
    {
      key: "issuer",
      label: "Issuer",
      value: document.issuer,
      rawText: document.issuer,
      status: "confirmed",
    },
  ];
  if (document.dueDate) {
    fields.push({
      key: "due_date",
      label: "Due date",
      value: document.dueDate,
      rawText: document.dueDate,
      status: "confirmed",
    });
  }
  if (document.amount) {
    fields.push({
      key: "amount",
      label: "Amount",
      value: document.amount,
      rawText: document.amount,
      status: "confirmed",
    });
  }
  if (document.reference) {
    fields.push({
      key: "reference",
      label: "Reference number",
      value: document.reference,
      rawText: document.reference,
      status: "confirmed",
    });
  }
  return fields;
}

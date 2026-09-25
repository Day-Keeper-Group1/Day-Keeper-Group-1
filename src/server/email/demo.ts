import "server-only";
import { CONTRACT_VERSION } from "@/lib/contract/extraction";
import {
  CONTRACT_FIELD_KEYS,
  NO_PAYMENT_REQUIRED,
  type ContractFieldKey,
} from "@/lib/contract/fields";
import { MockEmailProvider } from "./mock-provider";
import type { EmailExtractionProvider, EmailMessage } from "./provider";
import { readEmail, readEmailPage } from "./read";

// Synthetic, public demonstration data only. Never load a user's mailbox here.
const messages: EmailMessage[] = [
  {
    providerMessageId: "bill",
    from: "billing@example.com",
    subject: "Your Example Energy bill is ready",
    receivedAt: "2026-09-24T09:00:00+10:00",
    textBody:
      "Hello Margaret,\n\nYour electricity bill from Example Energy is ready. Please pay $84.50 by 8 October 2026.\n\nYour account reference is EE-2048. Quote this reference when making your payment.\n\nThank you,\nExample Energy",
  },
  {
    providerMessageId: "appointment",
    from: "appointments@example.com",
    subject: "Your appointment at Example Community Clinic",
    receivedAt: "2026-09-24T10:30:00+10:00",
    textBody:
      "Hello Margaret,\n\nPlease attend Example Community Clinic on 12 October 2026 at 10:30 am for your routine check-up.\n\nThe appointment is at 12 Sample Street, Melbourne. Bring your Medicare card. No payment is required. Your booking reference is CL-1030.\n\nKind regards,\nExample Community Clinic",
  },
  {
    providerMessageId: "newsletter",
    from: "community@example.com",
    subject: "A little news from Example Community Centre",
    receivedAt: "2026-09-23T14:00:00+10:00",
    textBody:
      "Hello Margaret,\n\nHere is this month's news from Example Community Centre. Our volunteers have planted a new herb garden and the reading room now has more large-print books.\n\nThis is just an update. You do not need to reply, book anything or make a payment.\n\nWarm wishes,\nThe community team",
  },
];

const examples: Record<string, Record<ContractFieldKey, string>> = {
  bill: {
    document_type: "Electricity bill",
    issuer: "Example Energy",
    action_required: "Pay Example Energy",
    due_date: "2026-10-08",
    amount: "$84.50",
    reference: "EE-2048",
  },
  appointment: {
    document_type: "Appointment",
    issuer: "Example Community Clinic",
    action_required: "Attend Example Community Clinic",
    due_date: "2026-10-12",
    amount: NO_PAYMENT_REQUIRED,
    reference: "CL-1030",
  },
};

const demoExtractor: EmailExtractionProvider = {
  async extract(message) {
    if (message.providerMessageId === "newsletter")
      return { kind: "no-action" };
    const values = examples[message.providerMessageId];
    if (!values) throw new Error("Unknown demo message");
    return {
      kind: "action",
      extraction: {
        contract_version: CONTRACT_VERSION,
        provider: "demo",
        model: null,
        fields: [
          ...CONTRACT_FIELD_KEYS.map((key) => ({
            key,
            value: values[key],
            status: "confirmed",
          })),
          ...(message.providerMessageId === "appointment"
            ? [{ key: "due_time", value: "10:30", status: "confirmed" }]
            : []),
        ],
      },
    };
  },
};

/** Exercise the real validation boundaries with predefined readings, without AI or persistence. */
export async function readDemoMailbox() {
  const mailbox = new MockEmailProvider([{ messages, nextCursor: null }]);
  const page = await readEmailPage(mailbox, null);
  return Promise.all(
    page.messages.map(async (message) => ({
      message,
      reading: await readEmail(demoExtractor, message),
    })),
  );
}

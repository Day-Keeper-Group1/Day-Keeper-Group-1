import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth/session";
import { savedEmailMessage } from "@/server/email/source";
import { GmailMailbox } from "./gmail-mailbox";

export const metadata = { title: "Email | DayKeeper" };
export default async function EmailPage({
  searchParams,
}: {
  searchParams: Promise<{ connection?: string; document?: string }>;
}) {
  const { connection, document: documentId } = await searchParams;
  const user = await requireUser();
  if (
    documentId &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      documentId,
    )
  )
    notFound();
  const initialEmail = documentId
    ? await savedEmailMessage(documentId, user.id)
    : null;
  if (documentId && !initialEmail) notFound();
  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <GmailMailbox
        key={documentId ?? "inbox"}
        initialEmail={initialEmail ?? undefined}
        connectionFailed={connection === "failed"}
      />
    </div>
  );
}

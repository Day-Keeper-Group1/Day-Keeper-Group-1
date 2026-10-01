import { GmailMailbox } from "./gmail-mailbox";

export const metadata = { title: "Email | DayKeeper" };
export default async function EmailPage({
  searchParams,
}: {
  searchParams: Promise<{ connection?: string }>;
}) {
  const { connection } = await searchParams;
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <GmailMailbox connectionFailed={connection === "failed"} />
    </div>
  );
}

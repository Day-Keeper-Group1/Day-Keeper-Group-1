import Link from "next/link";
import { ScreenHeader } from "@/components/screen";
import { GmailMailbox } from "./gmail-mailbox";

export const metadata = { title: "Email | DayKeeper" };
export default async function EmailPage({
  searchParams,
}: {
  searchParams: Promise<{ connection?: string }>;
}) {
  const { connection } = await searchParams;
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <ScreenHeader
        title="Your email"
        subtitle="Connect Gmail to read your recent inbox messages."
      />
      <p className="text-sub text-ink-dim">
        Read-only preview. Email extraction, tasks and reminders are not
        connected yet.
      </p>
      {connection === "connected" && (
        <p role="status" className="rounded-lg bg-success-bg p-4 text-success">
          Gmail connected. Choose Check email to read your inbox.
        </p>
      )}
      {connection === "failed" && (
        <p role="alert" className="rounded-lg bg-warn-bg p-4 text-warn">
          Gmail could not be connected. Try again and allow read-only access. If
          this continues, check the callback address and server setup.
        </p>
      )}
      <GmailMailbox />
      <Link
        className="inline-flex min-h-12 items-center font-semibold text-primary underline"
        href="/email-demo"
      >
        Try the sample email demo
      </Link>
    </div>
  );
}

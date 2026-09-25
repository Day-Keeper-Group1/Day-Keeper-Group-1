import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Mail, CheckCircle2 } from "lucide-react";
import { ScreenHeader, Panel } from "@/components/screen";
import { FactRow } from "@/components/fact-row";
import { APP_TIME_ZONE, formatDueDate } from "@/lib/contract/dates";
import { FIELD_LABELS, isContractFieldKey } from "@/lib/contract/fields";
import { readDemoMailbox } from "@/server/email/demo";

export const metadata: Metadata = {
  title: "Email demo | DayKeeper",
  robots: { index: false, follow: false },
};

export default async function EmailDemoPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;
  const entries = await readDemoMailbox();
  const selected = entries.find(
    ({ message }) => message.providerMessageId === email,
  );
  const received = (value: string) =>
    new Intl.DateTimeFormat("en-AU", {
      timeZone: APP_TIME_ZONE,
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value));

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-8 sm:py-10">
      <Link
        href="/dashboard"
        className="mb-6 inline-flex min-h-12 items-center gap-2 font-semibold text-primary underline underline-offset-4"
      >
        <ArrowLeft aria-hidden="true" size={18} /> DayKeeper
      </Link>
      <ScreenHeader
        title="Email demo"
        subtitle="From an email to a clear next step."
      />
      <div className="mb-6 rounded-[10px] border-2 border-line bg-warn-bg p-4 text-warn">
        <p className="font-bold">Demo — sample emails</p>
        <p className="mt-1 text-sub leading-relaxed">
          These fictional emails and their extracted details are predefined.
          Gmail and live AI extraction are not connected. No tasks or reminders
          are saved.
        </p>
      </div>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(260px,1fr)_minmax(0,2fr)]">
        <Panel title="Sample inbox">
          <p className="mb-4 text-sub text-ink-dim">
            3 emails · Choose one to open
          </p>
          <ul className="divide-y divide-line">
            {entries.map(({ message, reading }) => (
              <li key={message.providerMessageId}>
                <Link
                  href={`/email-demo?email=${message.providerMessageId}#email-detail`}
                  aria-current={
                    selected?.message.providerMessageId ===
                    message.providerMessageId
                      ? "page"
                      : undefined
                  }
                  className="block rounded-md border-l-4 border-transparent px-3 py-4 hover:bg-primary-soft aria-[current=page]:border-primary aria-[current=page]:bg-primary-soft"
                >
                  <span className="flex items-start gap-3">
                    <Mail
                      className="mt-1 shrink-0 text-primary"
                      size={20}
                      aria-hidden="true"
                    />
                    <span className="min-w-0">
                      <span className="block text-row font-bold">
                        {message.subject}
                      </span>
                      <span className="mt-1 block break-all text-caption text-ink-dim">
                        {message.from}
                      </span>
                    </span>
                  </span>
                  <span className="mt-3 flex items-center justify-between gap-2 text-caption font-semibold text-primary">
                    <span>
                      {reading.kind === "action"
                        ? "Example action available"
                        : "No action needed"}
                    </span>
                    <ArrowRight size={18} aria-hidden="true" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
        <div id="email-detail" className="min-w-0 scroll-mt-6 space-y-5">
          {selected ? (
            <>
              <Panel>
                <h2 className="text-title font-bold">
                  {selected.message.subject}
                </h2>
                <dl className="my-5 space-y-2 border-b border-line pb-5 text-sub">
                  <div>
                    <dt className="inline font-semibold">From: </dt>
                    <dd className="inline break-all">
                      {selected.message.from}
                    </dd>
                  </div>
                  <div>
                    <dt className="inline font-semibold">To: </dt>
                    <dd className="inline">Margaret (demo recipient)</dd>
                  </div>
                  <div>
                    <dt className="inline font-semibold">Received: </dt>
                    <dd className="inline">
                      {received(selected.message.receivedAt)} (Melbourne)
                    </dd>
                  </div>
                </dl>
                <p className="whitespace-pre-wrap text-row leading-relaxed">
                  {selected.message.textBody}
                </p>
              </Panel>
              {selected.reading.kind === "action" ? (
                <Panel title="Example extracted details">
                  <p className="mb-3 text-sub text-ink-dim">
                    A read-only preview of the details DayKeeper could use for a
                    task. These values were prepared for this demo.
                  </p>
                  {selected.reading.extraction.fields.map((field) => (
                    <FactRow
                      key={field.key}
                      line={{
                        key: field.key,
                        label: isContractFieldKey(field.key)
                          ? FIELD_LABELS[field.key]
                          : "Time",
                        value:
                          field.status !== "confirmed" || field.value === null
                            ? "Could not read this detail"
                            : field.key === "due_date"
                              ? formatDueDate(field.value, "fact")
                              : field.value,
                      }}
                    />
                  ))}
                  <p className="mt-4 border-t border-line pt-4 text-sub text-ink-dim">
                    Preview only. Creating a task and scheduling reminders will
                    be added when email integration is connected.
                  </p>
                </Panel>
              ) : (
                <Panel>
                  <h2 className="flex items-center gap-2 text-cta font-bold text-success">
                    <CheckCircle2 size={22} aria-hidden="true" /> No action
                    needed
                  </h2>
                  <p className="mt-3 text-row leading-relaxed">
                    This newsletter is an update. There is nothing to pay,
                    attend or reply to, so it would not become a task.
                  </p>
                  <p className="mt-3 text-sub text-ink-dim">
                    This result is predefined for the demo.
                  </p>
                </Panel>
              )}
            </>
          ) : (
            <Panel>
              <Mail
                className="mb-4 text-primary"
                size={32}
                aria-hidden="true"
              />
              <h2 className="text-cta font-bold">
                {email ? "Sample email not found" : "Open a sample email"}
              </h2>
              <p className="mt-2 text-row leading-relaxed">
                Choose the bill or appointment to see example extracted details.
                Open the newsletter to see how an email with no action is
                handled.
              </p>
            </Panel>
          )}
        </div>
      </div>
    </main>
  );
}

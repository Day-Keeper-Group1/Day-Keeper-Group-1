"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel, ScreenHeader } from "@/components/screen";
import type { GmailMessages, GmailStatus } from "@/lib/contract/email";
import { APP_TIME_ZONE } from "@/lib/contract/dates";
import styles from "./email-body.module.css";

async function request<T>(
  path: string,
  method = "GET",
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(`/api/email/gmail/${path}`, {
    method,
    cache: "no-store",
    signal,
  });
  const body = await response.json();
  if (!response.ok)
    throw new Error(
      body.error?.message ?? "Gmail is unavailable. Please try again.",
    );
  return body;
}

export function GmailMailbox({
  connectionFailed = false,
}: {
  connectionFailed?: boolean;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [status, setStatus] = useState<GmailStatus | null>(null);
  const [result, setResult] = useState<GmailMessages | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = result?.messages.find(
    (message) => message.providerMessageId === selectedId,
  );
  const detailHeading = useRef<HTMLHeadingElement | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reading, setReading] = useState(false);
  const [reload, setReload] = useState(0);
  const inboxRequest = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    inboxRequest.current = controller;
    async function loadInbox() {
      let connectionLoaded = false;
      try {
        const connection = await request<GmailStatus>(
          "status",
          "GET",
          controller.signal,
        );
        if (controller.signal.aborted) return;
        setStatus(connection);
        setLoading(false);
        connectionLoaded = true;
        if (connection.connected) {
          setReading(true);
          const messages = await request<GmailMessages>(
            "messages",
            "POST",
            controller.signal,
          );
          if (!controller.signal.aborted) setResult(messages);
        }
      } catch (err) {
        if (!controller.signal.aborted)
          setError(
            connectionLoaded && err instanceof Error
              ? err.message
              : "Could not load your Gmail connection. Check that you are signed in and the server is configured.",
          );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          setReading(false);
        }
      }
    }
    void loadInbox();
    return () => controller.abort();
  }, [reload]);

  async function createTask() {
    if (!selected || !status?.email || creating) return;
    setCreating(true);
    setCreateError("");
    try {
      const response = await fetch("/api/email/gmail/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId: selected.providerMessageId,
          mailbox: status.email,
        }),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(
          body.error?.message ??
            "Could not start reading this email. Please try again.",
        );
      router.push(`/documents/${body.documentId}/reading`);
    } catch (error) {
      setCreateError(
        error instanceof Error
          ? error.message
          : "Could not start reading this email. Please try again.",
      );
      setCreating(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    setError("");
    inboxRequest.current?.abort();
    setReading(false);
    try {
      await request("disconnect", "POST");
      setResult(null);
      setSelectedId(null);
      setStatus({ configured: true, connected: false, email: null });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not disconnect Gmail.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5" aria-busy={busy || loading || reading}>
      <ScreenHeader
        title="Inbox"
        subtitle="Read your recent Gmail inbox messages."
        action={
          status?.configured &&
          (status.connected ? (
            <Button
              variant="outline"
              disabled={busy || creating}
              onClick={disconnect}
            >
              {busy ? "Disconnecting..." : "Disconnect Gmail"}
            </Button>
          ) : (
            <form action="/api/email/gmail/connect" method="post">
              <Button type="submit" disabled={busy || creating}>
                Connect Gmail
              </Button>
            </form>
          ))
        }
      />
      <p className="text-sub text-ink-dim">
        Choose an email, then Create task to read its details. You can review
        them before saving.
      </p>
      {connectionFailed && !status?.connected && (
        <p role="alert" className="rounded-lg bg-warn-bg p-4 text-warn">
          Gmail could not be connected. Try again and allow read-only access. If
          this continues, check the callback address and server setup.
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-lg bg-warn-bg p-4 text-warn">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status">Loading your connection...</p>
      ) : !status ? (
        <Button
          onClick={() => {
            setLoading(true);
            setError("");
            setReload((value) => value + 1);
          }}
        >
          Try again
        </Button>
      ) : !status.configured ? (
        <p>
          Gmail setup is incomplete. Configure the server credentials and
          encryption key using the project Gmail setup guide.
        </p>
      ) : (
        <p className="break-words text-row" role="status">
          {status.connected
            ? `Connected to ${status.email}`
            : "Choose Connect Gmail to read your inbox."}
        </p>
      )}
      <p className="text-sub leading-relaxed text-ink-dim">
        Up to 20 inbox messages from the last 30 days appear automatically when
        you open this page with Gmail connected. Only emails you choose for
        Create task are saved. Attachments and HTML-only messages are not
        supported yet.
      </p>
      {reading && <p role="status">Loading your inbox...</p>}
      {result && (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(260px,1fr)_minmax(0,2fr)]">
          <Panel title="Recent inbox" className="min-w-0">
            <p role="status" className="mb-4 text-sub text-ink-dim">
              {result.messages.length} emails · Choose one to open
              {result.skipped > 0
                ? ` ${result.skipped} messages could not be displayed because their format or size is not supported.`
                : ""}
              {result.hasMore
                ? " More messages are available in Gmail; this preview shows only the first batch."
                : ""}
            </p>
            {result.messages.length === 0 && (
              <p>
                {result.skipped
                  ? "No supported plain-text messages were found in this batch."
                  : "No inbox messages were found from the last 30 days."}
              </p>
            )}
            <ul className="divide-y divide-line">
              {result.messages.map((message) => (
                <li key={message.providerMessageId}>
                  <button
                    type="button"
                    disabled={creating}
                    aria-current={
                      selectedId === message.providerMessageId
                        ? "true"
                        : undefined
                    }
                    aria-controls="email-detail"
                    onClick={() => {
                      setCreateError("");
                      setSelectedId(message.providerMessageId);
                      requestAnimationFrame(() =>
                        detailHeading.current?.focus(),
                      );
                    }}
                    className="block min-h-12 w-full cursor-pointer rounded-md border-l-4 border-transparent px-3 py-4 text-left hover:bg-primary-soft aria-[current=true]:border-primary aria-[current=true]:bg-primary-soft"
                  >
                    <span className="flex items-start gap-3">
                      <Mail
                        className="mt-1 shrink-0 text-primary"
                        size={20}
                        aria-hidden="true"
                      />
                      <span className="min-w-0">
                        <span className="block break-words text-row font-bold">
                          {message.subject || "(No subject)"}
                        </span>
                        <span className="mt-1 block break-all text-caption text-ink-dim">
                          {message.from}
                        </span>
                      </span>
                    </span>
                    <span className="mt-3 flex items-center justify-between gap-2 text-caption font-semibold text-primary">
                      <span>Open email</span>
                      <ArrowRight size={18} aria-hidden="true" />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Panel>
          <div id="email-detail" className="min-w-0 scroll-mt-6 space-y-5">
            {selected ? (
              <Panel>
                <div className="mb-5 space-y-2">
                  <Button
                    disabled={creating || busy}
                    onClick={() => void createTask()}
                  >
                    {creating ? "Starting reading..." : "Create task"}
                  </Button>
                  <p className="text-sub text-ink-dim">
                    Read the six key fields, then review before saving a task.
                  </p>
                  {createError && (
                    <p
                      role="alert"
                      className="rounded-lg bg-warn-bg p-3 text-warn"
                    >
                      {createError}
                    </p>
                  )}
                </div>
                <h2
                  ref={detailHeading}
                  tabIndex={-1}
                  className="scroll-mt-6 break-words text-title font-bold"
                >
                  {selected.subject || "(No subject)"}
                </h2>
                <dl className="my-5 space-y-2 border-b border-line pb-5 text-sub">
                  <div>
                    <dt className="inline font-semibold">From: </dt>
                    <dd className="inline break-all">{selected.from}</dd>
                  </div>
                  <div>
                    <dt className="inline font-semibold">Mailbox: </dt>
                    <dd className="inline break-all">{status?.email}</dd>
                  </div>
                  <div>
                    <dt className="inline font-semibold">Received: </dt>
                    <dd className="inline">
                      {new Intl.DateTimeFormat("en-AU", {
                        timeZone: APP_TIME_ZONE,
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      }).format(new Date(selected.receivedAt))}{" "}
                      (Melbourne)
                    </dd>
                  </div>
                </dl>
                {selected.sanitizedHtmlBody ? (
                  <div
                    className={`${styles.body} text-row leading-relaxed`}
                    // Only the server-sanitized field may be rendered as HTML.
                    dangerouslySetInnerHTML={{
                      __html: selected.sanitizedHtmlBody,
                    }}
                  />
                ) : (
                  <p className="whitespace-pre-wrap break-words text-row leading-relaxed">
                    {selected.textBody}
                  </p>
                )}
              </Panel>
            ) : (
              <Panel>
                <Mail
                  className="mb-4 text-primary"
                  size={32}
                  aria-hidden="true"
                />
                <h2 className="text-cta font-bold">
                  {result.messages.length
                    ? "Open an email"
                    : "Your inbox is empty"}
                </h2>
                <p className="mt-2 text-row leading-relaxed">
                  {result.messages.length
                    ? "Choose an email from your inbox to read it here."
                    : "Recent supported emails will appear here when you next open this page."}
                </p>
              </Panel>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

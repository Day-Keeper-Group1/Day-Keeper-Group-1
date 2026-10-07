"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/screen";
import type {
  EmailMessage,
  GmailMessages,
  GmailStatus,
} from "@/lib/contract/email";
import { APP_TIME_ZONE } from "@/lib/contract/dates";
import { EmailBody } from "./email-body";

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
  initialEmail,
}: {
  connectionFailed?: boolean;
  initialEmail?: EmailMessage & { mailbox: string };
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [status, setStatus] = useState<GmailStatus | null>(null);
  const [result, setResult] = useState<GmailMessages | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialEmail?.providerMessageId ?? null,
  );
  const selected =
    (selectedId === initialEmail?.providerMessageId
      ? initialEmail
      : undefined) ??
    result?.messages.find(
      (message) => message.providerMessageId === selectedId,
    );
  const lastOpened = useRef<HTMLButtonElement | null>(null);
  const selectedMailbox =
    selectedId === initialEmail?.providerMessageId
      ? initialEmail.mailbox
      : status?.email;
  const canCreate =
    !!status?.connected &&
    !!selectedMailbox &&
    selectedMailbox.toLowerCase() === status.email?.toLowerCase();
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
        if (connectionLoaded && !controller.signal.aborted) {
          const current = await request<GmailStatus>(
            "status",
            "GET",
            controller.signal,
          ).catch(() => null);
          if (current && !controller.signal.aborted) setStatus(current);
        }
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
    if (!selected || !status?.email || !canCreate || creating) return;
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
      const current = await request<GmailStatus>("status").catch(() => null);
      if (current) setStatus(current);
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
      setReload((value) => value + 1);
      setError(
        err instanceof Error ? err.message : "Could not disconnect Gmail.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5" aria-busy={busy || loading || reading}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="min-w-0 text-title font-bold tracking-[-0.2px] text-foreground">
          Inbox
          {status?.connected && status.email && (
            <span className="text-sub font-normal italic text-ink-dim">
              {" "}
              <br />
              Connected to <span className="break-all">{status.email}</span>
            </span>
          )}
        </h1>
        <div className="shrink-0">
          {status?.configured &&
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
            ))}
        </div>
      </div>
      <p className="text-sub text-ink-dim">
        Choose an email to read it here.
        <br />
        <strong>Create Task</strong> extracts the six key fields and opens the
        review page before you save a task.
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
      ) : !status.connected ? (
        <p className="text-row" role="status">
          Choose Connect Gmail to read your inbox.
        </p>
      ) : null}
      <p className="text-sub leading-relaxed italic text-ink-dim">
        Up to 20 inbox messages from the last 30 days appear automatically when
        you open this page with Gmail connected. Only emails you choose for
        Create Task are saved and extracted.
      </p>
      {reading && <p role="status">Loading your inbox...</p>}
      {(result || selected) && (
        <div className="min-w-0">
          {!selected && result && (
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
                      ref={(element) => {
                        if (
                          element &&
                          element.dataset.messageId ===
                            lastOpened.current?.dataset.messageId
                        )
                          lastOpened.current = element;
                      }}
                      data-message-id={message.providerMessageId}
                      disabled={creating}
                      aria-current={
                        selectedId === message.providerMessageId
                          ? "true"
                          : undefined
                      }
                      onClick={(event) => {
                        lastOpened.current = event.currentTarget;
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
          )}
          {selected && (
            <div id="email-detail" className="min-w-0 scroll-mt-6 space-y-5">
              <Button
                variant="ghost"
                className="mb-3"
                disabled={creating}
                onClick={() => {
                  setSelectedId(null);
                  setCreateError("");
                  requestAnimationFrame(() => lastOpened.current?.focus());
                }}
              >
                <ArrowLeft size={20} aria-hidden="true" /> Back to inbox
              </Button>
              <Panel>
                <div className="mb-5 space-y-2">
                  <div className="flex flex-wrap gap-3">
                    <Button
                      disabled={creating || busy || !canCreate}
                      onClick={() => void createTask()}
                    >
                      {creating ? "Starting reading..." : "Create Task"}
                    </Button>
                    {selectedMailbox && (
                      <Button
                        variant="outline"
                        nativeButton={false}
                        render={
                          <a
                            href={`https://mail.google.com/mail/?authuser=${encodeURIComponent(selectedMailbox)}#all/${encodeURIComponent(selected.providerMessageId)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Open in Gmail
                            <span className="sr-only">
                              {" "}
                              (opens in a new tab)
                            </span>
                          </a>
                        }
                      />
                    )}
                  </div>
                  <p className="text-sub text-ink-dim">
                    Review the six key fields before saving a task.
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
                    <dd className="inline break-all">{selectedMailbox}</dd>
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
                <EmailBody
                  key={selected.providerMessageId}
                  message={selected}
                />
              </Panel>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

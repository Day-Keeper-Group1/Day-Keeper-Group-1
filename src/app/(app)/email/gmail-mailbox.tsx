"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/screen";
import type { GmailMessages, GmailStatus } from "@/lib/contract/email";
import { APP_TIME_ZONE } from "@/lib/contract/dates";

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

export function GmailMailbox() {
  const [status, setStatus] = useState<GmailStatus | null>(null);
  const [result, setResult] = useState<GmailMessages | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    request<GmailStatus>("status", "GET", controller.signal)
      .then(setStatus)
      .catch(() => {
        if (!controller.signal.aborted)
          setError(
            "Could not load your Gmail connection. Check that you are signed in and the server is configured.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [reload]);

  async function checkEmail() {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      setResult(await request<GmailMessages>("messages", "POST"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not check email.");
    } finally {
      setBusy(false);
    }
  }
  async function disconnect() {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      await request("disconnect", "POST");
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
    <div className="space-y-5" aria-busy={busy || loading}>
      {error && (
        <p role="alert" className="rounded-lg bg-warn-bg p-4 text-warn">
          {error}
        </p>
      )}
      <Panel title="Gmail connection">
        {loading ? (
          <p role="status">Loading your connection…</p>
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
            encryption key using the project’s Gmail setup guide.
          </p>
        ) : (
          <>
            <p className="mb-4 break-words text-row">
              {status.connected
                ? `Connected to ${status.email}`
                : "Choose the Google account whose inbox you want to read."}
            </p>
            <div className="flex flex-wrap gap-3">
              {status.connected && (
                <Button disabled={busy} onClick={checkEmail}>
                  {busy ? "Please wait…" : "Check email"}
                </Button>
              )}
              <form action="/api/email/gmail/connect" method="post">
                <Button
                  type="submit"
                  disabled={busy}
                  variant={status.connected ? "outline" : "default"}
                >
                  {status.connected ? "Reconnect Gmail" : "Connect Gmail"}
                </Button>
              </form>
              {status.connected && (
                <Button variant="outline" disabled={busy} onClick={disconnect}>
                  Disconnect Gmail
                </Button>
              )}
            </div>
            <p className="mt-4 text-sub leading-relaxed text-ink-dim">
              Reads up to 20 inbox messages from the last 30 days when you press
              Check email. Messages are displayed here without being saved.
              Attachments and HTML-only messages are not supported yet.
            </p>
            <p className="mt-2 text-sub text-ink-dim">
              Disconnect removes DayKeeper’s stored access. You can also remove
              the Google grant in your Google account’s third-party connections.
            </p>
          </>
        )}
      </Panel>
      {result && (
        <Panel title="Recent inbox messages">
          <p role="status" className="mb-4 text-sub text-ink-dim">
            {result.messages.length} messages displayed.
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
          <div className="divide-y divide-line">
            {result.messages.map((message) => (
              <details key={message.providerMessageId} className="py-3">
                <summary className="min-h-12 cursor-pointer rounded-md py-3 text-row font-semibold">
                  {message.subject || "(No subject)"}
                  <span className="mt-1 block break-all text-caption font-normal text-ink-dim">
                    {message.from}
                  </span>
                </summary>
                <p className="mb-4 text-sub text-ink-dim">
                  Received{" "}
                  {new Intl.DateTimeFormat("en-AU", {
                    timeZone: APP_TIME_ZONE,
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(message.receivedAt))}{" "}
                  (Melbourne)
                </p>
                <p className="whitespace-pre-wrap break-words text-row leading-relaxed">
                  {message.textBody}
                </p>
              </details>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}

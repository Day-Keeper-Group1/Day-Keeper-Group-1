"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useActivity } from "@/components/layout/activity";
import { Panel, ScreenHeader } from "@/components/screen";
import { Button } from "@/components/ui/button";
import { formatDueDate, formatDueTime } from "@/lib/contract/dates";
import type { getVoiceCommitment } from "@/server/voice/records";

type Commitment = NonNullable<Awaited<ReturnType<typeof getVoiceCommitment>>>;

function timeLabel(ms: number) {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function VoiceReviewForm({
  conversationId,
  commitment,
}: {
  conversationId: string;
  commitment: Commitment;
}) {
  const router = useRouter();
  const { refresh, flash } = useActivity();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const date = commitment.dueDate
    ? formatDueDate(commitment.dueDate, "long")
    : "No date found";
  const due = commitment.dueTime
    ? `${date} at ${formatDueTime(commitment.dueTime)}`
    : date;

  async function decide(action: "confirm" | "dismiss") {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/conversations/${conversationId}/commitments/${commitment.id}/${action}`,
        { method: "POST" },
      );
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new Error(
          body?.error?.message ?? "Please try again in a moment.",
        );
      }
      flash(action === "confirm" ? "Task saved." : "Commitment dismissed.");
      await refresh();
      router.push("/dashboard");
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Please try again in a moment.",
      );
      setBusy(false);
    }
  }

  return (
    <div>
      <ScreenHeader
        title="Check this commitment"
        subtitle="A task is created only after you confirm it."
      />
      <div className="flex flex-col gap-3.5">
        <Panel title="Task to save">
          <p className="text-row font-bold">{commitment.title}</p>
          <p className="mt-2 text-sub text-ink-dim">{due}</p>
        </Panel>
        <Panel title="What was said">
          <div className="space-y-2">
            {commitment.transcript.utterances.map((line) => (
              <p
                key={line.index}
                className={
                  commitment.evidence.includes(line.index)
                    ? "rounded-md border border-primary bg-primary-soft p-3 text-row"
                    : "p-3 text-row"
                }
              >
                <span className="mr-2 text-label text-ink-dim">
                  {timeLabel(line.startMs)}
                </span>
                {line.text}
              </p>
            ))}
          </div>
        </Panel>
        {error ? (
          <p role="alert" className="text-sub text-danger">
            {error}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <Button disabled={busy} onClick={() => void decide("confirm")}>
            Confirm task
          </Button>
          <Button
            disabled={busy}
            variant="outline"
            onClick={() => void decide("dismiss")}
          >
            Dismiss
          </Button>
        </div>
      </div>
    </div>
  );
}

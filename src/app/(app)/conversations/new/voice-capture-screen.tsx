"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { FileAudio, Mic, Square } from "lucide-react";
import { useActivity } from "@/components/layout/activity";
import { Panel, ScreenHeader } from "@/components/screen";
import { Button } from "@/components/ui/button";
import { transcribeAudio } from "@/lib/voice/transcribe";
import type { ConversationTranscript } from "@/lib/contract/voice";

function timeLabel(ms: number) {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

type Phase =
  "idle" | "recording" | "transcribing" | "extracting" | "ready" | "failed";
type ConversationView = {
  id: string;
  status: "queued" | "processing" | "ready" | "failed";
  commitments?: Array<{ status: "needs-review" | "confirmed" | "dismissed" }>;
  message?: string;
};

export function VoiceCaptureScreen() {
  const { refresh } = useActivity();
  const picker = useRef<HTMLInputElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const stopTimer = useRef<number | null>(null);
  const discardRecording = useRef(false);
  const started = useRef(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<ConversationTranscript | null>(
    null,
  );
  const [conversation, setConversation] = useState<ConversationView | null>(
    null,
  );

  const inspect = useCallback(
    async (id: string) => {
      const response = await fetch(`/api/conversations/${id}`, {
        cache: "no-store",
      });
      if (!response.ok)
        throw new Error("This conversation could not be loaded.");
      const result = (await response.json()) as ConversationView;
      setConversation(result);
      if (result.status === "ready") {
        setPhase("ready");
        setStatus("");
        await refresh();
      } else if (result.status === "failed") {
        setPhase("failed");
        setStatus("");
      } else {
        setPhase("extracting");
        setStatus("Finding commitments…");
      }
    },
    [refresh],
  );

  useEffect(() => {
    let live = true;
    void fetch("/api/conversations", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : []))
      .then((rows: Array<{ id: string }>) => {
        if (live && !started.current && rows[0]) void inspect(rows[0].id);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [inspect]);

  useEffect(() => {
    if (phase !== "extracting" || !conversation?.id) return;
    const timer = window.setInterval(
      () =>
        void inspect(conversation.id).catch(() =>
          setError("Connection lost. Reopen Voice to check the result."),
        ),
      3000,
    );
    return () => window.clearInterval(timer);
  }, [conversation?.id, inspect, phase]);

  useEffect(
    () => () => {
      if (stopTimer.current !== null) window.clearTimeout(stopTimer.current);
      discardRecording.current = true;
      if (recorder.current?.state === "recording") recorder.current.stop();
      stream.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  async function processFile(file: File) {
    started.current = true;
    setError(null);
    setTranscript(null);
    setPhase("transcribing");
    try {
      const result = await transcribeAudio(file, setStatus);
      setTranscript(result.transcript);
      setStatus("Saving transcript…");
      const response = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientSubmissionId: crypto.randomUUID(),
          ...result,
        }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new Error(
          body?.error?.message ?? "This transcript could not be saved.",
        );
      }
      const saved = (await response.json()) as ConversationView;
      setConversation(saved);
      setPhase("extracting");
      setStatus("Finding commitments…");
      await refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "This recording could not be processed.",
      );
      setPhase("failed");
      setStatus("");
    }
  }

  async function startRecording() {
    started.current = true;
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      started.current = false;
      setError(
        "Recording is unavailable in this browser. Choose an audio file instead.",
      );
      return;
    }
    try {
      const acquired = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      stream.current = acquired;
      const mimeType = ["audio/webm", "audio/mp4"].find((type) =>
        MediaRecorder.isTypeSupported(type),
      );
      const active = new MediaRecorder(
        acquired,
        mimeType ? { mimeType } : undefined,
      );
      recorder.current = active;
      discardRecording.current = false;
      const chunks: Blob[] = [];
      active.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      active.onstop = () => {
        if (stopTimer.current !== null) window.clearTimeout(stopTimer.current);
        acquired.getTracks().forEach((track) => track.stop());
        stream.current = null;
        recorder.current = null;
        if (discardRecording.current) return;
        const type = active.mimeType || mimeType || "audio/webm";
        const extension = type.includes("mp4") ? "m4a" : "webm";
        void processFile(new File(chunks, `recording.${extension}`, { type }));
      };
      active.start();
      setPhase("recording");
      setStatus("Recording… up to 45 seconds");
      // Leave room for the final encoded frame inside the 45-second file limit.
      stopTimer.current = window.setTimeout(() => {
        if (active.state === "recording") active.stop();
      }, 44_500);
    } catch {
      started.current = false;
      stream.current?.getTracks().forEach((track) => track.stop());
      setError(
        "Microphone access was not available. You can choose an audio file.",
      );
      setPhase("idle");
    }
  }

  function stopRecording(discard = false) {
    discardRecording.current = discard;
    if (recorder.current?.state === "recording") recorder.current.stop();
    if (discard) {
      setPhase("idle");
      setStatus("");
    }
  }

  function reset() {
    setConversation(null);
    setTranscript(null);
    setError(null);
    setStatus("");
    setPhase("idle");
  }

  const remaining =
    conversation?.commitments?.filter((item) => item.status === "needs-review")
      .length ?? 0;

  return (
    <div>
      <ScreenHeader
        title="Voice"
        subtitle="Turn a short conversation into tasks you can check."
      />
      <Panel>
        {phase === "idle" ? (
          <div className="flex flex-col gap-3">
            <p className="text-row">
              Use a recording up to 45 seconds long. Audio stays on this device.
            </p>
            <Button size="block" onClick={() => void startRecording()}>
              <Mic aria-hidden="true" /> Start recording
            </Button>
            <Button
              size="block"
              variant="outline"
              onClick={() => picker.current?.click()}
            >
              <FileAudio aria-hidden="true" /> Upload audio
            </Button>
            <input
              ref={picker}
              type="file"
              accept="audio/mpeg,audio/mp4,audio/wav,audio/webm,.mp3,.m4a,.wav,.webm"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void processFile(file);
                event.target.value = "";
              }}
            />
          </div>
        ) : null}
        {phase === "recording" ? (
          <div className="flex flex-col gap-3">
            <p role="status" className="text-row">
              {status}
            </p>
            <Button size="block" onClick={() => stopRecording()}>
              <Square aria-hidden="true" /> Stop recording
            </Button>
            <Button
              size="block"
              variant="outline"
              onClick={() => stopRecording(true)}
            >
              Back
            </Button>
          </div>
        ) : null}
        {phase === "transcribing" || phase === "extracting" ? (
          <div className="py-6">
            <p role="status" className="text-row">
              <span
                className="mr-3 inline-block size-5 animate-spin rounded-full border-2 border-primary border-t-transparent"
                aria-hidden="true"
              />
              {status}
              {phase === "transcribing"
                ? " Please keep this page open."
                : " You may leave this page."}
            </p>
          </div>
        ) : null}
        {phase === "ready" ? (
          <div className="flex flex-col gap-3">
            <p className="text-row">
              {remaining > 0
                ? `${remaining} commitment${remaining === 1 ? "" : "s"} ready to check.`
                : "No clear commitments to check."}
            </p>
            {remaining > 0 ? (
              <Button
                size="block"
                nativeButton={false}
                render={<Link href="/dashboard">Go to To check</Link>}
              />
            ) : null}
            <Button size="block" variant="outline" onClick={reset}>
              Start another
            </Button>
          </div>
        ) : null}
        {phase === "failed" ? (
          <div className="flex flex-col gap-3">
            <p role="alert" className="text-row text-danger">
              {error ??
                conversation?.message ??
                "We could not find commitments this time."}
            </p>
            <Button size="block" onClick={reset}>
              Start again
            </Button>
          </div>
        ) : null}
        {error && phase === "idle" ? (
          <p role="alert" className="mt-3 text-sub text-danger">
            {error}
          </p>
        ) : null}
        {transcript &&
        (phase === "transcribing" ||
          phase === "extracting" ||
          phase === "ready") ? (
          <section aria-labelledby="transcript-heading" className="mt-6">
            <h2 id="transcript-heading" className="text-row font-semibold">
              Transcript
            </h2>
            <div className="mt-3 max-h-80 overflow-y-auto rounded-md border border-border p-4">
              {transcript.utterances.map((line) => (
                <p key={line.index} className="mb-3 text-row last:mb-0">
                  <span className="mr-2 text-label text-ink-dim">
                    {timeLabel(line.startMs)}
                  </span>
                  {line.text}
                </p>
              ))}
            </div>
          </section>
        ) : null}
      </Panel>
    </div>
  );
}

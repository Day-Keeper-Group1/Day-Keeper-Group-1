"use client";

import { useEffect, useRef, useState } from "react";
import {
  FileAudio,
  MessageSquareText,
  Quote,
  TriangleAlert,
} from "lucide-react";
import { Panel, ScreenHeader } from "@/components/screen";
import { Button } from "@/components/ui/button";
import type {
  ConversationTranscript,
  CommitmentExtraction,
} from "@/lib/contract/voice";
import {
  voiceExtractionResponseSchema,
  type VoiceExtractionResponse,
} from "@/lib/contract/voice";
import { cn } from "@/lib/utils";
import { audioDurationIssue, audioFileIssue } from "@/lib/voice/audio";

function timestamp(ms: number) {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function dateLabel(value: string | null) {
  if (!value) return "No date found";
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

type Scenario = {
  id: string;
  label: string;
  transcript: ConversationTranscript;
  expected: CommitmentExtraction | null;
};

function CommitmentList({
  extraction,
  source,
  selected,
  onSelect,
}: {
  extraction: CommitmentExtraction;
  source: "expected" | "returned";
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  if (extraction.commitments.length === 0) {
    return <p className="py-6 text-row">No commitments found.</p>;
  }
  return (
    <>
      <p className="mb-3 text-sub text-ink-dim">
        {extraction.commitments.length} commitment
        {extraction.commitments.length === 1 ? "" : "s"}. Select one to
        highlight its supporting words.
      </p>
      <ul className="space-y-3">
        {extraction.commitments.map((item) => {
          const key = `${source}:${item.id}`;
          return (
            <li key={item.id}>
              <button
                type="button"
                aria-pressed={selected === key}
                aria-controls={item.evidence
                  .map((index) => `utterance-${index}`)
                  .join(" ")}
                onClick={() => onSelect(key)}
                className={cn(
                  "w-full rounded-lg border-2 p-4 text-left",
                  selected === key
                    ? "border-primary bg-primary-soft"
                    : "border-line bg-card hover:bg-background",
                )}
              >
                <span className="block text-row font-bold">{item.title}</span>
                {item.status === "uncertain" && (
                  <span className="mt-2 flex items-center gap-2 rounded-md bg-warn-bg px-3 py-2 text-caption font-bold text-warn">
                    <TriangleAlert className="size-4" aria-hidden="true" />
                    Needs checking: the conversation is unclear
                  </span>
                )}
                <span className="mt-2 block text-sub text-ink-dim">
                  {dateLabel(item.dueDate)}
                  {item.dueTime ? ` at ${item.dueTime}` : ""}
                </span>
                <span className="mt-3 flex items-center gap-2 text-caption font-bold text-primary">
                  <Quote className="size-4" aria-hidden="true" />
                  {selected === key
                    ? "Evidence highlighted"
                    : "Show supporting words"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}

export function ConversationScreen({ scenarios }: { scenarios: Scenario[] }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedAudio, setSelectedAudio] = useState<{
    file: File;
    url: string;
    ready: boolean;
  } | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [scenarioId, setScenarioId] = useState(scenarios[0].id);
  const { transcript, expected } =
    scenarios.find((item) => item.id === scenarioId) ?? scenarios[0];
  const [showResults, setShowResults] = useState(false);
  const [returned, setReturned] = useState<VoiceExtractionResponse | null>(
    null,
  );
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const requestRef = useRef<AbortController | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = selectedId?.startsWith("expected:")
    ? expected?.commitments.find((item) => `expected:${item.id}` === selectedId)
    : returned?.extraction.commitments.find(
        (item) => `returned:${item.id}` === selectedId,
      );

  useEffect(() => {
    const url = selectedAudio?.url;
    if (!url) return;
    return () => URL.revokeObjectURL(url);
  }, [selectedAudio?.url]);

  useEffect(() => () => requestRef.current?.abort(), []);

  async function extract() {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setShowResults(true);
    setReturned(null);
    setExtractionError(null);
    setSelectedId(null);
    setLoading(true);
    try {
      const response = await fetch("/api/conversations/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioId }),
        signal: controller.signal,
      });
      const body: unknown = await response.json();
      if (!response.ok) {
        const message = (body as { error?: { message?: string } })?.error
          ?.message;
        throw new Error(
          message ?? "We could not extract commitments. Please try again.",
        );
      }
      if (!controller.signal.aborted) {
        setReturned(voiceExtractionResponseSchema.parse(body));
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        setExtractionError(
          error instanceof Error
            ? error.message
            : "We could not extract commitments. Please try again.",
        );
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  function chooseAudio(file: File | undefined) {
    if (!file) return;
    // Allow selecting the same file again after removing or replacing it.
    if (fileInputRef.current) fileInputRef.current.value = "";
    const issue = audioFileIssue(file);
    if (issue) {
      setAudioError(issue);
      return;
    }
    setAudioError(null);
    setSelectedAudio({ file, url: URL.createObjectURL(file), ready: false });
  }

  function removeAudio() {
    setSelectedAudio(null);
    setAudioError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function finishAudioCheck(url: string, seconds: number) {
    if (selectedAudio?.url !== url) return;
    const issue = audioDurationIssue(seconds);
    if (issue) {
      setAudioError(issue);
      setSelectedAudio(null);
      return;
    }
    setSelectedAudio((current) =>
      current?.url === url ? { ...current, ready: true } : current,
    );
  }

  return (
    <div>
      <ScreenHeader
        title="Review a conversation"
        subtitle="See what was promised, and the words it came from."
      />
      <div className="mb-5 rounded-[8px] border-2 border-line bg-primary-soft p-4">
        <p className="text-row font-bold">Conversation demo</p>
        <p className="mt-1 text-sub text-ink-dim">
          {expected
            ? "Compare a reviewed expected result with a fresh extraction from a fictional transcript."
            : "This longer fictional conversation has no prepared answer. See what Azure finds live; results may vary between runs."}{" "}
          Audio stays on this device; nothing is saved.
        </p>
      </div>
      <Panel title="Audio recording" className="mb-5">
        <div className="flex flex-col items-center rounded-lg border-2 border-dashed border-line bg-background px-4 py-6 text-center">
          <FileAudio className="mb-3 size-8 text-primary" aria-hidden="true" />
          <p className="text-row font-bold">Add a conversation recording</p>
          <p className="mt-1 text-caption text-ink-dim">
            MP3, M4A, WAV or WebM. Up to 50 MiB and 30 minutes.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".mp3,.m4a,.wav,.webm,audio/mpeg,audio/mp4,audio/wav,audio/webm"
            aria-label="Choose a conversation recording"
            className="sr-only"
            onChange={(event) => chooseAudio(event.target.files?.[0])}
          />
          <Button
            type="button"
            className="mt-4"
            onClick={() => fileInputRef.current?.click()}
          >
            {selectedAudio ? "Replace audio file" : "Choose audio file"}
          </Button>
          {audioError && (
            <p role="alert" className="mt-3 text-sub text-danger">
              {audioError}
            </p>
          )}
          {selectedAudio && (
            <div className="mt-5 w-full max-w-xl text-left">
              <p className="text-row font-bold break-all">
                {selectedAudio.file.name}
              </p>
              {!selectedAudio.ready && (
                <p role="status" className="mt-2 text-sub text-ink-dim">
                  Checking recording length…
                </p>
              )}
              <audio
                key={selectedAudio.url}
                controls
                preload="metadata"
                src={selectedAudio.url}
                className={cn("mt-3 w-full", !selectedAudio.ready && "hidden")}
                aria-label={`Play ${selectedAudio.file.name}`}
                onLoadedMetadata={(event) =>
                  finishAudioCheck(
                    selectedAudio.url,
                    event.currentTarget.duration,
                  )
                }
                onError={() => finishAudioCheck(selectedAudio.url, Number.NaN)}
              />
              <Button
                type="button"
                variant="outline"
                className="mt-3"
                onClick={removeAudio}
              >
                Remove audio
              </Button>
            </div>
          )}
          <p className="mt-3 text-sub text-ink-dim">
            Playback stays on this device. The transcript below is a separate
            prepared example.
          </p>
        </div>
      </Panel>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <label
            htmlFor="voice-scenario"
            className="mb-2 block text-row font-bold"
          >
            Example conversation
          </label>
          <select
            id="voice-scenario"
            value={scenarioId}
            onChange={(event) => {
              requestRef.current?.abort();
              setScenarioId(event.target.value);
              setShowResults(false);
              setReturned(null);
              setExtractionError(null);
              setLoading(false);
              setSelectedId(null);
            }}
            className="mb-2 min-h-12 w-full rounded-lg border-2 border-line bg-card px-3 text-row"
          >
            {scenarios.map((scenario) => (
              <option key={scenario.id} value={scenario.id}>
                {scenario.label}
              </option>
            ))}
          </select>
          <p className="text-sub text-ink-dim">
            {new Set(transcript.utterances.map((line) => line.speaker)).size}{" "}
            speakers · {transcript.utterances.length} transcript lines
          </p>
        </div>
        <Button onClick={extract} disabled={loading}>
          {loading
            ? "Extracting…"
            : showResults
              ? "Run extraction again"
              : expected
                ? "Extract commitments"
                : "Ask Azure to extract"}
        </Button>
      </div>
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Panel title="Conversation transcript">
          <ol className="space-y-3">
            {transcript.utterances.map((line) => {
              const highlighted =
                showResults && selected?.evidence.includes(line.index);
              return (
                <li
                  key={line.index}
                  id={`utterance-${line.index}`}
                  className={cn(
                    "rounded-lg border-2 p-3",
                    highlighted
                      ? "border-primary bg-primary-soft"
                      : "border-transparent bg-background",
                  )}
                >
                  <p className="mb-1 flex flex-wrap items-center gap-x-3 text-caption font-bold text-ink-dim">
                    <span>{line.speaker}</span>
                    <span>
                      {timestamp(line.startMs)}–{timestamp(line.endMs)}
                    </span>
                    <span>Line {line.index + 1}</span>
                  </p>
                  <p className="text-row leading-relaxed">{line.text}</p>
                  {highlighted && (
                    <p className="mt-2 flex items-center gap-2 text-caption font-bold text-primary">
                      <Quote className="size-4" aria-hidden="true" />
                      Supporting words
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        </Panel>
        <Panel title={expected ? "Commitment comparison" : "Azure extraction"}>
          <div aria-live="polite">
            {!showResults ? (
              <div className="py-8 text-center">
                <MessageSquareText
                  className="mx-auto mb-3 size-8 text-primary"
                  aria-hidden="true"
                />
                <p className="text-row font-bold">Ready to review</p>
                <p className="mt-2 text-sub text-ink-dim">
                  {expected
                    ? "Choose “Extract commitments” to compare expected and returned results."
                    : "Choose “Ask Azure to extract” to see what it finds. There is no prepared answer for this example."}
                </p>
              </div>
            ) : (
              <div className={cn("grid gap-4", expected && "xl:grid-cols-2")}>
                {expected && (
                  <section aria-label="Expected extraction">
                    <h3 className="mb-1 text-row font-bold">Expected</h3>
                    <p className="mb-4 text-caption text-ink-dim">
                      Reviewed fixture answer
                    </p>
                    <CommitmentList
                      extraction={expected}
                      source="expected"
                      selected={selectedId}
                      onSelect={(id) =>
                        setSelectedId(selectedId === id ? null : id)
                      }
                    />
                  </section>
                )}
                <section
                  aria-label="Returned extraction"
                  className={cn(
                    expected &&
                      "border-t border-line pt-4 xl:border-l xl:border-t-0 xl:pl-4 xl:pt-0",
                  )}
                >
                  <h3 className="mb-1 text-row font-bold">
                    {expected ? "Returned" : "What Azure found"}
                  </h3>
                  {loading && (
                    <p role="status" className="text-sub text-ink-dim">
                      Extracting commitments…
                    </p>
                  )}
                  {extractionError && (
                    <p role="alert" className="text-sub text-danger">
                      {extractionError}
                    </p>
                  )}
                  {returned && (
                    <>
                      <p className="mb-4 text-caption text-ink-dim">
                        {returned.provider === "azure"
                          ? `Azure · ${returned.model ?? "model"}`
                          : "Mock provider"}{" "}
                        · {returned.seconds.toFixed(1)}s
                      </p>
                      <CommitmentList
                        extraction={returned.extraction}
                        source="returned"
                        selected={selectedId}
                        onSelect={(id) =>
                          setSelectedId(selectedId === id ? null : id)
                        }
                      />
                    </>
                  )}
                </section>
              </div>
            )}
          </div>
          <p className="mt-5 border-t border-line pt-3 text-caption text-ink-dim">
            For review only. These results do not create tasks or reminders.
          </p>
        </Panel>
      </div>
    </div>
  );
}

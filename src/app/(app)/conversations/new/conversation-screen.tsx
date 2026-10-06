"use client";

import { useEffect, useRef, useState } from "react";
import { FileAudio, MessageSquareText, Quote } from "lucide-react";
import { Panel, ScreenHeader } from "@/components/screen";
import { Button } from "@/components/ui/button";
import type {
  ConversationTranscript,
  CommitmentExtraction,
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
  extraction: CommitmentExtraction;
};

export function ConversationScreen({ scenarios }: { scenarios: Scenario[] }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedAudio, setSelectedAudio] = useState<{
    file: File;
    url: string;
    ready: boolean;
  } | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [scenarioId, setScenarioId] = useState(scenarios[0].id);
  const { transcript, extraction } =
    scenarios.find((item) => item.id === scenarioId) ?? scenarios[0];
  const [showResults, setShowResults] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = extraction.commitments.find(
    (item) => item.id === selectedId,
  );

  useEffect(() => {
    const url = selectedAudio?.url;
    if (!url) return;
    return () => URL.revokeObjectURL(url);
  }, [selectedAudio?.url]);

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
          This fictional conversation uses a prepared transcript and mock
          results. Nothing is recorded, uploaded or saved.
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
              setScenarioId(event.target.value);
              setShowResults(false);
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
        <Button
          onClick={() => {
            setShowResults(!showResults);
            setSelectedId(null);
          }}
        >
          {showResults ? "Reset demo" : "Show mock commitments"}
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
        <Panel title="Proposed commitments">
          <div aria-live="polite">
            {!showResults ? (
              <div className="py-8 text-center">
                <MessageSquareText
                  className="mx-auto mb-3 size-8 text-primary"
                  aria-hidden="true"
                />
                <p className="text-row font-bold">Ready to review</p>
                <p className="mt-2 text-sub text-ink-dim">
                  Choose “Show mock commitments” to see the example results.
                </p>
              </div>
            ) : extraction.commitments.length === 0 ? (
              <p className="py-8 text-row">No commitments found.</p>
            ) : (
              <>
                <p className="mb-4 text-sub text-ink-dim">
                  {extraction.commitments.length} commitments. Select one to
                  highlight its supporting words.
                </p>
                <ul className="space-y-3">
                  {extraction.commitments.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        aria-pressed={selectedId === item.id}
                        aria-controls={item.evidence
                          .map((index) => `utterance-${index}`)
                          .join(" ")}
                        onClick={() =>
                          setSelectedId(selectedId === item.id ? null : item.id)
                        }
                        className={cn(
                          "w-full rounded-lg border-2 p-4 text-left",
                          selectedId === item.id
                            ? "border-primary bg-primary-soft"
                            : "border-line bg-card hover:bg-background",
                        )}
                      >
                        <span className="block text-row font-bold">
                          {item.title}
                        </span>
                        <span className="mt-2 block text-sub text-ink-dim">
                          {dateLabel(item.dueDate)}
                          {item.dueTime ? ` at ${item.dueTime}` : ""}
                        </span>
                        <span className="mt-3 flex items-center gap-2 text-caption font-bold text-primary">
                          <Quote className="size-4" aria-hidden="true" />
                          {selectedId === item.id
                            ? "Evidence highlighted"
                            : "Show supporting words"}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
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

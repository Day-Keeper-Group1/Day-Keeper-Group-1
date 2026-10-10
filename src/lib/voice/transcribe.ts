/** Browser-only, post-recording speech recognition. Audio never leaves the device. */
import {
  MAX_VOICE_DURATION_MS,
  VOICE_CONTRACT_VERSION,
  type ConversationTranscript,
} from "@/lib/contract/voice";
import type { AutomaticSpeechRecognitionPipelineType } from "@huggingface/transformers";

const MODEL_ID = "onnx-community/whisper-tiny.en";
let transcriberPromise: Promise<AutomaticSpeechRecognitionPipelineType> | null =
  null;

async function model() {
  if (!transcriberPromise) {
    transcriberPromise = import("@huggingface/transformers").then(
      ({ pipeline }) => {
        const createAsr = pipeline as unknown as (
          task: "automatic-speech-recognition",
          model: string,
          options: { device: "wasm" },
        ) => Promise<AutomaticSpeechRecognitionPipelineType>;
        return createAsr("automatic-speech-recognition", MODEL_ID, {
          device: "wasm",
        });
      },
    );
  }
  try {
    return await transcriberPromise;
  } catch (error) {
    transcriberPromise = null;
    throw error;
  }
}

export type BrowserTranscript = {
  transcript: ConversationTranscript;
  durationMs: number;
};

export async function transcribeAudio(
  file: File,
  onStage: (stage: string) => void,
): Promise<BrowserTranscript> {
  if (file.size === 0 || file.size > 10 * 1024 * 1024) {
    throw new Error("Choose an audio file smaller than 10 MiB.");
  }
  onStage("Reading audio…");
  const context = new AudioContext({ sampleRate: 16_000 });
  let audio: Float32Array;
  let durationMs: number;
  try {
    const buffer = await context.decodeAudioData(await file.arrayBuffer());
    durationMs = Math.round(buffer.duration * 1000);
    if (durationMs < 1 || durationMs > MAX_VOICE_DURATION_MS) {
      throw new Error("Choose a recording up to 45 seconds long.");
    }
    if (buffer.sampleRate !== 16_000) {
      throw new Error("This browser could not prepare the recording.");
    }
    audio = new Float32Array(buffer.length);
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const samples = buffer.getChannelData(channel);
      for (let i = 0; i < samples.length; i++) {
        audio[i] += samples[i] / buffer.numberOfChannels;
      }
    }
  } finally {
    await context.close();
  }

  onStage("Loading speech model…");
  const transcriber = await model();
  onStage("Transcribing on this device…");
  const output = await transcriber(audio, {
    return_timestamps: true,
    chunk_length_s: 30,
    stride_length_s: 5,
  });
  const result = Array.isArray(output) ? output[0] : output;
  const utterances = (result.chunks ?? [])
    .map((chunk) => ({
      text: chunk.text.trim(),
      startMs: Math.max(0, Math.round(chunk.timestamp[0] * 1000)),
      endMs: Math.min(durationMs, Math.round(chunk.timestamp[1] * 1000)),
    }))
    .filter((line) => line.text && line.endMs > line.startMs)
    .map((line, index) => ({ index, speaker: "Speaker 1", ...line }));
  if (utterances.length === 0) {
    throw new Error("No speech could be transcribed from this recording.");
  }
  return {
    transcript: { version: VOICE_CONTRACT_VERSION, utterances },
    durationMs,
  };
}

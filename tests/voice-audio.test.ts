import { describe, expect, it } from "vitest";
import {
  audioDurationIssue,
  audioFileIssue,
  MAX_VOICE_AUDIO_BYTES,
  MAX_VOICE_AUDIO_SECONDS,
} from "@/lib/voice/audio";

const file = (name: string, size: number, type: string) => ({
  name,
  size,
  type,
});

describe("local voice recording checks", () => {
  it.each([
    ["call.mp3", "audio/mpeg"],
    ["call.m4a", "audio/mp4"],
    ["call.wav", "audio/wav"],
    ["call.webm", "audio/webm"],
  ])("accepts %s", (name, type) => {
    expect(audioFileIssue(file(name, MAX_VOICE_AUDIO_BYTES, type))).toBeNull();
  });

  it("handles missing browser MIME data but rejects a mismatched MIME type", () => {
    expect(audioFileIssue(file("call.MP3", 100, ""))).toBeNull();
    expect(audioFileIssue(file("call.mp3", 100, "audio/wav"))).toMatch(
      /MP3, M4A, WAV or WebM/,
    );
  });

  it("rejects unsupported, empty and oversized files", () => {
    expect(audioFileIssue(file("call.txt", 100, "text/plain"))).toMatch(
      /MP3, M4A, WAV or WebM/,
    );
    expect(audioFileIssue(file("call.mp3", 0, "audio/mpeg"))).toMatch(/empty/);
    expect(
      audioFileIssue(file("call.mp3", MAX_VOICE_AUDIO_BYTES + 1, "audio/mpeg")),
    ).toMatch(/50 MiB/);
  });

  it("accepts exactly 30 minutes and rejects longer or unreadable audio", () => {
    expect(audioDurationIssue(MAX_VOICE_AUDIO_SECONDS)).toBeNull();
    expect(audioDurationIssue(MAX_VOICE_AUDIO_SECONDS + 1)).toMatch(
      /30 minutes/,
    );
    expect(audioDurationIssue(Number.NaN)).toMatch(/could not read/);
    expect(audioDurationIssue(0)).toMatch(/could not read/);
  });
});

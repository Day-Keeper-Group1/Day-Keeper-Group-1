/** Checks for recordings selected for local playback in the voice prototype. */

export const MAX_VOICE_AUDIO_BYTES = 50 * 1024 * 1024;
export const MAX_VOICE_AUDIO_SECONDS = 30 * 60;

const allowedTypes: Record<string, readonly string[]> = {
  mp3: ["audio/mpeg", "audio/mp3"],
  m4a: ["audio/mp4", "audio/x-m4a"],
  wav: ["audio/wav", "audio/x-wav", "audio/wave"],
  webm: ["audio/webm", "video/webm"],
};

/** The picker filter is only a hint; users can still select unsupported files. */
export function audioFileIssue(file: Pick<File, "name" | "size" | "type">) {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const types = allowedTypes[extension];
  const mimeType = file.type.toLowerCase().split(";")[0].trim();

  if (
    !types ||
    (mimeType &&
      mimeType !== "application/octet-stream" &&
      !types.includes(mimeType))
  ) {
    return "Choose an MP3, M4A, WAV or WebM audio file.";
  }
  if (file.size === 0) return "This audio file is empty. Choose another file.";
  if (file.size > MAX_VOICE_AUDIO_BYTES) {
    return "This audio file is over 50 MiB. Choose a smaller file.";
  }
  return null;
}

export function audioDurationIssue(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "We could not read this recording. Choose another audio file.";
  }
  if (seconds > MAX_VOICE_AUDIO_SECONDS) {
    return "This recording is over 30 minutes. Choose a shorter file.";
  }
  return null;
}

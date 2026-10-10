"use client";

import dynamic from "next/dynamic";

// Speech recognition runs only in the browser; keep its native dependencies
// out of the server function package.
const VoiceCaptureScreen = dynamic(
  () =>
    import("./voice-capture-screen").then(
      (module) => module.VoiceCaptureScreen,
    ),
  { ssr: false },
);

export default function NewConversationPage() {
  return <VoiceCaptureScreen />;
}

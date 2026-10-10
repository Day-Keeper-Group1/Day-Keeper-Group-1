import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The floating Next.js badge sits over the bottom navigation on a phone
  // width and hides the Home label. Build errors still show as an overlay.
  devIndicators: false,
  // Both the fixture endpoint and the saved-conversation handler read this
  // prompt at runtime. Include it in each deployed app function's trace.
  outputFileTracingIncludes: {
    "/api/conversations": ["./src/server/voice/prompt.md"],
    "/api/conversations/extract": ["./src/server/voice/prompt.md"],
  },
};

export default nextConfig;

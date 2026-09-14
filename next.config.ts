import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The floating Next.js badge sits over the bottom navigation on a phone
  // width and hides the Home label. Build errors still show as an overlay.
  devIndicators: false,
};

export default nextConfig;

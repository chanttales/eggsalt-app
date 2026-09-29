import type { NextConfig } from "next";

// Static export only: the same build is served by GitHub Pages and bundled into Capacitor.
// NEXT_PUBLIC_BASE_PATH is "/eggsalt-app" on GitHub Pages and empty for Capacitor/local.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || undefined;

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  basePath,
  images: { unoptimized: true },
};

export default nextConfig;

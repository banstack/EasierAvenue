import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.streeteasy.com",
      },
      {
        protocol: "https",
        hostname: "streeteasy.com",
      },
    ],
  },
  // Prevent better-sqlite3 (native module) from being bundled client-side
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
